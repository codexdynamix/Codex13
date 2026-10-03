import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  FacebookLogo,
  GmailLogo,
  InstagramLogo,
  PhoneLogo,
  TelegramLogo,
  ViberLogo,
  WhatsAppLogo,
} from "@/components/BrandMarks";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";
import { CONTACT, LINKS } from "@/lib/site";
import { useSiteConfig } from "@/context/SiteConfigContext";

type Inquiry = {
  name: string;
  phone: string;
  email: string;
  company?: string;
  budget?: string;
  timeline?: string;
  service?: string;
  message: string;
};

const emptyForm: Inquiry = {
  name: "",
  phone: "",
  email: "",
  company: "",
  budget: "",
  timeline: "",
  service: "",
  message: "",
};

export function Contact() {
  const {
    config,
    socialsGrouped,
    primaryPhone,
    primaryWhatsApp,
    primaryTelegram,
    primaryViber,
    primaryEmail,
    primaryAddress,
  } = useSiteConfig();

  const recipientEmail = config.formSubmitEmail || primaryEmail?.value || CONTACT.email;
  const phoneVal = primaryPhone?.value || CONTACT.phoneDisplay;
  const phoneRaw = primaryPhone?.value?.replace(/[^\d+]/g, "") || CONTACT.phoneE164;
  const phoneHref = primaryPhone?.href || `tel:${phoneRaw}`;

  const currentAddress = primaryAddress || {
    id: "addr-default",
    label: "Kyiv Office",
    city: "Kyiv",
    street: CONTACT.addressStreet,
    fullAddress: CONTACT.addressFull,
    lat: 50.4385,
    lng: 30.5235,
  };

  const whatsappUrl = primaryWhatsApp?.href || LINKS.whatsapp;
  const telegramUrl = primaryTelegram?.href || LINKS.telegram;
  const viberUrl = primaryViber?.href || LINKS.viber;
  const instagramUrl = socialsGrouped.instagram?.[0]?.href || LINKS.instagram;
  const facebookUrl = socialsGrouped.facebook?.[0]?.href || LINKS.facebook;

  const actionList = [
    { href: whatsappUrl, label: "WhatsApp", hint: "WhatsApp", Logo: WhatsAppLogo, external: true },
    { href: telegramUrl, label: "Telegram", hint: "Telegram", Logo: TelegramLogo, external: true },
    { href: viberUrl, label: "Viber", hint: "Viber", Logo: ViberLogo, external: true },
    { href: phoneHref, label: "Call", hint: "Call", Logo: PhoneLogo, external: false },
    { href: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail)}`, label: "Gmail", hint: "Gmail", Logo: GmailLogo, external: true },
  ];

  const [formData, setFormData] = useState<Inquiry>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [live, setLive] = useState(false);

  useEffect(() => {
    setLive(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get("sent") === "1") {
      toast.success("Message sent. We'll be in touch within a day.");
    }
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const extraNotes = [
      formData.company ? `Company: ${formData.company}` : null,
      formData.service ? `Service: ${formData.service}` : null,
    ].filter(Boolean).join(" | ");

    const finalMessage = extraNotes
      ? `[${extraNotes}]\n\n${formData.message.trim()}`
      : formData.message.trim();

    const data: Inquiry = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      company: formData.company?.trim(),
      budget: formData.budget?.trim(),
      timeline: formData.timeline?.trim(),
      service: formData.service?.trim(),
      message: finalMessage,
    };
    if (!data.name || !data.email || !data.message) {
      toast.error("Please fill in every field.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...data, source: "website_contact_form" }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (!response.ok || !result?.ok) throw new Error("Lead capture failed");
      toast.success("Message sent. We'll be in touch within a day.");
      setFormData(emptyForm);
    } catch {
      toast.error(
        `Could not send. Email us at ${recipientEmail} or WhatsApp ${phoneVal}.`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id="contact"
      aria-label="Contact"
      className="scroll-mt-24 bg-fill-elevated py-16 sm:py-24"
    >
      <div className="shell">
        <Reveal>
          <p className="mb-4 text-xs font-medium tracking-[0.22em] text-subtle uppercase">
            {config.contact?.badge || "Contact"}
          </p>
          <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-label sm:text-5xl lg:text-6xl">
            {config.contact?.title || "One number. Every channel."}
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {config.contact?.subtitle || "WhatsApp, Telegram, Viber, calls — same line. Write us, or visit our office."}
          </p>
        </Reveal>

        <div className="mt-12 grid items-start gap-6 lg:grid-cols-2 lg:gap-8">
          <Reveal>
            <article className="surface-lift flex flex-col overflow-hidden rounded-xl bg-card">
              <div className="flex flex-col items-center px-6 pt-6 pb-5 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-blue text-xl font-semibold text-paper shadow-[inset_0_0.5px_0_rgb(255_255_255_/_0.35)]">
                  {config.siteName?.[0] || CONTACT.name[0] || "C"}
                </span>
                <h3 className="mt-3.5 text-xl font-semibold tracking-tight text-label">
                  {config.siteName || CONTACT.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentAddress.city} office · {currentAddress.street}
                </p>
              </div>

              <div>
                <div className="grid grid-cols-5 gap-1 border-t border-hairline px-3 py-4 sm:px-5">
                  {actionList.map((action) => (
                    <a
                      key={action.label}
                      href={action.href}
                      {...(action.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="flex flex-col items-center gap-1.5 rounded-xl py-2 transition-colors duration-150 hover:bg-fill"
                    >
                      <action.Logo className="size-9 sm:size-10" />
                      <span className="text-[10px] font-medium tracking-wide text-label sm:text-[11px]">
                        {action.hint}
                      </span>
                    </a>
                  ))}
                </div>

                {(instagramUrl || facebookUrl || (socialsGrouped.custom && socialsGrouped.custom.length > 0)) && (
                  <div className="flex flex-wrap items-center justify-center gap-3 border-t border-hairline px-5 py-3 bg-card">
                    {instagramUrl && (
                      <a
                        href={instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Instagram"
                        className="transition-transform duration-150 hover:scale-105"
                      >
                        <InstagramLogo className="size-8" />
                      </a>
                    )}
                    {facebookUrl && (
                      <a
                        href={facebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Facebook"
                        className="transition-transform duration-150 hover:scale-105"
                      >
                        <FacebookLogo className="size-8" />
                      </a>
                    )}
                    {socialsGrouped.custom?.map((s, idx) => (
                      <a
                        key={idx}
                        href={s.href || s.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-label hover:bg-fill transition-colors"
                      >
                        {s.label || "Link"}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </article>
          </Reveal>

          <Reveal delay={80}>
            <div className="surface-lift flex flex-col justify-between overflow-hidden rounded-xl bg-card">
              {live ? (
                <form
                  action="/api/crm/leads"
                  method="post"
                  onSubmit={handleSubmit}
                  className="p-2"
                >
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    className="absolute -left-[9999px] h-0 w-0 opacity-0"
                    aria-hidden="true"
                  />
                  <div className="divide-y divide-hairline rounded-lg bg-fill">
                    <label className="block px-5 py-4">
                      <span className="mb-1.5 block text-xs font-medium tracking-wide text-subtle uppercase">
                        Name
                      </span>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        maxLength={100}
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        className="w-full bg-transparent text-base text-label outline-none placeholder:text-subtle"
                        placeholder="Your name"
                        autoComplete="name"
                        required
                      />
                    </label>
                    <label className="block px-5 py-4">
                      <span className="mb-1.5 block text-xs font-medium tracking-wide text-subtle uppercase">
                        Phone
                      </span>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        maxLength={40}
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                        className="w-full bg-transparent text-base text-label outline-none placeholder:text-subtle"
                        placeholder="+1 (555) 000-0000"
                        autoComplete="tel"
                      />
                    </label>
                    <label className="block px-5 py-4">
                      <span className="mb-1.5 block text-xs font-medium tracking-wide text-subtle uppercase">
                        Email
                      </span>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        maxLength={255}
                        value={formData.email}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        className="w-full bg-transparent text-base text-label outline-none placeholder:text-subtle"
                        placeholder="you@company.com"
                        autoComplete="email"
                        required
                      />
                    </label>

                    {config.contactForm?.showCompany !== false && (
                      <label className="block px-5 py-4">
                        <span className="mb-1.5 block text-xs font-medium tracking-wide text-subtle uppercase">
                          Company / Brand (Optional)
                        </span>
                        <input
                          id="company"
                          name="company"
                          type="text"
                          maxLength={120}
                          value={formData.company || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              company: e.target.value,
                            }))
                          }
                          className="w-full bg-transparent text-base text-label outline-none placeholder:text-subtle"
                          placeholder="e.g. Acme Corp or Retail Brand"
                        />
                      </label>
                    )}

                    {config.contactForm?.showServiceSelect !== false && (
                      <label className="block px-5 py-4">
                        <span className="mb-1.5 block text-xs font-medium tracking-wide text-subtle uppercase">
                          Service Needed
                        </span>
                        <select
                          id="service"
                          name="service"
                          value={formData.service || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              service: e.target.value,
                            }))
                          }
                          className="w-full bg-transparent text-base text-label outline-none"
                        >
                          <option value="">Select a service focus...</option>
                          <option value="Custom Web Development & Storefronts">Custom Web Development & Storefronts</option>
                          <option value="Bespoke CRM & VoIP Calling Desks">Bespoke CRM & VoIP Calling Desks</option>
                          <option value="Paid Ad Campaigns & Acquisition">Paid Ad Campaigns & Acquisition</option>
                          <option value="Email Marketing & Automation Flows">Email Marketing & Automation Flows</option>
                          <option value="Brand Identity & Web Systems">Brand Identity & Web Systems</option>
                        </select>
                      </label>
                    )}

                    <label className="block px-5 py-4">
                      <span className="mb-1.5 block text-xs font-medium tracking-wide text-subtle uppercase">
                        Message
                      </span>
                      <textarea
                        id="message"
                        name="message"
                        rows={5}
                        maxLength={1000}
                        value={formData.message}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            message: e.target.value,
                          }))
                        }
                        className="w-full resize-none bg-transparent text-base text-label outline-none placeholder:text-subtle"
                        placeholder="Site rebuild, new brand, social campaigns — what's the job?"
                        required
                      />
                    </label>
                  </div>
                  <div className="p-4">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full"
                      size="lg"
                    >
                      {isSubmitting ? "Sending…" : "Send message"}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="h-96" aria-hidden="true" />
              )}
            </div>
          </Reveal>
        </div>

        <Reveal delay={100} className="mt-6">
          <article className="map-frame surface-lift relative overflow-hidden rounded-xl bg-muted">
            <iframe
              title="Codex Dynamics office — Sportyvna, 1A, Kyiv"
              src={LINKS.mapsEmbed}
              className="relative z-10 h-[22rem] w-full border-0 sm:h-[28rem]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
            <div className="map-card pointer-events-auto absolute bottom-4 right-4 z-20 max-w-[min(calc(100%-2rem),22rem)] rounded-xl p-4 sm:bottom-5 sm:right-5">
              <p className="text-[11px] font-medium tracking-[0.18em] text-subtle uppercase">
                Kyiv Office
              </p>
              <p className="mt-1 text-lg font-semibold tracking-tight text-label">
                {CONTACT.addressStreet}
              </p>
              <p className="text-sm text-muted-foreground">
                {CONTACT.addressCity}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={LINKS.mapsDirections}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center rounded-full bg-blue px-4 text-sm font-medium text-paper hover:bg-blue-hover"
                >
                  Directions
                </a>
                <a
                  href={LINKS.mapsApple}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center rounded-full bg-fill px-4 text-sm font-medium text-label hover:bg-muted"
                >
                  Apple Maps
                </a>
              </div>
            </div>
          </article>
        </Reveal>
      </div>
    </section>
  );
}
