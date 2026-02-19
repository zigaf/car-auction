import { Injectable } from '@nestjs/common';
import { BcaVehicle } from './interfaces/bca-vehicle.interface';
import { Lot } from '../../db/entities/lot.entity';
import { FuelType } from '../../common/enums/fuel-type.enum';
import { LotStatus } from '../../common/enums/lot-status.enum';

@Injectable()
export class BcaDataMapperService {
  private readonly fuelTypeMap: Record<string, FuelType> = {
    Petrol: FuelType.PETROL,
    Diesel: FuelType.DIESEL,
    Electric: FuelType.ELECTRIC,
    Hybrid: FuelType.HYBRID,
    'Plug-in Hybrid': FuelType.HYBRID,
    LPG: FuelType.LPG,
    CNG: FuelType.CNG,
  };

  mapVehicleToLot(vehicle: BcaVehicle): Partial<Lot> {
    return {
      bcaLotId: vehicle.LotId,
      bcaVehicleId: vehicle.VehicleId,
      title: [vehicle.Make, vehicle.Model, vehicle.Derivative]
        .filter(Boolean)
        .join(' ')
        .trim(),
      brand: vehicle.Make || undefined,
      model: vehicle.Model || undefined,
      derivative: vehicle.Derivative || undefined,
      year: this.extractYear(vehicle.RegistrationDate),
      mileage: vehicle.Mileage ?? null,
      fuelType: this.mapFuelType(vehicle.FuelType),
      enginePowerKw: this.parseIntOrNull(vehicle.PowerKw),
      enginePowerPs: this.parseIntOrNull(vehicle.PowerPs),
      registrationDate: this.parseDate(vehicle.RegistrationDate),
      registrationNumber: vehicle.RegistrationNumber || null,
      vin: vehicle.VIN || undefined,
      vehicleType: vehicle.VehicleType || null,
      saleLocation: vehicle.SaleLocation || null,
      vehicleLocation: vehicle.VehicleLocation || null,
      saleCountry: vehicle.SaleCountry || null,
      saleName: vehicle.SaleName || null,
      saleDate: this.parseBcaDate(vehicle.SaleDate),
      saleEndDate: this.parseBcaDate(vehicle.SaleEndDate),
      saleChannel: vehicle.SaleChannel || null,
      saleType: vehicle.SaleType || null,
      startingBid: this.parsePrice(vehicle.StartingBid, vehicle.BidNow),
      buyNowPrice: this.parsePrice(vehicle.BuyNowPrice, vehicle.BuyNow),
      originalCurrency: vehicle.OriginalSaleCurrency || null,
      vatTypeCode: vehicle.VatTypeCode || null,
      originalVatRate: vehicle.OriginalVatRate ?? null,
      cosmeticGrade: vehicle.CosmeticGrade || null,
      mechanicalGrade: vehicle.MechanicalGrade || null,
      damageCost: vehicle.DamageCostCombined ?? null,
      conditionReportUrl: vehicle.ConditionReportUrl || null,
      bcaImageUrl: vehicle.ImageUrl || null,
      bcaLotUrl: vehicle.ViewLotUrl || null,
      lotNumber: vehicle.LotNumber || null,
      status: LotStatus.IMPORTED,
    };
  }

  private mapFuelType(bcaFuelType: string): FuelType | null {
    if (!bcaFuelType) return null;
    return this.fuelTypeMap[bcaFuelType] || FuelType.OTHER;
  }

  private extractYear(registrationDate: string | null): number | null {
    if (!registrationDate) return null;
    const date = new Date(registrationDate);
    return isNaN(date.getTime()) ? null : date.getFullYear();
  }

  private parseDate(dateStr: string | null): Date | null {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * BCA dates come in ASP.NET format: "/Date(1771286400000)/"
   */
  private parseBcaDate(dateStr: string | null): Date | null {
    if (!dateStr) return null;
    const match = dateStr.match(/\/Date\((\d+)\)\//);
    if (match) {
      return new Date(parseInt(match[1], 10));
    }
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Parse price from numeric field, falling back to string field.
   * Handles cases where numeric field is 0 or null but string field has actual value.
   */
  private parsePrice(
    numericValue: number | null | undefined,
    stringValue: string | null | undefined,
  ): number | null {
    // Use numeric value if it's a real number (including 0)
    if (numericValue !== null && numericValue !== undefined && !isNaN(numericValue)) {
      return numericValue;
    }
    // Fall back to parsing string value (e.g. "€12,500.00" or "12500")
    if (stringValue) {
      const cleaned = stringValue.replace(/[^0-9.]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  private parseIntOrNull(value: string | number | null): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    return isNaN(num) ? null : num;
  }
}
