import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#110f0c",
          raised: "#17140f",
        },
        surface: {
          DEFAULT: "#1b1813",
          2: "#221e17",
          3: "#2a251c",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.08)",
          strong: "rgba(255,255,255,0.16)",
        },
        ink: {
          DEFAULT: "#ede6d8",
          muted: "#a39a87",
          faint: "#6b6355",
        },
        // Sage: the primary accent — calm, grown, "on track".
        accent: {
          DEFAULT: "#7c9468",
          strong: "#a2bd86",
          soft: "rgba(124,148,104,0.16)",
        },
        // Clay: a warm second accent used sparingly (today's ring, 100% weeks) —
        // enough contrast against the sage to feel intentional, not random.
        clay: {
          DEFAULT: "#c17a4e",
          strong: "#d99a70",
          soft: "rgba(193,122,78,0.16)",
        },
      },
      fontFamily: {
        mono: [
          "Roboto Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(193,122,78,0.4), 0 0 24px -6px rgba(193,122,78,0.45)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-6px)" },
          "40%, 80%": { transform: "translateX(6px)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        shake: "shake 0.35s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
