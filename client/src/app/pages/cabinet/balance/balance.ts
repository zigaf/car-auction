import { Component } from '@angular/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-balance',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './balance.html',
  styleUrl: './balance.scss',
})
export class BalanceComponent {
  balance = 12500;

  transactions = [
    { id: 1, date: '2025-05-14', type: 'deposit', label: 'Пополнение', description: 'Банковский перевод IBAN', amount: 20000, balanceAfter: 20000 },
    { id: 2, date: '2025-05-15', type: 'commission', label: 'Комиссия', description: 'Регистрационный сбор участника', amount: -500, balanceAfter: 19500 },
    { id: 3, date: '2025-05-16', type: 'payment', label: 'Оплата', description: 'Porsche Cayenne 2020 — предоплата', amount: -5000, balanceAfter: 14500 },
    { id: 4, date: '2025-05-17', type: 'refund', label: 'Возврат', description: 'Возврат залога лот #112', amount: 1500, balanceAfter: 16000 },
    { id: 5, date: '2025-05-18', type: 'payment', label: 'Оплата', description: 'BMW 5 Series 2021 — залог', amount: -3500, balanceAfter: 12500 },
  ];

  getTypeIcon(type: string): string {
    switch (type) {
      case 'deposit': return 'arrow_downward';
      case 'payment': return 'arrow_upward';
      case 'commission': return 'receipt_long';
      case 'refund': return 'replay';
      default: return 'swap_vert';
    }
  }
}
