import { afterEach, describe, expect, it, vi } from "vitest";
import { footballRequest, crestData } from "@/lib/football.server";

afterEach(() => vi.unstubAllGlobals());
describe("API-Football", () => {
  it("returns successful empty fixtures for caching", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [], response: [] })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await footballRequest("/fixtures", { date: "2026-10-20", team: "127", timezone: "America/Sao_Paulo" }, "test-only")).toEqual([]);
    expect(fetchMock.mock.calls[0]?.[0].searchParams.get("timezone")).toBe("America/Sao_Paulo");
    expect(fetchMock.mock.calls[0]?.[0].searchParams.get("team")).toBe("127");
  });
  it("rejects daily quota errors even with HTTP 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: { requests: "Request limit reached" }, response: [] }))));
    await expect(footballRequest("/fixtures", {}, "test-only")).rejects.toThrow(/limite de consultas/);
  });
  it("treats a restricted date with an empty response as a failure, not no fixtures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: { plan: "Free plans have limited seasons; this date is not available" }, response: [] }))));
    await expect(footballRequest("/fixtures", { date: "2026-10-21" }, "test-only")).rejects.toMatchObject({ code: "date_restricted" });
  });
  it("treats HTTP 429 as the per-minute limit, not the daily quota", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 })));
    await expect(footballRequest("/fixtures", {}, "test-only")).rejects.toThrow(/Aguarde 1 minuto/);
  });
  it("does not fetch arbitrary crest URLs", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect(await crestData("https://example.com/logo.png")).toBeUndefined();
    expect(await crestData("https://media.api-sports.io/other.png")).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});