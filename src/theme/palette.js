// ─────────────────────────────────────────────────────────────────────────
// Paletas de marca — 3 identidades extraídas do site oficial IbiúNET
// (azul do hero "1000 mega", âmbar do card Wi-biNET, verde dos checks).
//
// Estrutura IDÊNTICA nas 3 áreas (mesma empresa) — o que muda é a cor:
//   • Fibra   → Azul   (velocidade / confiança)
//   • Redes   → Âmbar  (sinal / cobertura)
//   • Câmeras → Verde  (monitoramento / ao vivo)
//
// Cada área tem tema escuro e claro. Os neutros (bg/card/border…) recebem
// um tinte sutil do hue da área, mantendo coesão visual entre os painéis.
//
// Tokens novos (além dos originais):
//   accent      → cor primária forte (botões/realces)
//   accentDeep  → tom mais escuro do accent (gradiente/hover)
//   accentSoft  → tinta suave p/ fundos de chip/badge
//   gradient    → gradiente pronto p/ botões/ícones
//   glow        → sombra colorida (rgba)
//   onAccent    → cor do texto SOBRE o accent (âmbar exige texto escuro!)
//   rec         → vermelho "gravando" (só câmeras; herdado do Wi-biFIX)
//
// `blue` é mantido como token primário por compatibilidade: em cada área ele
// resolve para a cor da própria área, então telas que usam S.blue como
// destaque já ficam na identidade certa automaticamente.
// ─────────────────────────────────────────────────────────────────────────

// Neutros de texto compartilhados (não mudam por área)
const txtDark  = { text: '#f1f5f9', muted: '#475569', muted2: '#94a3b8' };
const txtLight = { text: '#1a2236', muted: '#8a93a8', muted2: '#5b6478' };

export const BRANDS = {
  // ── FIBRA — Azul (base navy original) ──────────────────────────────────
  fibra: {
    key: 'fibra', name: 'Fibra',
    dark: {
      ...txtDark,
      bg: '#080b14', card: '#0d1220', card2: '#111827', border: '#1a2540',
      surface: '#0a0f1e', input: '#080b14', input2: '#0d1525', headerBg: '#0d1220',
      blue: '#60a5fa', green: '#34d399', orange: '#fbbf24', purple: '#a78bfa', red: '#f87171',
      accent: '#2e8bff', accentDeep: '#1763e8', accentSoft: '#11243f',
      gradient: 'linear-gradient(135deg, #1763e8, #2e8bff)',
      glow: 'rgba(46,139,255,0.35)', onAccent: '#ffffff',
    },
    light: {
      ...txtLight,
      bg: '#dfe3ec', card: '#eceef4', card2: '#e4e7f0', border: '#c3c9d8',
      surface: '#f1f3f8', input: '#e6e9f1', input2: '#e9ecf4', headerBg: '#e8ebf2',
      blue: '#1763e8', green: '#059669', orange: '#d97706', purple: '#7c3aed', red: '#dc2626',
      accent: '#1763e8', accentDeep: '#0b47b8', accentSoft: '#dce9ff',
      gradient: 'linear-gradient(135deg, #1763e8, #2e8bff)',
      glow: 'rgba(23,99,232,0.22)', onAccent: '#ffffff',
    },
  },

  // ── REDES — Âmbar (card Wi-biNET) ──────────────────────────────────────
  redes: {
    key: 'redes', name: 'Redes',
    dark: {
      ...txtDark,
      bg: '#0f0d09', card: '#17130b', card2: '#1d1810', border: '#2e2614',
      surface: '#120f0a', input: '#0f0d09', input2: '#191409', headerBg: '#17130b',
      blue: '#fbbf24', green: '#34d399', orange: '#fb923c', purple: '#a78bfa', red: '#f87171',
      accent: '#ffb31f', accentDeep: '#e08a00', accentSoft: '#2a2008',
      gradient: 'linear-gradient(135deg, #e08a00, #ffb31f)',
      glow: 'rgba(255,179,31,0.30)', onAccent: '#1a1305',
    },
    light: {
      ...txtLight,
      text: '#2a2310', muted2: '#6b5f45',
      bg: '#f3ece0', card: '#f6f1e6', card2: '#efe9da', border: '#ddd0b8',
      surface: '#faf6ec', input: '#f0eadd', input2: '#f3eee0', headerBg: '#f2ecdd',
      blue: '#c77a00', green: '#059669', orange: '#ea7c2a', purple: '#7c3aed', red: '#dc2626',
      accent: '#c77a00', accentDeep: '#9a5e00', accentSoft: '#ffedc9',
      gradient: 'linear-gradient(135deg, #c77a00, #e89a1a)',
      glow: 'rgba(199,122,0,0.20)', onAccent: '#ffffff',
    },
  },

  // ── CÂMERAS (WIBICAM) — Verde (checks/“Contratar Plano”) ───────────────
  cameras: {
    key: 'cameras', name: 'WIBICAM',
    dark: {
      ...txtDark,
      bg: '#07120e', card: '#0b1a14', card2: '#0f211a', border: '#163a2c',
      surface: '#091711', input: '#07120e', input2: '#0d1d16', headerBg: '#0b1a14',
      blue: '#34d399', green: '#4ade80', orange: '#fbbf24', purple: '#a78bfa', red: '#f87171',
      accent: '#16d08a', accentDeep: '#0e9e66', accentSoft: '#07261d',
      gradient: 'linear-gradient(135deg, #0e9e66, #16d08a)',
      glow: 'rgba(22,208,138,0.30)', onAccent: '#042017', rec: '#ee3b36',
    },
    light: {
      ...txtLight,
      text: '#10241c', muted2: '#456b5b',
      bg: '#e1ece7', card: '#e8f1ec', card2: '#e0ebe5', border: '#bcd6c9',
      surface: '#eef5f1', input: '#e4efe9', input2: '#e8f1ec', headerBg: '#e6f0ea',
      blue: '#0e9e66', green: '#059669', orange: '#d97706', purple: '#7c3aed', red: '#dc2626',
      accent: '#0e9e66', accentDeep: '#0a7a4e', accentSoft: '#d5f5e6',
      gradient: 'linear-gradient(135deg, #0e9e66, #16c77e)',
      glow: 'rgba(14,158,102,0.20)', onAccent: '#ffffff', rec: '#dc2626',
    },
  },
};

// Compatibilidade: DARK/LIGHT antigos = identidade Fibra
export const DARK = BRANDS.fibra.dark;
export const LIGHT = BRANDS.fibra.light;

// Resolve a paleta por tema + área (default: fibra)
export const getPalette = (mode, brand = 'fibra') => {
  const b = BRANDS[brand] || BRANDS.fibra;
  return mode === 'light' ? b.light : b.dark;
};

// Metadados da área (nome/chave) p/ títulos e navegação
export const getBrandMeta = (brand) => {
  const b = BRANDS[brand] || BRANDS.fibra;
  return { key: b.key, name: b.name };
};
