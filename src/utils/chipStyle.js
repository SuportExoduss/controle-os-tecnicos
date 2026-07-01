// Adapta o estilo de um chip categórico ({ bg, color, border, ... }) ao tema.
//
// As tabelas de cor (SVC_STYLE, ASSUNTO_COLOR, ASSUNTO_BADGE, SLA_BADGE…) foram
// feitas para o tema ESCURO: texto numa cor clara (`color` = hue) sobre fundo
// escuro. No tema CLARO isso fica ilegível. Aqui, no claro, derivamos tudo da
// cor-base (hue): fundo bem clarinho (hue translúcido), texto escurecido e
// borda colorida nítida. Outras props do objeto (ex.: `label`) são preservadas.

const darken = (hex, amt) => {
  if (typeof hex !== 'string' || hex[0] !== '#' || hex.length < 7) return hex;
  const n = parseInt(hex.slice(1, 7), 16);
  if (Number.isNaN(n)) return hex;
  const r = Math.round(((n >> 16) & 255) * (1 - amt));
  const g = Math.round(((n >> 8) & 255) * (1 - amt));
  const b = Math.round((n & 255) * (1 - amt));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

export const chipStyle = (entry, mode) => {
  const e = entry || { bg: '#111111', color: '#64748b', border: '#334155' };
  if (mode !== 'light') return e; // escuro = como está nas tabelas
  const hue = (typeof e.color === 'string' && e.color[0] === '#') ? e.color : '#64748b';
  return { ...e, bg: hue + '1f', color: darken(hue, 0.5), border: hue };
};
