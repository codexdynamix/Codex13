export interface VisitorData {
  session_id: string;
  ip_address: string;
  country: string;
  country_code?: string;
  flag: string;
  city?: string;
  region?: string;
  postal_code?: string;
  street?: string;
  browser: string;
  device: string;
  user_agent: string;
  page_url: string;
  referrer?: string;
  created_at?: string;
  duration_seconds?: number;
  visit_count?: number;
  is_returning?: number;
  pages_viewed?: string;
  cookies_data?: string;
  email?: string;
  name?: string;
  phone?: string;
  is_lead?: number;
}

export function detectBrowser(ua: string): string {
  if (/edg/i.test(ua)) return "Edge";
  if (/opr|opera/i.test(ua)) return "Opera";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  return "Modern Browser";
}

export function detectDevice(ua: string): string {
  if (/ipad|tablet/i.test(ua)) return "Tablet";
  if (/iphone/i.test(ua)) return "Mobile (iPhone)";
  if (/android/i.test(ua)) return "Mobile (Android)";
  if (/macintosh|mac os/i.test(ua)) return "Desktop (macOS)";
  if (/windows/i.test(ua)) return "Desktop (Windows)";
  if (/linux/i.test(ua)) return "Desktop (Linux)";
  return "Desktop";
}

export function getFlagEmoji(countryCode?: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌐";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Cookie Helper Functions
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
  return match ? decodeURIComponent(match[3]) : null;
}

export function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getAllCookiesMap(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const pairs = document.cookie.split(";");
  const result: Record<string, string> = {};
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx);
      const val = decodeURIComponent(trimmed.slice(eqIdx + 1));
      result[key] = val;
    }
  }
  return result;
}

function guessCountryFromTimeZone(tz: string): { country: string; countryCode: string; flag: string } {
  if (!tz) return { country: "Direct Visitor", countryCode: "GL", flag: "🌐" };
  const tzLower = tz.toLowerCase();
  if (tzLower.includes("harare") || tzLower.includes("zimbabwe")) return { country: "Zimbabwe", countryCode: "ZW", flag: "🇿🇼" };
  if (tzLower.includes("johannesburg") || tzLower.includes("south_africa")) return { country: "South Africa", countryCode: "ZA", flag: "🇿🇦" };
  if (tzLower.includes("london")) return { country: "United Kingdom", countryCode: "GB", flag: "🇬🇧" };
  if (tzLower.includes("new_york") || tzLower.includes("los_angeles") || tzLower.includes("chicago") || tzLower.includes("denver")) return { country: "United States", countryCode: "US", flag: "🇺🇸" };
  if (tzLower.includes("toronto") || tzLower.includes("vancouver") || tzLower.includes("montreal")) return { country: "Canada", countryCode: "CA", flag: "🇨🇦" };
  if (tzLower.includes("berlin") || tzLower.includes("frankfurt")) return { country: "Germany", countryCode: "DE", flag: "🇩🇪" };
  if (tzLower.includes("paris")) return { country: "France", countryCode: "FR", flag: "🇫🇷" };
  if (tzLower.includes("kiev") || tzLower.includes("kyiv")) return { country: "Ukraine", countryCode: "UA", flag: "🇺🇦" };
  if (tzLower.includes("tokyo")) return { country: "Japan", countryCode: "JP", flag: "🇯🇵" };
  if (tzLower.includes("sydney") || tzLower.includes("melbourne")) return { country: "Australia", countryCode: "AU", flag: "🇦🇺" };
  if (tzLower.includes("dubai")) return { country: "United Arab Emirates", countryCode: "AE", flag: "🇦🇪" };
  if (tzLower.includes("singapore")) return { country: "Singapore", countryCode: "SG", flag: "🇸🇬" };
  if (tzLower.includes("nairobi")) return { country: "Kenya", countryCode: "KE", flag: "🇰🇪" };
  if (tzLower.includes("lagos")) return { country: "Nigeria", countryCode: "NG", flag: "🇳🇬" };
  if (tzLower.includes("cairo")) return { country: "Egypt", countryCode: "EG", flag: "🇪🇬" };
  if (tzLower.includes("delhi") || tzLower.includes("kolkata") || tzLower.includes("mumbai")) return { country: "India", countryCode: "IN", flag: "🇮🇳" };
  if (tzLower.includes("sao_paulo")) return { country: "Brazil", countryCode: "BR", flag: "🇧🇷" };
  const rawCity = tz.split("/")[1]?.replace(/_/g, " ") || "";
  return { country: rawCity || "Direct Visitor", countryCode: "GL", flag: "🌐" };
}

