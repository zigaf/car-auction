import { Component } from '@angular/core';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [],
  templateUrl: './documents.html',
  styleUrl: './documents.scss',
})
export class DocumentsComponent {
  documents = [
    { id: 1, name: 'passport_nalyvaiko.pdf', type: 'passport', typeLabel: 'Паспорт', status: 'approved', statusLabel: 'Подтверждён', date: '2025-05-10', uploadedBy: 'Максим Н.' },
    { id: 2, name: 'invoice_porsche_cayenne.pdf', type: 'invoice', typeLabel: 'Инвойс', status: 'pending', statusLabel: 'На проверке', date: '2025-05-16', uploadedBy: 'Менеджер' },
    { id: 3, name: 'customs_declaration_112.pdf', type: 'customs', typeLabel: 'Таможня', status: 'pending', statusLabel: 'На проверке', date: '2025-05-17', uploadedBy: 'Менеджер' },
    { id: 4, name: 'driver_license_expired.jpg', type: 'passport', typeLabel: 'Вод. удост.', status: 'rejected', statusLabel: 'Отклонён', date: '2025-05-08', uploadedBy: 'Максим Н.' },
  ];

  getStatusClass(status: string): string {
    switch (status) {
      case 'approved': return 'doc-status--approved';
      case 'pending': return 'doc-status--pending';
      case 'rejected': return 'doc-status--rejected';
      default: return '';
    }
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case 'passport': return 'badge';
      case 'invoice': return 'receipt';
      case 'customs': return 'assured_workload';
      default: return 'description';
    }
  }
}
