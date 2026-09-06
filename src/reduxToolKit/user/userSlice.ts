"use client";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { tokenManager } from "@/lib/tokenManager";
import {
  getSubdomainFromStorage,
  extractSubdomainFromURL,
  saveSubdomainToStorage,
  removeSubdomainFromStorage,
} from "@/lib/subdomainManager";
import {
  loginUser,
  logoutUser,
  fetchUserData,
  refreshAuthToken,
  signupUser,
  fetchAllUsers,
  fetchUserById,
  deleteUser,
  hardDeleteUser,
  reactivateUser,
  getCurrentUserProfile,
  updateUserProfile,
  changePassword,
  getTenantInfo,
  updateSchoolBranding,
} from "./userThunks";
import { normalizeRoles } from "./userUtils";
import { getDecodedTokenPayload } from "@/lib/jwt-decode";

interface UserState {
  accessToken: string | null;
  subdomain: string | null;
  institutionType: "k12" | "university";
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    schoolId: string;
    universityId?: string;
    roles: string[];
    avatar?: string;
  };
  // Users list state
  users: any[];
  students: any[];
  teachers: any[];
  vps: any[];
  accountants: any[];
  studentCount: number;
  teacherCount: number;
  // Selected user detail
  selectedUser: any | null;
  // Current user profile
  currentUserProfile: any | null;
  // Tenant/School settings
  tenantInfo: any | null;
  loading: boolean;
  error: string | null;
  success: boolean;
}

const USER_KEY = "currentUser";

const getInitialUser = (): UserState["user"] => {
  if (typeof window === "undefined") {
    return {
      id: "",
      email: "",
      firstName: "",
      lastName: "",
      schoolId: "",
      universityId: "",
      roles: [],
      avatar: "",
    };
  }
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      let roles = normalizeRoles(parsed?.roles);
      if (roles.length === 0 && parsed) {
        roles = normalizeRoles(parsed);
      }
      return {
        id: parsed?.id || "",
        email: parsed?.email || "",
        firstName: parsed?.firstName || "",
        lastName: parsed?.lastName || "",
        schoolId: parsed?.schoolId || "",
        universityId: parsed?.universityId || "",
        roles: roles,
        avatar: parsed?.avatar || parsed?.profilePicture || "",
      };
    }

    // Fallback: If no localStorage (e.g. after subdomain redirect), check JWT
    const token = tokenManager.getToken();
    if (token) {
      const decoded = getDecodedTokenPayload(token);
      if (decoded) {
        let roles = normalizeRoles(decoded.roles || decoded.role);
        if (roles.length === 0) {
          roles = normalizeRoles(decoded);
        }
        return {
          id: decoded.sub || decoded.id || decoded.userId || "",
          email: decoded.email || "",
          firstName: decoded.firstName || "",
          lastName: decoded.lastName || "",
          schoolId: decoded.schoolId || "",
          universityId: decoded.universityId || "",
          roles: roles,
          avatar: decoded.avatar || decoded.profilePicture || "",
        };
      }
    }

    return {
      id: "",
      email: "",
      firstName: "",
      lastName: "",
      schoolId: "",
      universityId: "",
      roles: [],
      avatar: "",
    };
  } catch (e) {
    console.warn("[userSlice] Failed to initialize user state", e);
    return {
      id: "",
      email: "",
      firstName: "",
      lastName: "",
      schoolId: "",
      universityId: "",
      roles: [],
      avatar: "",
    };
  }
};

const getInitialToken = () => {
  if (typeof window !== "undefined") {
    return tokenManager.getToken() || null;
  }
  return null;
};

const getInitialSubdomain = () => {
  // Don't automatically fetch subdomain on initialization
  // It will be extracted from login response
  if (typeof window !== "undefined") {
    // Only check localStorage if it exists from previous session
    const stored = getSubdomainFromStorage();
    return stored || null;
  }
  return null;
};

const getInitialInstitutionType = (): "k12" | "university" => {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return parsed.institutionType || "k12";
      } catch (e) {
        return "k12";
      }
    }
  }
  return "k12";
};

