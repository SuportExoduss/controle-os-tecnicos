import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { R, SP, SH, FS } from './tokens';

// Modal — casca única (overlay + painel centralizado + cabeçalho + fechar).
//   Fecha por Esc e por clique fora. Conteúdo alto rola INTERNAMENTE (nunca
//   estoura a tela). Título/ícone anunciam o contexto (acessibilidade).
//   width: largura máxima (default 460). Ações vão no `footer`.
export const Modal = ({
  S, title, subtitle, icon: Icon, onClose, children, footer,
  width = 460, closeOnBackdrop = true, zIndex = 60,
}) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div
        onClick={() => closeOnBackdrop && onClose?.()}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', zIndex: zIndex - 1 }}
      />
      <motion.div
        role="dialog" aria-modal="true" aria-label={title || 'Janela'}
        initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }}
        style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex, padding: SP.lg }}
      >
        <div style={{
          width: '100%', maxWidth: width, maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          background: S.surface, border: `1px solid ${S.border}`, borderRadius: R.lg, boxShadow: SH[3], overflow: 'hidden',
        }}>
          {/* Cabeçalho */}
          <div style={{ display: 'flex', alignItems: 'center', gap: SP.md, padding: `${SP.lg}px ${SP.xl}px`, borderBottom: `1px solid ${S.border}`, flexShrink: 0 }}>
            {Icon && (
              <div style={{ width: 40, height: 40, borderRadius: R.md, background: S.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={20} color={S.accent} />
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              {title && <div style={{ color: S.text, fontWeight: 800, fontSize: FS.lg }}>{title}</div>}
              {subtitle && <div style={{ color: S.muted, fontSize: FS.sm, marginTop: 2 }}>{subtitle}</div>}
            </div>
            <button type="button" className="ui-focus" onClick={onClose} aria-label="Fechar"
              style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', padding: 6, borderRadius: R.sm, display: 'flex', flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>

          {/* Conteúdo — rola internamente */}
          <div style={{ padding: `${SP.lg}px ${SP.xl}px`, overflowY: 'auto', flex: 1 }}>{children}</div>

          {/* Rodapé de ações (opcional) */}
          {footer && (
            <div style={{ display: 'flex', gap: SP.md, justifyContent: 'flex-end', padding: `${SP.md}px ${SP.xl}px`, borderTop: `1px solid ${S.border}`, flexShrink: 0 }}>
              {footer}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};
