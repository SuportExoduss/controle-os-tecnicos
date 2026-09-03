import { Spinner } from '../common/Spinner';
import { R, FS } from './tokens';

// Botão único do sistema — 4 pesos, 3 tamanhos, ícone e loading.
//   variant: 'primary' (ação principal, gradiente da área)
//            'secondary' (contorno neutro)
//            'danger' (destrutivo, vermelho)
//            'ghost' (sem borda; ações discretas)
//   tone: cor custom (sobrepõe o variant para casos semânticos pontuais)
//   size: 'sm' | 'md' | 'lg'   ·   icon/iconRight: componente lucide
// É um <button> real (acessível por teclado; foco visível via .ui-focus no index.css).
const PAD = { sm: '7px 12px', md: '10px 16px', lg: '13px 20px' };
const FSZ = { sm: FS.sm, md: FS.body, lg: FS.body };

export const Button = ({
  S, children, variant = 'primary', tone, size = 'md',
  icon: Icon, iconRight: IconRight, loading = false, disabled = false,
  fullWidth = false, type = 'button', style, ...rest
}) => {
  const off = disabled || loading;
  const c = tone || S.accent;

  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
    padding: PAD[size], borderRadius: R.md, fontSize: FSZ[size], fontWeight: 700,
    fontFamily: 'inherit', lineHeight: 1.1, whiteSpace: 'nowrap', cursor: off ? 'not-allowed' : 'pointer',
    minWidth: 0, // permite encolher em flex (evita transbordar o container)
    width: fullWidth ? '100%' : 'auto', opacity: off ? 0.55 : 1, transition: 'filter .15s, background .15s, border-color .15s',
    border: '1px solid transparent', boxSizing: 'border-box',
  };

  const skins = {
    primary:   { background: S.gradient, color: S.onAccent, boxShadow: `0 6px 18px ${S.glow}` },
    secondary: { background: 'transparent', color: S.text, border: `1px solid ${S.border}` },
    danger:    { background: 'transparent', color: S.red, border: `1px solid ${S.red}66` },
    ghost:     { background: 'transparent', color: S.muted2 },
    tone:      { background: c + '22', color: c, border: `1px solid ${c}66` },
  };
  const skin = tone ? skins.tone : skins[variant];

  const iconSz = size === 'sm' ? 14 : 16;
  return (
    <button
      type={type}
      className="ui-focus"
      disabled={off}
      style={{ ...base, ...skin, ...style }}
      onMouseEnter={(e) => { if (!off) e.currentTarget.style.filter = 'brightness(1.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
      {...rest}
    >
      {loading ? <Spinner /> : Icon ? <Icon size={iconSz} /> : null}
      {children}
      {!loading && IconRight ? <IconRight size={iconSz} /> : null}
    </button>
  );
};
