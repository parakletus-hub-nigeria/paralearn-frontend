import { createAsyncThunk } from "@reduxjs/toolkit";
import apiClient, { setAuthToken, removeAuthToken } from "@/lib/api";
import { tokenManager } from "@/lib/tokenManager";
import { routespath } from "@/lib/routepath";
import {
  getSubdomain,
  saveSubdomainToStorage,
  extractSubdomainFromURL,
  getSubdomainFromStorage,
} from "@/lib/subdomainManager";
import { RESET_STORE } from "@/reduxToolKit/constants";
import { fetchCurrentSession } from "@/reduxToolKit/setUp/setUpThunk";
import {
  normalizeRoles,
  pickRedirectPath,
  extractTokenAndUser,
  extractSubdomainFromUser,
} from "./userUtils";
/** Strips internal stack traces, Prisma details, and file paths from error messages. */
function sanitizeErrorMessage(msg: string): string {
  const lower = msg.toLowerCase();
  if (
    lower.includes("prisma") ||
    lower.includes("database") ||
    lower.includes("invocation") ||
    lower.includes("c:\\") ||
    lower.includes("/usr/") ||
    lower.includes(".ts:") ||
    lower.includes("stack trace") ||
    lower.includes("internal server error")
  ) {
    return "A server error occurred. Please try again later.";
  }
  return msg;
}

