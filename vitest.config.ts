import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const MOCKS = path.resolve(__dirname, "./src/test/mocks");

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
  resolve: {
    alias: [
      // ── Specific aliases MUST come before the catch-all "@" alias ──────────
      // Next.js server-only stubs
      { find: "server-only",                             replacement: `${MOCKS}/server-only.ts` },
      { find: "next/headers",                            replacement: `${MOCKS}/next-headers.ts` },
      { find: "next/cache",                              replacement: `${MOCKS}/next-cache.ts` },
      { find: "next/navigation",                         replacement: `${MOCKS}/next-navigation.ts` },
      // Auth chain — prevents next-auth from pulling next/server into vitest
      { find: /^next-auth(\/.*)?$/,                      replacement: `${MOCKS}/next-auth.ts` },
      { find: /^@auth\/.*/,                              replacement: `${MOCKS}/next-auth.ts` },
      { find: /^@\/lib\/auth(\/.*)?$/,                   replacement: `${MOCKS}/lib-auth.ts` },
      // General src alias (must be last so more-specific ones match first)
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
});
