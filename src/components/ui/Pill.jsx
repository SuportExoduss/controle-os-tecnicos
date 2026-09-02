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
}) => (
  <button
    type="button" className="ui-focus" onClick={onClick} disabled={disabled} title={title}
    aria-label={typeof children === 'string' ? children : undefined}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px',
      borderRadius: R.sm + 1, fontSize: FS.sm, fontWeight: 700, whiteSpace: 'nowrap',
      cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all .2s', fontFamily: 'inherit',
      // cor = estado "ativo" (ex.: técnico selecionado); opacidade dim quando inativo.
      border: `1px solid ${active ? tone : (S ? S.border : '#33415577')}`,
      background: active ? tone + '26' : 'transparent',
      color: active ? tone : (S ? S.muted : '#94a3b8'),
      boxShadow: active ? `0 0 14px ${tone}59` : 'none',
      opacity: active ? 1 : 0.6, ...style,
    }}
    {...rest}
  >
    {Icon && <Icon size={14} />}{children}
  </button>
);
