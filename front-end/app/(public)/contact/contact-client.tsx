"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/storefront/icons";
import { apiFetch } from "@/lib/api-client";
import { CONTACT_SUBJECTS, type ContactSubject } from "@/lib/labels";
import { SHOP } from "@/lib/shop-config";
import { useI18n } from "@/lib/i18n/context";
import { interpolate } from "@/lib/i18n/localize";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactClient() {
  const { t, isRTL } = useI18n();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState<ContactSubject>(CONTACT_SUBJECTS[0]);
  const [message, setMessage] = useState("");

  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const SUBJECT_LABELS: Record<ContactSubject, string> = {
    "Question produit": t.contact.subjects.question,
    "Commande & livraison": t.contact.subjects.order,
    "Garantie & SAV": t.contact.subjects.warranty,
    Autre: t.contact.subjects.other,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg(t.contact.errorNameReq);
      return;
    }
    if (!email.trim() || !EMAIL_RE.test(email.trim())) {
      setErrorMsg(t.contact.errorEmailInvalid);
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      setErrorMsg(t.contact.errorMessageMin);
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await apiFetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          subject,
          message: message.trim(),
        }),
      });

      const body = (await res.json().catch(() => null)) as {
        error?: string;
        errors?: Record<string, string>;
      } | null;

      if (!res.ok) {
        setErrorMsg(
          body?.errors
            ? Object.values(body.errors)[0]
            : (body?.error ?? t.contact.errorSendFailed),
        );
        setStatus("idle");
        return;
      }

      setStatus("success");
      setFullName("");
      setEmail("");
      setPhone("");
      setSubject(CONTACT_SUBJECTS[0]);
      setMessage("");
    } catch {
      setStatus("idle");
      setErrorMsg(
        interpolate(t.contact.errorSendFailedRetry, { phone: SHOP.phone }),
      );
    }
  };

  return (
    <div className="mx-auto max-w-[1360px] px-5 pb-16 pt-8 sm:px-8">
      <div className="mx-auto mb-10 max-w-2xl border-b border-[#17251f]/10 pb-6 text-center">
        <span className="block font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#1d4538]">
          {t.contact.eyebrow}
        </span>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-.06em] text-[#17251f] sm:text-5xl">
          {t.contact.title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[#5c6c64]">
          {t.contact.subtitle}
        </p>
      </div>

      <div className="mx-auto max-w-2xl rounded-2xl border border-[#17251f]/10 bg-[#fdfcf8] p-6 shadow-sm sm:p-10">
        {status === "success" ? (
          <div className="my-2 animate-fade-in rounded-xl border border-[#1d4538]/20 bg-[#edf3ee] p-8 text-center">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#1d4538] text-white shadow-sm">
              <CheckIcon className="h-7 w-7" />
            </span>
            <h2 className="text-xl font-semibold text-[#17251f]">
              {t.contact.successTitle}
            </h2>
            <p className="mt-2 text-sm text-[#5c6c64]">
              {t.contact.successMessage}
            </p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="mt-6 cursor-pointer rounded-xl border border-[#1d4538] bg-white px-6 py-2.5 text-xs font-bold uppercase tracking-[.1em] text-[#1d4538] transition hover:bg-[#edf3ee]"
            >
              {t.contact.sendAnother}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
                {errorMsg}
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-2 block text-[11px] font-bold uppercase tracking-[.08em] text-[#17251f]"
                >
                  {t.contact.fullName} <span className="text-[#1d4538]">*</span>
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.contact.fullNamePlaceholder}
                  className="w-full rounded-xl border border-[#17251f]/15 bg-white px-4 py-3 text-sm text-[#17251f] outline-none transition focus:border-[#1d4538] focus:ring-2 focus:ring-[#1d4538]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-[11px] font-bold uppercase tracking-[.08em] text-[#17251f]"
                >
                  {t.contact.email} <span className="text-[#1d4538]">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.contact.emailPlaceholder}
                  className="w-full rounded-xl border border-[#17251f]/15 bg-white px-4 py-3 text-sm text-[#17251f] outline-none transition focus:border-[#1d4538] focus:ring-2 focus:ring-[#1d4538]/15"
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-[11px] font-bold uppercase tracking-[.08em] text-[#17251f]"
                >
                  {t.contact.phone}
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.contact.phonePlaceholder}
                  className="w-full rounded-xl border border-[#17251f]/15 bg-white px-4 py-3 text-sm text-[#17251f] outline-none transition focus:border-[#1d4538] focus:ring-2 focus:ring-[#1d4538]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="subject"
                  className="mb-2 block text-[11px] font-bold uppercase tracking-[.08em] text-[#17251f]"
                >
                  {t.contact.subject} <span className="text-[#1d4538]">*</span>
                </label>
                <select
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value as ContactSubject)}
                  className="w-full rounded-xl border border-[#17251f]/15 bg-white px-4 py-3 text-sm text-[#17251f] outline-none transition focus:border-[#1d4538] focus:ring-2 focus:ring-[#1d4538]/15"
                >
                  {CONTACT_SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {SUBJECT_LABELS[s] ?? s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="message"
                className="mb-2 block text-[11px] font-bold uppercase tracking-[.08em] text-[#17251f]"
              >
                {t.contact.message} <span className="text-[#1d4538]">*</span>
              </label>
              <textarea
                id="message"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t.contact.messagePlaceholder}
                className="w-full resize-y rounded-xl border border-[#17251f]/15 bg-white p-4 text-sm text-[#17251f] outline-none transition focus:border-[#1d4538] focus:ring-2 focus:ring-[#1d4538]/15"
              />
            </div>

            <button
              type="submit"
              disabled={status === "loading"}
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-[#1d4538] py-4 text-[12px] font-bold uppercase tracking-[.12em] text-white shadow-md transition-all duration-200 hover:bg-[#14352b] hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "loading" ? (
                <span>{t.contact.sending}</span>
              ) : (
                <>
                  <span>{t.contact.sendBtn}</span>
                  <span className={`text-base ${isRTL ? "rotate-180" : ""}`}>→</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <div className="mx-auto mt-8 grid max-w-2xl gap-3 text-center font-mono text-[11px] uppercase tracking-[.14em] text-[#627269] sm:grid-cols-3">
        <p>{SHOP.phone}</p>
        <p className="normal-case tracking-normal">{SHOP.email}</p>
        <p className="normal-case tracking-normal">{SHOP.address}</p>
      </div>
    </div>
  );
}