// Log in the user and save the token
export const loginUser = createAsyncThunk(
  "user/login",
  async (
    credentials: {
      email: string;
      password: string;
      skipSessionCheck?: boolean;
      redirectTo?: string;
      institutionType?: "k12" | "university";
      universityId?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      const type = credentials.institutionType || "k12";
      const basePath = type === "university" ? "/api/uni-proxy" : "/api/proxy";

      const loginBody: Record<string, any> = {
        email: credentials.email,
        password: credentials.password,
      };
      // University login requires universityId in the body (API guide §5)
      if (type === "university" && credentials.universityId) {
        loginBody.universityId = credentials.universityId;
      }

      const response = await apiClient.post(
        `${basePath}${routespath.API_LOGIN}`,
        loginBody,
      );

      const { token: tokenFromResponse, user: userFromResponse } =
        extractTokenAndUser(response.data);


      // Try to get token from response first, then from cookies (set by backend)
      let accessToken = tokenFromResponse || tokenManager.getToken();

      // If still no token, wait a bit for cookie to be set (backend might set it as httpOnly cookie)
      if (!accessToken) {
        // Small delay to allow backend to set cookie
        await new Promise((resolve) => setTimeout(resolve, 100));
        accessToken = tokenManager.getToken();
      }
      if (!accessToken) {
        return rejectWithValue("No token received from server");
      }

      // Store token in cookies and sync with Redux
      if (!tokenManager.getToken()) {
        await setAuthToken(accessToken);
      } else {
        // Still sync with Redux even if token exists in cookies
        await setAuthToken(accessToken);
      }

      // Extract roles using the enhanced normalization logic
      console.log(
        "[Login Debug] Normalizing roles from user.roles:",
        userFromResponse?.roles,
      );
      let roles = normalizeRoles(userFromResponse?.roles);

      if (roles.length === 0 && userFromResponse) {
        console.log(
          "[Login Debug] Roles still empty, attempting to normalize from user object",
        );
        roles = normalizeRoles(userFromResponse);
      }

      // Failover to entire response data if user object didn't have roles
      if (roles.length === 0) {
        console.log(
          "[Login Debug] Roles still empty, attempting to normalize from full response",
        );
        roles = normalizeRoles(response.data);
      }

      console.log("[Login Debug] Final Extracted Roles:", roles);

      const mustChangePassword = !!response.data?.mustChangePassword;

      // ── UNIVERSITY LOGIN PATH ────────────────────────────────────────────────
      if (type === "university") {
        const universityId =
          userFromResponse?.universityId ||
          response.data?.user?.universityId ||
          response.data?.universityId ||
          null;

        // Fetch /auth/me to get the university subdomain (not in login response).
        // The JWT (already set via setAuthToken above) encodes universityId so the
        // server can resolve the tenant without an explicit X-University-Id header.
        // We still pass it as a header if available for servers that require it.
        let uniSubdomain: string | null = null;
        try {
          const meHeaders: Record<string, string> = {};
          if (universityId) meHeaders["X-University-Id"] = universityId;
          const meResponse = await apiClient.get("/api/uni-proxy/auth/me", {
            headers: meHeaders,
          });
          uniSubdomain =
            meResponse.data?.university?.subdomain ||
            meResponse.data?.data?.university?.subdomain ||
            null;
        } catch {
          // Non-fatal: fallback to same-host redirect if subdomain unavailable
        }

        const userToSave = {
          ...(response.data?.data || response.data || {}),
          ...(userFromResponse || {}),
          roles,
          institutionType: "university",
          universityId,
          subdomain: uniSubdomain,
        };

        // mustChangePassword → force change-password before dashboard
        const redirectPath = mustChangePassword
          ? "/uni-change-password"
          : pickRedirectPath(roles, "university");

        if (typeof window !== "undefined") {
          const currentHost = window.location.host;
          const currentProtocol = window.location.protocol;

          // Build subdomain URL — mirrors the K12 pattern exactly
          let targetHost = currentHost;
          if (uniSubdomain) {
            if (
              currentHost.includes("localhost") ||
              currentHost.includes("127.0.0.1")
            ) {
              const port = currentHost.includes(":")
                ? currentHost.split(":")[1]
                : "";
              targetHost = port
                ? `${uniSubdomain}.localhost:${port}`
                : `${uniSubdomain}.localhost`;
            } else {
              const hostParts = currentHost.split(".");
              const baseDomain =
                hostParts.length >= 2
                  ? hostParts.slice(-2).join(".")
                  : currentHost;
              targetHost = `${uniSubdomain}.${baseDomain}`;
            }
          }

          try {
            localStorage.setItem("currentUser", JSON.stringify(userToSave));
          } catch (e) {
            console.error(
              "[Login Thunk] Failed to save uni user to localStorage:",
              e,
            );
          }

          const urlObj = new URL(
            `${currentProtocol}//${targetHost}${redirectPath}`,
          );
          urlObj.searchParams.set("auth_token", accessToken);
          urlObj.searchParams.set(
            "auth_user",
            encodeURIComponent(JSON.stringify(userToSave)),
          );
          window.location.href = urlObj.toString();
        }

        return {
          accessToken,
          user: { ...(userFromResponse || {}), roles },
          subdomain: uniSubdomain,
          institutionType: "university" as const,
          mustChangePassword,
          redirecting: true,
        };
      }

      // ── K12 LOGIN PATH ───────────────────────────────────────────────────────
      const redirectTo = pickRedirectPath(roles, "k12");
      const subdomain = extractSubdomainFromUser(
        userFromResponse,
        response.data,
      );

      // If subdomain not found in user object, return error
      if (!subdomain) {
        return rejectWithValue(
          "Subdomain not found in user response. Please contact support.",
        );
      }

      // Store subdomain in localStorage and Redux
      saveSubdomainToStorage(subdomain);

      // Determine redirect path
      let redirectPath: string;

      // If explicit redirect path provided (e.g., from signup), use it
      if (credentials.redirectTo) {
        redirectPath = credentials.redirectTo;
      }
      // If skipSessionCheck is true (e.g., for new signups), go to setup
      else if (credentials.skipSessionCheck) {
        redirectPath = "/setup";
      }
      // Otherwise, check if academic session is set up
      else {
        const isTeacher = roles.some(
          (r: any) => String(r).toLowerCase() === "teacher",
        );
        const isStudent = roles.some(
          (r: any) => String(r).toLowerCase() === "student",
        );

        if (isTeacher || isStudent) {
          redirectPath = redirectTo;
        } else {
          redirectPath = routespath.DASHBOARD;
          try {
            const sessionResponse = (await Promise.race([
              apiClient.get(`/api/proxy${routespath.API_GET_CURRENT_SESSION}`),
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error("Session check timeout")),
                  3000,
                ),
              ),
            ])) as any;

            if (
              sessionResponse?.data?.success &&
              sessionResponse?.data?.data?.sessionDetails
            ) {
              redirectPath = routespath.DASHBOARD;
            } else {
              try {
                const allSessionsResponse = (await Promise.race([
                  apiClient.get(`/api/proxy${routespath.API_GET_ALL_SESSIONS}`),
                  new Promise((_, reject) =>
                    setTimeout(
                      () => reject(new Error("Sessions list check timeout")),
                      3000,
                    ),
                  ),
                ])) as any;
                const sessions =
                  allSessionsResponse?.data?.data ||
                  allSessionsResponse?.data ||
                  [];
                if (Array.isArray(sessions) && sessions.length > 0) {
                  redirectPath = routespath.DASHBOARD;
                } else {
                  redirectPath = "/setup";
                }
              } catch {
                redirectPath = "/setup";
              }
            }
          } catch {
            try {
              const allSessionsResponse = (await Promise.race([
                apiClient.get(`/api/proxy${routespath.API_GET_ALL_SESSIONS}`),
                new Promise((_, reject) =>
                  setTimeout(
                    () => reject(new Error("Sessions list check timeout")),
                    3000,
                  ),
                ),
              ])) as any;
              const sessions =
                allSessionsResponse?.data?.data ||
                allSessionsResponse?.data ||
                [];
              if (Array.isArray(sessions) && sessions.length > 0) {
                redirectPath = routespath.DASHBOARD;
              } else {
                redirectPath = "/setup";
              }
            } catch {
              redirectPath = "/setup";
            }
          }
        }
      }

      // Redirect to subdomain URL with appropriate path
      if (typeof window !== "undefined") {
        const currentHost = window.location.host;
        const currentProtocol = window.location.protocol;

        const subdomainStr = subdomain || "default";
        let newHost: string;

        if (
          currentHost.includes("localhost") ||
          currentHost.includes("127.0.0.1")
        ) {
          const port = currentHost.includes(":")
            ? currentHost.split(":")[1]
            : "";
          newHost = port
            ? `${subdomainStr}.localhost:${port}`
            : `${subdomainStr}.localhost`;
        } else {
          const hostParts = currentHost.split(".");
          if (hostParts.length >= 2) {
            const baseDomain = hostParts.slice(-2).join(".");
            newHost = `${subdomainStr}.${baseDomain}`;
          } else {
            newHost = `${subdomainStr}.${currentHost}`;
          }
        }

        const userToSave = {
          ...(response.data?.data || response.data || {}),
          ...(userFromResponse || {}),
          roles,
          // Explicitly include subdomain so protectedRoute can hydrate Redux
          // state.user.subdomain correctly on the new origin without relying
          // solely on URL extraction (which may not fire before the first request).
          subdomain,
        };

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("currentUser", JSON.stringify(userToSave));
          } catch (e) {
            console.error(
              "[Login Thunk] Failed to save user to localStorage:",
              e,
            );
          }
        }

        const urlObj = new URL(`${currentProtocol}//${newHost}${redirectPath}`);
        urlObj.searchParams.set("auth_token", accessToken);
        urlObj.searchParams.set(
          "auth_user",
          encodeURIComponent(JSON.stringify(userToSave)),
        );

        window.location.href = urlObj.toString();

        return {
          accessToken,
          user: {
            ...(userFromResponse || {}),
            roles,
          },
          subdomain: subdomain,
          institutionType: type,
          redirecting: true,
        };
      }

      return {
        accessToken,
        user: {
          ...(userFromResponse || {}),
          roles,
        },
        subdomain: subdomain,
        institutionType: type,
      };
    } catch (error: any) {
      const raw: string =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Login failed";

      console.error("[Login Error]", raw);
      return rejectWithValue(sanitizeErrorMessage(raw));
    }
  },
);

