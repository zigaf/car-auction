import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type FuelTypeCalc = 'petrol' | 'diesel' | 'hybrid' | 'electric';

export interface CalculateCustomsRequest {
  carPrice: number;
  year: number;
  engineVolume: number;
  fuelType: FuelTypeCalc;
  deliveryCost?: number;
  companyCost?: number;
}

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

@Injectable({ providedIn: 'root' })
export class CalculatorService {
  constructor(private readonly api: ApiService) {}

  calculateCustoms(data: CalculateCustomsRequest): Observable<CustomsBreakdown> {
    return this.api.post<CustomsBreakdown>('/calculator/customs', data);
  }
}
