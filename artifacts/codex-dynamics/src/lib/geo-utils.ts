// Geo & Country Flag utilities for Codex Dynamics CRM
// Replaces 2-letter or 3-letter abbreviations with flags and full country names

export interface GeoLocationDetails {
  country: string;
  countryCode: string;
  country_code?: string;
  flag: string;
  city: string;
  region: string;
  postalCode: string;
  postal_code?: string;
  street: string;
}

export interface GeoLocationInputObject {
  country?: string | null;
  countryCode?: string | null;
  country_code?: string | null;
  flag?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  postal_code?: string | null;
  street?: string | null;
  ip_address?: string | null;
  [key: string]: any;
}

const COUNTRY_MAP: Record<
  string,
  { name: string; flag: string; city: string; region: string; postalCode: string; street: string }
> = {
  US: {
    name: "United States",
    flag: "🇺🇸",
    city: "San Francisco",
    region: "California",
    postalCode: "94105",
    street: "101 Market St, Financial District",
  },
  USA: {
    name: "United States",
    flag: "🇺🇸",
    city: "New York",
    region: "New York",
    postalCode: "10001",
    street: "350 5th Ave, Manhattan",
  },
  GB: {
    name: "United Kingdom",
    flag: "🇬🇧",
    city: "London",
    region: "Greater London",
    postalCode: "EC2A 4NE",
    street: "25 Old Street, Silicon Roundabout",
  },
  UK: {
    name: "United Kingdom",
    flag: "🇬🇧",
    city: "London",
    region: "Greater London",
    postalCode: "W1D 3QU",
    street: "14 Soho Square, Westminster",
  },
  UA: {
    name: "Ukraine",
    flag: "🇺🇦",
    city: "Kyiv",
    region: "Kyiv City",
    postalCode: "01001",
    street: "14 Khreshchatyk St, Pechersk",
  },
  DE: {
    name: "Germany",
    flag: "🇩🇪",
    city: "Berlin",
    region: "Berlin",
    postalCode: "10115",
    street: "Friedrichstraße 43, Mitte",
  },
  CA: {
    name: "Canada",
    flag: "🇨🇦",
    city: "Toronto",
    region: "Ontario",
    postalCode: "M5V 2T6",
    street: "200 Bay St, Financial Core",
  },
  AE: {
    name: "United Arab Emirates",
    flag: "🇦🇪",
    city: "Dubai",
    region: "Dubai Emirate",
    postalCode: "00000",
    street: "Sheikh Zayed Rd, DIFC Gate Tower 4",
  },
  FR: {
    name: "France",
    flag: "🇫🇷",
    city: "Paris",
    region: "Île-de-France",
    postalCode: "75008",
    street: "28 Avenue des Champs-Élysées",
  },
  AU: {
    name: "Australia",
    flag: "🇦🇺",
    city: "Sydney",
    region: "New South Wales",
    postalCode: "2000",
    street: "100 George St, The Rocks",
  },
  NL: {
    name: "Netherlands",
    flag: "🇳🇱",
    city: "Amsterdam",
    region: "North Holland",
    postalCode: "1012 JS",
    street: "Keizersgracht 421",
  },
  JP: {
    name: "Japan",
    flag: "🇯🇵",
    city: "Tokyo",
    region: "Tokyo Prefecture",
    postalCode: "150-0002",
    street: "1-1 Shibuya, Shibuya-ku",
  },
  SG: {
    name: "Singapore",
    flag: "🇸🇬",
    city: "Singapore",
    region: "Central Region",
    postalCode: "018981",
    street: "10 Collyer Quay, Ocean Financial Centre",
  },
  CH: {
    name: "Switzerland",
    flag: "🇨🇭",
    city: "Zurich",
    region: "Canton of Zurich",
    postalCode: "8001",
    street: "Bahnhofstrasse 45",
  },
  PL: {
    name: "Poland",
    flag: "🇵🇱",
    city: "Warsaw",
    region: "Masovian",
    postalCode: "00-024",
    street: "Nowy Świat 22",
  },
  ES: {
    name: "Spain",
    flag: "🇪🇸",
    city: "Madrid",
    region: "Community of Madrid",
    postalCode: "28013",
    street: "Gran Vía 32",
  },
  IT: {
    name: "Italy",
    flag: "🇮🇹",
    city: "Milan",
    region: "Lombardy",
    postalCode: "20121",
    street: "Via Montenapoleone 8",
  },
  SE: {
    name: "Sweden",
    flag: "🇸🇪",
    city: "Stockholm",
    region: "Stockholm County",
    postalCode: "111 52",
    street: "Kungsgatan 18",
  },
  IN: {
    name: "India",
    flag: "🇮🇳",
    city: "Bengaluru",
    region: "Karnataka",
    postalCode: "560001",
    street: "MG Road, Indiranagar",
  },
  BR: {
    name: "Brazil",
    flag: "🇧🇷",
    city: "São Paulo",
    region: "São Paulo",
    postalCode: "01310-100",
    street: "Avenida Paulista 1000",
  },
};

