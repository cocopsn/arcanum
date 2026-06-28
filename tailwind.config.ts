import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
        },
        line: "var(--line)",
        body: "var(--text)",
        muted: "var(--text-muted)",
        topic: "var(--topic)",
        rank: {
          DEFAULT: "var(--rank)",
          soft: "var(--rank-soft)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
