import { Component, inject, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LotService } from '../../core/services/lot.service';
import { ILot, ILotStats, IBrandCount } from '../../models/lot.model';
import { AppBrandIconComponent } from '../../shared/components/brand-icon/brand-icon.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, DecimalPipe, AppBrandIconComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly lotService = inject(LotService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChild('recentTrack') recentTrack!: ElementRef<HTMLDivElement>;
  activeRecentDot = 0;
  recentDotCount = 0;
  private scrollHandler: (() => void) | null = null;

  loading = true;
  lots: ILot[] = [];
  recentLots: ILot[] = [];
  brands: IBrandCount[] = [];
  stats: ILotStats = { totalLots: 0, totalBrands: 0, countries: 0, withPhotos: 0 };

  steps = [
    { title: 'Регистрация', desc: 'Создайте аккаунт и пройдите верификацию' },
    { title: 'Пополните баланс', desc: 'Внесите депозит для участия в торгах' },
    { title: 'Выберите авто', desc: 'Найдите автомобиль в каталоге или на live-торгах' },
    { title: 'Сделайте ставку', desc: 'Участвуйте в аукционе в реальном времени' },
    { title: 'Оплатите лот', desc: 'После победы оплатите автомобиль' },
    { title: 'Доставка и растаможка', desc: 'Мы доставим и растаможим авто для вас' },
    { title: 'Получите авто', desc: 'Заберите автомобиль по вашему адресу' },
  ];

  popularTags = ['Porsche 911', 'BMW M3', 'Mercedes W124', 'Land Cruiser', 'Ferrari'];

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.setupRecentDots();
  }

  ngOnDestroy(): void {
    if (this.scrollHandler && this.recentTrack?.nativeElement) {
      this.recentTrack.nativeElement.removeEventListener('scroll', this.scrollHandler);
    }
  }

  private setupRecentDots(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    setTimeout(() => {
      const el = this.recentTrack?.nativeElement;
      if (!el) return;
      this.updateDotCount(el);
      this.scrollHandler = () => this.onRecentScroll(el);
      el.addEventListener('scroll', this.scrollHandler, { passive: true });
    });
  }

  private updateDotCount(el: HTMLElement): void {
    const card = el.querySelector('.ending-soon__card') as HTMLElement;
    if (!card) return;
    const cardWidth = card.offsetWidth + parseInt(getComputedStyle(el).gap || '0', 10);
    const visibleCards = Math.floor(el.clientWidth / cardWidth) || 1;
    const totalCards = el.children.length;
    this.recentDotCount = Math.max(1, totalCards - visibleCards + 1);
  }

  private onRecentScroll(el: HTMLElement): void {
    const card = el.querySelector('.ending-soon__card') as HTMLElement;
    if (!card) return;
    const cardWidth = card.offsetWidth + parseInt(getComputedStyle(el).gap || '0', 10);
    const index = Math.round(el.scrollLeft / cardWidth);
    if (index !== this.activeRecentDot) {
      this.activeRecentDot = index;
      this.cdr.detectChanges();
    }
  }

  scrollToRecentDot(index: number): void {
    const el = this.recentTrack?.nativeElement;
    if (!el) return;
    const card = el.querySelector('.ending-soon__card') as HTMLElement;
    if (!card) return;
    const cardWidth = card.offsetWidth + parseInt(getComputedStyle(el).gap || '0', 10);
    el.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
  }

  scrollRecentPrev(): void {
    if (this.activeRecentDot > 0) {
      this.scrollToRecentDot(this.activeRecentDot - 1);
    }
  }

  scrollRecentNext(): void {
    if (this.activeRecentDot < this.recentDotCount - 1) {
      this.scrollToRecentDot(this.activeRecentDot + 1);
    }
  }

  loadData(): void {
    this.loading = true;

    forkJoin({
      lots: this.lotService.getAll({ limit: 6, sort: 'price_desc' }),
      recentLots: this.lotService.getAll({ limit: 6, sort: 'date_desc' }),
      brands: this.lotService.getBrands(),
      stats: this.lotService.getStats(),
    }).subscribe({
      next: (result) => {
        this.lots = result.lots.data || [];
        this.recentLots = result.recentLots.data || [];
        this.brands = result.brands || [];
        this.stats = result.stats;
        this.loading = false;
        this.cdr.detectChanges();
        this.setupRecentDots();
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  getMainImage(lot: ILot): string | null {
    if (lot.images && lot.images.length > 0) {
      const main = lot.images.find((img) => img.category === 'main');
      const img = main || lot.images[0];
      return this.getImageUrl(img.url);
    }
    // Fallback to source image URL
    if (lot.sourceImageUrl) {
      return lot.sourceImageUrl.startsWith('//')
        ? 'https:' + lot.sourceImageUrl
        : lot.sourceImageUrl;
    }
    return null;
  }

  getImageUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${environment.apiUrl.replace('/api', '')}${path}`;
  }

  getFuelLabel(fuelType: string): string {
    const labels: Record<string, string> = {
      petrol: 'Бензин', diesel: 'Дизель', hybrid: 'Гибрид',
      electric: 'Электро', lpg: 'Газ', other: 'Другое',
    };
    return labels[fuelType] || fuelType || '-';
  }
}