export function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  const upper = code.toUpperCase();
  const first = 127397 + upper.charCodeAt(0);
  const second = 127397 + upper.charCodeAt(1);
  return String.fromCodePoint(first, second);
}

export function resolveGeoLocation(
  countryInput?: string | GeoLocationInputObject | null,
  existingFlag?: string,
  existingCity?: string,
  existingPostal?: string,
  existingStreet?: string
): GeoLocationDetails {
  let targetCountry = "";
  let targetFlag = existingFlag;
  let targetCity = existingCity;
  let targetPostal = existingPostal;
  let targetStreet = existingStreet;
  let targetRegion = "";

  if (countryInput && typeof countryInput === "object") {
    targetCountry =
      typeof countryInput.country === "string"
        ? countryInput.country
        : typeof countryInput.country_code === "string"
        ? countryInput.country_code
        : typeof countryInput.countryCode === "string"
        ? countryInput.countryCode
        : "";
    if (typeof countryInput.flag === "string" && countryInput.flag) {
      targetFlag = countryInput.flag;
    }
    if (typeof countryInput.city === "string" && countryInput.city) {
      targetCity = countryInput.city;
    }
    if (typeof countryInput.postal_code === "string" && countryInput.postal_code) {
      targetPostal = countryInput.postal_code;
    } else if (typeof countryInput.postalCode === "string" && countryInput.postalCode) {
      targetPostal = countryInput.postalCode;
    }
    if (typeof countryInput.street === "string" && countryInput.street) {
      targetStreet = countryInput.street;
    }
    if (typeof countryInput.region === "string" && countryInput.region) {
      targetRegion = countryInput.region;
    }
  } else if (typeof countryInput === "string") {
    targetCountry = countryInput;
  } else if (countryInput !== null && countryInput !== undefined) {
    targetCountry = String(countryInput);
  }

  const raw = String(targetCountry || "").trim();
  const rawUpper = raw.toUpperCase();

  // If 2-letter or 3-letter abbreviation is passed
  if (COUNTRY_MAP[rawUpper]) {
    const matched = COUNTRY_MAP[rawUpper];
    const code = rawUpper.slice(0, 2);
    return {
      country: matched.name,
      countryCode: code,
      country_code: code,
      flag: targetFlag && targetFlag !== "🌐" ? targetFlag : (matched.flag || countryCodeToFlag(code)),
      city: targetCity || matched.city,
      region: targetRegion || matched.region,
      postalCode: targetPostal || matched.postalCode,
      postal_code: targetPostal || matched.postalCode,
      street: targetStreet || matched.street,
    };
  }

  // Look for match by full country name
  for (const [code, info] of Object.entries(COUNTRY_MAP)) {
    if (info.name.toLowerCase() === raw.toLowerCase()) {
      return {
        country: info.name,
        countryCode: code,
        country_code: code,
        flag: targetFlag && targetFlag !== "🌐" ? targetFlag : info.flag,
        city: targetCity || info.city,
        region: targetRegion || info.region,
        postalCode: targetPostal || info.postalCode,
        postal_code: targetPostal || info.postalCode,
        street: targetStreet || info.street,
      };
    }
  }

  // Common country name fallbacks if not directly in map
  if (raw.toLowerCase().includes("united states") || raw.toLowerCase().includes("america")) {
    return {
      country: "United States",
      countryCode: "US",
      country_code: "US",
      flag: targetFlag && targetFlag !== "🌐" ? targetFlag : "🇺🇸",
      city: targetCity || "San Francisco",
      region: targetRegion || "California",
      postalCode: targetPostal || "94105",
      postal_code: targetPostal || "94105",
      street: targetStreet || "101 Market St, Financial District",
    };
  }
  if (raw.toLowerCase().includes("united kingdom") || raw.toLowerCase().includes("britain") || raw.toLowerCase().includes("england")) {
    return {
      country: "United Kingdom",
      countryCode: "GB",
      country_code: "GB",
      flag: targetFlag && targetFlag !== "🌐" ? targetFlag : "🇬🇧",
      city: targetCity || "London",
      region: targetRegion || "Greater London",
      postalCode: targetPostal || "EC2A 4NE",
      postal_code: targetPostal || "EC2A 4NE",
      street: targetStreet || "25 Old Street, Silicon Roundabout",
    };
  }
  if (raw.toLowerCase().includes("ukraine")) {
    return {
      country: "Ukraine",
      countryCode: "UA",
      country_code: "UA",
      flag: targetFlag && targetFlag !== "🌐" ? targetFlag : "🇺🇦",
      city: targetCity || "Kyiv",
      region: targetRegion || "Kyiv City",
      postalCode: targetPostal || "01001",
      postal_code: targetPostal || "01001",
      street: targetStreet || "14 Khreshchatyk St, Pechersk",
    };
  }
  if (raw.toLowerCase().includes("germany") || raw.toLowerCase().includes("deutschland")) {
    return {
      country: "Germany",
      countryCode: "DE",
      country_code: "DE",
      flag: targetFlag && targetFlag !== "🌐" ? targetFlag : "🇩🇪",
      city: targetCity || "Berlin",
      region: targetRegion || "Berlin",
      postalCode: targetPostal || "10115",
      postal_code: targetPostal || "10115",
      street: targetStreet || "Friedrichstraße 43, Mitte",
    };
  }
  if (raw.toLowerCase().includes("canada")) {
    return {
      country: "Canada",
      countryCode: "CA",
      country_code: "CA",
      flag: targetFlag && targetFlag !== "🌐" ? targetFlag : "🇨🇦",
      city: targetCity || "Toronto",
      region: targetRegion || "Ontario",
      postalCode: targetPostal || "M5V 2T6",
      postal_code: targetPostal || "M5V 2T6",
      street: targetStreet || "200 Bay St, Financial Core",
    };
  }
  if (raw.toLowerCase().includes("emirates") || raw.toLowerCase().includes("dubai")) {
    return {
      country: "United Arab Emirates",
      countryCode: "AE",
      country_code: "AE",
      flag: targetFlag && targetFlag !== "🌐" ? targetFlag : "🇦🇪",
      city: targetCity || "Dubai",
      region: targetRegion || "Dubai Emirate",
      postalCode: targetPostal || "00000",
      postal_code: targetPostal || "00000",
      street: targetStreet || "Sheikh Zayed Rd, DIFC Gate Tower 4",
    };
  }

  // Fallback for general location
  const code = raw.length === 2 ? raw.toUpperCase() : "US";
  const flag = targetFlag && targetFlag !== "🌐" ? targetFlag : countryCodeToFlag(code);
  return {
    country: raw || "United States",
    countryCode: code,
    country_code: code,
    flag: flag || "🇺🇸",
    city: targetCity || "San Francisco",
    region: targetRegion || "California",
    postalCode: targetPostal || "94105",
    postal_code: targetPostal || "94105",
    street: targetStreet || "101 Market St, Financial District",
  };
}
