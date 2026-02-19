import { Component, OnInit, inject } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { BalanceService } from '../../../core/services/balance.service';
import { IBalanceTransaction, BalanceTransactionType } from '../../../models/balance.model';

@Component({
  selector: 'app-balance',
  standalone: true,
  imports: [DecimalPipe, DatePipe],
  templateUrl: './balance.html',
  styleUrl: './balance.scss',
})
export class BalanceComponent implements OnInit {
  private readonly balanceService = inject(BalanceService);

  balance = 0;
  transactions: IBalanceTransaction[] = [];
  loading = true;
  error = '';

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.loading = true;
    this.error = '';

    this.balanceService.getBalance().subscribe({
      next: (res) => {
        this.balance = res.balance;
      },
      error: (err) => {
        this.error = 'Не удалось загрузить баланс';
        this.loading = false;
      },
    });

    this.balanceService.getTransactions(1, 50).subscribe({
      next: (res) => {
        this.transactions = res.data;
        this.loading = false;
      },
      error: () => {
        this.error = 'Не удалось загрузить историю операций';
        this.loading = false;
      },
    });
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case BalanceTransactionType.DEPOSIT:
        return 'arrow_downward';
      case BalanceTransactionType.CAR_PAYMENT:
        return 'arrow_upward';
      case BalanceTransactionType.COMMISSION:
        return 'receipt_long';
      case BalanceTransactionType.REFUND:
        return 'replay';
      case BalanceTransactionType.DELIVERY:
        return 'local_shipping';
      case BalanceTransactionType.CUSTOMS:
        return 'assured_workload';
      case BalanceTransactionType.BID_LOCK:
        return 'lock';
      case BalanceTransactionType.BID_UNLOCK:
        return 'lock_open';
      default:
        return 'swap_vert';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case BalanceTransactionType.DEPOSIT:
        return 'Пополнение';
      case BalanceTransactionType.CAR_PAYMENT:
        return 'Оплата авто';
      case BalanceTransactionType.COMMISSION:
        return 'Комиссия';
      case BalanceTransactionType.REFUND:
        return 'Возврат';
      case BalanceTransactionType.DELIVERY:
        return 'Доставка';
      case BalanceTransactionType.CUSTOMS:
        return 'Растаможка';
      case BalanceTransactionType.BID_LOCK:
        return 'Блокировка ставки';
      case BalanceTransactionType.BID_UNLOCK:
        return 'Разблокировка ставки';
      default:
        return 'Операция';
    }
  }
}
