import { DEFAULT_BRANDING } from "./defaults";
import type { ResolvedBranding } from "./types";

interface ClientOrganizationBranding {
  name?: string | null;
  branding?: ResolvedBranding | null;
}

export function getOrganizationLogo(organization?: ClientOrganizationBranding | null) {
  const branding = organization?.branding;
  if (branding?.isCustom) {
    return branding.logo;
  }

  return DEFAULT_BRANDING.logo;
}
