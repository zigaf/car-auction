import { Component, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { environment } from '../../../environments/environment';
import { LotService } from '../../core/services/lot.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { StateService } from '../../core/services/state.service';
import { ILot, ILotImage, ImageCategory } from '../../models/lot.model';

interface ConditionItem {
  part: string;
  issues: string[];
}

interface TireInfo {
  position: string;
  treadDepth: string | null;
  size: string | null;
}

export type GalleryTab = 'all' | 'exterior' | 'interior' | 'damage';

@Component({
  selector: 'app-lot-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe],
  templateUrl: './lot-detail.html',
  styleUrl: './lot-detail.scss',
})
export class LotDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly lotService = inject(LotService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly stateService = inject(StateService);

  loading = true;
  lot: ILot | null = null;
  selectedImageIndex = 0;
  equipmentExpanded = false;
  activeGalleryTab: GalleryTab = 'all';
  fullscreenOpen = false;

  isFavorite = false;
  favoriteLoading = false;

  // Reserve bid from "other platforms" (fake — 70-90% of starting bid)
  reserveMultiplier = 0.7 + Math.random() * 0.2;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadLot(id);
    }
  }

  ngOnDestroy(): void {
    if (this.fullscreenOpen) {
      document.body.style.overflow = '';
    }
  }

  loadLot(id: string): void {
    this.loading = true;
    this.lotService.getById(id).subscribe({
      next: (lot) => {
        this.lot = lot;
        this.loading = false;
        if (this.stateService.snapshot.isAuthenticated) {
          this.favoritesService.checkFavorite(id).subscribe({
            next: (res) => (this.isFavorite = res.isFavorite),
            error: () => {},
          });
        }
      },
      error: () => {
        this.lot = null;
        this.loading = false;
      },
    });
  }

  get images(): ILotImage[] {
    if (this.lot?.images?.length) return this.lot.images;
    if (this.lot?.sourceImageUrl) {
      const url = this.lot.sourceImageUrl.startsWith('//')
        ? 'https:' + this.lot.sourceImageUrl
        : this.lot.sourceImageUrl;
      return [{ url, category: 'main' } as unknown as ILotImage];
    }
    return [];
  }

  /** Images filtered by the active gallery tab */
  get filteredImages(): ILotImage[] {
    if (this.activeGalleryTab === 'all') return this.images;
    const categoryMap: Record<string, ImageCategory> = {
      exterior: ImageCategory.EXTERIOR,
      interior: ImageCategory.INTERIOR,
      damage: ImageCategory.DAMAGE,
    };
    const cat = categoryMap[this.activeGalleryTab];
    return this.images.filter((img) => img.category === cat);
  }

  get damageImages(): ILotImage[] {
    return this.images.filter((img) => img.category === ImageCategory.DAMAGE);
  }

  get currentImage(): string | null {
    const imgs = this.filteredImages;
    if (imgs.length === 0) return null;
    const idx = Math.min(this.selectedImageIndex, imgs.length - 1);
    return this.getImageUrl(imgs[idx]?.url);
  }

  get imageCounter(): string {
    const imgs = this.filteredImages;
    if (imgs.length === 0) return '';
    const idx = Math.min(this.selectedImageIndex, imgs.length - 1);
    return `${idx + 1} / ${imgs.length}`;
  }

  selectImage(index: number): void {
    this.selectedImageIndex = index;
  }

  /** Navigate to a specific image in the full (unfiltered) image list */
  goToImageInAllPhotos(image: ILotImage): void {
    this.activeGalleryTab = 'all';
    const idx = this.images.findIndex((img) => img.url === image.url);
    if (idx !== -1) {
      this.selectedImageIndex = idx;
    }
  }

  prevImage(): void {
    const imgs = this.filteredImages;
    if (imgs.length === 0) return;
    this.selectedImageIndex =
      this.selectedImageIndex <= 0 ? imgs.length - 1 : this.selectedImageIndex - 1;
  }

  nextImage(): void {
    const imgs = this.filteredImages;
    if (imgs.length === 0) return;
    this.selectedImageIndex =
      this.selectedImageIndex >= imgs.length - 1 ? 0 : this.selectedImageIndex + 1;
  }

  setGalleryTab(tab: GalleryTab): void {
    this.activeGalleryTab = tab;
    this.selectedImageIndex = 0;
  }

  toggleFullscreen(): void {
    this.fullscreenOpen = !this.fullscreenOpen;
    document.body.style.overflow = this.fullscreenOpen ? 'hidden' : '';
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      this.prevImage();
    } else if (event.key === 'ArrowRight') {
      this.nextImage();
    } else if (event.key === 'Escape' && this.fullscreenOpen) {
      this.toggleFullscreen();
    }
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

  // ── Sections data from specs._sections ──

  private get sections(): any {
    return (this.lot?.specs as any)?._sections || null;
  }

  get bodyCondition(): ConditionItem[] {
    return this.sections?.bodyCondition || [];
  }

  get interiorCondition(): ConditionItem[] {
    return this.sections?.interiorCondition || [];
  }

  get tires(): TireInfo[] {
    return (this.sections?.tires || []).slice(0, 4);
  }

  get stoneChips(): ConditionItem[] {
    return this.sections?.stoneChips || [];
  }

  get accidentInfo(): string | null {
    return this.sections?.accidentInfo || null;
  }

  get seatsInfo(): string | null {
    return this.sections?.seats || null;
  }

  get parkingFee(): string | null {
    return this.sections?.parkingFee || null;
  }

  get generalInfo(): string | null {
    return this.sections?.generalInfo || null;
  }

  get visibleEquipment(): string[] {
    const eq = this.lot?.equipment || [];
    return this.equipmentExpanded ? eq : eq.slice(0, 10);
  }

  toggleEquipment(): void {
    this.equipmentExpanded = !this.equipmentExpanded;
  }

  toggleFavorite(): void {
    if (!this.stateService.snapshot.isAuthenticated || !this.lot || this.favoriteLoading) return;
    this.favoriteLoading = true;
    const action = this.isFavorite
      ? this.favoritesService.removeFavorite(this.lot.id)
      : this.favoritesService.addFavorite(this.lot.id);
    action.subscribe({
      next: () => {
        this.isFavorite = !this.isFavorite;
        this.favoriteLoading = false;
      },
      error: () => (this.favoriteLoading = false),
    });
  }

  get minPayment(): number | null {
    if (!this.lot) return null;
    return this.lot.startingBid || this.lot.reservePrice || null;
  }

  get reserveBid(): number | null {
    if (!this.lot?.startingBid) return null;
    return Math.round(this.lot.startingBid * this.reserveMultiplier);
  }

  /** True if lot has at least some real specs data beyond title */
  get hasSpecs(): boolean {
    if (!this.lot) return false;
    return !!(this.lot.enginePowerPs || this.lot.enginePowerKw || this.lot.fuelType ||
      this.lot.mileage || this.lot.year || this.lot.transmission || this.lot.exteriorColor);
  }
}
