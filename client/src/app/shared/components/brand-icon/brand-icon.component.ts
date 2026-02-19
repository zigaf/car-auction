import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-brand-icon',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './brand-icon.component.html',
    styleUrl: './brand-icon.component.scss',
})
export class AppBrandIconComponent implements OnChanges {
    @Input() brand: string = '';
    @Input() size: number = 24;

    iconUrl: string = '';
    hasError: boolean = false;

    private readonly brandDomains: Record<string, string> = {
        'audi': 'audi.com',
        'bmw': 'bmw.com',
        'mercedes-benz': 'mercedes-benz.com',
        'mercedes-amg': 'mercedes-amg.com',
        'volkswagen': 'volkswagen.com',
        'vw': 'volkswagen.com',
        'volvo': 'volvo.com',
        'toyota': 'toyota.com',
        'ford': 'ford.com',
        'nissan': 'nissan-global.com',
        'hyundai': 'hyundai.com',
        'kia': 'kia.com',
        'peugeot': 'peugeot.com',
        'renault': 'renault.com',
        'citroen': 'citroen.com',
        'opel': 'opel.com',
        'skoda': 'skoda-auto.com',
        'seat': 'seat.com',
        'cupra': 'cupraofficial.com',
        'dacia': 'dacia.com',
        'mini': 'mini.com',
        'smart': 'smart.com',
        'mitsubishi': 'mitsubishimotors.com',
        'mazda': 'mazda.com',
        'honda': 'honda.com',
        'lexus': 'lexus.com',
        'porsche': 'porsche.com',
        'land-rover': 'landrover.com',
        'jaguar': 'jaguar.com',
        'fiat': 'fiat.com',
        'alfa-romeo': 'alfaromeo.com',
        'jeep': 'jeep.com',
        'chevrolet': 'chevrolet.com',
        'tesla': 'tesla.com'
    };

    ngOnChanges(): void {
        this.hasError = false;
        this.updateIconUrl();
    }

    private updateIconUrl(): void {
        if (!this.brand) {
            this.hasError = true;
            return;
        }

        const normalizedBrand = this.brand.toLowerCase().trim().replace(/\s+/g, '-');
        const domain = this.brandDomains[normalizedBrand];

        const resolvedDomain = domain ?? `${normalizedBrand}.com`;
        this.iconUrl = `https://img.logo.dev/${resolvedDomain}?token=pk_Vi55Q2apTvK73ITtWI81zA&size=${this.size}&format=png`;
    }

    onError(): void {
        this.hasError = true;
    }
}
