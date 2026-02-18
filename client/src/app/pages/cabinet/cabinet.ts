import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-cabinet',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './cabinet.html',
  styleUrl: './cabinet.scss',
})
export class CabinetComponent {
  navItems = [
    { path: '/cabinet', label: 'Обзор', icon: 'dashboard', exact: true },
    { path: '/cabinet/bids', label: 'Мои ставки', icon: 'gavel', exact: false },
    { path: '/cabinet/orders', label: 'Заказы', icon: 'local_shipping', exact: false },
    { path: '/cabinet/documents', label: 'Документы', icon: 'description', exact: false },
    { path: '/cabinet/balance', label: 'Баланс', icon: 'account_balance_wallet', exact: false },
    { path: '/cabinet/watchlist', label: 'Отслеживаемые', icon: 'favorite', exact: false },
    { path: '/cabinet/notifications', label: 'Уведомления', icon: 'notifications', exact: false },
    { path: '/cabinet/settings', label: 'Настройки', icon: 'settings', exact: false },
  ];
}
