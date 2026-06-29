import { describe, expect, test } from "vitest";
import { DEFAULT_BRANDING } from "./defaults";
import { getOrganizationLogo } from "./client";

describe("getOrganizationLogo", () => {
  test("uses default logo without elite organization branding", () => {
    expect(getOrganizationLogo(null)).toEqual(DEFAULT_BRANDING.logo);
    expect(
      getOrganizationLogo({
        name: "Starter",
      }),
    ).toEqual(DEFAULT_BRANDING.logo);
  });

  test("does not use organization logo without active branding", () => {
    expect(
      getOrganizationLogo({
        name: "Elite Org",
        branding: {
          ...DEFAULT_BRANDING,
          tenant: "elite",
          isCustom: false,
        },
      }),
    ).toEqual(DEFAULT_BRANDING.logo);
  });

  test("uses resolved branding logo when available", () => {
    expect(
      getOrganizationLogo({
        branding: {
          ...DEFAULT_BRANDING,
          isCustom: true,
          logo: {
            defaultUrl: "https://cdn.example.com/custom.png",
            emailUrl: "https://cdn.example.com/email.png",
            alt: "Custom",
            width: 400,
            height: 120,
          },
        },
      }),
    ).toMatchObject({
      defaultUrl: "https://cdn.example.com/custom.png",
      alt: "Custom",
      width: 400,
      height: 120,
    });
  });
});
