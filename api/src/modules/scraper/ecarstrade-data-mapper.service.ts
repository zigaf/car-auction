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
        // ssr data contains title, specsStr, images, price
        const { ssr, title, specsStr, images, price } = sourceData;

        // Parse specs from string (e.g. "Brand X | Model Y | 2019 | 50.000 km | Diesel | 110 kW (150 PS)")
        let brand, model, yearStr, mileageStr, fuelStr, powerStr;
        const parts = specsStr ? specsStr.split(' | ') : [];

        // Fallback extraction from title "Brand Model Derivative"
        const titleParts = title ? title.split(' ') : [];
        brand = titleParts[0] || parts[0];
        model = titleParts.slice(1, 3).join(' ') || parts[1];

        mileageStr = parts.find((p: string) => p.includes('km'));
        fuelStr = parts.find((p: string) => Object.keys(this.fuelTypeMap).some(f => p.includes(f)));
        yearStr = parts.find((p: string) => p.match(/\b20\d{2}\b/));
        powerStr = parts.find((p: string) => p.includes('kW') || p.includes('PS'));

        const year = yearStr ? parseInt(yearStr.match(/\b20\d{2}\b/)[0], 10) : null;
        const mileage = mileageStr ? this.parseGermanInt(mileageStr) : null;
        const power = this.parsePower(powerStr);
        const startingBid = this.parseGermanPrice(price) || (ssr?.currentBid ? parseFloat(ssr.currentBid) : null);

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
            fuelType: this.mapFuelType(fuelStr),
            enginePowerKw: power.kw,
            enginePowerPs: power.ps,
            saleCountry: 'EU',
            startingBid,
            originalCurrency: 'EUR',
            sourceImageUrl: categorizedImages.length > 0 ? categorizedImages[0].url : null,
            sourceUrl: detailUrl,
            description: ssr ? JSON.stringify(ssr) : null,
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
