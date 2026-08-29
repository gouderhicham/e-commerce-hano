export type Locale = "fr" | "ar";
export type Direction = "ltr" | "rtl";

export interface NavDict {
  boutique: string;
  categories: string;
  contact: string;
  favorites: string;
  cart: string;
  tagline: string;
  openMenu: string;
  closeMenu: string;
  languageSwitcher: string;
}

export interface HomeDict {
  titleLead: string;
  titleAccent: string;
  text: string;
  ctaCatalog: string;
  imageAlt: string;
  statGuaranteeVal: string;
  statGuaranteeLabel: string;
  statDeliveryVal: string;
  statDeliveryLabel: string;
  statRatingVal: string;
  statRatingLabel: string;
  favoritesEyebrow: string;
  favoritesTitle: string;
  favoritesText: string;
  favoritesCta: string;
  categoriesEyebrow: string;
  categoriesTitle: string;
  categoriesText: string;
  categoriesCta: string;
  promisesEyebrow: string;
  promisesTitle: string;
  promisesSubtitle: string;
  /** Intro paragraph of the promise block — NOT one of the three cards. */
  promisesText: string;
  promise1Title: string;
  promise1Text: string;
  promise2Title: string;
  promise2Text: string;
  promise3Title: string;
  promise3Text: string;
  exploreCategory: string;
  viewProduct: string;
  seeAll: string;
}

export interface CatalogueDict {
  eyebrow: string;
  allProducts: string;
  filterTitle: string;
  filterSubtitle: string;
  searchLabel: string;
  searchPlaceholder: string;
  sortBy: string;
  sortDefaut: string;
  sortPrixAsc: string;
  sortPrixDesc: string;
  sortNom: string;
  sortNouveautes: string;
  addedToCart: string;
  emptyTitle: string;
  emptySubtitle: string;
  resetFilters: string;
  openFilters: string;
  closeFilters: string;
  activeFilter: string;
  filterResults: string;
  guaranteesTitle: string;
  guarantee1: string;
  guarantee2: string;
  guarantee3: string;
}

export interface ProductDict {
  inStock: string;
  limitedStock: string;
  outOfStock: string;
  onRequest: string;
  onRequestNotice: string;
  outOfStockNotice: string;
  addToCart: string;
  orderNow: string;
  addedSuccess: string;
  backToCatalog: string;
  zoom: string;
  prevImage: string;
  nextImage: string;
  closeGallery: string;
  /** `{name}` and `{n}` are interpolated. */
  imageAlt: string;
  sameCategory: string;
  configTitle: string;
  detailsSection: string;
  orderSectionTitle: string;
  orderSectionSubtitle: string;
  viewStore: string;
}

export interface CartDict {
  eyebrow: string;
  title: string;
  /** `{n}` is interpolated — already pluralised per locale. */
  itemCount: string;
  itemCountOne: string;
  continueShopping: string;
  emptyTitle: string;
  emptySubtitle: string;
  browseCatalog: string;
  recapEyebrow: string;
  recapTitle: string;
  subtotal: string;
  shipping: string;
  shippingCalculated: string;
  shippingNotice: string;
  freeShipping: string;
  freeShippingNotice: string;
  total: string;
  checkoutBtn: string;
  directCheckoutNotice: string;
  /** `{name}` is interpolated. */
  removeItemNamed: string;
  removeItem: string;
  quantity: string;
  decreaseQty: string;
  increaseQty: string;
  perUnit: string;
  /** `{n}` is interpolated. */
  onlyLeftInStock: string;
}

export interface FavoritesDict {
  eyebrow: string;
  title: string;
  emptyTitle: string;
  emptySubtitle: string;
  browseCatalog: string;
  viewStore: string;
  addToCart: string;
  /** `{name}` is interpolated. */
  addAria: string;
  /** `{name}` is interpolated. */
  removeAria: string;
  added: string;
  removed: string;
}

export interface CheckoutDict {
  eyebrow: string;
  title: string;
  subtitle: string;
  backToCart: string;
  requiredFields: string;
  firstName: string;
  firstNamePlaceholder: string;
  lastName: string;
  lastNamePlaceholder: string;
  phone: string;
  phonePlaceholder: string;
  wilaya: string;
  wilayaPlaceholder: string;
  commune: string;
  communePlaceholder: string;
  pickupNotice: string;
  paymentMethod: string;
  codTitle: string;
  codDescription: string;
  orderSummaryTitle: string;
  subtotal: string;
  shipping: string;
  free: string;
  total: string;
  placeOrderBtn: string;
  placingOrder: string;
  successEyebrow: string;
  successTitleLead: string;
  successTitleAccent: string;
  successOrderRef: string;
  successCallNotice: string;
  totalToPay: string;
  backHome: string;
  errorNameReq: string;
  errorLastNameReq: string;
  errorPhoneInvalid: string;
  errorWilayaReq: string;
  errorCommuneReq: string;
  errorSaveOrder: string;
}

export interface ContactDict {
  eyebrow: string;
  title: string;
  subtitle: string;
  fullName: string;
  fullNamePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  phone: string;
  phonePlaceholder: string;
  subject: string;
  message: string;
  messagePlaceholder: string;
  sendBtn: string;
  sending: string;
  successTitle: string;
  successMessage: string;
  sendAnother: string;
  errorNameReq: string;
  errorEmailInvalid: string;
  errorMessageMin: string;
  errorSendFailed: string;
  /** `{phone}` is interpolated. */
  errorSendFailedRetry: string;
  subjects: {
    question: string;
    order: string;
    warranty: string;
    other: string;
  };
}

export interface FooterDict {
  copyright: string;
  motto: string;
  testedAndGuaranteed: string;
  deliveryWilayas: string;
}

export interface CommonDict {
  currency: string;
  surCommande: string;
  loading: string;
  /** Network failure — no response from the server. */
  errorNetwork: string;
  /** Server rejected the payload but sent no usable detail. */
  errorGeneric: string;
}

export interface Dictionary {
  nav: NavDict;
  home: HomeDict;
  catalogue: CatalogueDict;
  product: ProductDict;
  cart: CartDict;
  favorites: FavoritesDict;
  checkout: CheckoutDict;
  contact: ContactDict;
  footer: FooterDict;
  common: CommonDict;
}
