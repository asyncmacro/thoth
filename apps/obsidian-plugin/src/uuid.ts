/**
 * Generates a RFC-4122 version 4 UUID without Node dependencies.
 * Uses the Web Crypto API which is available in Electron and Obsidian Mobile.
 */

export function uuidv4(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Set version (4) and variant (10)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
