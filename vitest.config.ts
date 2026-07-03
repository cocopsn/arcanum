import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// mirror the next.config webpack rule: import .md files as raw strings (the seed books) so tests
// that touch the seed loader work under vitest too.
const mdRaw = {
  name: "md-raw",
  transform(src: string, id: string) {
    if (id.endsWith(".md")) return { code: `export default ${JSON.stringify(src)};`, map: null };
    return null;
  },
};

export default defineConfig({
  plugins: [react(), mdRaw],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
