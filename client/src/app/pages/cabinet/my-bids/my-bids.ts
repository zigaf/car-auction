import { Component, OnInit, OnDestroy } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuctionService } from '../../../core/services/auction.service';
import { StateService } from '../../../core/services/state.service';
import { IBid } from '../../../models/auction.model';
import { LotStatus } from '../../../models/lot.model';

type BidTab = 'all' | 'active' | 'won' | 'lost';

@Component({
  selector: 'app-my-bids',
  standalone: true,
  imports: [DecimalPipe, DatePipe, RouterLink],
  templateUrl: './my-bids.html',
  styleUrl: './my-bids.scss',
})
export class MyBidsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  bids: IBid[] = [];
  filteredBids: IBid[] = [];
  activeTab: BidTab = 'all';
  loading = true;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  totalItems = 0;
  pageSize = 20;

  // Counts per tab
  counts = { all: 0, active: 0, won: 0, lost: 0 };

  constructor(
    private readonly auctionService: AuctionService,
    private readonly stateService: StateService,
  ) {}

  ngOnInit(): void {
    this.loadBids();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadBids(): void {
    this.loading = true;
    this.error = null;

    this.auctionService.getMyBids(this.currentPage, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.bids = response.data;
          this.totalItems = response.total;
          this.loading = false;
          this.computeCounts();
          this.applyFilter();
        },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.message || 'Failed to load bids';
        },
      });
  }

  private computeCounts(): void {
    const userId = this.stateService.snapshot.user?.id;
    this.counts = {
      all: this.bids.length,
      active: this.bids.filter(b => b.lot?.status === LotStatus.TRADING).length,
      won: this.bids.filter(b => b.lot?.status === LotStatus.SOLD && b.lot?.winnerId === userId).length,
      lost: this.bids.filter(b => b.lot?.status === LotStatus.SOLD && b.lot?.winnerId !== userId).length,
    };
  }

  setTab(tab: BidTab): void {
    this.activeTab = tab;
    this.applyFilter();
  }

  private applyFilter(): void {
    const userId = this.stateService.snapshot.user?.id;

    switch (this.activeTab) {
      case 'active':
        this.filteredBids = this.bids.filter(b => b.lot?.status === LotStatus.TRADING);
        break;
      case 'won':
        this.filteredBids = this.bids.filter(b => b.lot?.status === LotStatus.SOLD && b.lot?.winnerId === userId);
        break;
      case 'lost':
        this.filteredBids = this.bids.filter(b => b.lot?.status === LotStatus.SOLD && b.lot?.winnerId !== userId);
        break;
      default:
        this.filteredBids = [...this.bids];
    }
  }

  getBidStatus(bid: IBid): { label: string; cssClass: string } {
    const userId = this.stateService.snapshot.user?.id;
    const lot = bid.lot;

    if (!lot) return { label: '--', cssClass: '' };

    if (lot.status === LotStatus.SOLD) {
      if (lot.winnerId === userId) {
        return { label: 'Won', cssClass: 'bid-status--won' };
      }
      return { label: 'Lost', cssClass: 'bid-status--lost' };
    }

    if (lot.status === LotStatus.TRADING) {
      const currentPrice = lot.currentPrice ? parseFloat(String(lot.currentPrice)) : 0;
      if (bid.amount >= currentPrice) {
        return { label: 'Leading', cssClass: 'bid-status--leading' };
      }
      return { label: 'Outbid', cssClass: 'bid-status--outbid' };
    }

    return { label: lot.status, cssClass: '' };
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadBids();
  }

  getLotImage(bid: IBid): string | null {
    if (bid.lot?.images && bid.lot.images.length > 0) {
      return bid.lot.images[0].url;
    }
    return bid.lot?.sourceImageUrl || null;
  }
}
