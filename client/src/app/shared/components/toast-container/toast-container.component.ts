import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';
import { AppToastComponent } from '../toast/toast.component';

@Component({
    selector: 'app-toast-container',
    standalone: true,
    imports: [CommonModule, AppToastComponent],
    templateUrl: './toast-container.component.html',
    styleUrl: './toast-container.component.scss',
})
export class AppToastContainerComponent {
    toastService = inject(ToastService);
}
