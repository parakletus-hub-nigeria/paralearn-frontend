/**
 * Utilities for WhatsApp Authentication flow.
 * Handles phone normalization (E.164), validation, countdown formatting,
 * challenge code parsing, QR code rendering, and local persistence for 1-click login.
 */

export interface CountryCodeOption {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
}

export const SUPPORTED_COUNTRIES: CountryCodeOption[] = [
  { name: "Nigeria", code: "NG", dialCode: "+234", flag: "🇳🇬" },
  { name: "Ghana", code: "GH", dialCode: "+233", flag: "🇬🇭" },
  { name: "Kenya", code: "KE", dialCode: "+254", flag: "🇰🇪" },
  { name: "South Africa", code: "ZA", dialCode: "+27", flag: "🇿🇦" },
  { name: "United Kingdom", code: "GB", dialCode: "+44", flag: "🇬🇧" },
  { name: "United States", code: "US", dialCode: "+1", flag: "🇺🇸" },
  { name: "Canada", code: "CA", dialCode: "+1", flag: "🇨🇦" },
  { name: "Cameroon", code: "CM", dialCode: "+237", flag: "🇨🇲" },
  { name: "Uganda", code: "UG", dialCode: "+256", flag: "🇺🇬" },
  { name: "Rwanda", code: "RW", dialCode: "+250", flag: "🇷🇼" },
];

const LOCAL_STORAGE_WA_PHONE_KEY = "paralearn_wa_phone";

export function getSavedWhatsAppPhone(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(LOCAL_STORAGE_WA_PHONE_KEY) || "";
  } catch {
    return "";
  }
}

export function saveWhatsAppPhone(phone: string): void {
  if (typeof window === "undefined" || !phone) return;
  try {
    localStorage.setItem(LOCAL_STORAGE_WA_PHONE_KEY, phone.trim());
  } catch (err) {
    console.debug("[WhatsApp Auth] Could not save phone number:", err);
  }
}

export function clearSavedWhatsAppPhone(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LOCAL_STORAGE_WA_PHONE_KEY);
  } catch (err) {
    console.debug("[WhatsApp Auth] Could not clear phone number:", err);
  }
}

/**
 * Normalizes user input into a clean E.164 phone number.
 * Handles:
 * - "08012345678" -> "+2348012345678"
 * - "2348012345678" -> "+2348012345678"
 * - "+234 801-234-5678" -> "+2348012345678"
 * - "8012345678" -> "+2348012345678"
 */
export function normalizeWhatsAppNumber(
  rawInput: string,
  defaultDialCode: string = "+234"
): string {
  if (!rawInput) return "";

  let cleaned = rawInput.trim().replace(/[\s\(\)\-\.]/g, "");

  if (cleaned.startsWith("+")) {
    return "+" + cleaned.slice(1).replace(/\D/g, "");
  }

  cleaned = cleaned.replace(/\D/g, "");

  const dialDigits = defaultDialCode.replace(/\D/g, "");

  if (cleaned.startsWith(dialDigits)) {
    return `+${cleaned}`;
  }

  if (cleaned.startsWith("0")) {
    return `${defaultDialCode}${cleaned.slice(1)}`;
  }

  if (cleaned.length === 10 && defaultDialCode === "+234") {
    return `${defaultDialCode}${cleaned}`;
  }

  return `${defaultDialCode}${cleaned}`;
}

/**
 * Validates whether the normalized string is a plausible international phone number.
 * E.164 requires + followed by 8 to 15 digits.
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  if (!phoneNumber) return false;
  const e164Regex = /^\+[1-9]\d{7,14}$/;
  return e164Regex.test(phoneNumber.trim());
}

/**
 * Formats seconds remaining into MM:SS.
 */
export function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00:00";
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const mm = mins < 10 ? `0${mins}` : `${mins}`;
  const ss = secs < 10 ? `0${secs}` : `${secs}`;
  return `${mm}:${ss}`;
}

/**
 * Parses the prefilled text from a WhatsApp wa.me URL
 */
export function parseChallengeTextFromUrl(whatsappUrl: string): string {
  try {
    const url = new URL(whatsappUrl);
    return url.searchParams.get("text") || "";
  } catch {
    const match = whatsappUrl.match(/[?&]text=([^&]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    return "";
  }
}

/**
 * Generates a standard Data URL / QR code image without causing build/SSR issues.
 */
export async function generateQrCodeDataUrl(
  text: string,
  size: number = 220
): Promise<string> {
  if (!text) return "";
  try {
    const qrModule = await import("qrcode");
    const qrcodeLib = (qrModule && (qrModule.default || qrModule)) as any;
    if (qrcodeLib && typeof qrcodeLib.toDataURL === "function") {
      return await qrcodeLib.toDataURL(text, {
        width: size,
        margin: 1,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
      });
    }
  } catch (err) {
    console.debug("[WhatsApp QR] Dynamic import fallback:", err);
  }

  // Fallback to high-resolution direct QR service
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
}