// Pull the current user's profile data
export const fetchUserData = createAsyncThunk(
  "user/fetchUserData",
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(routespath.API_USER_PROFILE);

      if (!response.data) {
        return rejectWithValue("No user data received");
      }

      return response.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch user data";

      console.error("[Fetch User Data Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Log out the user and clean up everything
export const logoutUser = createAsyncThunk(
  "user/logout",
  async (_, { rejectWithValue, dispatch }) => {
    try {
      try {
        // Attempt to notify backend of logout
        // Must go through proxy rewrite to backend
        await apiClient.get(`/api/proxy${routespath.API_LOGOUT}`);
      } catch (error) {
        // Even if logout endpoint fails, we still want to clear local state
        console.warn("[Logout] Backend logout failed, clearing local auth");
      }

      // Remove token from cookies
      await removeAuthToken();
      tokenManager.clearAllAuthCookies();

      // Clear subdomain from localStorage
      const { removeSubdomainFromStorage } =
        await import("@/lib/subdomainManager");
      removeSubdomainFromStorage();

      // Reset ALL Redux slices and RTK Query caches so the next login
      // starts completely clean — no previous tenant data leaks through.
      dispatch({ type: RESET_STORE });

      return null;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Logout failed";

      console.error("[Logout Error]", errorMessage);

      // Still clear cookies and reset store even if error occurs
      await removeAuthToken();
      tokenManager.clearAllAuthCookies();
      dispatch({ type: RESET_STORE });

      return rejectWithValue(errorMessage);
    }
  },
);

// Refresh the access token when it expires
export const refreshAuthToken = createAsyncThunk(
  "user/refreshToken",
  async (_, { rejectWithValue }) => {
    try {
      // Use GET method for refresh token (as used in protectedRoute)
      const response = await apiClient.get(
        `/api/proxy${routespath.API_REFRESH}`,
      );
      const { accessToken: responseToken } = response.data;

      // Try to get token from response first, then from cookies
      let accessToken = responseToken || tokenManager.getToken();

      // If still no token, wait a bit for cookie to be set
      if (!accessToken) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        accessToken = tokenManager.getToken();
      }

      if (!accessToken) {
        return rejectWithValue("No token received from refresh endpoint");
      }

      // Update token in cookies and Redux
      await setAuthToken(accessToken);

      return { accessToken };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Token refresh failed";

      console.error("[Token Refresh Error]", errorMessage);

      // Clear auth if refresh fails
      await removeAuthToken();
      tokenManager.removeToken();

      return rejectWithValue(errorMessage);
    }
  },
);

// Register a new user account
export const signupUser = createAsyncThunk(
  "user/signup",
  async (
    userData: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      const response = await apiClient.post(routespath.API_SIGNUP, userData);
      const { accessToken, user } = response.data;
      return {
        accessToken,
        user: user || {},
      };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Signup failed";

      console.error("[Signup Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Fetch all users (students and teachers)
export const fetchAllUsers = createAsyncThunk(
  "user/fetchAllUsers",
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get("/api/proxy/users");

      if (!response.data) {
        return rejectWithValue("No users data received");
      }

      const users = response.data.data || response.data;

      // Separate students and teachers by checking all assigned roles
      const students = users.filter((item: any) => {
        const roles = item.roles || [];
        return (
          Array.isArray(roles) &&
          roles.some(
            (r: any) =>
              r.role?.name === "student" ||
              r.name === "student" ||
              r === "student",
          )
        );
      });

      const teachers = users.filter((item: any) => {
        const roles = item.roles || [];
        return (
          Array.isArray(roles) &&
          roles.some(
            (r: any) =>
              r.role?.name === "teacher" ||
              r.name === "teacher" ||
              r === "teacher",
          )
        );
      });

      return {
        users,
        students,
        teachers,
        studentCount: students.length,
        teacherCount: teachers.length,
      };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch users";

      // Only log non-subdomain errors to reduce console noise
      // Subdomain errors are expected in some scenarios and will be handled by the UI
      if (!errorMessage.toLowerCase().includes("subdomain")) {
        console.error("[Fetch All Users Error]", errorMessage);
      }

      return rejectWithValue(errorMessage);
    }
  },
);

// Fetch a single user by ID
export const fetchUserById = createAsyncThunk(
  "user/fetchUserById",
  async (userId: string, { rejectWithValue }) => {
    try {
      if (!userId) {
        return rejectWithValue("User ID is required");
      }

      const response = await apiClient.get(`/api/proxy/users/${userId}`);

      if (!response.data) {
        return rejectWithValue("No user data received");
      }

      return response.data.data || response.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch user details";

      console.error("[Fetch User By ID Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Delete a user (Soft Delete)
export const deleteUser = createAsyncThunk(
  "user/deleteUser",
  async (userId: string, { rejectWithValue }) => {
    try {
      if (!userId) {
        return rejectWithValue("User ID is required");
      }

      const response = await apiClient.delete(`/api/proxy/users/${userId}`);

      return {
        userId,
        message: response.data?.message || "User deleted successfully",
      };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to delete user";

      console.error("[Delete User Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Hard Delete a user (Permanent)
export const hardDeleteUser = createAsyncThunk(
  "user/hardDeleteUser",
  async (userId: string, { rejectWithValue }) => {
    try {
      if (!userId) {
        return rejectWithValue("User ID is required");
      }

      const response = await apiClient.delete(
        `/api/proxy/users/${userId}/hard`,
      );

      return {
        userId,
        message: response.data?.message || "User permanently deleted",
      };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to permanently delete user";

      console.error("[Hard Delete User Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Reactivate a user
export const reactivateUser = createAsyncThunk(
  "user/reactivateUser",
  async (userId: string, { rejectWithValue }) => {
    try {
      if (!userId) {
        return rejectWithValue("User ID is required");
      }

      const response = await apiClient.post(
        `/api/proxy/users/${userId}/reactivate`,
      );

      return {
        user: response.data?.data || null,
        userId,
        message: response.data?.message || "User reactivated successfully",
      };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to reactivate user";

      console.error("[Reactivate User Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Get current user profile
export const getCurrentUserProfile = createAsyncThunk(
  "user/getCurrentUserProfile",
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get("/api/proxy/users/me");

      if (!response.data) {
        return rejectWithValue("No user data received");
      }

      return response.data.data || response.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch user profile";

      console.error("[Get Current User Profile Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Update user profile
export const updateUserProfile = createAsyncThunk(
  "user/updateUserProfile",
  async (
    data: {
      userId: string;
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      address?: string;
      dateOfBirth?: string;
      gender?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      if (!data.userId) {
        return rejectWithValue("User ID is required");
      }

      const response = await apiClient.patch(
        `/api/proxy/users/${data.userId}`,
        {
          firstName: data.firstName,
          lastName: data.lastName,
          phoneNumber: data.phoneNumber,
          address: data.address,
          dateOfBirth: data.dateOfBirth,
          gender: data.gender,
        },
      );

      return response.data.data || response.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to update user profile";

      console.error("[Update User Profile Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Update user roles
export const updateUserRoles = createAsyncThunk(
  "user/updateUserRoles",
  async (data: { userId: string; roles: string[] }, { rejectWithValue }) => {
    try {
      if (!data.userId) return rejectWithValue("User ID is required");
      const response = await apiClient.post(
        `/api/proxy/users/${data.userId}/roles`,
        { roles: data.roles },
      );
      return response.data.data || response.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to update user roles";
      console.error("[Update User Roles Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Update user classes
export const updateUserClasses = createAsyncThunk(
  "user/updateUserClasses",
  async (data: { userId: string; classIds: string[] }, { rejectWithValue }) => {
    try {
      if (!data.userId) return rejectWithValue("User ID is required");
      const response = await apiClient.post(
        `/api/proxy/users/${data.userId}/classes`,
        { classIds: data.classIds },
      );
      return response.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to update user classes";
      console.error("[Update User Classes Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Change password
export const changePassword = createAsyncThunk(
  "user/changePassword",
  async (
    data: { currentPassword: string; newPassword: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await apiClient.post("/api/proxy/auth/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });

      return response.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to change password";

      console.error("[Change Password Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Get tenant/school settings
export const getTenantInfo = createAsyncThunk(
  "user/getTenantInfo",
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get("/api/proxy/tenant/info");

      if (!response.data) {
        return rejectWithValue("No tenant data received");
      }

      return response.data.data || response.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch tenant information";

      console.error("[Get Tenant Info Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Update school branding (v1.5)
export const updateSchoolBranding = createAsyncThunk(
  "user/updateSchoolBranding",
  async (
    data: {
      logoUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
      accentColor?: string;
      motto?: string;
      domain?: string;
      schoolName?: string;
      address?: string;
      phoneNumber?: string;
      website?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      // First attempt v1.5 endpoint /school-settings/branding
      const response = await apiClient.patch(
        "/school-settings/branding",
        data,
      );

      return response.data.data || response.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to update school branding";

      console.error("[Update School Branding Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

/**
 * Fetch the current university user's profile from GET /auth/me.
 * Used by RoleGuard for university users instead of the K12 /users/me endpoint.
 * The response includes university.subdomain which is needed for routing.
 */
export const fetchUniUserProfile = createAsyncThunk(
  "user/fetchUniUserProfile",
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as any;
      const universityId = state.user?.user?.universityId;

      const response = await apiClient.get("/api/uni-proxy/auth/me", {
        headers: universityId ? { "X-University-Id": universityId } : {},
      });

      if (!response.data) {
        return rejectWithValue("No user data received");
      }

      return response.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch university user profile";

      console.error("[Fetch Uni User Profile Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);
