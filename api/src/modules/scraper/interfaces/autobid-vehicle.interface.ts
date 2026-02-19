/**
 * Data extracted from a vehicle card on the autobid.de search results page.
 */
export interface AutobidVehicleCard {
  title: string;
  detailUrl: string;
  vehicleId: string;
  thumbnailUrl: string | null;
  price: string | null;
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
