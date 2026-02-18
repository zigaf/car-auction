import { Component, inject, afterNextRender } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-lot-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe],
  templateUrl: './lot-detail.html',
  styleUrl: './lot-detail.scss',
})
export class LotDetailComponent {
  private route = inject(ActivatedRoute);

  loading = true;
  lot: any = null;
  selectedImageIndex = 0;

  constructor() {
    afterNextRender(() => {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) this.loadLot(id);
    });
  }

  async loadLot(id: string): Promise<void> {
    this.loading = true;
    try {
      const resp = await fetch(`${environment.apiUrl}/lots/${id}`);
      if (!resp.ok) throw new Error('Not found');
      this.lot = await resp.json();
    } catch {
      this.lot = null;
    } finally {
      this.loading = false;
    }
  }

  get images(): any[] {
    return this.lot?.images || [];
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
