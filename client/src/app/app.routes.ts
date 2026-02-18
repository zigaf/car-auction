import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.HomeComponent),
  },
  {
    path: 'catalog',
    loadComponent: () => import('./pages/catalog/catalog').then((m) => m.CatalogComponent),
  },
  {
    path: 'catalog/:id',
    loadComponent: () => import('./pages/lot-detail/lot-detail').then((m) => m.LotDetailComponent),
  },
  {
    path: 'live',
    loadComponent: () => import('./pages/live-trading/live-trading').then((m) => m.LiveTradingComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/auth/register/register').then((m) => m.RegisterComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about').then((m) => m.AboutComponent),
  },
  {
    path: 'faq',
    loadComponent: () => import('./pages/faq/faq').then((m) => m.FaqComponent),
  },
  {
    path: 'contacts',
    loadComponent: () => import('./pages/contacts/contacts').then((m) => m.ContactsComponent),
  },
  {
    path: 'cabinet',
    loadComponent: () => import('./pages/cabinet/cabinet').then((m) => m.CabinetComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/cabinet/dashboard/dashboard').then((m) => m.DashboardComponent),
      },
      {
        path: 'bids',
        loadComponent: () => import('./pages/cabinet/my-bids/my-bids').then((m) => m.MyBidsComponent),
      },
      {
        path: 'orders',
        loadComponent: () => import('./pages/cabinet/orders/orders').then((m) => m.OrdersComponent),
      },
      {
        path: 'documents',
        loadComponent: () => import('./pages/cabinet/documents/documents').then((m) => m.DocumentsComponent),
      },
      {
        path: 'balance',
        loadComponent: () => import('./pages/cabinet/balance/balance').then((m) => m.BalanceComponent),
      },
      {
        path: 'watchlist',
        loadComponent: () => import('./pages/cabinet/watchlist/watchlist').then((m) => m.WatchlistComponent),
      },
      {
        path: 'notifications',
        loadComponent: () => import('./pages/cabinet/notifications/notifications').then((m) => m.NotificationsComponent),
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/cabinet/settings/settings').then((m) => m.SettingsComponent),
      },
    ],
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./pages/auth/callback/callback').then((m) => m.AuthCallbackComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
