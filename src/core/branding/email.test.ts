import { afterEach, describe, expect, test, vi } from "vitest";
import { resolveEmailBranding } from "./email";

const mocks = vi.hoisted(() => ({
  getBrandingForRequest: vi.fn(),
}));

vi.mock("./server", () => ({
  getBrandingForRequest: mocks.getBrandingForRequest,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("resolveEmailBranding", () => {
  test("uses prefixed SMTP env vars for custom branding", async () => {
    vi.stubEnv("EMAIL_ELITE", "elite@example.com");
    vi.stubEnv("EMAIL_PASS_ELITE", "secret");
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    mocks.getBrandingForRequest.mockResolvedValue({
      isCustom: true,
      displayName: "Elite",
      logo: {
        defaultUrl: "https://cdn.example.com/logo.png",
        emailUrl: "https://cdn.example.com/email.png",
        alt: "Elite",
        width: 180,
        height: 60,
      },
      palette: { primary: { "50": "#fffdeb", "100": "#fdf7c8", "500": "#f0b210" } },
      hero: {
        background: "white",
        border: "transparent",
        padding: "0",
        foreground: "var(--foreground)",
        mutedForeground: "var(--muted-foreground)",
        cardBackground: "rgb(255 255 255 / 0.9)",
        cardForeground: "var(--foreground)",
        cardMutedForeground: "var(--muted-foreground)",
        cardBorder: "#e5e7eb",
      },
      email: { fromName: "Elite", smtpEnvPrefix: "ELITE" },
      faviconUrl: "/favicon.ico",
      tenant: "elite",
    });

    const branding = await resolveEmailBranding({
      req: new Request("https://elite.negococloud.es"),
    });

    expect(branding.address).toBe("elite@example.com");
    expect(branding.password).toBe("secret");
    expect(branding.smtpHost).toBe("smtp.example.com");
    expect(branding.logoUrl).toBe("https://cdn.example.com/email.png");
    expect(branding.theme.buttonBg).toBe("#f0b210");
  });

  test("falls back to noreply credentials for default branding", async () => {
    vi.stubEnv("EMAIL_NOREPLY", "noreply@example.com");
    vi.stubEnv("EMAIL_PASS_NOREPLY", "default-secret");
    mocks.getBrandingForRequest.mockResolvedValue({
      isCustom: false,
      displayName: "Negoco Cloud",
      logo: {
        defaultUrl: "/logo_inline.png",
        emailUrl: "https://negococloud.es/favicon.png",
        alt: "Negoco Cloud",
        width: 180,
        height: 60,
      },
      palette: {},
      hero: {
        background: "white",
        border: "transparent",
        padding: "0",
        foreground: "var(--foreground)",
        mutedForeground: "var(--muted-foreground)",
        cardBackground: "rgb(255 255 255 / 0.9)",
        cardForeground: "var(--foreground)",
        cardMutedForeground: "var(--muted-foreground)",
        cardBorder: "#e5e7eb",
      },
      email: { fromName: "Negoco Cloud", smtpEnvPrefix: "NOREPLY" },
      faviconUrl: "/favicon.ico",
      tenant: "default",
    });

    const branding = await resolveEmailBranding({
      req: new Request("https://demo.negococloud.es"),
      logoUrl: "https://cdn.example.com/custom.png",
    });

    expect(branding.address).toBe("noreply@example.com");
    expect(branding.password).toBe("default-secret");
    expect(branding.logoUrl).toBe("https://negococloud.es/favicon.png");
  });
});
