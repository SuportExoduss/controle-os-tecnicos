import { R, SP, SH } from './tokens';

// Card — superfície padrão (substitui os vários "Glass"/divs de card inline).
//   pad: padding interno (default LG) · hover: destaca no mouseover (para cards clicáveis)
//   accent: barra/realce de cor à esquerda (opcional)
export const Card = ({ S, children, pad = SP.lg, hover = false, accent, elevated = true, onClick, style, ...rest }) => (
  <div
    onClick={onClick}
    className={hover || onClick ? 'ui-card-hover' : undefined}
    style={{
      background: S.card, border: `1px solid ${S.border}`,
      borderLeft: accent ? `3px solid ${accent}` : `1px solid ${S.border}`,
      borderRadius: R.lg, padding: pad, boxShadow: elevated ? SH[1] : 'none',
      cursor: onClick ? 'pointer' : 'default', transition: 'transform .15s, border-color .15s, box-shadow .15s',
      ...style,
    }}
    {...rest}
  >
    {children}
  </div>
);

// SectionTitle — título pequeno e forte de bloco (padrão único de cabeçalho de card).
export const SectionTitle = ({ S, icon: Icon, children, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, marginBottom: SP.md }}>
    {Icon && <Icon size={15} color={S.accent} />}
    <span style={{ color: S.text, fontWeight: 700, fontSize: '13px' }}>{children}</span>
    {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
  </div>
);
