/**
 * Data extracted from a vehicle card on the autobid.de search results page.
 */
export interface AutobidVehicleCard {
  title: string;
  detailUrl: string;
  vehicleId: string;
  thumbnailUrl: string | null;
  price: string | null;
  /** Кат.Nr — lot number within the auction */
  lotNumber: string | null;
  /** Номер аукциона — auction sale number */
  auctionNumber: string | null;
  /** "D-21 19.02.2026 10:00 часов (CET)" — auction end date string */
  auctionEndDate: string | null;
  /** "нетто" or "брутто" — VAT type */
  vatType: string | null;
  /** Summary line: "Комби, 1.5 литров, Бензин, 6-скоростная коробка передач" */
  summaryLine: string | null;
}

/**
 * Full data extracted from an autobid.de vehicle detail page.
 */
export interface AutobidVehicleDetail {
  title: string;
  specs: Record<string, string>;
  imageUrls: string[];
  price: string | null;
  description: string | null;
  auctionEndDate: string | null;
  /** Кат.Nr — lot number within the auction */
  lotNumber: string | null;
  /** Номер аукциона */
  auctionNumber: string | null;
  /** "нетто" / "брутто" — VAT type */
  vatType: string | null;
  /** Equipment list (Комплектация) - array of feature strings */
  equipment: string[];
  /** Structured section data for body/interior/tire condition */
  sections: AutobidDetailSections;
}

/**
 * Structured sections from the detail page.
 */
export interface AutobidDetailSections {
  /** Авария / Предшествующие повреждения */
  accidentInfo: string | null;
  /** Кузов - body damage descriptions */
  bodyCondition: AutobidConditionItem[];
  /** Салон - interior condition */
  interiorCondition: AutobidConditionItem[];
  /** Шины / Колесные диски */
  tires: AutobidTireInfo[];
  /** Сиденья */
  seats: string | null;
  /** Вмятина от камней / Ветровое стекло */
  stoneChips: AutobidConditionItem[];
  /** Взнос за нахождение автомобиля на стоянке */
  parkingFee: string | null;
  /** Общая информация */
  generalInfo: string | null;
  /** Image URLs extracted from damage/condition sections (body, interior, stone chips, accident) */
  damageImageUrls: string[];
  /** Summary line below title: "2.0 литров, Дизель, Автомат, ..." */
  summaryLine: string | null;
  /** All images with assigned categories (exterior/interior/damage) */
  categorizedImages: { url: string; category: string }[];
}

export interface AutobidConditionItem {
  part: string;
  issues: string[];
}

export interface AutobidTireInfo {
  position: string;
  treadDepth: string | null;
  size: string | null;
}

/**
 * Result from scraping one page of search results.
 */
export interface AutobidSearchResult {
  vehicles: AutobidVehicleCard[];
  totalCount: number | null;
  currentPage: number;
  totalPages: number | null;
}