async function fetchClientGeo(): Promise<{ ip?: string; country: string; countryCode: string; flag: string; city: string; region: string } | null> {
  if (typeof window === "undefined") return null;
  try {
    const cached = sessionStorage.getItem("__cdx_geo_cache");
    if (cached) {
      return JSON.parse(cached);
    }
  // eslint-disable-next-line no-empty
  } catch {}
  return null;
}

// State tracking in memory during active browser session
let sessionStartTime = Date.now();
let heartbeatInterval: NodeJS.Timeout | null = null;
let isTrackerInitialized = false;

export function recordLeadContactInfo(email: string, name?: string, phone?: string): void {
  if (typeof window === "undefined") return;
  if (email) setCookie("__cdx_lead_email", email.trim());
  if (name) setCookie("__cdx_lead_name", name.trim());
  if (phone) setCookie("__cdx_lead_phone", phone.trim());

  // Immediately send sync ping to tie contact info to the active visitor session
  void trackCurrentVisitor(window.location.pathname + window.location.hash);
}

let lastTrackedUrl = "";
let lastTrackedTime = 0;

export async function trackCurrentVisitor(page = "/"): Promise<void> {
  if (typeof window === "undefined") return;

  const activeUrl = page || window.location.pathname + window.location.hash || "/";
  const now = Date.now();
  if (activeUrl === lastTrackedUrl && now - lastTrackedTime < 2500) {
    return;
  }
  lastTrackedUrl = activeUrl;
  lastTrackedTime = now;

  try {
    // 1. Manage Persistent Visitor Cookie UUID (__cdx_vid)
    let visitorUuid = getCookie("__cdx_vid");
    const isNewVisitor = !visitorUuid;
    if (!visitorUuid) {
      visitorUuid = `vid_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      setCookie("__cdx_vid", visitorUuid, 365);
    }

    // 2. Manage Visit Count (__cdx_visit_count)
    let visitCount = parseInt(getCookie("__cdx_visit_count") || "0", 10);
    const sessionCookie = getCookie("__cdx_session");
    if (!sessionCookie) {
      visitCount += 1;
      setCookie("__cdx_visit_count", String(visitCount), 365);
    }

    // 3. Manage First Visit Timestamp (__cdx_first_visit)
    let firstVisit = getCookie("__cdx_first_visit");
    if (!firstVisit) {
      firstVisit = new Date().toISOString();
      setCookie("__cdx_first_visit", firstVisit, 365);
    }

    // 4. Session ID in cookie & sessionStorage
    let sessionId = sessionStorage.getItem("codex_session_id") || getCookie("__cdx_session");
    if (!sessionId) {
      sessionId = `sess_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem("codex_session_id", sessionId);
      setCookie("__cdx_session", sessionId, 1);
      sessionStartTime = Date.now();
    }

    // 5. Manage Cookie Consent & Marketing UTMs
    if (!getCookie("__cdx_cookie_consent")) {
      setCookie("__cdx_cookie_consent", "accepted", 365);
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("utm_source")) {
      setCookie("__cdx_utm_source", urlParams.get("utm_source") || "", 30);
    }
    if (urlParams.get("utm_campaign")) {
      setCookie("__cdx_utm_campaign", urlParams.get("utm_campaign") || "", 30);
    }

    // 6. Track Pages Clicked and Visited History (__cdx_pages_history)
    let pagesHistory: Array<{ url: string; title: string; timestamp: string }> = [];
    try {
      const storedHistory = getCookie("__cdx_pages_history") || sessionStorage.getItem("cdx_pages_history");
      if (storedHistory) {
        pagesHistory = JSON.parse(storedHistory);
      }
    } catch {
      pagesHistory = [];
    }

    const lastPage = pagesHistory[pagesHistory.length - 1];
    if (!lastPage || lastPage.url !== activeUrl) {
      pagesHistory.push({
        url: activeUrl,
        title: document.title || "Codex Dynamics",
        timestamp: new Date().toISOString(),
      });
      if (pagesHistory.length > 15) {
        pagesHistory = pagesHistory.slice(pagesHistory.length - 15);
      }
      const historyStr = JSON.stringify(pagesHistory);
      setCookie("__cdx_pages_history", historyStr, 30);
      try {
        sessionStorage.setItem("cdx_pages_history", historyStr);
      // eslint-disable-next-line no-empty
      } catch {}
    }

    // 7. Calculate Time Spent / Duration
    const durationSeconds = Math.max(1, Math.floor((Date.now() - sessionStartTime) / 1000));
    setCookie("__cdx_duration_secs", String(durationSeconds), 1);

    // 8. Device & Geo Resolution
    const ua = navigator.userAgent;
    const browser = detectBrowser(ua);
    const device = detectDevice(ua);

    // Try real IP Geo, or fallback to real timezone
    const realGeo = await fetchClientGeo();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const tzFallback = guessCountryFromTimeZone(tz);

    const country = realGeo?.country || tzFallback.country;
    const countryCode = realGeo?.countryCode || tzFallback.countryCode;
    const flag = realGeo?.flag || tzFallback.flag;
    const city = realGeo?.city || "";
    const region = realGeo?.region || "";
    const ip = realGeo?.ip || "";

    const referrer = document.referrer ? new URL(document.referrer).hostname : "Direct";

    // Gather cookies map for inspection
    const allCookies = getAllCookiesMap();
    allCookies.__cdx_screen = `${window.screen.width}x${window.screen.height} (${window.devicePixelRatio}x DPR)`;
    allCookies.__cdx_lang = navigator.language;
    allCookies.__cdx_platform = navigator.platform;

    const email = getCookie("__cdx_lead_email") || "";
    const name = getCookie("__cdx_lead_name") || "";
    const phone = getCookie("__cdx_lead_phone") || "";

    const payload = {
      session_id: sessionId,
      ip: ip,
      page: activeUrl,
      country,
      country_code: countryCode,
      flag,
      city,
      region,
      postal_code: "",
      street: "",
      browser,
      device,
      referrer,
      duration_seconds: durationSeconds,
      visit_count: visitCount,
      is_returning: visitCount > 1 || !isNewVisitor ? 1 : 0,
      pages_viewed: JSON.stringify(pagesHistory),
      cookies_data: JSON.stringify(allCookies),
      email,
      name,
      phone,
    };

    // Store visitor session locally
    try {
      sessionStorage.setItem("__cdx_last_visitor_payload", JSON.stringify(payload));
    } catch {}

    // Set up heartbeat listener once
    if (!isTrackerInitialized && typeof window !== "undefined") {
      isTrackerInitialized = true;

      // Listen to browser back/forward page changes
      let lastKnownPathname = window.location.pathname;
      window.addEventListener("popstate", () => {
        if (window.location.pathname !== lastKnownPathname) {
          lastKnownPathname = window.location.pathname;
          void trackCurrentVisitor(window.location.pathname);
        }
      });

      // Periodic heartbeat every 15s to update duration and keep session live
      if (!heartbeatInterval) {
        heartbeatInterval = setInterval(() => {
          const currentDuration = Math.max(1, Math.floor((Date.now() - sessionStartTime) / 1000));
          setCookie("__cdx_duration_secs", String(currentDuration), 1);
        }, 15000);
      }
    }
  } catch {
    // Non-blocking
  }
}

export function initVisitorTracker(): void {
  if (typeof window === "undefined") return;
  void trackCurrentVisitor(window.location.pathname + window.location.hash);
}
