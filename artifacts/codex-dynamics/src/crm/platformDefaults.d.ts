export function fetchSiteConfigFromBackend(options?: {
  admin?: boolean;
  adminToken?: string;
}): Promise<any | null>;

export function saveSiteConfigToApi(
  siteConfig: object | null,
  adminToken?: string,
): Promise<any | null>;

export function updateSiteConfigToApi(
  patch: object,
  adminToken?: string,
): Promise<any | null>;

export function sanitizePublicSiteConfig(siteConfig: object | null | undefined): any;