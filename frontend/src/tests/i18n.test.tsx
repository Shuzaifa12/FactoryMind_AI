import { describe, expect, it } from "vitest";
import { directionOf, lookup } from "../lib/i18n";

describe("i18n", () => {
  it("determines layout direction accurately", () => {
    expect(directionOf("en")).toBe("ltr");
    expect(directionOf("ur")).toBe("rtl");
  });

  it("looks up localized message keys", () => {
    expect(lookup("en", "app.name")).toBe("FactoryMind AI");
    expect(lookup("ur", "app.name")).toBe("FactoryMind AI");
    expect(lookup("en", "common.critical")).toBe("Critical");
    expect(lookup("ur", "common.critical")).toBe("شدید");
  });

  it("falls back to key if path missing", () => {
    expect(lookup("en", "nonexistent.key")).toBe("nonexistent.key");
  });
});
