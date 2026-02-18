import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class AboutComponent {
  stats = [
    { value: '2,500+', label: 'Автомобилей продано' },
    { value: '15,000+', label: 'Зарегистрированных клиентов' },
    { value: '6', label: 'Стран присутствия' },
    { value: '98%', label: 'Довольных клиентов' },
  ];

  team = [
    { name: 'Александр Петров', role: 'CEO & Основатель', icon: 'person' },
    { name: 'Мария Коваленко', role: 'Руководитель отдела продаж', icon: 'person' },
    { name: 'Дмитрий Шевченко', role: 'Технический директор', icon: 'person' },
  ];
}
