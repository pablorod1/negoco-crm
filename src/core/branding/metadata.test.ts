import { describe, expect, test } from "vitest";
import { DEFAULT_BRANDING } from "./defaults";
import {
  parseBrandingMetadata,
  resolveBrandingFromOrganization,
} from "./metadata";

const metadata = JSON.stringify({
  branding: {
    enabled: true,
    displayName: "Elite Co",
    faviconUrl: "https://cdn.example.com/favicon.png",
    logo: {
      defaultUrl: "https://cdn.example.com/logo.png",
      emailUrl: "https://cdn.example.com/email-logo.png",
      width: 400,
      height: 120,
    },
    palette: {
      primary: {
        "50": "#fffdeb",
        "500": "#f0b210",
        DEFAULT: "#f0b210",
      },
    },
    hero: {
      background: "linear-gradient(90deg, #173f55 0%, #008f8c 100%)",
      foreground: "#ffffff",
      mutedForeground: "rgb(255 255 255 / 0.82)",
      cardBackground: "rgb(255 255 255 / 0.86)",
      cardForeground: "#0f172a",
      cardMutedForeground: "#475569",
    },
    email: {
      fromName: "Elite Co",
      smtpEnvPrefix: "ELITE_CO",
    },
  },
});

describe("parseBrandingMetadata", () => {
  test("returns null for invalid metadata", () => {
    expect(parseBrandingMetadata("{")).toBeNull();
    expect(parseBrandingMetadata(JSON.stringify({ other: true }))).toBeNull();
  });

  test("parses branding metadata", () => {
    expect(parseBrandingMetadata(metadata)).toMatchObject({
      enabled: true,
      displayName: "Elite Co",
      email: { smtpEnvPrefix: "ELITE_CO" },
    });
  });
});

describe("resolveBrandingFromOrganization", () => {
  test("falls back when plan is not elite", () => {
    const branding = resolveBrandingFromOrganization({
      tenant: "starter",
      name: "Starter",
      logo: "https://cdn.example.com/starter.png",
      plan: "starter",
      metadata,
    });

    expect(branding.isCustom).toBe(false);
    expect(branding.displayName).toBe(DEFAULT_BRANDING.displayName);
  });

  test("falls back when branding is disabled", () => {
    const branding = resolveBrandingFromOrganization({
      tenant: "elite",
      name: "Elite",
      logo: null,
      plan: "elite",
      metadata: JSON.stringify({ branding: { enabled: false } }),
    });

    expect(branding.isCustom).toBe(false);
  });

  test("resolves elite branding", () => {
    const branding = resolveBrandingFromOrganization({
      tenant: "elite",
      name: "Elite Org",
      logo: null,
      plan: "elite",
      metadata,
    });

    expect(branding.isCustom).toBe(true);
    expect(branding.displayName).toBe("Elite Co");
    expect(branding.logo.defaultUrl).toBe("https://cdn.example.com/logo.png");
    expect(branding.hero.foreground).toBe("#ffffff");
    expect(branding.hero.cardBackground).toBe("rgb(255 255 255 / 0.86)");
    expect(branding.email.smtpEnvPrefix).toBe("ELITE_CO");
  });

  test("derives readable hero text colors when metadata omits them", () => {
    const darkHeroBranding = resolveBrandingFromOrganization({
      tenant: "nasertel",
      name: "Nasertel",
      logo: null,
      plan: "elite",
      metadata: JSON.stringify({
        branding: {
          enabled: true,
          hero: {
            background: "linear-gradient(90deg, #173f55 0%, #008f8c 100%)",
          },
        },
      }),
    });

    const lightHeroBranding = resolveBrandingFromOrganization({
      tenant: "beenergy",
      name: "Beenergy",
      logo: null,
      plan: "elite",
      metadata: JSON.stringify({
        branding: {
          enabled: true,
          hero: {
            background: "linear-gradient(90deg, #f0b210 0%, #f7d43a 100%)",
          },
        },
      }),
    });

    expect(darkHeroBranding.hero.foreground).toBe("#ffffff");
    expect(darkHeroBranding.hero.mutedForeground).toBe(
      "rgb(255 255 255 / 0.82)",
    );
    expect(lightHeroBranding.hero.foreground).toBe("#0f172a");
    expect(lightHeroBranding.hero.mutedForeground).toBe("#475569");
  });
});
