export interface BcaVehicle {
  VehicleId: string;
  VIN: string;
  Make: string;
  Model: string;
  Derivative: string | null;
  Mileage: number;
  FuelType: string;
  PowerKw: string;
  PowerPs: string;
  RegistrationDate: string | null;
  RegistrationNumber: string;
  ImageUrl: string;
  Imagekey: string;
  SaleLocation: string;
  VehicleLocation: string;
  SaleCountry: string;
  SaleName: string;
  SaleDate: string;
  SaleEndDate: string;
  SaleChannel: string;
  SaleType: string;
  BidNow: string;
  BuyNow: string;
  StartingBid: number;
  BuyNowPrice: number;
  VatTypeCode: string;
  VehicleType: string;
  CosmeticGrade: string;
  MechanicalGrade: string;
  DamageCostCombined: number | null;
  LotId: string;
  LotNumber: string;
  ConditionReportAvailable: boolean;
  ViewLotUrl: string;
  ViewLotLink: string;
  ConditionReportUrl: string;
  OriginalSaleCurrency: string;
  OriginalVatRate: number;
  [key: string]: unknown;
}

export interface BcaSearchResponse {
  VehicleResults: BcaVehicle[];
  TotalVehicleCount: number;
  PageSize: number;
  [key: string]: unknown;
}
