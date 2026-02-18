import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-my-bids',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './my-bids.html',
  styleUrl: './my-bids.scss',
})
export class MyBidsComponent {
  activeTab: 'active' | 'won' | 'lost' = 'active';

  activeBids = [
    { id: 1, brand: 'BMW', model: '5 Series', year: 2021, myBid: 18500, currentBid: 18500, status: 'leading', endTime: '1:45:22' },
    { id: 3, brand: 'Audi', model: 'A6', year: 2022, myBid: 25000, currentBid: 26500, status: 'outbid', endTime: '0:28:15' },
    { id: 7, brand: 'Volvo', model: 'XC60', year: 2021, myBid: 24300, currentBid: 24300, status: 'leading', endTime: '1:30:00' },
  ];

  wonBids = [
    { id: 5, brand: 'Porsche', model: 'Cayenne', year: 2020, finalPrice: 42000, paymentStatus: 'Ожидание оплаты' },
  ];

  lostBids = [
    { id: 2, brand: 'Mercedes', model: 'E-Class', year: 2020, myBid: 21000, finalPrice: 23500 },
  ];
}
