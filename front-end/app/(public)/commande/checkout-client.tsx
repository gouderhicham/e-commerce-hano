"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, mediaSrc } from "@/lib/api-client";
import { fmtDA } from "@/lib/format";
import { useProductsById } from "@/lib/use-products-by-id";
import { useCart } from "@/components/storefront/cart-context";
import { Arrow, Bag } from "@/components/storefront/icons";
import { computeShipping } from "@/lib/data/rules";
import { SHIPPING } from "@/lib/shop-config";
import { useI18n } from "@/lib/i18n/context";
import { pick } from "@/lib/i18n/localize";
import type { Order, Wilaya } from "@/lib/data/types";

/* eslint-disable @next/next/no-img-element -- see home-sections.tsx. */

const PHONE_RE = /^0[567]\d{8}$/;

const inputCls =
  "mt-2 w-full border-b border-[#17251f]/20 bg-transparent py-3 text-[14px] font-normal text-[#17251f] outline-none transition placeholder:text-[#9ca59e] focus:border-[#1d4538]";
const labelCls =
  "block text-[11px] font-bold uppercase tracking-[.08em] text-[#33423b]";

type Errors = Partial<
  Record<"firstName" | "lastName" | "phone" | "wilaya" | "commune", string>
>;

export function CheckoutClient({ wilayas = [] }: { wilayas?: Wilaya[] } = {}) {
  const { lines, setQty, remove, clear } = useCart();
  const { products, missing } = useProductsById(lines.map((l) => l.id));
  const { locale, t, isRTL } = useI18n();

  const [allWilayas, setAllWilayas] = useState<Wilaya[]>(wilayas);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [wilayaCode, setWilayaCode] = useState<number | "">("");
  const [communeId, setCommuneId] = useState<number | "">("");

  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [placed, setPlaced] = useState<Order | null>(null);

  useEffect(() => {
    for (const id of missing) remove(id);
  }, [missing, remove]);

  useEffect(() => {
    if (allWilayas.some((w) => w.communes && w.communes.length > 0)) return;
    fetch("/api/shipping/wilayas")
      .then((r) => r.json())
      .then((data: Wilaya[]) => setAllWilayas(data))
      .catch(() => {});
  }, [allWilayas]);

  const rows = useMemo(() => {
    return lines
      .map((line) => ({
        line,
        product: products.get(line.id),
      }))
      .filter(
        (row): row is { line: typeof row.line; product: NonNullable<typeof row.product> } =>
          Boolean(row.product),
      );
  }, [lines, products]);

  const communes = useMemo(
    () => allWilayas.find((w) => w.code === wilayaCode)?.communes ?? [],
    [allWilayas, wilayaCode],
  );

  const totalItems = rows.reduce((sum, r) => sum + r.line.qty, 0);
  const subtotal = rows.reduce(
    (sum, r) => sum + (r.product.promoPrice ?? r.product.price ?? 0) * r.line.qty,
    0,
  );
  const freeShipping =
    SHIPPING.freeThreshold > 0 && subtotal > SHIPPING.freeThreshold;
  const selectedCommune = communes.find((c) => c.id === communeId);
  const selectedWilaya = allWilayas.find((w) => w.code === wilayaCode);
  const shipping = computeShipping({
    subtotal,
    wilayaFee: selectedWilaya?.fee ?? null,
    communeFee: selectedCommune?.fee ?? null,
  });
  const total = subtotal + shipping;

  const validate = (): boolean => {
    const next: Errors = {};
    if (!firstName.trim()) next.firstName = t.checkout.errorNameReq;
    if (!lastName.trim()) next.lastName = t.checkout.errorLastNameReq;
    if (!PHONE_RE.test(phone.replace(/\s/g, "")))
      next.phone = t.checkout.errorPhoneInvalid;
    if (wilayaCode === "") next.wilaya = t.checkout.errorWilayaReq;
    if (communeId === "") next.commune = t.checkout.errorCommuneReq;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setServerError("");
    if (!validate() || rows.length === 0) return;

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
          lines: rows.map((r) => ({ productId: r.product.id, qty: r.line.qty })),
        }),
      });

      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const payload = body as
          | { error?: string; errors?: Record<string, string> }
          | null;
        if (payload?.errors) {
          setServerError(
            Object.values(payload.errors)[0] ?? t.common.errorGeneric,
          );
        } else {
          setServerError(payload?.error ?? t.checkout.errorSaveOrder);
        }
        return;
      }

      clear();
      const payload = body as { order: Order };
      setPlaced(payload?.order ?? (body as Order));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setServerError(t.common.errorNetwork);
    } finally {
      setSubmitting(false);
    }
  };

  if (placed) {
    return (
      <section className="mx-auto grid min-h-[70vh] max-w-2xl place-items-center px-5 py-16 text-center">
        <div className="rounded-2xl border border-[#17251f]/10 bg-[#fdfcf8] p-8 shadow-sm sm:p-12">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#dcebdd] text-2xl text-[#2a624b]">
            ✓
          </span>
          <p className="mt-8 font-mono text-[10px] font-semibold uppercase tracking-[.2em] text-[#1d4538]">
            {t.checkout.successEyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-medium tracking-[-.07em] sm:text-5xl">
            {t.checkout.successTitleLead}
            <br />
            <em className="font-normal not-italic text-[#789a89]">
              {t.checkout.successTitleAccent}
            </em>
          </h1>
          <p className="mt-5 font-mono text-sm font-bold text-[#1d4538]">
            {placed.id}
          </p>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-7 text-[#627168]">
            {t.checkout.successCallNotice}
          </p>
          <p className="mt-4 font-mono text-sm font-bold text-[#17251f]">
            {t.checkout.totalToPay} {fmtDA(placed.total, locale)}
          </p>
          <Link
            href="/catalogue"
            className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#1d4538] px-7 py-4 text-[11px] font-bold uppercase tracking-[.1em] text-white shadow-sm transition hover:bg-[#14352b]"
          >
            {t.checkout.backHome} <Arrow />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mx-auto grid max-w-[1360px] gap-10 px-5 pb-12 pt-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:pb-16 lg:pt-6"
    >
      <div>
        <Link
          href="/panier"
          className="mb-6 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.1em] text-[#1d4538] transition hover:text-[#14352b]"
        >
          <Arrow left /> {t.checkout.backToCart}
        </Link>

        {serverError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            {serverError}
          </div>
        )}

        <section className="rounded-2xl border border-[#17251f]/10 bg-[#fdfcf8] p-6 shadow-sm sm:p-8">
          <div className="flex items-end justify-between border-b border-[#17251f]/10 pb-4">
            <div>
              <span className="block font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#1d4538]">
                {t.checkout.eyebrow}
              </span>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-.05em] text-[#17251f]">
                {t.checkout.title}
              </h2>
            </div>
            <p className="text-[11px] font-medium text-[#718078]">
              * {t.checkout.requiredFields}
            </p>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <label className={labelCls}>
              {t.checkout.firstName} *
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                placeholder={t.checkout.firstNamePlaceholder}
                aria-invalid={!!errors.firstName}
                className={inputCls}
              />
              {errors.firstName && (
                <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-red-600">
                  {errors.firstName}
                </span>
              )}
            </label>
            <label className={labelCls}>
              {t.checkout.lastName} *
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                placeholder={t.checkout.lastNamePlaceholder}
                aria-invalid={!!errors.lastName}
                className={inputCls}
              />
              {errors.lastName && (
                <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-red-600">
                  {errors.lastName}
                </span>
              )}
            </label>
            <label className={`${labelCls} sm:col-span-2`}>
              {t.checkout.phone} *
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={t.checkout.phonePlaceholder}
                aria-invalid={!!errors.phone}
                className={inputCls}
              />
              {errors.phone && (
                <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-red-600">
                  {errors.phone}
                </span>
              )}
            </label>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-[#17251f]/10 bg-[#fdfcf8] p-6 shadow-sm sm:p-8">
          <div className="border-b border-[#17251f]/10 pb-4">
            <span className="block font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#1d4538]">
              {t.checkout.shipping}
            </span>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-.05em] text-[#17251f]">
              {t.checkout.wilaya}
            </h2>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <label className={labelCls}>
              {t.checkout.wilaya} *
              <select
                value={wilayaCode}
                onChange={(e) => {
                  setWilayaCode(e.target.value ? Number(e.target.value) : "");
                  setCommuneId("");
                }}
                aria-invalid={!!errors.wilaya}
                className={`${inputCls} cursor-pointer`}
              >
                <option value="">{t.checkout.wilayaPlaceholder}</option>
                {wilayas.map((w) => (
                  <option key={w.code} value={w.code}>
                    {String(w.code).padStart(2, "0")} - {pick(locale, w.name, w.nameAr)}
                  </option>
                ))}
              </select>
              {errors.wilaya && (
                <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-red-600">
                  {errors.wilaya}
                </span>
              )}
            </label>
            <label className={labelCls}>
              {t.checkout.commune} *
              <select
                value={communeId}
                onChange={(e) =>
                  setCommuneId(e.target.value ? Number(e.target.value) : "")
                }
                disabled={wilayaCode === ""}
                aria-invalid={!!errors.commune}
                className={`${inputCls} cursor-pointer disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <option value="">
                  {wilayaCode === ""
                    ? t.checkout.wilayaPlaceholder
                    : t.checkout.communePlaceholder}
                </option>
                {communes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {pick(locale, c.name, c.nameAr)}
                  </option>
                ))}
              </select>
              {errors.commune && (
                <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-red-600">
                  {errors.commune}
                </span>
              )}
            </label>
            <p className="text-[11px] leading-5 normal-case tracking-normal text-[#718078] sm:col-span-2">
              {t.checkout.pickupNotice}
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-[#1d4538]/15 bg-[#edf3ee] p-6 shadow-sm">
          <span className="block font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#1d4538]">
            {t.checkout.paymentMethod}
          </span>
          <h2 className="mt-2 text-xl font-semibold tracking-[-.04em] text-[#17251f]">
            {t.checkout.codTitle}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#58675f]">
            {t.checkout.codDescription}
          </p>
        </section>
      </div>

      <aside className="self-start lg:sticky lg:top-[90px]">
        <div className="cart-scrollbar flex max-h-[calc(100vh-105px)] flex-col overflow-y-auto rounded-2xl border border-[#17251f]/10 bg-[#fdfcf8] p-6 shadow-sm">
          <div className="flex shrink-0 items-center justify-between border-b border-[#17251f]/10 pb-4">
            <div>
              <span className="block font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#1d4538]">
                {t.checkout.orderSummaryTitle}
              </span>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-.05em] text-[#17251f]">
                {t.cart.recapTitle} ({totalItems})
              </h2>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3ee] text-[#1d4538] shadow-sm">
              <Bag />
            </span>
          </div>

          <div className="my-3 divide-y divide-[#17251f]/10">
            {rows.length === 0 ? (
              <p className="py-8 text-center text-xs font-medium text-[#718078]">
                {t.cart.emptyTitle}
              </p>
            ) : (
              rows.map(({ line, product }) => {
                const unit = product.promoPrice ?? product.price ?? 0;
                return (
                  <div
                    key={line.id}
                    className="group flex items-center gap-3.5 py-4"
                  >
                    <div
                      className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[#17251f]/10"
                      style={{ backgroundColor: product.tone }}
                    >
                      {product.imageUrl && (
                        <img
                          src={mediaSrc(product.imageUrl) ?? ""}
                          alt={pick(locale, product.name, product.nameAr)}
                          className="h-full w-full object-cover mix-blend-multiply transition duration-300 group-hover:scale-105"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[13px] font-bold leading-4 text-[#17251f] transition group-hover:text-[#1d4538]">
                        {pick(locale, product.name, product.nameAr)}
                      </h3>
                      <p className="mt-1 text-[10.5px] font-normal leading-4 text-[#627269]">
                        {pick(locale, product.specs, product.specsAr)}
                      </p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="inline-flex items-center rounded-lg border border-[#17251f]/15 bg-white text-xs font-semibold shadow-2xs">
                          <button
                            type="button"
                            onClick={() =>
                              line.qty <= 1
                                ? remove(line.id)
                                : setQty(line.id, line.qty - 1)
                            }
                            aria-label={t.cart.decreaseQty}
                            className="cursor-pointer rounded-s-lg px-2.5 py-1 text-[#718078] transition hover:bg-[#e7eee5] hover:text-[#17251f]"
                          >
                            -
                          </button>
                          <span className="px-2.5 text-[11px] font-bold text-[#17251f]">
                            {line.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => setQty(line.id, line.qty + 1)}
                            disabled={line.qty >= product.stock}
                            aria-label={t.cart.increaseQty}
                            className="cursor-pointer rounded-e-lg px-2.5 py-1 text-[#718078] transition hover:bg-[#e7eee5] hover:text-[#17251f] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    <b className="whitespace-nowrap font-mono text-[13px] font-bold text-[#17251f]">
                      {fmtDA(unit * line.qty, locale)}
                    </b>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-auto shrink-0 space-y-3.5 border-t border-[#17251f]/10 pt-4 text-sm">
            <p className="flex justify-between text-[12px] font-medium uppercase tracking-[.06em] text-[#627269]">
              <span>{t.checkout.subtotal}</span>
              <span className="whitespace-nowrap font-mono text-[13px] font-semibold text-[#17251f]">
                {fmtDA(subtotal, locale)}
              </span>
            </p>
            <p className="flex justify-between text-[12px] font-medium uppercase tracking-[.06em] text-[#627269]">
              <span>{t.checkout.shipping}</span>
              <span className="whitespace-nowrap font-mono text-[13px] font-semibold text-[#17251f]">
                {freeShipping ? t.checkout.free : fmtDA(shipping, locale)}
              </span>
            </p>
            <div className="flex items-baseline justify-between border-t border-[#17251f]/10 pt-4">
              <span className="text-base font-bold tracking-tight text-[#17251f]">
                {t.checkout.total}
              </span>
              <span className="whitespace-nowrap font-mono text-xl font-extrabold text-[#1d4538]">
                {fmtDA(total, locale)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={rows.length === 0 || submitting}
            className="mt-6 flex w-full shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-[#1d4538] py-4 text-[12px] font-bold uppercase tracking-[.12em] text-white shadow-md transition-all duration-200 hover:bg-[#14352b] hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>
              {submitting ? t.checkout.placingOrder : t.checkout.placeOrderBtn}
            </span>
            {!submitting && <span className={`text-base ${isRTL ? "rotate-180" : ""}`}>→</span>}
          </button>
        </div>
      </aside>
    </form>
  );
}
