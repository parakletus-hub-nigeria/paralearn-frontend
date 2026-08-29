import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosError,
} from "axios";
import { tokenManager } from "./tokenManager";
import { routespath } from "./routepath";
import { toast } from "sonner";
import { getSubdomain } from "./subdomainManager";

// Token refresh queue — ensures only one refresh runs at a time.
// Any 401s that arrive during a refresh are queued and replayed once refresh completes.
let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function enqueueRefreshWaiter(): Promise<string> {
  return new Promise((resolve, reject) => {
    refreshQueue.push({ resolve, reject });
  });
}

function drainRefreshQueue(token: string) {
  refreshQueue.forEach((p) => p.resolve(token));
  refreshQueue = [];
}

function rejectRefreshQueue(err: unknown) {
  refreshQueue.forEach((p) => p.reject(err));
  refreshQueue = [];
}

// Lazy import store to avoid circular dependency
let storeInstance: any = null;

const getStore = () => {
  if (!storeInstance) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    // @ts-ignore - Dynamic require to avoid circular dependency
    storeInstance = require("@/reduxToolKit/store").store;
  }
  return storeInstance;
};

// Import refresh logic
const getRefreshHelper = () => {
  return require("./authRefresh").performTokenRefresh;
};

/**
 * Factory function to create configured Axios clients for different backends.
 */
