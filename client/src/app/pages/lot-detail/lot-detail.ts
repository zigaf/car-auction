import { Component, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { LotService } from '../../core/services/lot.service';
import { AuctionService } from '../../core/services/auction.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { StateService } from '../../core/services/state.service';
import { WebsocketService } from '../../core/services/websocket.service';
import { AuctionStateService } from '../../core/services/auction-state.service';
import { TimeService } from '../../core/services/time.service';
import { ILot, ILotImage, ImageCategory, LotStatus } from '../../models/lot.model';
import { IBid } from '../../models/auction.model';

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
  private readonly auctionService = inject(AuctionService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly stateService = inject(StateService);
  private readonly wsService = inject(WebsocketService);
  private readonly auctionState = inject(AuctionStateService);
  private readonly timeService = inject(TimeService);
  private readonly destroy$ = new Subject<void>();

  private bidFlashTimer: ReturnType<typeof setTimeout> | null = null;
  private bidTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private lastBidWasPreBid = false;

  // ─── Gallery state ────────────────────────────────────────────────────────
  loading = true;
  lot: ILot | null = null;
  selectedImageIndex = 0;
  equipmentExpanded = false;
  activeGalleryTab: GalleryTab = 'all';
  fullscreenOpen = false;

  // ─── Favorites ────────────────────────────────────────────────────────────
  isFavorite = false;
  favoriteLoading = false;

  // Reserve bid from "other platforms" (simulated: 70-90% of starting bid)
  reserveMultiplier = 0.7 + Math.random() * 0.2;

  // ─── Auction / bidding state ──────────────────────────────────────────────
  now = 0; // updated every second via interval; initialised after TimeService
  bidHistory: IBid[] = [];
  watcherCount = 0;

  bidding = false;
  bidError: string | null = null;
  bidSuccess = false;
  auctionEnded = false;

  customBidAmount: number | null = null;
  maxAutoBidAmount: number | null = null;

  currentUserId: string | null = null;
  isWinning = false;
  isOutbid = false;
  activeAutoBidMax: number | null = null;
  activeAutoBidLotId: string | null = null;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.now = this.timeService.now();
    this.currentUserId = this.stateService.snapshot.user?.id ?? null;

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadLot(id);
    }

    // Keep timer ticking every second
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.now = this.timeService.now();
      });
  }

  ngOnDestroy(): void {
    if (this.lot) {
      this.wsService.leaveAuction(this.lot.id);
    }
    if (this.fullscreenOpen) {
      document.body.style.overflow = '';
    }
    if (this.bidFlashTimer) clearTimeout(this.bidFlashTimer);
    if (this.bidTimeoutTimer) clearTimeout(this.bidTimeoutTimer);
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadLot(id: string): void {
    this.loading = true;
    this.lotService.getById(id).subscribe({
      next: (lot) => {
        this.lot = lot;
        this.loading = false;

        // Seed global state with HTTP snapshot price
        this.auctionState.seedFromLots([lot]);

        if (this.stateService.snapshot.isAuthenticated) {
          this.favoritesService.checkFavorite(id).subscribe({
            next: (res) => (this.isFavorite = res.isFavorite),
            error: () => {},
          });

          // Join the auction room for per-lot real-time events
          if (lot.status === LotStatus.TRADING) {
            this.wsService.joinAuction(lot.id);
            this.connectAuctionEvents(lot.id);
            this.loadBidHistory(lot.id);
          }
        }
      },
      error: () => {
        this.lot = null;
        this.loading = false;
      },
    });
  }

  private connectAuctionEvents(lotId: string): void {
    // Real-time bid updates for this specific lot
    this.wsService.bidUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe((update) => {
        if (update.lotId !== lotId) return;

        // Update local lot reference — AuctionStateService already receives
        // the same price via feedUpdate$ (global feed), so no manual state sync needed.
        if (this.lot) {
          this.lot = { ...this.lot, currentPrice: update.amount };
        }

        // Determine winning/outbid status
        if (this.currentUserId) {
          const isMyBid = update.userId === this.currentUserId;
          this.isWinning = isMyBid;
          this.isOutbid = !isMyBid;
          if (!isMyBid && this.activeAutoBidLotId === lotId && this.activeAutoBidMax !== null) {
            if (update.amount > this.activeAutoBidMax) {
              this.activeAutoBidMax = null;
              this.activeAutoBidLotId = null;
            }
          }
        }

        // Prepend new bid to history (no HTTP round-trip)
        const newBid: IBid = {
          id: '',
          lotId: update.lotId,
          userId: update.userId,
          amount: update.amount,
          isPreBid: update.isAutoBid ?? false,
          maxAutoBid: null,
          createdAt: update.timestamp,
          bidderFlag: update.bidderFlag,
        };
        this.bidHistory = [newBid, ...this.bidHistory].slice(0, 10);
      });

    // Auction time extensions (anti-sniping)
    this.wsService.auctionExtended$
      .pipe(takeUntil(this.destroy$))
      .subscribe((ext) => {
        if (ext.lotId !== lotId) return;
        if (this.lot) {
          this.lot = { ...this.lot, auctionEndAt: ext.newEndAt };
        }
        this.auctionState.updateEndAt(lotId, ext.newEndAt);
      });

    // Auction ended
    this.wsService.auctionEnded$
      .pipe(takeUntil(this.destroy$))
      .subscribe((ended) => {
        if (ended.lotId !== lotId) return;
        this.auctionEnded = true;
        if (this.lot) {
          this.lot = { ...this.lot, currentPrice: ended.finalPrice, winnerId: ended.winnerId };
        }
        if (this.activeAutoBidLotId === lotId) {
          this.activeAutoBidMax = null;
          this.activeAutoBidLotId = null;
        }
      });

    // Bid placed acknowledgement
    this.wsService.bidPlaced$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.bidTimeoutTimer) {
          clearTimeout(this.bidTimeoutTimer);
          this.bidTimeoutTimer = null;
        }
        this.lastBidWasPreBid = false;
        this.bidding = false;
        this.bidSuccess = true;
        this.bidError = null;
        this.customBidAmount = null;
        setTimeout(() => { this.bidSuccess = false; }, 3000);
      });

    // Bid errors
    this.wsService.bidError$
      .pipe(takeUntil(this.destroy$))
      .subscribe((err) => {
        if (this.bidTimeoutTimer) {
          clearTimeout(this.bidTimeoutTimer);
          this.bidTimeoutTimer = null;
        }
        if (this.lastBidWasPreBid) {
          this.activeAutoBidMax = null;
          this.activeAutoBidLotId = null;
        }
        this.lastBidWasPreBid = false;
        this.bidding = false;
        this.bidError = err.message;
        setTimeout(() => { this.bidError = null; }, 5000);
      });

    // Watcher count
    this.wsService.watcherCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        if (data.lotId === lotId) {
          this.watcherCount = data.count;
        }
      });
  }

  private loadBidHistory(lotId: string): void {
    this.auctionService.getBidsByLot(lotId, 1, 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.bidHistory = response.data;
        },
      });
  }

  // ─── Bidding actions ──────────────────────────────────────────────────────

  placeBid(): void {
    if (!this.lot || !this.customBidAmount || this.bidding) return;
    const minBid = this.getMinBid(this.lot);
    if (this.customBidAmount < minBid) {
      this.bidError = `Минимальная ставка: €${minBid.toLocaleString()}`;
      return;
    }
    this.lastBidWasPreBid = false;
    this.bidding = true;
    this.bidError = null;

    if (this.bidTimeoutTimer) clearTimeout(this.bidTimeoutTimer);
    this.bidTimeoutTimer = setTimeout(() => {
      if (this.bidding) {
        this.bidding = false;
        this.bidError = 'Нет ответа от сервера. Попробуйте снова.';
        setTimeout(() => { this.bidError = null; }, 4000);
      }
    }, 15000);

    this.wsService.placeBid(this.lot.id, this.customBidAmount);
  }

  placePreBid(): void {
    if (!this.lot || !this.maxAutoBidAmount || this.bidding) return;
    const minBid = this.getMinBid(this.lot);
    if (this.maxAutoBidAmount < minBid) {
      this.bidError = `Авто-ставка должна быть не менее €${minBid.toLocaleString()}`;
      return;
    }
    this.lastBidWasPreBid = true;
    this.bidding = true;
    this.bidError = null;
    this.activeAutoBidMax = this.maxAutoBidAmount;
    this.activeAutoBidLotId = this.lot.id;

    if (this.bidTimeoutTimer) clearTimeout(this.bidTimeoutTimer);
    this.bidTimeoutTimer = setTimeout(() => {
      if (this.bidding) {
        this.bidding = false;
        this.activeAutoBidMax = null;
        this.activeAutoBidLotId = null;
        this.bidError = 'Нет ответа от сервера. Попробуйте снова.';
        setTimeout(() => { this.bidError = null; }, 4000);
      }
    }, 15000);

    this.wsService.placePreBid(this.lot.id, this.maxAutoBidAmount);
    this.maxAutoBidAmount = null;
  }

  clearAutoBid(): void {
    this.activeAutoBidMax = null;
    this.activeAutoBidLotId = null;
  }

  quickBid(increment: number): void {
    if (!this.lot) return;
    this.customBidAmount = this.getCurrentPrice(this.lot) + increment;
  }

  // ─── Gallery helpers ──────────────────────────────────────────────────────

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

  // ─── Specs from lot._sections ─────────────────────────────────────────────

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

  // ─── Auction computed ─────────────────────────────────────────────────────

  get isTrading(): boolean {
    return this.lot?.status === LotStatus.TRADING;
  }

  get isAuthenticated(): boolean {
    return this.stateService.snapshot.isAuthenticated;
  }

  getCurrentPrice(lot: ILot): number {
    const livePrice = this.auctionState.getLotPrice(lot.id);
    if (livePrice !== null) return livePrice;
    if (lot.currentPrice) return parseFloat(String(lot.currentPrice));
    if (lot.startingBid) return parseFloat(String(lot.startingBid));
    return 0;
  }

  getBidStep(lot: ILot): number {
    return parseFloat(String(lot.bidStep)) || 100;
  }

  getMinBid(lot: ILot): number {
    return this.getCurrentPrice(lot) + this.getBidStep(lot);
  }

  getQuickBidIncrements(): number[] {
    if (!this.lot) return [100, 250, 500, 1000];
    const price = this.getCurrentPrice(this.lot);
    if (price < 1000)  return [50, 100, 200, 500];
    if (price < 5000)  return [100, 250, 500, 1000];
    if (price < 20000) return [250, 500, 1000, 2500];
    if (price < 50000) return [500, 1000, 2500, 5000];
    return [1000, 2500, 5000, 10000];
  }

  getTimeLeft(endAt: string | null): string {
    if (!endAt) return '--:--';
    const diff = new Date(endAt).getTime() - this.now;
    if (diff <= 0) return '0:00';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  getTimerClass(endAt: string | null): string {
    if (!endAt) return 'timer--green';
    const diff = new Date(endAt).getTime() - this.now;
    if (diff < 30000) return 'timer--red';
    if (diff < 120000) return 'timer--yellow';
    return 'timer--green';
  }

  isMyBid(bid: IBid): boolean {
    return !!this.currentUserId && bid.userId === this.currentUserId;
  }

  // ─── Favorites ────────────────────────────────────────────────────────────

  toggleFavorite(): void {
    if (!this.stateService.snapshot.isAuthenticated || !this.lot || this.favoriteLoading) return;
    this.favoriteLoading = true;
    const lotId = this.lot.id;
    if (this.isFavorite) {
      this.favoritesService.removeFavorite(lotId).subscribe({
        next: () => { this.isFavorite = false; this.favoriteLoading = false; },
        error: () => (this.favoriteLoading = false),
      });
    } else {
      this.favoritesService.addFavorite(lotId).subscribe({
        next: () => { this.isFavorite = true; this.favoriteLoading = false; },
        error: () => (this.favoriteLoading = false),
      });
    }
  }

  // ─── Legacy panel helpers ─────────────────────────────────────────────────

  get minPayment(): number | null {
    if (!this.lot) return null;
    return this.lot.startingBid || this.lot.reservePrice || null;
  }

  get reserveBid(): number | null {
    if (!this.lot?.startingBid) return null;
    return Math.round(this.lot.startingBid * this.reserveMultiplier);
  }

  get hasSpecs(): boolean {
    if (!this.lot) return false;
    return !!(this.lot.enginePowerPs || this.lot.enginePowerKw || this.lot.fuelType ||
      this.lot.mileage || this.lot.year || this.lot.transmission || this.lot.exteriorColor);
  }
}
