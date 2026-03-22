import { Component, inject, computed } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class AboutComponent {
  readonly ls = inject(LanguageService);

  readonly benefits = computed(() => [
    { icon: 'track_changes', title: this.ls.t('about.why.1.title'), desc: this.ls.t('about.why.1.desc') },
    { icon: 'visibility', title: this.ls.t('about.why.2.title'), desc: this.ls.t('about.why.2.desc') },
    { icon: 'local_shipping', title: this.ls.t('about.why.3.title'), desc: this.ls.t('about.why.3.desc') },
    { icon: 'verified_user', title: this.ls.t('about.why.4.title'), desc: this.ls.t('about.why.4.desc') },
  ]);

  readonly values = computed(() => [
    { icon: 'visibility', title: this.ls.t('about.values.1.title'), desc: this.ls.t('about.values.1.desc') },
    { icon: 'bolt', title: this.ls.t('about.values.2.title'), desc: this.ls.t('about.values.2.desc') },
    { icon: 'verified', title: this.ls.t('about.values.3.title'), desc: this.ls.t('about.values.3.desc') },
  ]);

  team = [
    { name: 'Александр Петров', role: 'CEO & Основатель', icon: 'person' },
    { name: 'Мария Соколова', role: 'Руководитель отдела продаж', icon: 'person' },
    { name: 'Дмитрий Громов', role: 'Технический директор', icon: 'person' },
  ];
}
