import { createAsyncThunk } from "@reduxjs/toolkit";
import apiClient, { setAuthToken } from "@/lib/api";
import { tokenManager } from "@/lib/tokenManager";
import { routespath } from "@/lib/routepath";
import {
  saveSubdomainToStorage,
  getSubdomain,
} from "@/lib/subdomainManager";
import {
  normalizeRoles,
  pickRedirectPath,
  extractTokenAndUser,
  extractSubdomainFromUser,
} from "./userUtils";
import { hydrateUserState } from "./userSlice";

function sanitizeErrorMessage(msg: string): string {
  const lower = msg.toLowerCase();
  if (
    lower.includes("prisma") ||
    lower.includes("database") ||
    lower.includes("invocation") ||
    lower.includes("stack trace") ||
    lower.includes("internal server error")
  ) {
    return "A server error occurred. Please try again later.";
  }
  return msg;
}

export interface WhatsAppStartResponse {
  success: boolean;
  message: string;
  data: {
    challengeId: string;
    whatsappUrl: string;
    expiresAt: string;
  };
}

export interface WhatsAppStatusResponse {
  success: boolean;
  status: "PENDING" | "VERIFIED" | "CONSUMED" | "EXPIRED";
  message?: string;
  data?: {
    status: "PENDING" | "VERIFIED" | "CONSUMED" | "EXPIRED";
  };
}

/**
 * Step 1: Initiates WhatsApp authentication by requesting a challenge
 */
export const startWhatsAppAuth = createAsyncThunk(
  "user/startWhatsAppAuth",
  async (
    payload: { phoneNumber?: string; subdomain?: string },
    { rejectWithValue }
  ) => {
    try {
      const headers: Record<string, string> = {};
      const activeSubdomain = payload.subdomain || getSubdomain();
      if (activeSubdomain) {
        headers["X-Tenant-Subdomain"] = activeSubdomain;
      }

      const body: Record<string, any> = {};
      if (payload.phoneNumber) {
        body.phoneNumber = payload.phoneNumber;
      }

      const response = await apiClient.post(
        `/api/proxy${routespath.API_WHATSAPP_START}`,
        body,
        { headers }
      );

      const data = response.data?.data || response.data;
      if (!data?.challengeId || !data?.whatsappUrl) {
        return rejectWithValue("Invalid response received from authentication server.");
      }

      return {
        challengeId: data.challengeId as string,
        whatsappUrl: data.whatsappUrl as string,
        expiresAt: data.expiresAt as string,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return rejectWithValue(
          "No registered user found with this phone number for your school. Please check your number or contact your school administrator."
        );
      }
      if (error.response?.status === 400) {
        return rejectWithValue(
          error.response?.data?.message || "Invalid phone number format."
        );
      }
      const raw: string =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to initiate WhatsApp authentication.";
      return rejectWithValue(sanitizeErrorMessage(raw));
    }
  }
);

/**
 * Step 2: Polls the backend for verification status of the challenge
 */
export const checkWhatsAppStatus = createAsyncThunk(
  "user/checkWhatsAppStatus",
  async (
    payload: { challengeId: string; subdomain?: string },
    { rejectWithValue }
  ) => {
    try {
      const headers: Record<string, string> = {};
      const activeSubdomain = payload.subdomain || getSubdomain();
      if (activeSubdomain) {
        headers["X-Tenant-Subdomain"] = activeSubdomain;
      }

      const response = await apiClient.post(
        `/api/proxy${routespath.API_WHATSAPP_STATUS}`,
        { challengeId: payload.challengeId },
        { headers }
      );

      const status =
        response.data?.status ||
        response.data?.data?.status ||
        (response.data?.data as any);

      return {
        status: (status || "PENDING") as "PENDING" | "VERIFIED" | "CONSUMED" | "EXPIRED",
      };
    } catch (error: any) {
      const raw: string =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to check WhatsApp status.";
      return rejectWithValue(sanitizeErrorMessage(raw));
    }
  }
);

/**
 * Step 3: Completes the WhatsApp login flow after challenge is marked VERIFIED
 */
