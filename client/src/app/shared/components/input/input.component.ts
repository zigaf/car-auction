import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

@Component({
    selector: 'app-input',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './input.component.html',
    styleUrl: './input.component.scss',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => AppInputComponent),
            multi: true,
        }
    ]
})
export class AppInputComponent implements ControlValueAccessor {
    @Input() label: string = '';
    @Input() placeholder: string = '';
    @Input() type: 'text' | 'email' | 'password' | 'number' = 'text';
    @Input() icon: string = '';
    @Input() errorMessage: string = '';
    @Input() required: boolean = false;

    value: any = '';
    isDisabled: boolean = false;
    showPasswordToggle: boolean = false;
    isPasswordVisible: boolean = false;

    onChange: any = () => { };
    onTouch: any = () => { };

    ngOnInit() {
        if (this.type === 'password') {
            this.showPasswordToggle = true;
        }
    }

    get actualType(): string {
        if (this.type === 'password') {
            return this.isPasswordVisible ? 'text' : 'password';
        }
        return this.type;
    }

    togglePasswordVisibility() {
        this.isPasswordVisible = !this.isPasswordVisible;
    }

    writeValue(value: any): void {
        this.value = value;
    }

    registerOnChange(fn: any): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: any): void {
        this.onTouch = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.isDisabled = isDisabled;
    }

    onInput(event: Event) {
        const val = (event.target as HTMLInputElement).value;
        this.value = val;
        this.onChange(val);
        this.onTouch();
    }
}
