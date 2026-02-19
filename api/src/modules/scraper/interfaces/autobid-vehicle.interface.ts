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
