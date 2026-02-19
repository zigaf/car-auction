import { Injectable } from '@nestjs/common';
import { AutobidVehicleDetail } from './interfaces/autobid-vehicle.interface';
import { Lot } from '../../db/entities/lot.entity';
import { FuelType } from '../../common/enums/fuel-type.enum';
import { LotStatus } from '../../common/enums/lot-status.enum';

@Injectable()
export class AutobidDataMapperService {
  private readonly fuelTypeMap: Record<string, FuelType> = {
    // Russian labels (site uses /ru/ locale)
    'Бензин': FuelType.PETROL,
    'Дизель': FuelType.DIESEL,
    'Электро': FuelType.ELECTRIC,
    'Электрический': FuelType.ELECTRIC,
    'Гибрид': FuelType.HYBRID,
    'Газ': FuelType.LPG,
    // German labels (fallback)
    'Benzin': FuelType.PETROL,
    'Super': FuelType.PETROL,
    'Diesel': FuelType.DIESEL,
    'Elektro': FuelType.ELECTRIC,
    'Hybrid': FuelType.HYBRID,
    'Plug-in-Hybrid': FuelType.HYBRID,
    'Plug-In Hybrid': FuelType.HYBRID,
    'Autogas (LPG)': FuelType.LPG,
    'LPG': FuelType.LPG,
    'Erdgas (CNG)': FuelType.CNG,
    'CNG': FuelType.CNG,
  };

  mapVehicleToLot(
    detail: AutobidVehicleDetail,
    vehicleId: string,
    detailUrl: string,
  ): Partial<Lot> {
    const specs = detail.specs;
    const brand = this.findSpec(specs, ['Марка', 'Marke']) || this.extractBrandFromTitle(detail.title);
    const model = this.findSpec(specs, ['Модель', 'Modell']) || this.extractModelFromTitle(detail.title, brand);
    const derivative = this.findSpec(specs, ['Вариант', 'Variante', 'Версия', 'Ausstattung']);
    const mileageStr = this.findSpec(specs, ['Показания счетчика', 'Пробег', 'Kilometerstand', 'km-Stand', 'Laufleistung']);
    const fuelStr = this.findSpec(specs, ['Вид топлива', 'Топливо', 'Kraftstoff', 'Kraftstoffart']);
    const powerStr = this.findSpec(specs, ['Мощность', 'Leistung']);
    const regStr = this.findSpec(specs, ['Первичная регистрация', 'Первая регистрация', 'Erstzulassung', 'Дата регистрации']);
    const vinStr = this.findSpec(specs, ['Идентификационный номер', 'VIN', 'FIN', 'Fahrgestellnummer']);
    const locationStr = this.findSpec(specs, ['местоположение', 'Местоположение', 'Standort', 'Расположение']);
    const colorStr = this.findSpec(specs, ['Цвет', 'Farbe', 'Außenfarbe', 'Обозначение цвета']);
    const vehicleTypeStr = this.findSpec(specs, ['Категория', 'Тип', 'Fahrzeugart', 'Тип кузова', 'Karosserie']);
    const transmissionStr = this.findSpec(specs, ['Вид коробки передач', 'Коробка передач', 'Getriebe', 'Трансмиссия']);

    const power = this.parsePower(powerStr);
    const year = this.extractYear(regStr);
    const regDate = this.parseRegistrationDate(regStr);

    // Extract owners count from specs
    const ownersStr = this.findSpec(specs, ['Общее известное число предыдущих владельцев', 'Vorbesitzer', 'Anzahl der Vorbesitzer']);
    const keysStr = this.findSpec(specs, ['Количество ключей', 'Anzahl Schlüssel']);

    // Build description from sections
    const description = this.buildDescription(detail);

    return {
      sourceId: vehicleId,
      sourceVehicleId: vehicleId,
      source: 'autobid',
      title: detail.title || [brand, model, derivative].filter(Boolean).join(' ').trim(),
      brand: brand || undefined,
      model: model || undefined,
      derivative: derivative || undefined,
      year,
      mileage: this.parseGermanInt(mileageStr),
      fuelType: this.mapFuelType(fuelStr),
      enginePowerKw: power.kw,
      enginePowerPs: power.ps,
      registrationDate: regDate,
      vin: vinStr || undefined,
      exteriorColor: colorStr,
      vehicleType: vehicleTypeStr,
      vehicleLocation: locationStr,
      saleCountry: 'DE',
      startingBid: this.parseGermanPrice(detail.price),
      originalCurrency: 'EUR',
      sourceImageUrl: detail.imageUrls?.[0] || null,
      sourceUrl: detailUrl,
      transmission: transmissionStr || undefined,
      numberOfOwners: this.parseLeadingInt(ownersStr),
      numberOfKeys: this.parseLeadingInt(keysStr),
      equipment: detail.equipment?.length > 0 ? detail.equipment : null,
      specs: {
        ...specs,
        ...(detail.sections ? { _sections: detail.sections } : {}),
      },
      description,
      saleDate: this.parseGermanDate(detail.auctionEndDate),
      status: LotStatus.IMPORTED,
    };
  }

