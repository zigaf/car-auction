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
        this.iconUrl = `/brand-icons/${normalizedBrand}.png`;
    }

    onError(): void {
        this.hasError = true;
    }
}