export const createApiClient = (baseURL: string): AxiosInstance => {
  const apiClient = axios.create({
    baseURL,
    timeout: 300000,
    withCredentials: true, // Important for cookies
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  // Inject auth token before every request
  apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      try {
        const state = getStore().getState();
        const token = tokenManager.getToken() || state.user?.accessToken;

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Get subdomain with fallback priority: Redux -> localStorage -> URL
        const reduxSubdomain = state?.user?.subdomain;
        const subdomain = getSubdomain(reduxSubdomain);

        // For super-admin routes, prefer the k12 admin subdomain so it is not
        // overwritten by the regular school user's subdomain.
        const k12Subdomain = state?.superAdmin?.k12Subdomain;
        const isSuperAdminRoute = (config.url || "").includes("/super-admin/");
        const effectiveSubdomain = isSuperAdminRoute && k12Subdomain ? k12Subdomain : subdomain;

        // Normalize relative URLs to use the Next.js proxy route if not already prefixed
        if (
          config.url &&
          !baseURL &&
          !config.url.startsWith("/api/") &&
          !config.url.startsWith("http://") &&
          !config.url.startsWith("https://")
        ) {
          config.url = `/api/proxy${config.url.startsWith("/") ? "" : "/"}${config.url}`;
        }

        // Attach tenant header for all requests where subdomain is found.
        // Set both standard x-tenant-subdomain and X-Tenant-Subdomain for robust multi-tenancy compatibility.
        if (effectiveSubdomain) {
          if (typeof config.headers.set === "function") {
            config.headers.set("x-tenant-subdomain", effectiveSubdomain);
            config.headers.set("X-Tenant-Subdomain", effectiveSubdomain);
          } else {
            config.headers["x-tenant-subdomain"] = effectiveSubdomain;
            config.headers["X-Tenant-Subdomain"] = effectiveSubdomain;
          }
        }

        // Identify if this is a login or password reset request for logging/warning purposes
        const isAuthAction =
          (config.url || "").includes(routespath.API_LOGIN) ||
          (config.url || "").includes("/auth/forgot-password") ||
          (config.url || "").includes("/auth/reset-password") ||
          (config.url || "").includes("/sabinote/auth/") ||
          (config.url || "").includes("/lesson-generator/auth/") ||
          (config.url || "").includes("/api/proxy/lesson-generator/");

        // Log warnings in development
        if (process.env.NODE_ENV === "development") {
          if (!subdomain && !isAuthAction) {
            console.warn("[API Request] Missing subdomain for:", config.url);
          }
        }

        return config;
      } catch (error) {
        console.error("[Request Interceptor Error]", error);
        return Promise.reject(error);
      }
    },
    (error: AxiosError) => {
      console.error("[Request Interceptor Error]", error.message);
      return Promise.reject(error);
    },
  );

  // Handle responses, dynamic branding headers, and global errors (401, 402, 403, 500)
  apiClient.interceptors.response.use(
    (response) => {
      // Ingest backend diagnostic and branding headers if present
      if (typeof window !== "undefined" && response.headers) {
        const primaryColor =
          response.headers["x-school-primary-color"] ||
          (response.headers as any)["X-School-Primary-Color"];
        if (primaryColor && typeof primaryColor === "string") {
          document.documentElement.style.setProperty("--school-primary-color", primaryColor);
        }
      }
      return response;
    },
    async (error: AxiosError) => {
      const config = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      // Handle 402 Payment Required (Report card locked behind fee paywall)
      if (error.response?.status === 402) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[API 402] Report card locked pending fee clearance:", error.response.data);
        }
        // Reject cleanly with the full error envelope so Paywall Guard can extract balance & payment URL
        return Promise.reject(error);
      }

      // Handle 401 Unauthorized with token refresh
      if (error.response?.status === 401) {
        const url = config?.url || "";
        const isLoginRequest = url.includes(routespath.API_LOGIN);
        const isRefreshRequest = url.includes(routespath.API_REFRESH);
        const isChangePasswordRequest = url.includes(
          routespath.API_CHANGE_PASSWORD,
        );

        // Standalone lesson-generator requests
        const isSabinoteRequest = url.includes("/lesson-generator") || url.includes("/sabinote/auth");

        // Super admin routes use their own auth — never redirect on 401
        const isSuperAdminRequest = url.includes("/super-admin/");

        if (isLoginRequest || isChangePasswordRequest || isSuperAdminRequest) {
          return Promise.reject(error);
        }

        if (isRefreshRequest) {
          tokenManager.removeToken();
          import("@/reduxToolKit/user/userThunks").then(({ logoutUser }) => {
            getStore()?.dispatch(logoutUser());
          });
          return Promise.reject(error);
        }

        const handleAuthFailure = (err: unknown) => {
          tokenManager.removeToken();
          import("@/reduxToolKit/user/userThunks").then(({ logoutUser }) => {
            getStore()?.dispatch(logoutUser());
          });
          if (typeof window !== "undefined") {
            const currentPath = window.location.pathname;
            if (!currentPath.includes("/auth/") && !currentPath.includes("/sabinote/auth/")) {
              toast.error("Session expired, please log in again");
              const redirectPath = isSabinoteRequest ? routespath.SABINOTE_LOGIN : routespath.SIGNIN;
              setTimeout(() => { window.location.href = redirectPath; }, 1500);
            }
          }
          return Promise.reject(err);
        };

        if (config._retry) {
          console.warn("[API] Refresh token failed, redirecting to login");
          return handleAuthFailure(error);
        }

        // If a refresh is already in flight, queue this request to retry with the new token
        if (isRefreshing) {
          try {
            const freshToken = await enqueueRefreshWaiter();
            if (config.headers) config.headers.Authorization = `Bearer ${freshToken}`;
            return apiClient(config);
          } catch (queueErr) {
            return Promise.reject(queueErr);
          }
        }

        isRefreshing = true;
        config._retry = true;

        try {
          const newToken = await getRefreshHelper()();

          if (!newToken) throw new Error("No token received from refresh");

          const freshToken = tokenManager.getToken();
          drainRefreshQueue(freshToken as string);
          isRefreshing = false;

          if (config.headers) config.headers.Authorization = `Bearer ${freshToken}`;
          return apiClient(config);
        } catch (refreshError) {
          isRefreshing = false;
          rejectRefreshQueue(refreshError);
          console.error("[API] Token refresh failed:", refreshError);
          return handleAuthFailure(refreshError);
        }
      }

      // Handle 403 Forbidden
      if (error.response?.status === 403) {
        console.error("[API] Access Forbidden for URL:", config.url);
        if ((config as any).skipGlobalRedirect) {
          return Promise.reject(error);
        }
        return Promise.reject(error);
      }

      // Handle 500 Server Error
      if (error.response?.status === 500) {
        console.error("[API] Server Error:", error.response.data);
      }

      // Check for subdomain error to filter development logs and trigger logout
      const responseData = error.response?.data as any;
      const responseMsg = responseData?.message || responseData?.error || "";
      const errorMessage =
        typeof responseMsg === "string"
          ? responseMsg
          : Array.isArray(responseMsg)
          ? responseMsg.join(", ")
          : "";

      const isSubdomainError =
        errorMessage.toLowerCase().includes("subdomain") ||
        errorMessage.toLowerCase().includes("invalid subdomain") ||
        (error.message && error.message.toLowerCase().includes("subdomain"));

      if (isSubdomainError) {
        console.warn("[API] Invalid subdomain error detected, logging out...");
        tokenManager.removeToken();
        const store = getStore();
        import("@/reduxToolKit/user/userThunks").then(({ logoutUser }) => {
          store.dispatch(logoutUser());
        });
        if (typeof window !== "undefined") {
          const currentPath = window.location.pathname;
          if (!currentPath.includes("/auth/") && !currentPath.includes("/sabinote/auth/")) {
            toast.error("Session expired, please log in again");
            const isSabinoteRequest = (config?.url || "").includes("/lesson-generator") || (config?.url || "").includes("/sabinote/auth");
            const redirectPath = isSabinoteRequest ? routespath.SABINOTE_LOGIN : routespath.SIGNIN;
            setTimeout(() => { window.location.href = redirectPath; }, 1500);
          }
        }
        return Promise.reject(error);
      }

      if (process.env.NODE_ENV === "development" && !isSubdomainError) {
        const errorInfo: any = { message: error.message || "Unknown error" };
        if (error.response) {
          errorInfo.status = error.response.status;
          errorInfo.statusText = error.response.statusText;
          errorInfo.url = config?.url;
          if (error.response.data) errorInfo.data = error.response.data;
        } else if (error.request) {
          errorInfo.type = "Network Error";
          errorInfo.url = config?.url;
        }
        if (
          errorInfo.status ||
          errorInfo.data ||
          errorInfo.message !== "Unknown error"
        ) {
          console.warn("[API Error]", errorInfo);
        }
      }

      return Promise.reject(error);
    },
  );

  return apiClient;
};
