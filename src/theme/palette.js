// Paletas de tema — escuro (padrão) e claro (suave, sem branco puro)
export const DARK = {
  bg:'#080b14', card:'#0d1220', card2:'#111827', border:'#1a2540',
  surface:'#0a0f1e', input:'#080b14', input2:'#0d1525',
  text:'#f1f5f9', muted:'#475569', muted2:'#94a3b8',
  blue:'#60a5fa', green:'#34d399', orange:'#fbbf24', purple:'#a78bfa', red:'#f87171',
  headerBg:'#0d1220',
};

// Claro mas suave (tons de cinza-azulado, evita branco puro p/ não cansar a vista)
export const LIGHT = {
  bg:'#dfe3ec', card:'#eceef4', card2:'#e4e7f0', border:'#c3c9d8',
  surface:'#f1f3f8', input:'#e6e9f1', input2:'#e9ecf4',
  text:'#1a2236', muted:'#8a93a8', muted2:'#5b6478',
  blue:'#2563eb', green:'#059669', orange:'#d97706', purple:'#7c3aed', red:'#dc2626',
  headerBg:'#e8ebf2',
};

export const getPalette = (mode) => (mode === 'light' ? LIGHT : DARK);
