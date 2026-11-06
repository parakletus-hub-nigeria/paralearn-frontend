"use client";

import { warmUpWorkers } from "../workers/client";

export type OfflineReadiness = "unsupported" | "dev" | "installing" | "ready" | "failed";

/**
 * Makes the app reopen without internet: registers /rms-offline-sw.js (only on rms.* hosts,
 * so it can never take over the main ParaLearn app), then has it save every asset the page
 * and both Web Workers need.
 */
export async function setUpOffline(): Promise<OfflineReadiness> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return "unsupported";
  if (!window.location.hostname.startsWith("rms.")) return "unsupported";
  if (process.env.NODE_ENV !== "production") return "dev";

  try {
    await navigator.serviceWorker.register("/rms-offline-sw.js", { scope: "/" });
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      // First visit: wait until the worker takes control so worker scripts go through it
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        navigator.serviceWorker.addEventListener("controllerchange", done, { once: true });
        setTimeout(done, 3000);
      });
    }
    // Loading the Web Workers once fetches their scripts while we're online
    await warmUpWorkers().catch(() => undefined);

    const urls = new Set<string>(["/"]);
    for (const entry of performance.getEntriesByType("resource")) {
      const url = new URL(entry.name, window.location.href);
      if (url.origin === window.location.origin && !url.pathname.startsWith("/api/")) urls.add(url.pathname + url.search);
    }
    const target = navigator.serviceWorker.controller || registration.active;
    if (!target) return "failed";
    await new Promise<void>((resolve) => {
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type !== "precached") return;
        navigator.serviceWorker.removeEventListener("message", onMessage);
        resolve();
      };
      navigator.serviceWorker.addEventListener("message", onMessage);
      target.postMessage({ type: "precache", urls: [...urls] });
      setTimeout(resolve, 15000);
    });
    return "ready";
  } catch {
    // Registering re-downloads the worker script, which fails offline; an installed worker still serves the app
    return navigator.serviceWorker.controller ? "ready" : "failed";
  }
}
