import { describe, expect, test } from "vitest";
import { getBrandingCssVariables } from "./css";
import { resolveBrandingFromOrganization } from "./metadata";

describe("getBrandingCssVariables", () => {
  test("maps palette and hero config to CSS variables", () => {
    const branding = resolveBrandingFromOrganization({
      tenant: "elite",
      name: "Elite Org",
      logo: null,
      plan: "elite",
      metadata: JSON.stringify({
        branding: {
          enabled: true,
          palette: {
            primary: {
              "50": "#fffdeb",
              "500": "#f0b210",
              DEFAULT: "#f0b210",
            },
          },
          hero: {
            background: "linear-gradient(90deg, #f0b210 0%, #f7d43a 100%)",
            border: "#faee8d",
            padding: "16px",
            foreground: "#0f172a",
            mutedForeground: "#475569",
            cardBackground: "rgb(255 255 255 / 0.42)",
            cardForeground: "#0f172a",
            cardMutedForeground: "#475569",
            cardBorder: "transparent",
          },
        },
      }),
    });

    expect(getBrandingCssVariables(branding)).toMatchObject({
      "--primary-color-50": "#fffdeb",
      "--primary-color-500": "#f0b210",
      "--primary-color": "#f0b210",
      "--bg-hero": "linear-gradient(90deg, #f0b210 0%, #f7d43a 100%)",
      "--hero-border": "#faee8d",
      "--hero-padding": "16px",
      "--hero-foreground": "#0f172a",
      "--hero-muted-foreground": "#475569",
      "--hero-card-background": "rgb(255 255 255 / 0.42)",
      "--hero-card-foreground": "#0f172a",
      "--hero-card-muted-foreground": "#475569",
      "--hero-card-border": "transparent",
    });
  });
});
