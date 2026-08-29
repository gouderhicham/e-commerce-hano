"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, mediaSrc } from "@/lib/api-client";
import { fmtDA } from "@/lib/format";
import { PHONE_REGEX, computeShipping } from "@/lib/data/rules";
import { SHIPPING } from "@/lib/shop-config";
import { Arrow } from "@/components/storefront/icons";
import { useI18n } from "@/lib/i18n/context";
import { pick } from "@/lib/i18n/localize";
import type { Order, ProductDetail, Wilaya } from "@/lib/data/types";

/* eslint-disable @next/next/no-img-element -- see home-sections.tsx. */

/** Anchor the product page's "Passer la commande" button scrolls to. */
export const ORDER_SECTION_ID = "commander";

const inputCls =
  "mt-2 w-full border-b border-[#17251f]/20 bg-transparent py-3 text-[14px] font-normal text-[#17251f] outline-none transition placeholder:text-[#9ca59e] focus:border-[#1d4538]";
const labelCls =
  "block text-[11px] font-bold uppercase tracking-[.08em] text-[#33423b]";
const errorCls =
  "mt-1 block text-[11px] font-medium normal-case tracking-normal text-red-600";

type Errors = Partial<
  Record<"firstName" | "lastName" | "phone" | "wilaya" | "commune", string>
>;

/**
 * The checkout, inlined on the product page, for this product only.
 */
