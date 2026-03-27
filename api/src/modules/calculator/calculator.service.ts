import { Injectable } from '@nestjs/common';
import { CalculateCustomsDto, CalcCountry } from './dto/calculate-customs.dto';

export interface CustomsBreakdown {
  carPrice: number;
  customsDuty: number;
  recyclingFee: number;
  customsProcessingFee: number;
  companyCost: number;
  deliveryCost: number;
  totalCustoms: number;
  totalCost: number;
  ageYears: number;
  country: CalcCountry;
}

const DELIVERY_TABLE: Record<string, Record<CalcCountry, number>> = {
  belgium:     { russia: 1200, belarus: 800 },
  netherlands: { russia: 1200, belarus: 800 },
  germany:     { russia: 1100, belarus: 700 },
  france:      { russia: 1300, belarus: 900 },
  italy:       { russia: 1400, belarus: 1000 },
  spain:       { russia: 1500, belarus: 1100 },
  poland:      { russia: 900,  belarus: 500 },
  lithuania:   { russia: 800,  belarus: 400 },
};

const RUB_PER_EUR = 100;
const BYN_PER_EUR = 3.5;

@Injectable()
export class CalculatorService {
  calculate(dto: CalculateCustomsDto): CustomsBreakdown {
    const currentYear = new Date().getFullYear();
    const ageYears = currentYear - dto.year;

    const customsDuty = this.calculateDuty(dto.carPrice, dto.engineVolume, ageYears);
    const recyclingFee = this.calculateRecyclingFee(dto.country, ageYears);
    const customsProcessingFee = this.calculateProcessingFee(dto.country);
    const companyCost = dto.carPrice <= 10000 ? 500 : 1000;
    const deliveryCost = this.resolveDeliveryCost(dto);

    const totalCustoms = this.round(customsDuty + recyclingFee + customsProcessingFee);
    const totalCost = this.round(dto.carPrice + totalCustoms + companyCost + deliveryCost);

    return {
      carPrice: dto.carPrice,
      customsDuty,
      recyclingFee,
      customsProcessingFee,
      companyCost,
      deliveryCost,
      totalCustoms,
      totalCost,
      ageYears,
      country: dto.country,
    };
  }

  private calculateDuty(carPrice: number, engineVolume: number, ageYears: number): number {
    if (ageYears < 3) {
      return this.dutyUnder3(carPrice, engineVolume);
    } else if (ageYears <= 5) {
      return this.dutyByVolume(engineVolume, [
        [1000, 1.5],
        [1500, 1.7],
        [1800, 2.5],
        [2300, 2.7],
        [3000, 3.0],
        [Infinity, 3.6],
      ]);
    } else {
      return this.dutyByVolume(engineVolume, [
        [1000, 3.0],
        [1500, 3.2],
        [1800, 3.5],
        [2300, 4.8],
        [3000, 5.0],
        [Infinity, 5.7],
      ]);
    }
  }

  private dutyUnder3(carPrice: number, engineVolume: number): number {
    const brackets: { maxPrice: number; pct: number; minPerCc: number }[] = [
      { maxPrice: 8500,   pct: 0.54, minPerCc: 2.5 },
      { maxPrice: 16700,  pct: 0.48, minPerCc: 3.5 },
      { maxPrice: 42300,  pct: 0.48, minPerCc: 5.5 },
      { maxPrice: 84500,  pct: 0.48, minPerCc: 7.5 },
      { maxPrice: 169000, pct: 0.48, minPerCc: 15.0 },
      { maxPrice: Infinity, pct: 0.48, minPerCc: 20.0 },
    ];

    const bracket = brackets.find(b => carPrice <= b.maxPrice)!;
    const byPercent = carPrice * bracket.pct;
    const byVolume = engineVolume * bracket.minPerCc;

    return this.round(Math.max(byPercent, byVolume));
  }

  private dutyByVolume(engineVolume: number, rates: [number, number][]): number {
    const rate = rates.find(([maxVol]) => engineVolume <= maxVol)!;
    return this.round(engineVolume * rate[1]);
  }

  private calculateRecyclingFee(country: CalcCountry, ageYears: number): number {
    if (country === CalcCountry.RUSSIA) {
      const baseRate = 20000;
      const coeff = ageYears < 3 ? 0.17 : 0.26;
      return this.round((baseRate * coeff) / RUB_PER_EUR);
    }

    // Belarus
    let amountByn: number;
    if (ageYears < 3) {
      amountByn = 544.5;
    } else if (ageYears <= 7) {
      amountByn = 816.7;
    } else {
      amountByn = 1225.1;
    }
    return this.round(amountByn / BYN_PER_EUR);
  }

  private calculateProcessingFee(country: CalcCountry): number {
    if (country === CalcCountry.RUSSIA) {
      return this.round(3100 / RUB_PER_EUR);
    }
    return this.round(120 / BYN_PER_EUR);
  }

  private resolveDeliveryCost(dto: CalculateCustomsDto): number {
    if (dto.deliveryCost !== undefined && dto.deliveryCost !== null) {
      return dto.deliveryCost;
    }

    if (dto.originCountry && dto.destinationCountry) {
      const origin = dto.originCountry.toLowerCase();
      const entry = DELIVERY_TABLE[origin];
      if (entry && entry[dto.country] !== undefined) {
        return entry[dto.country];
      }
    }

    return 0;
  }

  private round(v: number): number {
    return Math.round(v * 100) / 100;
  }
}
