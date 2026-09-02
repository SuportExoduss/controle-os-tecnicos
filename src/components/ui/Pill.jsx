import { R, FS } from './tokens';

// StatusPill — chip de estado, SÓ leitura (Feito / Ausente / Passageiro / SLA…).
// Reconhecimento por cor + TEXTO (nunca só cor, por acessibilidade).
//   tone: cor semântica · icon: lucide opcional · size 'sm' (tabela) | 'md' (card)
export const StatusPill = ({ tone = '#94a3b8', children, icon: Icon, size = 'sm', style }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    fontSize: size === 'sm' ? FS.xs : FS.sm, fontWeight: 700, lineHeight: 1.2,
    padding: size === 'sm' ? '2px 8px' : '3px 10px', borderRadius: R.pill,
    background: tone + '22', color: tone, border: `1px solid ${tone}55`, whiteSpace: 'nowrap', ...style,
  }}>
    {Icon && <Icon size={size === 'sm' ? 11 : 13} />}{children}
  </span>
);

// PillButton — atalho colorido clicável (ex.: Folga/Feriado/Atestado/Passageiro).
// `active` liga o preenchimento/glow; `tone` é a cor semântica do atalho.
export const PillButton = ({
  tone = '#3b82f6', active = true, children, icon: Icon,
  disabled = false, onClick, title, S, style, ...rest
}) => {
  const on = active && !disabled;
  return (
    <button
      type="button" className="ui-focus" onClick={onClick} disabled={disabled} title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px',
        borderRadius: R.sm + 1, fontSize: FS.sm, fontWeight: 700, whiteSpace: 'nowrap',
        cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all .2s', fontFamily: 'inherit',
        border: `1px solid ${on ? tone : (S ? S.border : '#33415577')}`,
        background: on ? tone + '26' : 'transparent',
        color: on ? tone : (S ? S.muted : '#94a3b8'),
        boxShadow: on ? `0 0 14px ${tone}59` : 'none',
        opacity: disabled ? 0.55 : 1, ...style,
      }}
      {...rest}
    >
      {Icon && <Icon size={14} />}{children}
    </button>
  );
};