export const completeWhatsAppAuth = createAsyncThunk(
  "user/completeWhatsAppAuth",
  async (
    payload: {
      challengeId: string;
      subdomain?: string;
      institutionType?: "k12" | "university";
    },
    { rejectWithValue, dispatch }
  ) => {
    try {
      const type = payload.institutionType || "k12";
      const headers: Record<string, string> = {};
      const activeSubdomain = payload.subdomain || getSubdomain();
      if (activeSubdomain) {
        headers["X-Tenant-Subdomain"] = activeSubdomain;
      }

      const response = await apiClient.post(
        `/api/proxy${routespath.API_WHATSAPP_COMPLETE}`,
        { challengeId: payload.challengeId },
        { headers }
      );

      const { token: tokenFromResponse, user: userFromResponse } =
        extractTokenAndUser(response.data);

      let accessToken = tokenFromResponse || tokenManager.getToken();

      if (!accessToken) {
        // Wait briefly if cookie is set asynchronously
        await new Promise((resolve) => setTimeout(resolve, 150));
        accessToken = tokenManager.getToken();
      }

      if (!accessToken) {
        return rejectWithValue("No access token received from authentication server.");
      }

      // Store in cookies / storage and sync
      await setAuthToken(accessToken);

      // Normalize roles
      let roles = normalizeRoles(userFromResponse?.roles);
      if (roles.length === 0 && userFromResponse) {
        roles = normalizeRoles(userFromResponse);
      }
      if (roles.length === 0) {
        roles = normalizeRoles(response.data);
      }

      const redirectPath = pickRedirectPath(roles, type);
      const subdomain =
        extractSubdomainFromUser(userFromResponse, response.data) ||
        activeSubdomain ||
        null;

      if (subdomain) {
        saveSubdomainToStorage(subdomain);
      }

      const userToSave = {
        ...(response.data?.data || response.data || {}),
        ...(userFromResponse || {}),
        roles,
        subdomain,
        institutionType: type,
      };

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("currentUser", JSON.stringify(userToSave));
        } catch (e) {
          console.error("[WhatsApp Auth] Failed to save user to localStorage:", e);
        }
      }

      // Update Redux state
      dispatch(
        hydrateUserState({
          accessToken,
          user: userToSave,
          subdomain,
          institutionType: type,
        })
      );

      // Handle Cross-subdomain redirection if needed
      if (typeof window !== "undefined" && subdomain) {
        const currentHost = window.location.host;
        const currentProtocol = window.location.protocol;
        const currentUrlSubdomain = getSubdomain();

        // If user is not already on the correct tenant subdomain, redirect
        if (currentUrlSubdomain !== subdomain) {
          let newHost: string;
          if (
            currentHost.includes("localhost") ||
            currentHost.includes("127.0.0.1")
          ) {
            const port = currentHost.includes(":")
              ? currentHost.split(":")[1]
              : "";
            newHost = port
              ? `${subdomain}.localhost:${port}`
              : `${subdomain}.localhost`;
          } else {
            const hostParts = currentHost.split(".");
            if (hostParts.length >= 2) {
              const baseDomain = hostParts.slice(-2).join(".");
              newHost = `${subdomain}.${baseDomain}`;
            } else {
              newHost = `${subdomain}.${currentHost}`;
            }
          }

          const urlObj = new URL(`${currentProtocol}//${newHost}${redirectPath}`);
          urlObj.searchParams.set("auth_token", accessToken);
          urlObj.searchParams.set(
            "auth_user",
            encodeURIComponent(JSON.stringify(userToSave))
          );

          window.location.href = urlObj.toString();

          return {
            accessToken,
            user: userToSave,
            roles,
            subdomain,
            redirectPath,
            redirecting: true,
          };
        }
      }

      return {
        accessToken,
        user: userToSave,
        roles,
        subdomain,
        redirectPath,
        redirecting: false,
      };
    } catch (error: any) {
      const raw: string =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "WhatsApp authentication completion failed.";
      return rejectWithValue(sanitizeErrorMessage(raw));
    }
  }
);
