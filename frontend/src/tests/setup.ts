import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

(globalThis as any).React = React;

afterEach(() => {
  cleanup();
});

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
