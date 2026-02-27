import { Injectable } from '@nestjs/common';
import { CalculateCustomsDto, FuelTypeCalc } from './dto/calculate-customs.dto';

export interface CustomsBreakdown {
  carPrice: number;
  exciseTax: number;
  importDuty: number;
  vat: number;
  pensionFund: number;
  totalCustoms: number;
  deliveryCost: number;
  companyCost: number;
  totalCost: number;
  ageYears: number;
  ageCoefficient: number;
}

@Injectable()
export class CalculatorService {
  calculate(dto: CalculateCustomsDto): CustomsBreakdown {
    const currentYear = new Date().getFullYear();
    const ageYears = currentYear - dto.year;
    const deliveryCost = dto.deliveryCost ?? 0;
    const companyCost = dto.companyCost ?? 0;

    const ageCoefficient = this.getAgeCoefficient(ageYears);
    const exciseTax = this.calculateExcise(dto.fuelType, dto.engineVolume, ageCoefficient);
    const importDuty = Math.round(dto.carPrice * 0.1 * 100) / 100;
    const vat = Math.round((dto.carPrice + exciseTax + importDuty) * 0.2 * 100) / 100;
    const pensionFund = Math.round(dto.carPrice * 0.03 * 100) / 100;

    const totalCustoms = Math.round((exciseTax + importDuty + vat + pensionFund) * 100) / 100;
    const totalCost = Math.round((dto.carPrice + totalCustoms + deliveryCost + companyCost) * 100) / 100;

    return {
      carPrice: dto.carPrice,
      exciseTax,
      importDuty,
      vat,
      pensionFund,
      totalCustoms,
      deliveryCost,
      companyCost,
      totalCost,
      ageYears,
      ageCoefficient,
    };
  }

  private getAgeCoefficient(ageYears: number): number {
    if (ageYears <= 3) return 1.0;
    if (ageYears <= 5) return 1.5;
    if (ageYears <= 7) return 2.0;
    return 2.5;
  }

  private calculateExcise(
    fuelType: FuelTypeCalc,
    engineVolume: number,
    ageCoefficient: number,
  ): number {
    if (fuelType === FuelTypeCalc.ELECTRIC) {
      return 0;
    }

    let ratePerCm3: number;

    if (fuelType === FuelTypeCalc.DIESEL) {
      if (engineVolume <= 1500) ratePerCm3 = 0.075;
      else if (engineVolume <= 2500) ratePerCm3 = 0.075;
      else ratePerCm3 = 0.15;
    } else {
      // Petrol or Hybrid
      if (engineVolume < 1000) ratePerCm3 = 0.048;
      else if (engineVolume <= 1500) ratePerCm3 = 0.066;
      else if (engineVolume <= 2200) ratePerCm3 = 0.066;
      else ratePerCm3 = 0.132;
    }

    return Math.round(engineVolume * ratePerCm3 * ageCoefficient * 100) / 100;
  }
}
