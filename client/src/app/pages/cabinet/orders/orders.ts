import { Component } from '@angular/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './orders.html',
  styleUrl: './orders.scss',
})
export class OrdersComponent {
  orders = [
    {
      id: 'ORD-001',
      brand: 'Porsche',
      model: 'Cayenne',
      year: 2020,
      total: 47200,
      currentStatus: 3,
      statuses: [
        { label: 'Ожидание', done: true },
        { label: 'Утверждён', done: true },
        { label: 'Оплачен', done: true },
        { label: 'На СВХ', done: false },
        { label: 'Растаможка', done: false },
        { label: 'Доставка', done: false },
        { label: 'Завершён', done: false },
      ],
    },
  ];
}
