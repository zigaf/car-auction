import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { StateService, UserState } from '../../core/services/state.service';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-cabinet',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './cabinet.html',
  styleUrl: './cabinet.scss',
})
export class CabinetComponent {
  private ls = inject(LanguageService);
  private stateService = inject(StateService);

  get currentUser(): UserState | null {
    return this.stateService.snapshot.user;
  }

  get userName(): string {
    const user = this.currentUser;
    if (!user) return '';
    return `${user.firstName} ${user.lastName}`.trim();
  }

  get userStatus(): string {
    const user = this.currentUser;
    if (!user) return '';
    return user.isVerified ? this.ls.t('user.verified') : this.ls.t('user.notVerified');
  }

  get isBroker(): boolean {
    return this.currentUser?.role === 'broker';
  }

  get navItems() {
    const items = [
      { path: '/cabinet', label: this.ls.t('cabinet.overview'), icon: 'dashboard', exact: true },
    ];

    if (this.isBroker) {
      items.push({ path: '/cabinet/traders', label: this.ls.t('traders.title'), icon: 'group', exact: false });
    }

    items.push(
      { path: '/cabinet/bids', label: this.ls.t('cabinet.bids'), icon: 'gavel', exact: false },
      { path: '/cabinet/orders', label: this.ls.t('cabinet.orders'), icon: 'local_shipping', exact: false },
      { path: '/cabinet/documents', label: this.ls.t('cabinet.documents'), icon: 'description', exact: false },
      { path: '/cabinet/balance', label: this.ls.t('cabinet.balance'), icon: 'account_balance_wallet', exact: false },
      { path: '/cabinet/watchlist', label: this.ls.t('cabinet.watchlist'), icon: 'favorite', exact: false },
      { path: '/cabinet/calendar', label: this.ls.t('cabinet.calendar'), icon: 'calendar_month', exact: false },
      { path: '/cabinet/notifications', label: this.ls.t('cabinet.notifications'), icon: 'notifications', exact: false },
      { path: '/cabinet/calculator', label: this.ls.t('cabinet.calculator'), icon: 'calculate', exact: false },
      { path: '/cabinet/settings', label: this.ls.t('cabinet.settings'), icon: 'settings', exact: false },
    );

    return items;
  }
}