  private parseLeadingInt(str: string | null): number | null {
    if (!str) return null;
    const match = str.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  private buildDescription(detail: AutobidVehicleDetail): string | null {
    const parts: string[] = [];

    if (detail.description) {
      parts.push(detail.description);
    }

    const sections = detail.sections;
    if (!sections) return parts.length > 0 ? parts.join('\n\n') : null;

    if (sections.accidentInfo) {
      parts.push(`Авария / Повреждения: ${sections.accidentInfo}`);
    }

    if (sections.bodyCondition?.length > 0) {
      const lines = sections.bodyCondition.map((item) => {
        const issues = item.issues.length > 0 ? ` — ${item.issues.join(', ')}` : '';
        return `  ${item.part}${issues}`;
      });
      parts.push(`Кузов:\n${lines.join('\n')}`);
    }

    if (sections.interiorCondition?.length > 0) {
      const lines = sections.interiorCondition.map((item) => {
        const issues = item.issues.length > 0 ? ` — ${item.issues.join(', ')}` : '';
        return `  ${item.part}${issues}`;
      });
      parts.push(`Салон:\n${lines.join('\n')}`);
    }

    if (sections.tires?.length > 0) {
      const lines = sections.tires.map((t) => {
        const info = [t.treadDepth, t.size].filter(Boolean).join(', ');
        return `  ${t.position}: ${info}`;
      });
      parts.push(`Шины:\n${lines.join('\n')}`);
    }

    if (sections.stoneChips?.length > 0) {
      const lines = sections.stoneChips.map((item) => {
        const issues = item.issues.length > 0 ? ` — ${item.issues.join(', ')}` : '';
        return `  ${item.part}${issues}`;
      });
      parts.push(`Вмятина от камней:\n${lines.join('\n')}`);
    }

    if (sections.seats) {
      parts.push(`Сиденья: ${sections.seats}`);
    }

    if (sections.generalInfo) {
      parts.push(`Общая информация: ${sections.generalInfo}`);
    }

    if (sections.parkingFee) {
      parts.push(`Стоянка: ${sections.parkingFee}`);
    }

    return parts.length > 0 ? parts.join('\n\n') : null;
  }

  private findSpec(specs: Record<string, string>, keys: string[]): string | null {
    for (const key of keys) {
      // Exact match
      if (specs[key]) return specs[key];
      // Case-insensitive partial match
      const found = Object.entries(specs).find(
        ([k]) => k.toLowerCase().includes(key.toLowerCase()),
      );
      if (found) return found[1];
    }
    return null;
  }

  private extractBrandFromTitle(title: string): string | null {
    if (!title) return null;
    // First word is usually the brand
    return title.split(/\s+/)[0] || null;
  }

  private extractModelFromTitle(title: string, brand: string | null): string | null {
    if (!title) return null;
    if (brand) {
      const rest = title.replace(new RegExp(`^${brand}\\s*`, 'i'), '').trim();
      // Take first 1-2 words as model
      const parts = rest.split(/\s+/);
      return parts.slice(0, 2).join(' ') || null;
    }
    const parts = title.split(/\s+/);
    return parts[1] || null;
  }

  private mapFuelType(fuelStr: string | null): FuelType | null {
    if (!fuelStr) return null;
    // Try exact match first
    if (this.fuelTypeMap[fuelStr]) return this.fuelTypeMap[fuelStr];
    // Try partial match
    const lower = fuelStr.toLowerCase();
    for (const [key, value] of Object.entries(this.fuelTypeMap)) {
      if (lower.includes(key.toLowerCase())) return value;
    }
    return FuelType.OTHER;
  }

  /**
   * Parse German-format number: "123.456" -> 123456
   */
  parseGermanInt(str: string | null): number | null {
    if (!str) return null;
    const cleaned = str.replace(/[^\d.,]/g, '');
    // German: dot = thousands separator
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const num = parseInt(normalized, 10);
    return isNaN(num) ? null : num;
  }

  /**
   * Parse German-format price: "12.500,00 €" -> 12500.00
   */
  parseGermanPrice(str: string | null): number | null {
    if (!str) return null;
    const cleaned = str.replace(/[^\d.,]/g, '');
    if (!cleaned) return null;
    // German: dot = thousands, comma = decimal
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
  }

  /**
   * Parse power string: "110 kW (150 PS)" -> { kw: 110, ps: 150 }
   */
  private parsePower(str: string | null): { kw: number | null; ps: number | null } {
    if (!str) return { kw: null, ps: null };
    // German: "110 kW (150 PS)" or Russian: "84 кВт / 114 л.с."
    const kwMatch = str.match(/(\d+)\s*(?:kW|кВт)/i);
    const psMatch = str.match(/(\d+)\s*(?:PS|л\.?\s*с\.?)/i);
    return {
      kw: kwMatch ? parseInt(kwMatch[1], 10) : null,
      ps: psMatch ? parseInt(psMatch[1], 10) : null,
    };
  }

  private extractYear(regStr: string | null): number | null {
    if (!regStr) return null;
    // Try MM/YYYY or MM.YYYY format
    const match = regStr.match(/(\d{2})[./](\d{4})/);
    if (match) return parseInt(match[2], 10);
    // Try just YYYY
    const yearMatch = regStr.match(/(\d{4})/);
    if (yearMatch) return parseInt(yearMatch[1], 10);
    return null;
  }

  private parseRegistrationDate(regStr: string | null): Date | null {
    if (!regStr) return null;
    const match = regStr.match(/(\d{2})[./](\d{4})/);
    if (match) {
      return new Date(parseInt(match[2], 10), parseInt(match[1], 10) - 1, 1);
    }
    return null;
  }

  /**
   * Parse German date: "19.02.2026 14:30" or "19.02.2026"
   */
  private parseGermanDate(str: string | null): Date | null {
    if (!str) return null;
    const match = str.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    if (match) {
      const [, day, month, year, hours, minutes] = match;
      return new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        hours ? parseInt(hours, 10) : 0,
        minutes ? parseInt(minutes, 10) : 0,
      );
    }
    return null;
  }
}
