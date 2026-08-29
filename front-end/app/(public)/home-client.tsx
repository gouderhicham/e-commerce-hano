"use client";

import { useEffect, useState } from "react";
import type {
  HomeCategoryCard,
  HomeFavorites,
  Showcase,
} from "@/lib/data/types";
import {
  CategoriesSection,
  FavoritesSection,
  HeroSection,
  HeroShowcase,
  PromiseSection,
} from "@/components/storefront/home-sections";

interface HomeData {
  showcase: Showcase | null;
  categoryCards: HomeCategoryCard[];
  favorites: HomeFavorites;
}

const DEFAULT_HOME_DATA: HomeData = {
  showcase: null,
  categoryCards: [
    {
      id: "pt",
      name: "Portables",
      nameAr: "حواسيب محمولة",
      detail: "PC portables testés et garantis",
      detailAr: "حواسيب محمولة مفحوصة ومضمونة",
      img: "/media/products/seed-elitebook-845.webp",
      slug: "portables",
      categoryId: "pt",
      sortOrder: 1,
    },
    {
      id: "ram",
      name: "Mémoire RAM",
      nameAr: "ذاكرة عشوائية",
      detail: "DDR4 et DDR5 pour PC portables",
      detailAr: "DDR4 و DDR5 للحواسيب المحمولة",
      img: "/media/products/seed-thinkpad-t14.webp",
      slug: "ram",
      categoryId: "ram",
      sortOrder: 2,
    },
    {
      id: "ssd",
      name: "Stockage SSD",
      nameAr: "أقراص التخزين",
      detail: "SSD NVMe M.2 haute vitesse",
      detailAr: "SSD NVMe M.2 فائق السرعة",
      img: "/media/products/seed-latitude-7420.webp",
      slug: "ssd",
      categoryId: "ssd",
      sortOrder: 3,
    },
  ],
  favorites: { items: [] },
};

export function HomeClient({ initialData }: { initialData?: HomeData | null }) {
  const [data, setData] = useState<HomeData>(initialData ?? DEFAULT_HOME_DATA);

  useEffect(() => {
    fetch("/api/home")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch home data");
        return res.json();
      })
      .then((json: HomeData) => {
        if (json && typeof json === "object") {
          setData(json);
        }
      })
      .catch(() => {
        /* Keep fallback data on error */
      });
  }, []);

  return (
    <>
      <HeroSection />
      {data.showcase && <HeroShowcase showcase={data.showcase} />}
      <CategoriesSection cards={data.categoryCards} />
      {data.favorites?.items?.length > 0 && (
        <FavoritesSection favorites={data.favorites} />
      )}
      <PromiseSection />
    </>
  );
}
