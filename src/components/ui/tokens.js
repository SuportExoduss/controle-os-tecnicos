// ─────────────────────────────────────────────────────────────────────────
// Design tokens — vocabulário ÚNICO de espaçamento, raio e sombra.
// Não substitui o tema de cor (esse vem do objeto `S` por área/tema em palette.js);
// aqui ficam só as constantes estruturais que antes eram digitadas à mão em
// cada componente. Import: `import { SP, R, SH, FS } from '../ui/tokens'`.
// ─────────────────────────────────────────────────────────────────────────

// Espaçamento (px) — escala fechada. Use estes em vez de números soltos.
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Raio de borda (px).
export const R = { sm: 8, md: 12, lg: 16, pill: 999 };

// Sombras — 3 níveis de elevação (funcionam em claro e escuro).
export const SH = {
  1: '0 1px 2px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.06)',
  2: '0 8px 24px rgba(0,0,0,0.12)',
  3: '0 24px 60px rgba(0,0,0,0.28)',
};

// Tamanhos de fonte de referência (px) — hierarquia previsível.
export const FS = { xs: 11, sm: 12, label: 13, body: 14, lg: 16, title: 18, kpi: 26 };
