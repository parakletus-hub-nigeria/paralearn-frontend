/**
 * Utility to manage subdomain extraction and storage
 */

const SUBDOMAIN_KEY = "adminSubdomain";

/**
 * Pure hostname -> subdomain parser, usable both in the browser
 * (extractSubdomainFromURL below) and on the server (e.g. reading the `Host`
 * header in a Server Component via next/headers). Keeping the parsing rules
 * in one function means client and server can never silently disagree about
 * which host is a tenant, which is SabiNote, and which is the root site.
 *
 * Splits the hostname by '.' and gets the first part.
 * Example: 'subdomain.pln.ng' -> 'subdomain'
 * Example: 'subdomain.localhost' -> 'subdomain'
 */
export const parseSubdomainFromHostname = (hostname: string | null | undefined): string | null => {
  try {
    if (!hostname) {
      return null;
    }

    const lower = hostname.toLowerCase();

    // 1. Handle localhost and IP addresses
    if (lower === "localhost" || lower === "127.0.0.1" || lower === "0.0.0.0") {
      return null;
    }

    // 2. Split by '.'
    const parts = hostname.split(".");
    
    // 3. Special Case: SabiNote Primary Domain (e.g. sabinote.com, www.sabinote.app)
    // If the domain itself is sabinote, we treat it as the 'sabinote' product subdomain
    if (lower.includes("sabinote")) {
      // sabinote.tld (2 parts)
      if (parts.length === 2 && parts[0] === "sabinote") return "sabinote";
      // www.sabinote.tld (3 parts)
      if (parts.length === 3 && parts[0] === "www" && parts[1] === "sabinote") return "sabinote";
    }

    // 4. Identification logic
    // We treat the first part as a subdomain ONLY if:
    // a) It's a .localhost dev domain (e.g. school.localhost)
    // b) It's a standard domain with 3+ parts (e.g. school.pln.ng) AND the first part isn't 'www' 
    //    OR it's a 4+ part domain starting with 'www' (e.g. www.school.pln.ng)

    if (lower.endsWith(".localhost")) {
      const first = parts[0];
      return first === "www" ? null : first;
    }

    // Platforms common domains to ignore as subdomains
    // We remove 'sabinote' from here so it can be picked up as a valid product subdomain
    // "cbt" is a platform subdomain (cbt.pln.ng), not a school tenant
    const platformDomains = ["pln", "paralearn", "cbt"];

    if (parts.length >= 3) {
      const first = parts[0];
      const second = parts[1];

      // Handle www.subdomain.domain.tld or www.domain.tld
      if (first === "www") {
        // If it's www.domain.tld (3 parts), return null
        if (parts.length === 3) return null;
        
        // If it's www.subdomain.domain.tld (4+ parts), return the subdomain
        if (platformDomains.includes(second)) return null;
        
        return second;
      }

      // If it's subdomain.domain.tld (3 parts)
      // Check if the first part is actually just the platform name (e.g. paralearn.app)
      if (parts.length === 3 && platformDomains.includes(first)) {
        return null;
      }

      return first;
    }

    return null;
  } catch (error) {
    console.error("[Subdomain] Error extracting from URL:", error);
    return null;
  }
};

/**
 * Browser-only convenience wrapper around parseSubdomainFromHostname, reading
 * the hostname from window.location. Server code (Server Components, route
 * handlers) should call parseSubdomainFromHostname directly with the `Host`
 * header instead — window is never available there.
 */
export const extractSubdomainFromURL = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return parseSubdomainFromHostname(window.location.hostname);
};

/**
 * Get subdomain from localStorage
 */
export const getSubdomainFromStorage = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const subdomain = localStorage.getItem(SUBDOMAIN_KEY);
    return subdomain || null;
  } catch (error) {
    console.error("[Subdomain] Error reading from localStorage:", error);
    return null;
  }
};

/**
 * Save subdomain to localStorage
 */
export const saveSubdomainToStorage = (subdomain: string): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(SUBDOMAIN_KEY, subdomain);
  } catch (error) {
    console.error("[Subdomain] Error saving to localStorage:", error);
  }
};

/**
 * Remove subdomain from localStorage
 */
export const removeSubdomainFromStorage = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(SUBDOMAIN_KEY);
  } catch (error) {
    console.error("[Subdomain] Error removing from localStorage:", error);
  }
};

/**
 * Sanitize subdomain - remove any invalid characters
 */
const sanitizeSubdomain = (subdomain: string | null | undefined): string | null => {
  if (!subdomain) return null;
  
  // Remove any whitespace, convert to lowercase, and only keep alphanumeric + hyphens
  const cleaned = subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  
  // Must be at least 1 character and not just hyphens
  if (!cleaned || /^-*$/.test(cleaned)) return null;
  
  return cleaned;
};

/**
 * Get subdomain with fallback priority:
 * 1. URL extraction — the current hostname is always the authoritative tenant.
 *    Stale Redux/localStorage values from a previous session must never override
 *    the subdomain the user is physically browsing on.
 * 2. Redux state (passed as parameter) — correct on same-origin pages
 * 3. localStorage — legacy fallback only
 */
export const getSubdomain = (reduxSubdomain?: string | null): string | null => {
  // First, extract from current URL — this is always ground truth.
  // When a user is on dta.localhost, we must send dta regardless of what
  // stale state exists in Redux or localStorage from a prior pls session.
  const urlSubdomain = extractSubdomainFromURL();
  const cleanUrl = sanitizeSubdomain(urlSubdomain);
  if (cleanUrl) {
    // Keep localStorage in sync so fallbacks stay accurate
    saveSubdomainToStorage(cleanUrl);
    return cleanUrl;
  }

  // Second, check Redux state (correct on root-domain pages where URL has no subdomain)
  const cleanRedux = sanitizeSubdomain(reduxSubdomain);
  if (cleanRedux) {
    return cleanRedux;
  }

  // Third, localStorage fallback
  const storedSubdomain = getSubdomainFromStorage();
  const cleanStored = sanitizeSubdomain(storedSubdomain);
  if (cleanStored) {
    return cleanStored;
  }

  return null;
};

export const subdomainManager = {
  extractFromURL: extractSubdomainFromURL,
  getFromStorage: getSubdomainFromStorage,
  saveToStorage: saveSubdomainToStorage,
  removeFromStorage: removeSubdomainFromStorage,
  get: getSubdomain,
};