const initialState: UserState = {
  accessToken: getInitialToken() || null,
  subdomain: getInitialSubdomain(),
  institutionType: getInitialInstitutionType(),
  user: getInitialUser(),
  users: [],
  students: [],
  teachers: [],
  vps: [],
  accountants: [],
  studentCount: 0,
  teacherCount: 0,
  selectedUser: null,
  currentUserProfile: null,
  tenantInfo: null,
  loading: false,
  error: null,
  success: false,
};

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  schoolId: string;
  universityId?: string;
  roles: string[];
  avatar?: string;
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    updateAccessToken: (state, action: PayloadAction<{ accessToken: any }>) => {
      state.accessToken = action.payload.accessToken;
    },
    updateSubdomain: (
      state,
      action: PayloadAction<{ subdomain: string | null }>,
    ) => {
      state.subdomain = action.payload.subdomain;
      // Sync to localStorage
      if (action.payload.subdomain) {
        saveSubdomainToStorage(action.payload.subdomain);
      } else {
        removeSubdomainFromStorage();
      }
    },
    updateInstitutionType: (
      state,
      action: PayloadAction<"k12" | "university">,
    ) => {
      state.institutionType = action.payload;
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(USER_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            parsed.institutionType = action.payload;
            localStorage.setItem(USER_KEY, JSON.stringify(parsed));
          }
        } catch (e) {}
      }
    },
    /**
     * Hydrate Redux state from the auth_user payload delivered via URL params
     * after a cross-subdomain redirect. This avoids a full profile re-fetch.
     */
    hydrateUserState: (
      state,
      action: PayloadAction<{
        accessToken: string;
        user: Partial<User>;
        subdomain?: string | null;
        institutionType?: "k12" | "university";
      }>,
    ) => {
      const { accessToken, user, subdomain, institutionType } = action.payload;
      state.accessToken = accessToken;
      if (user) {
        state.user = {
          id: user.id || state.user.id,
          email: user.email || state.user.email,
          firstName: user.firstName || state.user.firstName,
          lastName: user.lastName || state.user.lastName,
          schoolId: user.schoolId || state.user.schoolId,
          universityId: user.universityId || state.user.universityId,
          roles: (user.roles && user.roles.length > 0) ? user.roles : state.user.roles,
          avatar: user.avatar || state.user.avatar,
        };
      }
      if (subdomain) state.subdomain = subdomain;
      if (institutionType) state.institutionType = institutionType;
    },
  },

  extraReducers: (builder) => {
    // Handling login states
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.accessToken = action.payload.accessToken;
        state.user = action.payload.user;
        state.subdomain = action.payload.subdomain || state.subdomain;
        state.institutionType = (action.payload.institutionType as "k12" | "university") || state.institutionType;
        state.success = true;
        state.error = null;
        // Persist user snapshot for reloads (roles-based guards)
        if (typeof window !== "undefined") {
          try {
            // Extract roles, fallback to checking user object for flags
            let roles = normalizeRoles(action.payload.user?.roles);
            if (roles.length === 0) {
              roles = normalizeRoles(action.payload.user);
            }

            const toSave = {
              ...action.payload.user,
              roles,
              institutionType: action.payload.institutionType || "k12",
            };
            localStorage.setItem(USER_KEY, JSON.stringify(toSave));
          } catch {}
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Login failed";
        state.success = false;
        state.accessToken = null;
      });

    // Loading user profile
    builder
      .addCase(fetchUserData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserData.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user || action.payload;
        state.error = null;
      })
      .addCase(fetchUserData.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to fetch user data";
      });

    // Logging out
    builder
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.loading = false;
        state.accessToken = null;
        state.subdomain = null;
        state.user = {
          id: "",
          email: "",
          firstName: "",
          lastName: "",
          schoolId: "",
          universityId: "",
          roles: [],
        };
        state.error = null;
        state.success = true;
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem(USER_KEY);
          } catch {}
        }
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false;
        // Clear state even on error
        state.accessToken = null;
        state.subdomain = null;
        state.user = {
          id: "",
          email: "",
          firstName: "",
          lastName: "",
          schoolId: "",
          universityId: "",
          roles: [],
        };
        state.error = (action.payload as string) || "Logout failed";
      });

    // Refreshing the token
    builder
      .addCase(refreshAuthToken.pending, (state) => {
        state.loading = true;
      })
      .addCase(refreshAuthToken.fulfilled, (state, action) => {
        state.loading = false;
        state.accessToken = action.payload.accessToken;
        state.error = null;
      })
      .addCase(refreshAuthToken.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Token refresh failed";
        // Clear auth on token refresh failure
        state.accessToken = null;
      });

    // Signup
    builder
      .addCase(signupUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(signupUser.fulfilled, (state, action) => {
        state.loading = false;
        state.accessToken = action.payload.accessToken;
        state.user = action.payload.user;
        state.success = true;
        state.error = null;
      })
      .addCase(signupUser.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Signup failed";
        state.success = false;
      });

    // Fetch all users
    builder
      .addCase(fetchAllUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload.users;
        state.students = action.payload.students;
        state.teachers = action.payload.teachers;
        state.vps = action.payload.vps || [];
        state.accountants = action.payload.accountants || [];
        state.users = action.payload.users || [];
        state.studentCount = action.payload.studentCount;
        state.teacherCount = action.payload.teacherCount;
        state.error = null;
      })
      .addCase(fetchAllUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to fetch users";
      });

    // Fetch user by ID
    builder
      .addCase(fetchUserById.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.selectedUser = null;
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedUser = action.payload;
        state.error = null;
      })
      .addCase(fetchUserById.rejected, (state, action) => {
        state.loading = false;
        state.selectedUser = null;
        state.error =
          (action.payload as string) || "Failed to fetch user details";
      });

    // Delete user
    builder
      .addCase(deleteUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.loading = false;
        // Remove user from lists
        state.users = state.users.filter(
          (user) => user.id !== action.payload.userId,
        );
        state.students = state.students.filter(
          (user) => user.id !== action.payload.userId,
        );
        state.teachers = state.teachers.filter(
          (user) => user.id !== action.payload.userId,
        );
        state.studentCount = state.students.length;
        state.teacherCount = state.teachers.length;
        state.success = true;
        state.error = null;
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to delete user";
      })

      // Hard Delete User
      .addCase(hardDeleteUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(hardDeleteUser.fulfilled, (state, action) => {
        state.loading = false;
        state.users = state.users.filter(
          (user) => user.id !== action.payload.userId,
        );
        state.students = state.students.filter(
          (user) => user.id !== action.payload.userId,
        );
        state.teachers = state.teachers.filter(
          (user) => user.id !== action.payload.userId,
        );
        state.studentCount = state.students.length;
        state.teacherCount = state.teachers.length;
        state.success = true;
        state.error = null;
      })
      .addCase(hardDeleteUser.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to permanently delete user";
      })

      // Reactivate User
      .addCase(reactivateUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(reactivateUser.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.error = null;

        const updatedUser = action.payload.user;

        // Update user in lists instead of removing them
        const updateList = (list: any[]) =>
          list.map((u) =>
            u.id === action.payload.userId
              ? { ...u, ...updatedUser, isActive: true }
              : u,
          );

        state.users = updateList(state.users);
        state.students = updateList(state.students);
        state.teachers = updateList(state.teachers);
      })
      .addCase(reactivateUser.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to reactivate user";
      });

    // Get current user profile
    builder
      .addCase(getCurrentUserProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getCurrentUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUserProfile = action.payload;

        // Extract roles from profile response
        let roles = normalizeRoles(action.payload?.roles);

        // If roles is empty, try the whole payload for role flags (iadmin, etc)
        if (roles.length === 0) {
          roles = normalizeRoles(action.payload);
        }

        state.user = {
          id: action.payload?.id || state.user.id,
          email: action.payload?.email || state.user.email,
          firstName: action.payload?.firstName || state.user.firstName,
          lastName: action.payload?.lastName || state.user.lastName,
          schoolId: action.payload?.schoolId || state.user.schoolId,
          universityId: action.payload?.universityId || state.user.universityId,
          roles: roles.length ? roles : state.user.roles,
          avatar:
            action.payload?.avatar ||
            action.payload?.profilePicture ||
            state.user.avatar,
        };
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(USER_KEY, JSON.stringify(state.user));
          } catch {}
        }
        state.error = null;
      })
      .addCase(getCurrentUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to fetch user profile";
      });

    // Update user profile
    builder
      .addCase(updateUserProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUserProfile = action.payload;
        // Only merge into the logged-in user's state if the updated user IS
        // the currently authenticated user. Admins updating other users' profiles
        // must NOT overwrite the current session's roles/data.
        if (action.payload?.id && state.user?.id && action.payload.id === state.user.id) {
          state.user = {
            ...state.user,
            ...action.payload,
          };
        }
        state.success = true;
        state.error = null;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.success = false;
        state.error =
          (action.payload as string) || "Failed to update user profile";
      });

    // Change password
    builder
      .addCase(changePassword.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
        state.error = null;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.loading = false;
        state.success = false;
        state.error = (action.payload as string) || "Failed to change password";
      });

    // Get tenant info
    builder
      .addCase(getTenantInfo.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getTenantInfo.fulfilled, (state, action) => {
        state.loading = false;
        state.tenantInfo = action.payload;
        state.error = null;
      })
      .addCase(getTenantInfo.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to fetch tenant information";
      });

    // Update school branding
    builder
      .addCase(updateSchoolBranding.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(updateSchoolBranding.fulfilled, (state, action) => {
        state.loading = false;
        state.tenantInfo = {
          ...state.tenantInfo,
          ...action.payload,
        };
        state.success = true;
        state.error = null;
      })
      .addCase(updateSchoolBranding.rejected, (state, action) => {
        state.loading = false;
        state.success = false;
        state.error =
          (action.payload as string) || "Failed to update school branding";
      });
  },
});
// Export thunks for use in components
export {
  loginUser,
  logoutUser,
  fetchUserData,
  refreshAuthToken,
  signupUser,
  fetchAllUsers,
  fetchUserById,
  deleteUser,
  getCurrentUserProfile,
  updateUserProfile,
  changePassword,
  getTenantInfo,
  updateSchoolBranding,
};
export const { updateAccessToken, updateSubdomain, updateInstitutionType, hydrateUserState } =
  userSlice.actions;
const userReducer = userSlice.reducer;
export default userReducer;
