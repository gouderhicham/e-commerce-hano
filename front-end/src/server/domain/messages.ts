import type { Locale } from "./locale";

/**
 * Arabic renderings of the customer-facing error messages.
 *
 * The French message stays the canonical key: routes, guards and services keep
 * declaring their message in French exactly as before, and this table is
 * consulted only on the way out (see `handleError`). That keeps the back office
 * — which is French-only by design — untouched, while an Arabic customer stops
 * being shown French text they cannot read.
 *
 * A message with no entry here falls through unchanged, so adding a new
 * validation rule can never break a response; it just stays French until someone
 * adds the line. Keep the keys byte-identical to the thrown messages.
 *
 * Scope: only what a SHOPPER can trigger — login, registration, the account
 * pages, the cart and checkout, the contact form. Admin-only messages (product
 * form, stock, tag groups, delivery-fee import…) are deliberately absent: the
 * back office is French-only, so translating them would be dead weight.
 */
const AR: Record<string, string> = {
  // ── Generic ────────────────────────────────────────────────────────────────
  "Erreur interne du serveur.": "خطأ داخلي في الخادم.",
  "Données invalides.": "بيانات غير صالحة.",
  "Accès refusé.": "تم رفض الوصول.",
  "Non authentifié.": "يجب تسجيل الدخول.",
  "Veuillez vous connecter pour continuer.": "يرجى تسجيل الدخول للمتابعة.",
  "Accès réservé à l'administrateur.": "الوصول مخصص للمسؤول فقط.",
  "Route introuvable.": "المسار غير موجود.",
  "Fichier introuvable.": "الملف غير موجود.",
  "Corps de requête JSON invalide.": "محتوى الطلب غير صالح.",
  "Trop de tentatives. Veuillez réessayer dans un instant.":
    "عدد كبير من المحاولات. يرجى المحاولة مرة أخرى بعد قليل.",

  // ── Identity ───────────────────────────────────────────────────────────────
  "Le nom est requis.": "الاسم مطلوب.",
  "Nom requis.": "الاسم مطلوب.",
  "Email invalide.": "بريد إلكتروني غير صالح.",
  "Email requis.": "البريد الإلكتروني مطلوب.",
  "Cet email est déjà utilisé.": "هذا البريد الإلكتروني مستخدم بالفعل.",
  "Numéro de téléphone invalide.": "رقم الهاتف غير صحيح.",
  "Mot de passe invalide.": "كلمة المرور غير صحيحة.",
  "Identifiants invalides.": "بيانات الدخول غير صحيحة.",
  "Email ou mot de passe incorrect":
    "البريد الإلكتروني أو كلمة المرور غير صحيحة",

  // ── Password ───────────────────────────────────────────────────────────────
  "Le mot de passe est requis.": "كلمة المرور مطلوبة.",
  "Le mot de passe doit contenir au moins 6 caractères.":
    "يجب أن تحتوي كلمة المرور على 6 أحرف على الأقل.",
  "Le mot de passe actuel est requis.": "كلمة المرور الحالية مطلوبة.",
  "Mot de passe actuel incorrect.": "كلمة المرور الحالية غير صحيحة.",
  "Les mots de passe ne correspondent pas.": "كلمتا المرور غير متطابقتين.",
  "La confirmation est requise.": "التأكيد مطلوب.",
  "Compte introuvable.": "الحساب غير موجود.",

  // ── Contact form ───────────────────────────────────────────────────────────
  "Sujet invalide.": "موضوع غير صالح.",
  "Le message est requis.": "الرسالة مطلوبة.",
  "Le message doit contenir au moins 10 caractères.":
    "يجب أن تحتوي الرسالة على 10 أحرف على الأقل.",

  // ── Cart & checkout ────────────────────────────────────────────────────────
  "Produit invalide.": "منتج غير صالح.",
  "Quantité invalide.": "الكمية غير صالحة.",
  "La quantité doit être au moins 1.": "يجب أن تكون الكمية 1 على الأقل.",
  "La wilaya est requise.": "الولاية مطلوبة.",
  "La commune est requise.": "البلدية مطلوبة.",
  "Wilaya invalide.": "ولاية غير صالحة.",
  "Commune invalide.": "بلدية غير صالحة.",
  "Mode de paiement invalide.": "طريقة الدفع غير صالحة.",
  "Votre panier est vide.": "سلة التسوق فارغة.",
  "Produit indisponible.": "المنتج غير متوفر.",
  "Stock insuffisant.": "الكمية المتوفرة غير كافية.",
  "Commande introuvable.": "الطلب غير موجود.",
  "Produit introuvable.": "المنتج غير موجود.",
};

/**
 * Messages that carry a product name, so no lookup table can ever match them.
 *
 * These are the two a shopper is most likely to hit — both at checkout, the one
 * moment where being handed French text is most costly — so they get a pattern
 * instead. The captured name is a proper noun and is spliced through untouched.
 */
const AR_PATTERNS: { match: RegExp; ar: (name: string) => string }[] = [
  {
    match: /^Stock insuffisant pour « (.+) »\.$/,
    ar: (name) => `الكمية المتوفرة غير كافية للمنتج « ${name} ».`,
  },
  {
    match: /^« (.+) » est sur commande et ne peut pas être ajouté au panier\.$/,
    ar: (name) => `« ${name} » متوفر عند الطلب ولا يمكن إضافته إلى السلة.`,
  },
];

/**
 * Translate one user-facing message. Unknown messages are returned as-is —
 * never blanked, never replaced by a generic string.
 */
export function translateMessage(message: string, locale: Locale): string {
  if (locale === "fr") return message;

  const exact = AR[message];
  if (exact) return exact;

  for (const { match, ar } of AR_PATTERNS) {
    const found = match.exec(message);
    if (found) return ar(found[1]);
  }

  return message;
}

/** Translate every value of a `{ field: message }` validation payload. */
export function translateErrors(
  errors: Record<string, string>,
  locale: Locale,
): Record<string, string> {
  if (locale === "fr") return errors;
  const out: Record<string, string> = {};
  for (const [field, message] of Object.entries(errors)) {
    out[field] = translateMessage(message, locale);
  }
  return out;
}
