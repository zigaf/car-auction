import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cookies',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cookies.html',
  styleUrl: './cookies.scss',
})
export class CookiesComponent {}
