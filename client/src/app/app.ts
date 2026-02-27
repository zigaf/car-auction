import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header';
import { FooterComponent } from './components/footer/footer';
import { AppToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { AuctionStateService } from './core/services/auction-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, AppToastContainerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor() {
    // Start the global real-time feed so every page gets live price updates.
    // AuctionStateService handles the auth check and WS connection internally.
    inject(AuctionStateService).init();
  }
}
