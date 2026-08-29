import { routespath } from "@/lib/routepath";

/**
 * Normalizes user roles into a string array.
 * Handles various structures like objects with role names or simple string arrays.
 */
export const normalizeRoles = (roles: any): string[] => {
  if (!roles) return [];

  // If roles is already an array of strings
  if (
    Array.isArray(roles) &&
    roles.length > 0 &&
    typeof roles[0] === "string"
  ) {
    return roles.map((r) => {
      const normalized = String(r).trim().toLowerCase();
      // Map university role names to frontend role names
      if (normalized === "school_admin") return "admin";
      return normalized;
    });
  }

  // If roles is an array of objects like [{role: {name: 'admin'}}]
  if (Array.isArray(roles)) {
    return roles
      .map((r) => r?.role?.name || r?.name || r)
      .filter((v) => typeof v === "string")
      .map((v) => {
        const normalized = v.trim().toLowerCase();
        if (normalized === "school_admin") return "admin";
        return normalized;
      });
  }

  // If roles is a single string
  if (typeof roles === "string") {
    const normalized = roles.trim().toLowerCase();
    if (normalized === "school_admin") return ["admin"];
    return [normalized];
  }

  // If roles is actually a user object or payload containing role indicators
  const extractedRoles: Set<string> = new Set();

  // Helper to check for truthy values
  const isTrue = (val: any) => {
    if (val === true || val === "true" || val === 1 || val === "1") return true;
    return false;
  };

  // Check explicit role field (handles both K12 and University role names)
  const mainRole = String(roles.role || "").toLowerCase();
  if (mainRole === "admin" || mainRole === "school_admin") extractedRoles.add("admin");
  if (mainRole === "principal") extractedRoles.add("principal");
  if (mainRole === "vp" || mainRole === "vice_principal") extractedRoles.add("vp");
  if (mainRole === "accountant" || mainRole === "bursar") extractedRoles.add("accountant");
  if (mainRole === "teacher") extractedRoles.add("teacher");
  if (mainRole === "lecturer") extractedRoles.add("lecturer");
  if (mainRole === "student") extractedRoles.add("student");
  if (mainRole === "editor") extractedRoles.add("editor");

  // Check boolean/string flags
  if (isTrue(roles.isAdmin) || isTrue(roles.isadmin))
    extractedRoles.add("admin");
  if (isTrue(roles.isPrincipal) || isTrue(roles.isprincipal))
    extractedRoles.add("principal");
  if (isTrue(roles.isVp) || isTrue(roles.isvp))
    extractedRoles.add("vp");
  if (isTrue(roles.isAccountant) || isTrue(roles.isaccountant))
    extractedRoles.add("accountant");
  if (isTrue(roles.isTeacher) || isTrue(roles.isteacher))
    extractedRoles.add("teacher");
  if (isTrue(roles.isStudent) || isTrue(roles.isstudent))
    extractedRoles.add("student");
  if (isTrue(roles.isEditor) || isTrue(roles.iseditor))
    extractedRoles.add("editor");

  // Check for presence of unique IDs as indicators
  if (roles.teacherId) extractedRoles.add("teacher");
  if (roles.studentId) extractedRoles.add("student");

  // Check string array represented as comma-separated string if applicable
  if (typeof roles.roles === "string" && roles.roles.includes(",")) {
    roles.roles
      .split(",")
      .forEach((r: string) => extractedRoles.add(r.trim().toLowerCase()));
  }

  return Array.from(extractedRoles);
};

/**
 * Determines the redirect path based on user roles and institution type.
 */
export const pickRedirectPath = (
  roles: string[],
  institutionType: "k12" | "university" = "k12",
): string => {
  if (!roles || roles.length === 0) return routespath.DASHBOARD;

  if (institutionType === "university") {
    if (roles.includes("admin") || roles.includes("editor"))
      return "/uni-admin/dashboard";
    if (roles.includes("lecturer") || roles.includes("teacher"))
      return "/uni-lecturer/dashboard";
    if (roles.includes("student")) return "/uni-student/dashboard";
    return "/uni-admin/dashboard";
  }

  if (roles.includes("accountant") && !roles.includes("admin") && !roles.includes("principal")) {
    return routespath.FINANCE;
  }

  if (roles.includes("teacher") && !roles.includes("admin") && !roles.includes("principal") && !roles.includes("vp")) {
    return routespath.TEACHER_DASHBOARD;
  }

  if (roles.includes("student")) {
    return routespath.STUDENT_DASHBOARD;
  }

  if (roles.includes("admin") || roles.includes("principal") || roles.includes("vp") || roles.includes("editor")) {
    return routespath.DASHBOARD;
  }

  // Default to main dashboard
  return routespath.DASHBOARD;
};

/**
 * Extracts authentication token and user object from API response data.
 */
export const extractTokenAndUser = (data: any) => {
  const token = data?.accessToken || data?.token;
  // Handle various user nesting possibilities
  const user = data?.user || data?.data?.user;
  return { token, user };
};

/**
 * Extracts tenant/school subdomain from user object or response data.
 * Handles the response structure: { data: { school: { subdomain: "..." } } }
 * For university responses, subdomain may not be present — returns null.
 */
export const extractSubdomainFromUser = (
  user: any,
  responseData: any,
): string | null => {
  // Priority: 1. Response data.school.subdomain, 2. Response root subdomain, 3. School object subdomain
  return (
    responseData?.data?.school?.subdomain ||
    responseData?.subdomain ||
    responseData?.school?.subdomain ||
    null
  );
};
