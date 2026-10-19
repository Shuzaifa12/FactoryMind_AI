import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusCard } from "../components/StatusCard";
import { I18nProvider } from "../lib/i18n";
import { ThemeProvider } from "../lib/theme";

describe("StatusCard", () => {
  it("renders ok state when health response is ok", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        database: "ok",
        version: "0.1.0",
        environment: "development",
        database_engine: "sqlite",
      }),
    });

    render(
      <ThemeProvider>
        <I18nProvider>
          <StatusCard />
        </I18nProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
      expect(screen.getByText("sqlite")).toBeInTheDocument();
    });
  });
});
