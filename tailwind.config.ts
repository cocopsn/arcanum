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
        text: {
          DEFAULT: "var(--text)",
          muted: "var(--text-muted)",
          faint: "var(--text-faint)",
        },
        topic: "var(--topic)",
        gold: "var(--gold)",
        amber: "var(--amber)",
        rank: {
          DEFAULT: "var(--rank)",
          soft: "var(--rank-soft)",
          glow: "var(--rank-glow)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        aura: "0 0 0 1px var(--rank-soft), 0 8px 40px -12px var(--rank-glow)",
      },
    },
  },
  plugins: [],
};

export default config;
