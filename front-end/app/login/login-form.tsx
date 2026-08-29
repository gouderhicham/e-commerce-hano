"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { cartReset } from "@/components/storefront/cart-context";
import { favoritesReset } from "@/components/storefront/favorites-context";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputCls =
  "w-full rounded-xl border border-[#17251f]/15 bg-white px-4 py-3.5 text-sm text-[#17251f] outline-none transition focus:border-[#1d4538] focus:ring-2 focus:ring-[#1d4538]/15";
const labelCls =
  "mb-2 block text-[11px] font-bold uppercase tracking-[.08em] text-[#17251f]";

/**
 * Back-office sign-in. The storefront is entirely guest — browsing, favourites,
 * cart and checkout never ask for an account — so this page exists only to let
 * the shop owner into /admin. There is no public registration.
 */
export function LoginCard({ guardMsg }: { guardMsg: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [authError, setAuthError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = "Email invalide.";
    if (password.length < 6)
      next.password = "Le mot de passe doit faire au moins 6 caractères.";
    setErrors(next);
    setAuthError("");
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const payload = (await res.json().catch(() => null)) as {
        user?: { role: string };
        error?: string;
        errors?: Record<string, string>;
      } | null;

      if (!res.ok) {
        setAuthError(
          payload?.errors
            ? Object.values(payload.errors)[0]
            : (payload?.error ?? "Email ou mot de passe incorrect"),
        );
        return;
      }

      // Session switch: drop the guest localStorage cart + favourites so a
      // browsing session can't leak into the account.
      cartReset();
      favoritesReset();
      router.push(payload?.user?.role === "ADMIN" ? "/admin" : "/");
      router.refresh();
    } catch {
      setAuthError("Connexion impossible. Vérifiez votre réseau.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <Link href="/" className="mb-8 flex items-center justify-center gap-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/pc-logo.jpg"
          alt=""
          className="h-10 w-10 rounded-full border border-[#1d4538]/20 object-cover shadow-sm"
        />
        <div className="flex flex-col justify-center leading-none">
          <div className="flex items-baseline gap-1 font-mono text-[17px] font-extrabold uppercase tracking-[.18em] text-[#17251f]">
            <span>pc store</span>
            <span className="font-black text-[#1d4538]">.39</span>
          </div>
          <span className="mt-0.5 font-mono text-[8px] font-semibold uppercase tracking-[.25em] text-[#78827b]">
            panneau d&apos;administration
          </span>
        </div>
      </Link>

      <div className="rounded-2xl border border-[#17251f]/10 bg-[#fdfcf8] p-6 shadow-sm sm:p-8">
        <span className="block font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#1d4538]">
          Backoffice
        </span>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-.06em] text-[#17251f]">
          Connexion
        </h1>

        {guardMsg && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
            {guardMsg}
          </div>
        )}

        {authError && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            {authError}
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
          <div>
            <label htmlFor="email" className={labelCls}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((p) => ({ ...p, email: "" }));
              }}
              placeholder="admin@pcstore39.dz"
              aria-invalid={!!errors.email}
              className={inputCls}
            />
            {errors.email && (
              <p className="mt-1 text-[11px] font-medium text-red-600">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className={labelCls}>
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((p) => ({ ...p, password: "" }));
              }}
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              className={inputCls}
            />
            {errors.password && (
              <p className="mt-1 text-[11px] font-medium text-red-600">
                {errors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-[#1d4538] py-4 text-[12px] font-bold uppercase tracking-[.12em] text-white shadow-md transition-all duration-200 hover:bg-[#14352b] hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Connexion…" : "Se connecter"}
            {!submitting && <span className="text-base">→</span>}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-[11px] text-[#78827b]">
        <Link href="/" className="font-semibold text-[#1d4538] hover:underline">
          ← Retour à la boutique
        </Link>
      </p>
    </div>
  );
}
