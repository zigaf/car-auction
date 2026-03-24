import { Injectable } from '@nestjs/common';
import { Lot } from '../../db/entities/lot.entity';
import { FuelType } from '../../common/enums/fuel-type.enum';
import { LotStatus } from '../../common/enums/lot-status.enum';
import { AuctionType } from '../../common/enums/auction-type.enum';

@Injectable()
export class EcarsTradeDataMapperService {
    private readonly fuelTypeMap: Record<string, FuelType> = {
        'Petrol': FuelType.PETROL,
        'Diesel': FuelType.DIESEL,
        'Electric': FuelType.ELECTRIC,
        'Hybrid': FuelType.HYBRID,
        'LPG': FuelType.LPG,
        'CNG': FuelType.CNG,
        'Бензин': FuelType.PETROL,
        'Дизель': FuelType.DIESEL,
        'Электро': FuelType.ELECTRIC,
        'Гибрид': FuelType.HYBRID,
        'Газ': FuelType.LPG,
    };

    mapVehicleToLot(
        sourceData: any,
        vehicleId: string,
        detailUrl: string
    ): Partial<Lot> & { _categorizedImages?: { url: string; category: string }[] } {
        const {
            jsonLd, title, specs, images, prices, vatType,
            equipment, equipmentByCategory, remarks, auctionInfo,
            pickupLocation, pickupReadiness, sellerName,
            conditionReportUrl, documentsType, documentCountry, serviceHistory,
        } = sourceData;

        const getSpec = (keywords: string[]): string | null => {
            if (!specs) return null;
            const specKeys = Object.keys(specs);
            const key = specKeys.find(k => keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase())));
            return key ? specs[key] : null;
        };

        // --- Brand & Model ---
        let brand = jsonLd?.brand?.name || undefined;
        let model = undefined;

        const specBrandModel = getSpec(['Марка и модель', 'Make and model']);
        if (specBrandModel) {
            const parts = specBrandModel.split(' ');
            if (!brand) brand = parts[0];
            model = parts.slice(1).join(' ') || undefined;
        } else if (brand && title) {
            model = title.replace(new RegExp(`^${brand}\\s*`, 'i'), '').split(' ').slice(0, 3).join(' ') || undefined;
        } else if (title) {
            const titleParts = title.split(' ');
            brand = titleParts[0];
            model = titleParts.slice(1, 4).join(' ');
        }

        // --- Year ---
        let year: number | undefined = undefined;
        const regDateStr = getSpec(['первой регистрации', 'first registration']);
        if (regDateStr) {
            const yearMatch = regDateStr.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) year = parseInt(yearMatch[0], 10);
        }
        if (!year && jsonLd?.dateVehicleFirstRegistered) {
            const yMatch = jsonLd.dateVehicleFirstRegistered.match(/\b(19|20)\d{2}\b/);
            if (yMatch) year = parseInt(yMatch[0], 10);
        }

        // --- Registration Date ---
        const registrationDate = this.parseRegistrationDate(regDateStr || jsonLd?.dateVehicleFirstRegistered);

        // --- Mileage ---
        let mileage: number | null = null;
        const specMileage = getSpec(['Пробег', 'Mileage', 'mileage']);
        if (specMileage) mileage = this.parseGermanInt(specMileage);
        if (!mileage && jsonLd?.mileageFromOdometer?.value) {
            mileage = this.parseGermanInt(jsonLd.mileageFromOdometer.value);
        }

        // --- Fuel Type ---
        let fuelType: FuelType | null = null;
        const specFuel = getSpec(['Тип топлива', 'Fuel type', 'fuel']);
        if (specFuel) fuelType = this.mapFuelType(specFuel);
        if (!fuelType && jsonLd?.fuelType) fuelType = this.mapFuelType(jsonLd.fuelType);

        // --- Power ---
        const specPower = getSpec(['Мощность', 'Power', 'power']);
        const power = this.parsePower(specPower);

        // --- Transmission ---
        const transmission = getSpec(['Тип коробки передач', 'Transmission type', 'Gearbox type', 'transmission']);
        const numberOfGears = this.parseGermanInt(getSpec(['Коробка передач', 'Gearbox', 'gears']));

        // --- Dimensions ---
        const numberOfDoors = this.parseGermanInt(getSpec(['Дверей', 'Doors', 'doors']));
        const numberOfSeats = this.parseGermanInt(getSpec(['Мест', 'Seats', 'Number of places', 'seats']));
        const engineCapacityCc = this.parseGermanInt(getSpec(['Объем двигателя', 'Engine capacity', 'Engine size', 'capacity']));

        // --- Emission ---
        const emissionClass = getSpec(['Класс эмиссии', 'Emission class', 'emission']);
        const co2Emissions = getSpec(['CO₂', 'CO2', 'co2']);

        // --- Color ---
        const exteriorColor = getSpec(['Цвет', 'Color', 'Colour', 'color']);

        // --- Vehicle Type / Category ---
        const vehicleType = getSpec(['Категория', 'Category', 'category']);

        // --- Origin Country ---
        const originCountry = getSpec(['Страна производства', 'Country of production', 'origin']);

        // --- VIN (validate 17 chars alphanumeric) ---
        let vin: string | undefined = undefined;
        const specVin = getSpec(['VIN']);
        if (specVin && /^[A-HJ-NPR-Z0-9]{17}$/i.test(specVin.trim())) {
            vin = specVin.trim().toUpperCase();
        }

        // --- Lot Number (Номер блока / Unit N°) ---
        const lotNumber = getSpec(['Номер блока', 'Block number', 'Unit N']);

        // --- Prices ---
        const startingBid = this.parseGermanPrice(prices?.oldPrice) || this.parseGermanPrice(prices?.buyNowPrice);
        const buyNowPrice = this.parseGermanPrice(prices?.buyNowPrice);

        // --- Auction Type ---
        let auctionType = AuctionType.TIMED;
        if (auctionInfo) {
            if (auctionInfo.includes('Наш сток') || auctionInfo.includes('Our stock') || auctionInfo.includes('Fixed')) {
                auctionType = AuctionType.BUY_NOW;
            }
        }

        // --- Categorize Images ---
        const categorizedImages: { url: string; category: string }[] = [];
        if (images && Array.isArray(images)) {
            images.forEach((url: string, i: number) => {
                let category = 'exterior';
                if (i === 0) category = 'main';
                else if (url.includes('interior') || url.includes('_int')) category = 'interior';
                else if (url.includes('damage') || url.includes('_dmg')) category = 'damage';
                categorizedImages.push({ url, category });
            });
        }

        // --- Specs JSONB (store all extra data) ---
        const specsJsonb: Record<string, any> = { ...specs };
        if (equipmentByCategory && Object.keys(equipmentByCategory).length > 0) {
            specsJsonb.equipmentByCategory = equipmentByCategory;
        }
        if (pickupReadiness) specsJsonb.pickupReadiness = pickupReadiness;
        if (prices?.totalPrice) specsJsonb.totalPrice = prices.totalPrice;
        if (documentsType) specsJsonb.documentsType = documentsType;
        if (documentCountry) specsJsonb.documentCountry = documentCountry;

        return {
            sourceId: `ecars_${vehicleId}`,
            sourceVehicleId: vehicleId,
            source: 'ecarstrade',
            title: title || `${brand} ${model}`.trim(),
            brand: brand || undefined,
            model: model || undefined,
            year,
            mileage,
            fuelType,
            enginePowerKw: power.kw,
            enginePowerPs: power.ps,
            engineCapacityCc,
            transmission,
            numberOfGears,
            numberOfDoors,
            numberOfSeats,
            emissionClass,
            co2Emissions,
            exteriorColor,
            vehicleType,
            originCountry,
            vin,
            lotNumber,
            sellerName: sellerName || undefined,
            saleName: auctionInfo || undefined,
            vehicleLocation: pickupLocation || undefined,
            vatTypeCode: vatType || undefined,
            conditionReportUrl: conditionReportUrl || undefined,
            registrationDate,
            saleCountry: 'EU',
            startingBid,
            buyNowPrice,
            originalCurrency: 'EUR',
            sourceImageUrl: categorizedImages.length > 0 ? categorizedImages[0].url : null,
            sourceUrl: detailUrl,
            description: remarks || null,
            equipment: equipment && equipment.length > 0 ? equipment : undefined,
            serviceHistory: serviceHistory && serviceHistory.length > 0 ? serviceHistory : undefined,
            specs: Object.keys(specsJsonb).length > 0 ? specsJsonb : undefined,
            auctionType,
            status: LotStatus.IMPORTED,
            _categorizedImages: categorizedImages.length > 0 ? categorizedImages : undefined,
        } as Partial<Lot> & { _categorizedImages?: { url: string; category: string }[] };
    }

    private mapFuelType(fuelStr: string | null): FuelType | null {
        if (!fuelStr) return null;
        const lower = fuelStr.toLowerCase();
        for (const [key, value] of Object.entries(this.fuelTypeMap)) {
            if (lower.includes(key.toLowerCase())) return value;
        }
        if (lower.includes('бензин') && lower.includes('электр')) return FuelType.HYBRID;
        if (lower.includes('plug')) return FuelType.HYBRID;
        return FuelType.OTHER;
    }

    parseGermanInt(str: string | null): number | null {
        if (!str) return null;
        const cleaned = str.replace(/[^\d.,]/g, '');
        const normalized = cleaned.replace(/\./g, '').replace(',', '.');
        const num = parseInt(normalized, 10);
        return isNaN(num) ? null : num;
    }

    parseGermanPrice(str: string | null): number | null {
        if (!str) return null;
        const cleaned = str.replace(/[^\d.,]/g, '');
        if (!cleaned) return null;
        const normalized = cleaned.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(normalized);
        return isNaN(num) ? null : num;
    }

    private parsePower(str: string | null): { kw: number | null; ps: number | null } {
        if (!str) return { kw: null, ps: null };
        const kwMatch = str.match(/(\d+)\s*kW/i);
        const psMatch = str.match(/(\d+)\s*(?:PS|Hp|HP|hp|л\.?\s?с\.?)/i);
        return {
            kw: kwMatch ? parseInt(kwMatch[1], 10) : null,
            ps: psMatch ? parseInt(psMatch[1], 10) : null,
        };
    }

    private parseRegistrationDate(str: string | null): Date | null {
        if (!str) return null;
        const match = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (!match) return null;
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
    }
}
