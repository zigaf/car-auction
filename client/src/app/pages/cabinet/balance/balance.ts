import { Component, OnInit, inject } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BalanceService } from '../../../core/services/balance.service';
import { StateService } from '../../../core/services/state.service';
import { AppButtonComponent } from '../../../shared/components/button/button.component';
import { IBalanceTransaction, BalanceTransactionType } from '../../../models/balance.model';
import { LanguageService } from '../../../core/services/language.service';

const RESTRICTED_FLAGS = ['🇷🇺', '🇧🇾'];

@Component({
  selector: 'app-balance',
  standalone: true,
  imports: [DecimalPipe, DatePipe, FormsModule, AppButtonComponent],
  templateUrl: './balance.html',
  styleUrl: './balance.scss',
})
export class BalanceComponent implements OnInit {
  ls = inject(LanguageService);
  private readonly balanceService = inject(BalanceService);
  private readonly stateService = inject(StateService);

  balance = 0;
  transactions: IBalanceTransaction[] = [];
  loading = true;
  error = '';

  showDepositPanel = false;

  get currentUser() {
    return this.stateService.snapshot.user;
  }

  get isVerified(): boolean {
    return this.currentUser?.isVerified ?? false;
  }

  get isRestrictedCountry(): boolean {
    const flag = this.currentUser?.countryFlag ?? '';
    return RESTRICTED_FLAGS.some((f) => flag.includes(f));
  }

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.loading = true;
    this.error = '';

    this.balanceService.getBalance().subscribe({
      next: (res) => {
        this.balance = res.balance;
        this.stateService.updateBalance(res.balance);
      },
      error: () => {
        this.error = this.ls.t('balance.error.balance');
        this.loading = false;
      },
    });

    this.balanceService.getTransactions(1, 50).subscribe({
      next: (res) => {
        this.transactions = res.data;
        this.loading = false;
      },
      error: () => {
        this.error = this.ls.t('balance.error.history');
        this.loading = false;
      },
    });
  }

  toggleDepositPanel(): void {
    if (!this.isVerified) return;
    this.showDepositPanel = !this.showDepositPanel;
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case BalanceTransactionType.DEPOSIT:     return 'arrow_downward';
      case BalanceTransactionType.CAR_PAYMENT: return 'arrow_upward';
      case BalanceTransactionType.COMMISSION:  return 'receipt_long';
      case BalanceTransactionType.REFUND:      return 'replay';
      case BalanceTransactionType.DELIVERY:    return 'local_shipping';
      case BalanceTransactionType.CUSTOMS:     return 'assured_workload';
      case BalanceTransactionType.BID_LOCK:    return 'lock';
      case BalanceTransactionType.BID_UNLOCK:  return 'lock_open';
      default:                                  return 'swap_vert';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case BalanceTransactionType.DEPOSIT:     return this.ls.t('balance.type.deposit');
      case BalanceTransactionType.CAR_PAYMENT: return this.ls.t('balance.type.carPayment');
      case BalanceTransactionType.COMMISSION:  return this.ls.t('balance.type.commission');
      case BalanceTransactionType.REFUND:      return this.ls.t('balance.type.refund');
      case BalanceTransactionType.DELIVERY:    return this.ls.t('balance.type.delivery');
      case BalanceTransactionType.CUSTOMS:     return this.ls.t('balance.type.customs');
      case BalanceTransactionType.BID_LOCK:    return this.ls.t('balance.type.bidLock');
      case BalanceTransactionType.BID_UNLOCK:  return this.ls.t('balance.type.bidUnlock');
      default:                                  return this.ls.t('balance.type.other');
    }
  }
}
