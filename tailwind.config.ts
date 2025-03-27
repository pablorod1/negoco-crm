import type { Config } from "tailwindcss";
import { heroui } from "@heroui/react";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          background: "hsl(var(--sidebar-background))",
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        primary: {
          DEFAULT: "var(--primary-color-500)",
          foreground: "#fff",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 10px)",
      },
    },
  },
  plugins: [
    heroui({
      themes: {
        beenergy: {
          colors: {
            primary: {
              50: "#fffdeb",
              100: "#fdf7c8",
              200: "#faee8d",
              300: "#f8e151",
              400: "#f7d43a",
              500: "#f0b210",
              600: "#d48a0b",
              700: "#b0630d",
              800: "#8f4d11",
              900: "#763f11",
              DEFAULT: "#f0b210",
              foreground: "#fff",
            },
            danger: {
              DEFAULT: "#dc3545",
              foreground: "#fff",
            },
            default: {
              DEFAULT: "#ffffff",
              foreground: "#d48a0b",
            },
          },
        },
        light: {
          colors: {
            primary: {
              50: "#f0f6ff",
              100: "#dbe8fe",
              200: "#bfd7fe",
              300: "#93bbfd",
              400: "#609afa",
              500: "#3b82f6",
              600: "#2570eb",
              700: "#1d64d8",
              800: "#1e55af",
              900: "#1e478a",
              DEFAULT: "#f0b210",
              foreground: "#fff",
            },
            danger: {
              DEFAULT: "#dc3545",
              foreground: "#fff",
            },
            default: {
              DEFAULT: "#ffffff",
              foreground: "#3b82f6",
            },
          },
        },
      },
      layout: {
        radius: {
          small: "6px",
        },
      },
    }),
    tailwindcssAnimate,
  ],
} satisfies Config;
