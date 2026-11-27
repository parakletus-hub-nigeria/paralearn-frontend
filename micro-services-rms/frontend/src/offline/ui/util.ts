"use client";

import { useSyncExternalStore } from "react";

export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true
  );
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** True on Android Chrome / mobile browsers that can hand an Excel file straight to WhatsApp */
export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof File === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({
      files: [new File(["x"], "sheet.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })],
    });
  } catch {
    return false;
  }
}

/** Opens the phone's native Share sheet (e.g. WhatsApp); returns false if user cancelled */
export async function shareFile(blob: Blob, fileName: string, title?: string): Promise<boolean> {
  const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
  try {
    await navigator.share({ files: [file], title: title || fileName });
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return false;
    downloadBlob(blob, fileName);
    return true;
  }
}

export const safeFileName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();

export const ordinal = (n: number) => {
  const r = n % 100;
  const s = r >= 11 && r <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] || "th";
  return `${n}${s}`;
};

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const TERMS = ["First Term", "Second Term", "Third Term"] as const;

export function currentSession(now = new Date()): string {
  // Nigerian sessions start in September
  const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}/${y + 1}`;
}

export const timeAgo = (iso: string) => {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
