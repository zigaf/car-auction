import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral';

@Component({
    selector: 'app-status-badge',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './status-badge.component.html',
    styleUrl: './status-badge.component.scss',
})
export class AppStatusBadgeComponent {
    @Input() status: StatusType = 'neutral';
    @Input() label: string = '';
}
