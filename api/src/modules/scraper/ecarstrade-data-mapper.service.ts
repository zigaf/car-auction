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
    };

    mapVehicleToLot(
        sourceData: any,
        vehicleId: string,
        detailUrl: string
    ): Partial<Lot> & { _categorizedImages?: { url: string; category: string }[] } {
        // extractedData contains jsonLd, title, specs, images, price, equipment, serviceHistory
        const { jsonLd, title, specs, images, price, equipment, serviceHistory } = sourceData;

        // Extract from JSON-LD if available
        let brand = jsonLd?.brand?.name || undefined;
        let model = undefined;
        let year = undefined;
        let mileage = undefined;
        let fuelType = null;
        let power = { kw: null as number | null, ps: null as number | null };
        let startingBid = this.parseGermanPrice(price);

        // Extended specs
        let transmission = undefined;
        let numberOfGears = undefined;
        let numberOfDoors = undefined;
        let numberOfSeats = undefined;
        let engineCapacityCc = undefined;
        let emissionClass = undefined;
        let co2Emissions = undefined;
        let originCountry = undefined;
        let sellerName = undefined;
        let vin = undefined;

        if (jsonLd) {
            year = jsonLd.dateVehicleFirstRegistered ? parseInt(jsonLd.dateVehicleFirstRegistered.split('/').pop() || '', 10) : undefined;
            if (jsonLd.mileageFromOdometer?.value) {
                mileage = this.parseGermanInt(jsonLd.mileageFromOdometer.value);
            }
            if (jsonLd.fuelType) {
                fuelType = this.mapFuelType(jsonLd.fuelType);
            }
        }

        // Fallback or override with specs grid
        if (specs) {
            const specKeys = Object.keys(specs);
            const getSpec = (keywords: string[]) => {
                const key = specKeys.find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
                return key ? specs[key] : null;
            };

            const specYear = getSpec(['год', 'registration', 'jahr', 'year']);
            if (specYear && !year) {
                const yearMatch = specYear.match(/\b20\d{2}\b/);
                if (yearMatch) year = parseInt(yearMatch[0], 10);
            }

            const specMileage = getSpec(['пробег', 'mileage', 'kilometer', 'km']);
            if (specMileage && !mileage) mileage = this.parseGermanInt(specMileage);

            const specFuel = getSpec(['топливо', 'fuel', 'kraftstoff']);
            if (specFuel && !fuelType) fuelType = this.mapFuelType(specFuel);

            const specPower = getSpec(['мощность', 'power', 'leistung']);
            if (specPower) power = this.parsePower(specPower);

            const specTransmission = getSpec(['коробка', 'transmission', 'getriebe']);
            if (specTransmission) transmission = specTransmission;

            const specGears = getSpec(['передач', 'gears', 'gänge']);
            if (specGears) numberOfGears = this.parseGermanInt(specGears);

            const specDoors = getSpec(['дверей', 'doors', 'türen']);
            if (specDoors) numberOfDoors = this.parseGermanInt(specDoors);

            const specSeats = getSpec(['мест', 'seats', 'sitze']);
            if (specSeats) numberOfSeats = this.parseGermanInt(specSeats);

            const specEngine = getSpec(['объем', 'двигатель', 'engine', 'hubraum', 'capacity']);
            if (specEngine) engineCapacityCc = this.parseGermanInt(specEngine);

            const specEmission = getSpec(['эмиссии', 'emission']);
            if (specEmission) emissionClass = specEmission;

            const specCo2 = getSpec(['co2', 'co_2']);
            if (specCo2) co2Emissions = specCo2;

            const specOrigin = getSpec(['производства', 'origin', 'herkunft']);
            if (specOrigin) originCountry = specOrigin;

            const specSeller = getSpec(['продавец', 'seller', 'verkäufer']);
            if (specSeller) sellerName = specSeller;

            const specVin = getSpec(['vin', 'номер блока']);
            if (specVin) vin = specVin;
        }

        // Fallback extraction from title "Brand Model Derivative"
        if (!brand) {
            const titleParts = title ? title.split(' ') : [];
            brand = titleParts[0];
            model = titleParts.slice(1, 3).join(' ');
        } else {
            // Strip brand from title to get model
            model = title?.replace(new RegExp(`^${brand}\\s*`, 'i'), '').split(' ').slice(0, 2).join(' ') || undefined;
        }

        // Categorize Images
        const categorizedImages: { url: string, category: string }[] = [];
        if (images && Array.isArray(images)) {
            images.forEach((url, i) => {
                let category = 'exterior';
                if (i === 0) category = 'main';
                else if (i > 15) category = 'damage'; // rough heuristic if no clear labels

                categorizedImages.push({ url, category });
            });
        }

        return {
            sourceId: `ecars_${vehicleId}`,
            sourceVehicleId: vehicleId,
            source: 'ecarstrade',
            title: title || `${brand} ${model}`.trim(),
            brand: brand || undefined,
            model: model || undefined,
            year,
            mileage,
            fuelType: fuelType,
            enginePowerKw: power.kw,
            enginePowerPs: power.ps,
            engineCapacityCc,
            transmission,
            numberOfGears,
            numberOfDoors,
            numberOfSeats,
            emissionClass,
            co2Emissions,
            originCountry,
            sellerName,
            vin,
            saleCountry: 'EU',
            startingBid,
            originalCurrency: 'EUR',
            sourceImageUrl: categorizedImages.length > 0 ? categorizedImages[0].url : null,
            sourceUrl: detailUrl,
            description: jsonLd ? JSON.stringify(jsonLd) : null,
            equipment: equipment && equipment.length > 0 ? equipment : undefined,
            serviceHistory: serviceHistory && serviceHistory.length > 0 ? serviceHistory : undefined,
            specs: specs || undefined,
            auctionType: AuctionType.TIMED,
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
        const psMatch = str.match(/(\d+)\s*PS/i);
        return {
            kw: kwMatch ? parseInt(kwMatch[1], 10) : null,
            ps: psMatch ? parseInt(psMatch[1], 10) : null,
        };
    }
}
