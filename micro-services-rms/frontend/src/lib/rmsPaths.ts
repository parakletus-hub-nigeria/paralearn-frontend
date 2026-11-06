"use client";

import { useCallback, useSyncExternalStore } from "react";

const PREFIX = "/result-studio";

const subscribe = () => () => {};
const onRmsHost = () => window.location.hostname.startsWith("rms.");

/**
 * Builds in-app links. On rms.pln.ng the proxy maps "/batches/1" to /result-studio/batches/1,
 * so links stay short; anywhere else (localhost:3000, previews) they need the prefix.
 * The server render uses the prefixed form, which works on every host.
 */
export function useRmsHref() {
  const rmsHost = useSyncExternalStore(subscribe, onRmsHost, () => false);
  return useCallback(
    (path: string = "/") => {
      const clean = path.startsWith("/") ? path : `/${path}`;
      if (rmsHost) return clean;
      return clean === "/" ? PREFIX : `${PREFIX}${clean}`;
    },
    [rmsHost]
  );
}
