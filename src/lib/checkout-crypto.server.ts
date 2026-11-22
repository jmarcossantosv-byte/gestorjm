// Web Crypto works in both the preview and the published Worker.
const encoder = new TextEncoder();
async function encryptionKey() {
  const secret = process.env["MERCADOPAGO_CREDENTIAL_ENCRYPTION_SECRET"];
  if (!secret) throw new Error("O armazenamento seguro ainda não está disponível.");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
function base64(bytes: Uint8Array) {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
}
function bytes(value: string) { return Uint8Array.from(atob(value), (c) => c.charCodeAt(0)); }
export async function encryptCredential(value: string, userId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(userId) }, await encryptionKey(), encoder.encode(value));
  return `${base64(iv)}.${base64(new Uint8Array(encrypted))}`;
}
export async function decryptCredential(value: string, userId: string) {
  const [iv, cipher] = value.split(".");
  if (!iv || !cipher) throw new Error("Cadastre novamente a chave do Mercado Pago.");
  const result = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(iv), additionalData: encoder.encode(userId) }, await encryptionKey(), bytes(cipher));
  return new TextDecoder().decode(result);
}
export function createCheckoutToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
}
