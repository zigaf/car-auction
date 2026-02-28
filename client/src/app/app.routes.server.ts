import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'about',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'faq',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'contacts',
    renderMode: RenderMode.Prerender,
  },
  // Real-time and auth-gated routes — render only in the browser
  {
    path: 'live',
    renderMode: RenderMode.Client,
  },
  {
    path: 'cabinet',
    renderMode: RenderMode.Client,
  },
  {
    path: 'cabinet/**',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
