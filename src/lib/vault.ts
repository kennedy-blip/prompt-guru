/** Web Crypto AES-GCM vault for the browser API key (never uploaded). */

const KEY_STORAGE = "promptguru.vault.key";
const SECRET_STORAGE = "promptguru.vault.secret";
const settingsStorage = "promptguru.settings.v1";

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i += 1) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function fromB64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getKey(create: boolean): Promise<CryptoKey | null> {
  if (typeof window === "undefined" || !("crypto" in window)) return null;
  let raw = localStorage.getItem(KEY_STORAGE);
  if (!raw) {
    if (!create) return null;
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const exported = await crypto.subtle.exportKey("raw", key);
    raw = toB64(exported);
    localStorage.setItem(KEY_STORAGE, raw);
  }
  return crypto.subtle.importKey("raw", fromB64(raw), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptSecret(plain: string): Promise<string> {
  if (!plain) return "";
  try {
    const key = await getKey(true);
    if (!key) return `plain:${btoa(plain)}`;
    const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
    const encoded = new TextEncoder().encode(plain);
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    return `v1:${toB64(iv)}:${toB64(cipher)}`;
  } catch {
    return `plain:${btoa(plain)}`;
  }
}

export async function decryptSecret(payload: string): Promise<string> {
  if (!payload) return "";
  try {
    if (payload.startsWith("plain:")) return atob(payload.slice(6));
    if (!payload.startsWith("v1:")) return payload;
    const [, ivB64, cipherB64] = payload.split(":");
    const key = await getKey(false);
    if (!key) return "";
    const iv = fromB64(ivB64);
    const cipher = fromB64(cipherB64);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return new TextDecoder().decode(plain);
  } catch {
    return "";
  }
}

export function clearVault(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SECRET_STORAGE);
  localStorage.removeItem(KEY_STORAGE);
}

export function readEncryptedSecret(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SECRET_STORAGE) ?? "";
}

export function writeEncryptedSecret(payload: string): void {
  if (typeof window === "undefined") return;
  if (!payload) localStorage.removeItem(SECRET_STORAGE);
  else localStorage.setItem(SECRET_STORAGE, payload);
}

export const SETTINGS_STORAGE_KEY = settingsStorage;
