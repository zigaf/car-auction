import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type FuelTypeCalc = 'petrol' | 'diesel' | 'hybrid' | 'electric';
export type CalcCountry = 'russia' | 'belarus';

export interface CalculateCustomsRequest {
  country: CalcCountry;
  carPrice: number;
  year: number;
  engineVolume: number;
  fuelType: FuelTypeCalc;
  originCountry?: string;
  destinationCountry?: string;
  deliveryCost?: number;
}

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

@Injectable({ providedIn: 'root' })
export class CalculatorService {
  constructor(private readonly api: ApiService) {}

  calculateCustoms(data: CalculateCustomsRequest): Observable<CustomsBreakdown> {
    return this.api.post<CustomsBreakdown>('/calculator/customs', data);
  }
}
