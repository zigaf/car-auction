export enum FuelType {
  PETROL = 'petrol',
  DIESEL = 'diesel',
  HYBRID = 'hybrid',
  ELECTRIC = 'electric',
  LPG = 'lpg',
  CNG = 'cng',
  OTHER = 'other',
}

export enum LotStatus {
  IMPORTED = 'imported',
  ACTIVE = 'active',
  TRADING = 'trading',
  SOLD = 'sold',
  CANCELLED = 'cancelled',
}

export enum ImageCategory {
  MAIN = 'main',
  EXTERIOR = 'exterior',
  INTERIOR = 'interior',
  DAMAGE = 'damage',
  DOCUMENT = 'document',
}

export interface ILotImage {
  id: string;
  lotId: string;
  url: string;
  originalUrl: string | null;
  sourceImageId: string | null;
  category: ImageCategory;
  sortOrder: number;
  createdAt: string;
}

export interface ILot {
  id: string;
  sourceId: string | null;
  sourceVehicleId: string | null;
  source: string | null;
  title: string;
  brand: string;
  model: string;
  derivative: string;
  year: number | null;
  mileage: number | null;
  fuelType: FuelType | null;
  enginePowerKw: number | null;
  enginePowerPs: number | null;
  registrationDate: string | null;
  registrationNumber: string | null;
  vin: string;
  exteriorColor: string | null;
  vehicleType: string | null;
  saleLocation: string | null;
  vehicleLocation: string | null;
  saleCountry: string | null;
  saleName: string | null;
  saleDate: string | null;
  saleEndDate: string | null;
  saleChannel: string | null;
  saleType: string | null;
  startingBid: number | null;
  buyNowPrice: number | null;
  originalCurrency: string | null;
  vatTypeCode: string | null;
  originalVatRate: number | null;
  cosmeticGrade: string | null;
  mechanicalGrade: string | null;
  damageCost: number | null;
  conditionReportUrl: string | null;
  sourceImageUrl: string | null;
  sourceUrl: string | null;
  specs: Record<string, unknown> | null;
  status: LotStatus;
  description: string | null;
  equipment: string[] | null;
  transmission: string | null;
  numberOfOwners: number | null;
  numberOfKeys: number | null;
  lotNumber: string | null;
  auctionType: string | null;
  reservePrice: number | null;
  bidStep: number;
  auctionStartAt: string | null;
  auctionEndAt: string | null;
  currentPrice: number | null;
  winnerId: string | null;
  images: ILotImage[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ILotFilter {
  brand?: string;
  model?: string;
  yearFrom?: number;
  yearTo?: number;
  priceFrom?: number;
  priceTo?: number;
  fuelType?: string;
  mileageFrom?: number;
  mileageTo?: number;
  country?: string;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface IPaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ILotStats {
  totalLots: number;
  totalBrands: number;
  countries: number;
  withPhotos: number;
}

export interface IBrandCount {
  brand: string;
  count: number;
}
