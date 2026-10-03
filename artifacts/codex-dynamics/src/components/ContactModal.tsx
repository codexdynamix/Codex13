import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Send,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  WhatsAppLogo,
  TelegramLogo,
  PhoneLogo,
  GmailLogo,
} from "@/components/BrandMarks";
import { LINKS } from "@/lib/site";
import { cn } from "@/lib/utils";

export interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultService?: string;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  company: string;
  service: string;
  message: string;
}

const SERVICES = [
  "High-Performance Website",
  "Web Design & UI/UX",
  "Full-Stack Web App",
  "SEO & Digital Marketing",
  "Performance Optimization",
  "General Inquiry",
];

export function ContactModal({ isOpen, onClose, defaultService }: ContactModalProps) {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    company: "",
    service: defaultService || SERVICES[0],
    message: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      // Reset success state after closing
      const timer = setTimeout(() => setIsSuccess(false), 300);
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {};

    if (!form.name.trim()) {
      errs.name = "Please enter your name.";
    }

    if (!form.email.trim()) {
      errs.email = "Please enter your email.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = "Please enter a valid email address.";
    }

    if (!form.message.trim()) {
      errs.message = "Please tell us a bit about your project or inquiry.";
    } else if (form.message.trim().length < 8) {
      errs.message = "Please provide at least 8 characters for your message.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setIsSubmitting(true);

      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company: form.company.trim(),
        service: form.service,
        message: `[Service: ${form.service}]\n${form.message.trim()}`,
        source: "website_contact_modal",
      };

      const response = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, kind: "enquiry" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "We couldn't send your inquiry. Please try again.");
      }
      setIsSuccess(true);
      toast.success("Inquiry received! We'll reply shortly.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't send your inquiry. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Dialog Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl max-h-[90vh] bg-card rounded-3xl shadow-2xl border border-hairline overflow-hidden flex flex-col z-10"
          >
            {/* Modal Header */}
            <div className="p-6 sm:p-7 border-b border-hairline flex items-start justify-between gap-4 bg-muted/20">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue mb-1">
                  <Sparkles className="size-3.5" />
                  <span>Direct Agency Desk</span>
                </div>
                <h2
                  id="contact-modal-title"
                  className="text-xl sm:text-2xl font-bold text-label font-display tracking-tight"
                >
                  Contact Us
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Have a project in mind or need engineering counsel? We respond within 2 hours.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="size-9 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-label flex items-center justify-center transition-colors shrink-0"
                aria-label="Close dialog"
              >
                <X className="size-4.5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-7 overflow-y-auto flex-1 space-y-6">
              {isSuccess ? (
                <div className="py-8 text-center space-y-4 animate-in fade-in duration-300">
                  <div className="size-14 rounded-full bg-blue/10 text-blue flex items-center justify-center mx-auto">
                    <CheckCircle2 className="size-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-label font-display">
                      Message Dispatched!
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
                      Thank you, <span className="font-semibold text-label">{form.name}</span>. Our engineering directors have received your dispatch and will respond to <span className="font-mono text-label">{form.email}</span>.
                    </p>
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full sm:w-auto px-6 h-10 rounded-xl bg-blue text-white text-xs font-semibold hover:bg-blue-hover transition-colors cursor-pointer"
                    >
                      Return to Site
                    </button>
                    <a
                      href={LINKS.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto px-4 h-10 rounded-xl border border-hairline text-label text-xs font-semibold hover:bg-muted/40 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <WhatsAppLogo className="size-4" />
                      <span>Chat on WhatsApp</span>
                    </a>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {/* Name & Email Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-label flex items-center justify-between">
                        <span>Your Name *</span>
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, name: e.target.value }));
                          if (errors.name) setErrors((err) => ({ ...err, name: undefined }));
                        }}
                        placeholder="Alex Morgan"
                        disabled={isSubmitting}
                        className={cn(
                          "w-full h-10 rounded-xl bg-paper px-3.5 text-xs text-label border transition-colors outline-none",
                          errors.name
                            ? "border-destructive focus:ring-1 focus:ring-destructive"
                            : "border-hairline focus:border-blue focus:ring-1 focus:ring-blue"
                        )}
                      />
                      {errors.name && (
                        <p className="text-[11px] text-destructive">{errors.name}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-label flex items-center justify-between">
                        <span>Email Address *</span>
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, email: e.target.value }));
                          if (errors.email) setErrors((err) => ({ ...err, email: undefined }));
                        }}
                        placeholder="alex@company.com"
                        disabled={isSubmitting}
                        className={cn(
                          "w-full h-10 rounded-xl bg-paper px-3.5 text-xs text-label border transition-colors outline-none",
                          errors.email
                            ? "border-destructive focus:ring-1 focus:ring-destructive"
                            : "border-hairline focus:border-blue focus:ring-1 focus:ring-blue"
                        )}
                      />
                      {errors.email && (
                        <p className="text-[11px] text-destructive">{errors.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Phone, Company & Service Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-label flex items-center justify-between">
                        <span>Phone</span>
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, phone: e.target.value }))
                        }
                        placeholder="+1 (555) 000-0000"
                        disabled={isSubmitting}
                        className="w-full h-10 rounded-xl bg-paper px-3.5 text-xs text-label border border-hairline focus:border-blue focus:ring-1 focus:ring-blue outline-none transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-label flex items-center justify-between">
                        <span>Company</span>
                      </label>
                      <input
                        type="text"
                        value={form.company}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, company: e.target.value }))
                        }
                        placeholder="Company / Org"
                        disabled={isSubmitting}
                        className="w-full h-10 rounded-xl bg-paper px-3.5 text-xs text-label border border-hairline focus:border-blue focus:ring-1 focus:ring-blue outline-none transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-label">
                        <span>Project Focus</span>
                      </label>
                      <select
                        value={form.service}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, service: e.target.value }))
                        }
                        disabled={isSubmitting}
                        className="w-full h-10 rounded-xl bg-paper px-3 text-xs text-label border border-hairline focus:border-blue focus:ring-1 focus:ring-blue outline-none transition-colors"
                      >
                        {SERVICES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Message Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-label flex items-center justify-between">
                      <span>Message / Project Brief *</span>
                      <span className="text-[10px] text-muted-foreground">Min. 8 characters</span>
                    </label>
                    <textarea
                      rows={4}
                      value={form.message}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, message: e.target.value }));
                        if (errors.message) setErrors((err) => ({ ...err, message: undefined }));
                      }}
                      placeholder="Outline your project, goals, or architectural requirements..."
                      disabled={isSubmitting}
                      className={cn(
                        "w-full rounded-xl bg-paper p-3 text-xs text-label border transition-colors outline-none resize-none leading-relaxed",
                        errors.message
                          ? "border-destructive focus:ring-1 focus:ring-destructive"
                          : "border-hairline focus:border-blue focus:ring-1 focus:ring-blue"
                      )}
                    />
                    {errors.message && (
                      <p className="text-[11px] text-destructive">{errors.message}</p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-11 rounded-2xl bg-blue hover:bg-blue-hover text-white text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          <span>Transmitting Inquiry...</span>
                        </>
                      ) : (
                        <>
                          <span>Transmit Inquiry</span>
                          <Send className="size-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Instant Channels Footer */}
              <div className="pt-5 border-t border-hairline">
                <div className="text-[11px] font-medium text-muted-foreground mb-3 flex items-center justify-between">
                  <span>Prefer an instant direct channel?</span>
                  <span className="font-mono text-[10px] text-subtle">Kyiv Office UTC+2</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <a
                    href={LINKS.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-xl bg-muted/40 hover:bg-muted text-label text-xs transition-colors"
                  >
                    <WhatsAppLogo className="size-5 shrink-0" />
                    <span className="truncate">WhatsApp</span>
                  </a>
                  <a
                    href={LINKS.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-xl bg-muted/40 hover:bg-muted text-label text-xs transition-colors"
                  >
                    <TelegramLogo className="size-5 shrink-0" />
                    <span className="truncate">Telegram</span>
                  </a>
                  <a
                    href={LINKS.tel}
                    className="flex items-center gap-2 p-2 rounded-xl bg-muted/40 hover:bg-muted text-label text-xs transition-colors"
                  >
                    <PhoneLogo className="size-5 shrink-0" />
                    <span className="truncate">Call</span>
                  </a>
                  <a
                    href={LINKS.gmail}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-xl bg-muted/40 hover:bg-muted text-label text-xs transition-colors"
                  >
                    <GmailLogo className="size-5 shrink-0" />
                    <span className="truncate">Gmail</span>
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
