import { describe, expect, it, vi } from "vitest";
import { apiBaseUrl, request, ApiError } from "../lib/api";

describe("api client", () => {
  it("defaults to localhost:8000 when NEXT_PUBLIC_API_BASE_URL is unset", () => {
    expect(apiBaseUrl()).toBe("http://localhost:8000");
  });

  it("parses successful JSON responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    const res = await request<{ status: string }>("/api/v1/health");
    expect(res.status).toBe("ok");
  });

  it("throws typed ApiError on HTTP failures", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        error: { code: "NOT_FOUND", message: "Dataset missing" },
      }),
    });

    await expect(request("/api/v1/datasets/99")).rejects.toThrow(ApiError);
  });
});
