import { R, SP } from './tokens';
import { Button } from './Button';

// EmptyState — "não há dados" NÃO é erro. Explica o porquê e o próximo passo.
//   Diferencie "sem registros no período" de "filtro sem resultado" pelo texto.
export const EmptyState = ({ S, icon: Icon, title, description, actionLabel, onAction }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', gap: SP.md, padding: `${SP.xxl}px ${SP.lg}px`,
    background: S.card, border: `1px dashed ${S.border}`, borderRadius: R.lg,
  }}>
    {Icon && (
      <div style={{ width: 48, height: 48, borderRadius: R.md, background: S.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={24} color={S.accent} />
      </div>
    )}
    <div style={{ color: S.text, fontWeight: 700, fontSize: '15px' }}>{title}</div>
    {description && <div style={{ color: S.muted2, fontSize: '13px', maxWidth: 340, lineHeight: 1.5 }}>{description}</div>}
    {actionLabel && onAction && (
      <div style={{ marginTop: SP.xs }}>
        <Button S={S} variant="secondary" size="sm" onClick={onAction}>{actionLabel}</Button>
      </div>
    )}
  </div>
);

// ErrorState — "o sistema falhou". Separado de vazio. Oferece recuperação.
export const ErrorState = ({ S, icon: Icon, title = 'Algo deu errado', message, onRetry, retryLabel = 'Tentar novamente' }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', gap: SP.md, padding: `${SP.xxl}px ${SP.lg}px`,
    background: S.warnBg, border: `1px solid ${S.warnBorder}`, borderRadius: R.lg,
  }}>
    {Icon && (
      <div style={{ width: 48, height: 48, borderRadius: R.md, background: S.red + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={24} color={S.red} />
      </div>
    )}
    <div style={{ color: S.text, fontWeight: 700, fontSize: '15px' }}>{title}</div>
    {message && <div style={{ color: S.muted2, fontSize: '13px', maxWidth: 360, lineHeight: 1.5 }}>{message}</div>}
    {onRetry && (
      <div style={{ marginTop: SP.xs }}>
        <Button S={S} variant="secondary" size="sm" tone={S.red} onClick={onRetry}>{retryLabel}</Button>
      </div>
    )}
  </div>
);
