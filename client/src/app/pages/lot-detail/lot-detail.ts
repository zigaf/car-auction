import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { environment } from '../../../environments/environment';
import { LotService } from '../../core/services/lot.service';
import { ILot, ILotImage } from '../../models/lot.model';

@Component({
  selector: 'app-lot-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe],
  templateUrl: './lot-detail.html',
  styleUrl: './lot-detail.scss',
})
export class LotDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly lotService = inject(LotService);

  loading = true;
  lot: ILot | null = null;
  selectedImageIndex = 0;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadLot(id);
    }
  }

  loadLot(id: string): void {
    this.loading = true;
    this.lotService.getById(id).subscribe({
      next: (lot) => {
        this.lot = lot;
        this.loading = false;
      },
      error: () => {
        this.lot = null;
        this.loading = false;
      },
    });
  }

  get images(): ILotImage[] {
    if (this.lot?.images?.length) return this.lot.images;
    // Fallback: create virtual image from source image URL
    if (this.lot?.sourceImageUrl) {
      const url = this.lot.sourceImageUrl.startsWith('//')
        ? 'https:' + this.lot.sourceImageUrl
        : this.lot.sourceImageUrl;
      return [{ url, category: 'main' } as unknown as ILotImage];
    }
    return [];
  }

  get currentImage(): string | null {
    if (this.images.length === 0) return null;
    return this.getImageUrl(this.images[this.selectedImageIndex]?.url);
  }

  selectImage(index: number): void {
    this.selectedImageIndex = index;
  }

  getImageUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${environment.apiUrl.replace('/api', '')}${path}`;
  }

  getFuelLabel(fuelType: string): string {
    const map: Record<string, string> = {
      petrol: 'Бензин', diesel: 'Дизель', hybrid: 'Гибрид',
      electric: 'Электро', lpg: 'Газ', other: 'Другое',
    };
    return map[fuelType] || fuelType || '-';
  }
}
