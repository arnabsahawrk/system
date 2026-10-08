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
        // Today's card once every task on it is done: the clay glow turns sage.
        "glow-done": "0 0 0 1px rgba(124,148,104,0.6), 0 0 30px -6px rgba(124,148,104,0.55)",
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
        // Opens a block downward instead of letting it pop in and shove
        // everything below it. 12rem is comfortably taller than any block
        // that uses it.
        unfold: {
          "0%": { opacity: "0", maxHeight: "0px" },
          "100%": { opacity: "1", maxHeight: "12rem" },
        },
        // --- motion vocabulary for the new screens. Everything here moves
        // only transform/opacity, so it stays on the GPU and stays smooth on
        // an iPhone 7. ---
        // The "in" animations deliberately have NO final keyframe: they run
        // from the state below to whatever the element's own styles say, so
        // they never fight a class like opacity-55 once they finish.
        //
        // Staggered entrance for cards: give each a different animationDelay.
        rise: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
        },
        // The checkbox "thunk" when a task is ticked.
        pop: {
          "0%": { transform: "scale(0.82)" },
          "55%": { transform: "scale(1.16)" },
          "100%": { transform: "scale(1)" },
        },
        // A number that just changed (task chain).
        bump: {
          "0%": { transform: "scale(0.7)", opacity: "0.4" },
          "60%": { transform: "scale(1.3)", opacity: "1" },
        },
        // A badge being stamped onto a card.
        stamp: {
          "0%": { transform: "scale(0.5)", opacity: "0" },
          "65%": { transform: "scale(1.12)", opacity: "1" },
        },
        // One pass of light across a card header when its day is completed.
        sweep: {
          "0%": { transform: "translateX(-130%)", opacity: "0" },
          "15%": { opacity: "1" },
          "100%": { transform: "translateX(330%)", opacity: "0" },
        },
        // Bars growing up from their baseline.
        "bar-grow": {
          "0%": { transform: "scaleY(0)" },
        },
        // Same, growing from the left (horizontal rate bars).
        "bar-grow-x": {
          "0%": { transform: "scaleX(0)" },
        },
        "sheet-up": {
          "0%": { transform: "translateY(100%)" },
        },
        "sheet-down": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(100%)" },
        },
        "modal-in": {
          "0%": { opacity: "0", transform: "translateY(10px) scale(0.97)" },
        },
        "modal-out": {
          "0%": { opacity: "1", transform: "translateY(0) scale(1)" },
          "100%": { opacity: "0", transform: "translateY(10px) scale(0.97)" },
        },
        "backdrop-in": {
          "0%": { opacity: "0" },
        },
        "backdrop-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        shake: "shake 0.35s ease-in-out",
        unfold: "unfold 0.3s ease-out",
        rise: "rise 0.5s cubic-bezier(0.22,1,0.36,1) backwards",
        pop: "pop 0.34s cubic-bezier(0.22,1,0.36,1)",
        bump: "bump 0.34s cubic-bezier(0.22,1,0.36,1)",
        stamp: "stamp 0.45s cubic-bezier(0.22,1,0.36,1) backwards",
        sweep: "sweep 1.15s ease-out both",
        "bar-grow": "bar-grow 0.7s cubic-bezier(0.22,1,0.36,1) backwards",
        "bar-grow-x": "bar-grow-x 0.7s cubic-bezier(0.22,1,0.36,1) backwards",
        "sheet-up": "sheet-up 0.4s cubic-bezier(0.22,1,0.36,1) backwards",
        "sheet-down": "sheet-down 0.26s cubic-bezier(0.4,0,1,1) both",
        "modal-in": "modal-in 0.34s cubic-bezier(0.22,1,0.36,1) backwards",
        "modal-out": "modal-out 0.22s ease-in both",
        "backdrop-in": "backdrop-in 0.3s ease-out backwards",
        "backdrop-out": "backdrop-out 0.24s ease-in both",
      },
      transitionTimingFunction: {
        // A confident ease-out with a touch of overshoot-free "settle".
        spring: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
