import axios from "axios";
import { store } from "@/reduxToolKit/store";
import { updateAccessToken } from "@/reduxToolKit/user/userSlice";
import { tokenManager } from "./tokenManager";
import { routespath } from "./routepath";
import { getSubdomain } from "./subdomainManager";

let refreshPromise: Promise<any> | null = null;

export const performTokenRefresh = async (): Promise<string | null> => {
  if (refreshPromise) {
    const res = await refreshPromise;
    return res.accessToken || res.data?.accessToken || tokenManager.getToken() || null;
  }

  refreshPromise = (async () => {
    try {
      const state = store.getState();
      const subdomain = getSubdomain(state.user?.subdomain);
      
      const headers: any = {
        "Content-Type": "application/json",
      };
      
      if (subdomain) {
        headers["X-Tenant-Subdomain"] = subdomain;
      }

      const response = await axios.get(
        `/api/proxy${routespath.API_REFRESH}`,
        {
          withCredentials: true,
          headers,
        }
      );

      const data = response.data;
      
      // Try different paths to extract the token
      const newToken = 
        data?.accessToken || 
        data?.data?.accessToken || 
        data?.token ||
        data?.data?.token;

      if (newToken) {
        tokenManager.setToken(newToken);
        store.dispatch(updateAccessToken({ accessToken: newToken }));
        return data;
      } else {
        console.error("[Auth Refresh] No token in response, data structure:", data);
        throw new Error("No token returned from refresh");
      }
    } catch (error) {
      console.error("[Auth Refresh] Refresh failed:", error);
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  const result = await refreshPromise;
  return result.accessToken || result.data?.accessToken || tokenManager.getToken() || null;
};