export function ProductOrderForm({
  product,
  wilayas,
  unitPrice,
  configLabel,
}: {
  product: ProductDetail;
  wilayas: Wilaya[];
  /** Price of the selected configuration, in DA. */
  unitPrice: number;
  /** Label of the selected configuration, e.g. "16 Go / 512 Go". */
  configLabel?: string;
}) {
  const { locale, t } = useI18n();

  const [qty, setQty] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [wilayaCode, setWilayaCode] = useState<number | "">("");
  const [communeId, setCommuneId] = useState<number | "">("");

  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [placed, setPlaced] = useState<Order | null>(null);

  const communes = useMemo(
    () => wilayas.find((w) => w.code === wilayaCode)?.communes ?? [],
    [wilayas, wilayaCode],
  );

  const subtotal = unitPrice * qty;
  const selectedCommune = communes.find((c) => c.id === communeId);
  const selectedWilaya = wilayas.find((w) => w.code === wilayaCode);
  const addressPicked = communeId !== "";
  const shipping = computeShipping({
    subtotal,
    wilayaFee: selectedWilaya?.fee ?? null,
    communeFee: selectedCommune?.fee ?? null,
  });
  const freeShipping =
    SHIPPING.freeThreshold > 0 && subtotal > SHIPPING.freeThreshold;
  const total = subtotal + (addressPicked ? shipping : 0);

  const validate = (): boolean => {
    const next: Errors = {};
    if (!firstName.trim()) next.firstName = t.checkout.errorNameReq;
    if (!lastName.trim()) next.lastName = t.checkout.errorLastNameReq;
    if (!PHONE_REGEX.test(phone.replace(/\s/g, "")))
      next.phone = t.checkout.errorPhoneInvalid;
    if (wilayaCode === "") next.wilaya = t.checkout.errorWilayaReq;
    if (communeId === "") next.commune = t.checkout.errorCommuneReq;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setServerError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          phone: phone.replace(/\s/g, ""),
          wilayaCode: Number(wilayaCode),
          communeId: Number(communeId),
          method: "COD",
          lines: [{ productId: product.id, qty, configLabel }],
        }),
      });

      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const payload = body as
          | { error?: string; errors?: Record<string, string> }
          | null;
        setServerError(
          payload?.errors
            ? (Object.values(payload.errors)[0] ?? t.common.errorGeneric)
            : (payload?.error ?? t.checkout.errorSaveOrder),
        );
        return;
      }
      const payload = body as { order: Order };
      setPlaced(payload?.order ?? (body as Order));
      window.scrollTo({
        top: (document.getElementById(ORDER_SECTION_ID)?.offsetTop ?? 0) - 80,
        behavior: "smooth",
      });
    } catch {
      setServerError(t.common.errorNetwork);
    } finally {
      setSubmitting(false);
    }
  };

  if (placed) {
    return (
      <section
        id={ORDER_SECTION_ID}
        className="border-y border-[#17251f]/10 bg-[#e7eee5] py-16 sm:py-20"
      >
        <div className="mx-auto max-w-[640px] px-5 text-center sm:px-8">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[.22em] text-[#2c5b48]">
            {t.checkout.successEyebrow}
          </span>
          <h2 className="mt-3 text-3xl font-medium tracking-[-.05em] text-[#17251f] sm:text-4xl">
            {t.checkout.successTitleLead}
            <span className="text-[#2c5b48]">{t.checkout.successTitleAccent}</span>
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#58675f]">
            {t.checkout.successOrderRef}{" "}
            <b className="font-mono font-bold text-[#17251f]">
              {placed.id}
            </b>
            . {t.checkout.successCallNotice}
          </p>

          <div className="mt-8 rounded-2xl border border-[#17251f]/10 bg-white p-6 text-start shadow-xs">
            <div className="flex items-center justify-between border-b border-[#17251f]/10 pb-4">
              <div>
                <p className="text-sm font-bold text-[#17251f]">
                  {pick(locale, product.name, product.nameAr)}
                </p>
                {configLabel && (
                  <p className="font-mono text-xs text-[#58675f]">
                    {configLabel} · {t.cart.quantity} : {qty}
                  </p>
                )}
              </div>
              <b className="text-base text-[#17251f]">
                {fmtDA(placed.total ?? total, locale)}
              </b>
            </div>
            <div className="pt-4 text-xs leading-5 text-[#58675f]">
              <p>
                <b>{t.checkout.wilaya} :</b> {pick(locale, selectedWilaya?.name, selectedWilaya?.nameAr)}{" "}
                {selectedCommune
                  ? `· ${pick(locale, selectedCommune.name, selectedCommune.nameAr)}`
                  : ""}
              </p>
              <p className="mt-1">
                <b>{t.checkout.paymentMethod} :</b> {t.checkout.codTitle}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/catalogue"
              className="inline-flex items-center gap-3 rounded-full bg-[#1d4538] px-7 py-3.5 text-xs font-bold uppercase tracking-[.08em] text-white transition hover:bg-[#14352b]"
            >
              {t.product.viewStore} <Arrow />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id={ORDER_SECTION_ID}
      className="border-y border-[#17251f]/10 bg-[#e7eee5] py-16 sm:py-20"
    >
      <div className="mx-auto max-w-[1360px] px-5 sm:px-8">
        <div className="mx-auto max-w-xl text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#627269]">
            {t.checkout.eyebrow}
          </p>
          <h2 className="mt-2 text-3xl font-medium tracking-[-.05em] text-[#17251f] sm:text-4xl">
            {t.product.orderSectionTitle}
          </h2>
          <p className="mt-2 text-sm text-[#58675f]">
            {t.product.orderSectionSubtitle}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="mx-auto mt-10 grid max-w-4xl gap-8 rounded-3xl border border-[#17251f]/10 bg-white p-6 shadow-sm sm:p-10 lg:grid-cols-[1.15fr_.85fr]"
        >
          {/* Inputs */}
          <div>
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-[.14em] text-[#2c5b48]">
              {t.checkout.subtitle}
            </h3>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t.checkout.firstName}</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t.checkout.firstNamePlaceholder}
                  className={inputCls}
                />
                {errors.firstName && <span className={errorCls}>{errors.firstName}</span>}
              </div>
              <div>
                <label className={labelCls}>{t.checkout.lastName}</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t.checkout.lastNamePlaceholder}
                  className={inputCls}
                />
                {errors.lastName && <span className={errorCls}>{errors.lastName}</span>}
              </div>
            </div>

            <div className="mt-4">
              <label className={labelCls}>{t.checkout.phone}</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t.checkout.phonePlaceholder}
                className={inputCls}
              />
              {errors.phone && <span className={errorCls}>{errors.phone}</span>}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t.checkout.wilaya}</label>
                <select
                  value={wilayaCode}
                  onChange={(e) => {
                    const code = e.target.value ? Number(e.target.value) : "";
                    setWilayaCode(code);
                    setCommuneId("");
                  }}
                  className={inputCls}
                >
                  <option value="">{t.checkout.wilayaPlaceholder}</option>
                  {wilayas.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.code} - {pick(locale, w.name, w.nameAr)}
                    </option>
                  ))}
                </select>
                {errors.wilaya && <span className={errorCls}>{errors.wilaya}</span>}
              </div>
              <div>
                <label className={labelCls}>{t.checkout.commune}</label>
                <select
                  value={communeId}
                  onChange={(e) => setCommuneId(e.target.value ? Number(e.target.value) : "")}
                  disabled={wilayaCode === ""}
                  className={inputCls}
                >
                  <option value="">{t.checkout.communePlaceholder}</option>
                  {communes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {pick(locale, c.name, c.nameAr)}
                    </option>
                  ))}
                </select>
                {errors.commune && <span className={errorCls}>{errors.commune}</span>}
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-[#f5f8f4] p-4 text-xs leading-5 text-[#58675f]">
              <p className="font-bold text-[#1d4538]">{t.checkout.codTitle}</p>
              <p className="mt-0.5">{t.checkout.codDescription}</p>
            </div>
          </div>

          {/* Summary */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#17251f]/10 bg-[#f8f7f2] p-6">
            <div>
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-[.14em] text-[#2c5b48]">
                {t.checkout.orderSummaryTitle}
              </h3>

              <div className="mt-4 flex items-center gap-3 border-b border-[#17251f]/10 pb-4">
                {product.imageUrl && (
                  <img
                    src={mediaSrc(product.imageUrl) ?? ""}
                    alt={pick(locale, product.name, product.nameAr)}
                    className="h-16 w-16 rounded-lg object-cover bg-white"
                  />
                )}
                <div>
                  <p className="text-sm font-bold text-[#17251f]">
                    {pick(locale, product.name, product.nameAr)}
                  </p>
                  {configLabel && (
                    <p className="font-mono text-[11px] text-[#63726a]">{configLabel}</p>
                  )}
                  <p className="mt-1 font-mono text-xs font-semibold text-[#1d4538]">
                    {fmtDA(unitPrice, locale)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-[#44524a]">
                  {t.cart.quantity}
                </span>
                <div className="inline-flex items-center rounded-lg border border-[#17251f]/15 bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="h-7 w-7 rounded text-sm font-bold text-[#17251f] hover:bg-[#e7eee5]"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-mono text-xs font-bold">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => q + 1)}
                    className="h-7 w-7 rounded text-sm font-bold text-[#17251f] hover:bg-[#e7eee5]"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2 border-t border-[#17251f]/10 pt-4 text-xs text-[#58675f]">
                <div className="flex justify-between">
                  <span>{t.checkout.subtotal}</span>
                  <b>{fmtDA(subtotal, locale)}</b>
                </div>
                <div className="flex justify-between">
                  <span>{t.checkout.shipping}</span>
                  <b>
                    {addressPicked
                      ? freeShipping
                        ? t.checkout.free
                        : fmtDA(shipping, locale)
                      : t.cart.shippingCalculated}
                  </b>
                </div>
                <div className="flex justify-between border-t border-[#17251f]/10 pt-2 text-sm font-bold text-[#17251f]">
                  <span>{t.checkout.total}</span>
                  <span className="text-[#1d4538]">{fmtDA(total, locale)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6">
              {serverError && (
                <p className="mb-3 rounded-lg bg-red-50 p-2.5 text-center text-xs font-semibold text-red-600">
                  {serverError}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full cursor-pointer rounded-xl bg-[#1d4538] py-4 text-center text-xs font-bold uppercase tracking-[.1em] text-white shadow-md transition hover:bg-[#14352b] disabled:opacity-50"
              >
                {submitting ? t.checkout.placingOrder : t.checkout.placeOrderBtn}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
