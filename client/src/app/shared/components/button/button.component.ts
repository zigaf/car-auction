import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
    selector: 'app-button',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './button.component.html',
    styleUrl: './button.component.scss',
})
export class AppButtonComponent {
    @Input() variant: ButtonVariant = 'primary';
    @Input() size: ButtonSize = 'md';
    @Input() disabled: boolean = false;
    @Input() loading: boolean = false;
    @Input() icon: string = '';
    @Input() type: 'button' | 'submit' | 'reset' = 'button';
    @Input() fullWidth: boolean = false;

    @Output() clicked = new EventEmitter<Event>();

    get classes(): string {
        return [
            'app-btn',
            `app-btn--${this.variant}`,
            `app-btn--${this.size}`,
            this.fullWidth ? 'app-btn--full-width' : '',
            this.loading ? 'app-btn--loading' : '',
        ].filter(Boolean).join(' ');
    }

    onClick(event: Event): void {
        if (!this.disabled && !this.loading) {
            this.clicked.emit(event);
        }
    }
}
