import { Component } from '@angular/core';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class NotificationsComponent {
  notifications = [
    { id: 1, type: 'bid', icon: 'gavel', title: 'Ставка перебита', message: 'Ваша ставка на Audi A6 2022 была перебита. Текущая цена: 26,500 EUR.', time: '5 мин назад', read: false },
    { id: 2, type: 'order', icon: 'local_shipping', title: 'Статус заказа обновлён', message: 'Заказ ORD-001 (Porsche Cayenne) перешёл на этап "Оплачен".', time: '2 часа назад', read: false },
    { id: 3, type: 'document', icon: 'description', title: 'Документ подтверждён', message: 'Ваш паспорт успешно прошёл верификацию.', time: '1 день назад', read: false },
    { id: 4, type: 'system', icon: 'info', title: 'Новый аукцион', message: 'Завтра в 14:00 стартует live-аукцион. 12 лотов премиум-класса.', time: '1 день назад', read: true },
    { id: 5, type: 'balance', icon: 'account_balance_wallet', title: 'Пополнение баланса', message: 'На ваш счёт зачислено 20,000 EUR. Текущий баланс: 12,500 EUR.', time: '3 дня назад', read: true },
  ];

  get unreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  markAllRead(): void {
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
  }

  markRead(id: number): void {
    this.notifications = this.notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    );
  }
}
