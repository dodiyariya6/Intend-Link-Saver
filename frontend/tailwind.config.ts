/**
 * Tailwind theme, wired to the CSS custom properties defined in
 * src/design/tokens.css. This is the approved design system config —
 * every color/spacing/radius/shadow/motion value used anywhere in the app
 * must come from here, never an arbitrary bracket value or inline hex.
 */
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "-apple-system", "Segoe UI", "sans-serif"],
      },
      fontSize: {
        display: ["40px", { lineHeight: "1.15", fontWeight: "700" }],
        h1: ["32px", { lineHeight: "1.2", fontWeight: "700" }],
        h2: ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        h3: ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        body: ["14px", { lineHeight: "1.6", fontWeight: "400" }],
        label: ["13px", { lineHeight: "1.4", fontWeight: "500" }],
        caption: ["12px", { lineHeight: "1.4", fontWeight: "500" }],
        overline: [
          "11px",
          { lineHeight: "1.3", fontWeight: "600", letterSpacing: "0.04em" },
        ],
      },
      colors: {
        canvas: "var(--color-bg-canvas)",
        surface: {
          DEFAULT: "var(--color-bg-surface)",
          sunken: "var(--color-bg-surface-sunken)",
          hover: "var(--color-bg-surface-hover)",
        },
        border: {
          subtle: "var(--color-border-subtle)",
          DEFAULT: "var(--color-border-default)",
          strong: "var(--color-border-strong)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
          onAccent: "var(--color-text-on-accent)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          subtle: "var(--color-accent-subtle)",
          border: "var(--color-accent-border)",
        },
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: {
          DEFAULT: "var(--color-danger)",
          subtle: "var(--color-danger-subtle)",
        },
      },
      // Spacing: deliberately NOT overriding Tailwind's default scale.
      // Tailwind's default scale is already `key * 4px`, so it already IS
      // our approved 8px grid on its even keys — no redefinition needed,
      // just a documented, enforced subset of keys to use. The design
      // system's named tokens map to these native Tailwind keys:
      //
      //   space-0.5 (4px)  -> key 1     space-4  (32px) -> key 8
      //   space-1   (8px)  -> key 2     space-5  (40px) -> key 10
      //   space-1.5 (12px) -> key 3     space-6  (48px) -> key 12
      //   space-2   (16px) -> key 4     space-8  (64px) -> key 16
      //   space-3   (24px) -> key 6     space-10 (80px) -> key 20
      //                                 space-12 (96px) -> key 24
      //
      // Only these keys (plus 0) are "approved" — arbitrary bracket values
      // and off-grid keys (5, 7, 9, 11...) should not appear in component code.
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        full: "9999px",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        focus: "var(--shadow-focus)",
      },
      maxWidth: {
        content: "1200px",
        prose: "65ch",
      },
      transitionDuration: {
        150: "150ms",
        180: "180ms",
        200: "200ms",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.98)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-up-fade": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out",
        "scale-in": "scale-in 180ms ease-out",
        "slide-up-fade": "slide-up-fade 180ms ease-out",
        shimmer: "shimmer 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
