export const NAV_LINKS = [
  { href: "#services", label: "Services" },
  { href: "#work", label: "Projects" },
  { href: "#process", label: "Process" },
  { href: "#about", label: "About" },
  { href: "#reviews", label: "Reviews" },
  { href: "#contact", label: "Contact" },
] as const;

export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export function smoothNavigate(path: string) {
  if (typeof window === 'undefined') return;
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

if (typeof window !== 'undefined') {
  (window as any).cdxNavigate = smoothNavigate;
}
