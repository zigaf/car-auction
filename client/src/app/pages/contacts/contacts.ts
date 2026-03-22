import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-contacts',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './contacts.html',
  styleUrl: './contacts.scss',
})
export class ContactsComponent {
  readonly ls = inject(LanguageService);

  name = '';
  email = '';
  message = '';
}
