import { webcrypto } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { encryptCredential, decryptCredential } from "@/lib/checkout-crypto.server";

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  // Synthetic test value only; production uses the managed secret store.
  vi.stubEnv("MERCADOPAGO_CREDENTIAL_ENCRYPTION_SECRET", "synthetic-encryption-key-for-tests-only");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Credencial privada por administrador", () => {
  it("recupera a chave somente para o mesmo administrador", async () => {
    const encrypted = await encryptCredential("synthetic-provider-key-for-tests", "admin-a");
    expect(await decryptCredential(encrypted, "admin-a")).toBe("synthetic-provider-key-for-tests");
    await expect(decryptCredential(encrypted, "admin-b")).rejects.toThrow();
  });
  it("recusa conteúdo adulterado", async () => {
    const encrypted = await encryptCredential("synthetic-provider-key-for-tests", "admin-a");
    const [iv, cipher] = encrypted.split(".");
    if (!iv || !cipher) throw new Error("Test setup failed");
    const damaged = Uint8Array.from(atob(cipher), (c) => c.charCodeAt(0));
    const first = damaged[0];
    if (first === undefined) throw new Error("Test setup failed");
    damaged[0] = first ^ 1;
    await expect(decryptCredential(`${iv}.${btoa(Array.from(damaged, (b) => String.fromCharCode(b)).join(""))}`, "admin-a")).rejects.toThrow();
  });
});