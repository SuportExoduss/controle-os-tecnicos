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

// Neutros de texto + "sucesso suave" (Sair/confirmações) — adaptam por tema.
const txtDark  = { text: '#f1f5f9', muted: '#475569', muted2: '#94a3b8', okBg: '#0d2d1f', okBorder: '#065f46', warnBg: '#1c1200', warnBorder: '#78350f' };
const txtLight = { text: '#1a2236', muted: '#8a93a8', muted2: '#5b6478', okBg: '#dcfce7', okBorder: '#86efac', warnBg: '#fef3c7', warnBorder: '#fcd34d' };

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
      bg: '#eef3fb', card: '#ffffff', card2: '#f4f8fd', border: '#dbe5f2',
      surface: '#ffffff', input: '#f5f8fd', input2: '#ffffff', headerBg: '#ffffff',
      blue: '#1763e8', green: '#059669', orange: '#d97706', purple: '#7c3aed', red: '#dc2626',
      accent: '#1763e8', accentDeep: '#0b47b8', accentSoft: '#e4edff',
      gradient: 'linear-gradient(135deg, #1763e8, #2e8bff)',
      glow: 'rgba(23,99,232,0.16)', onAccent: '#ffffff',
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
      bg: '#fbf6ec', card: '#ffffff', card2: '#fcf8f0', border: '#ece1cd',
      surface: '#ffffff', input: '#fbf7ee', input2: '#ffffff', headerBg: '#ffffff',
      blue: '#c77a00', green: '#059669', orange: '#ea7c2a', purple: '#7c3aed', red: '#dc2626',
      accent: '#c77a00', accentDeep: '#9a5e00', accentSoft: '#fdeed0',
      gradient: 'linear-gradient(135deg, #c77a00, #e89a1a)',
      glow: 'rgba(199,122,0,0.15)', onAccent: '#ffffff',
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
      bg: '#eef8f3', card: '#ffffff', card2: '#f2faf6', border: '#cfe8db',
      surface: '#ffffff', input: '#f1f9f5', input2: '#ffffff', headerBg: '#ffffff',
      blue: '#0e9e66', green: '#059669', orange: '#d97706', purple: '#7c3aed', red: '#dc2626',
      accent: '#0e9e66', accentDeep: '#0a7a4e', accentSoft: '#d6f3e6',
      gradient: 'linear-gradient(135deg, #0e9e66, #16c77e)',
      glow: 'rgba(14,158,102,0.15)', onAccent: '#ffffff', rec: '#dc2626',
    },
  },

  // ── FROTA — Azul Tiffany (cyan-turquesa; checklist dos veículos) ───────
  frota: {
    key: 'frota', name: 'Frota',
    dark: {
      ...txtDark,
      bg: '#08161a', card: '#0d2125', card2: '#112b30', border: '#1a4146',
      surface: '#0a1c20', input: '#08161a', input2: '#0e2327', headerBg: '#0d2125',
      blue: '#5fe3da', green: '#34d399', orange: '#fbbf24', purple: '#a78bfa', red: '#f87171',
      accent: '#1cc5bd', accentDeep: '#0a9690', accentSoft: '#07221f',
      gradient: 'linear-gradient(135deg, #0a9690, #1cc5bd)',
      glow: 'rgba(28,197,189,0.30)', onAccent: '#042220',
    },
    light: {
      ...txtLight,
      text: '#13302e', muted2: '#4f7370',
      bg: '#eaf7f5', card: '#ffffff', card2: '#f0faf8', border: '#cce8e4',
      surface: '#ffffff', input: '#eef8f6', input2: '#ffffff', headerBg: '#ffffff',
      blue: '#0a9690', green: '#059669', orange: '#d97706', purple: '#7c3aed', red: '#dc2626',
      accent: '#0a9690', accentDeep: '#07736e', accentSoft: '#d2efec',
      gradient: 'linear-gradient(135deg, #0a9690, #14b3ab)',
      glow: 'rgba(10,150,144,0.15)', onAccent: '#ffffff',
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
