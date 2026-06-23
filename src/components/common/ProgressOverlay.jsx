import { useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeContext } from '../../context/ThemeContext';
import { Loader2 } from 'lucide-react';

/**
 * Overlay bloqueante de progresso. Trava o uso do site (pointer-events) até a
 * operação terminar. Suporta dois modos:
 *  - determinado:   passe `progress` (0–100) → mostra a porcentagem real.
 *  - indeterminado: `progress` null/undefined → spinner "Processando…".
 */
export const ProgressOverlay = ({ open, progress = null, title = 'Processando…', subtitle = '' }) => {
  const { S } = useContext(ThemeContext);
  const determinate = typeof progress === 'number';
  const pct = determinate ? Math.max(0, Math.min(100, Math.round(progress))) : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)', padding: '16px' }}>
          <motion.div
            initial={{ scale: 0.9, y: 16, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            style={{ width: '100%', maxWidth: '380px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', padding: '32px 28px', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', textAlign: 'center' }}>

            <div style={{ width: '56px', height: '56px', margin: '0 auto 18px', borderRadius: '16px', background: S.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 28px ${S.glow}` }}>
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'flex' }}>
                <Loader2 size={28} color={S.onAccent} strokeWidth={2.5} />
              </motion.div>
            </div>

            <div style={{ color: S.text, fontWeight: 800, fontSize: '17px' }}>{title}</div>
            {subtitle && <div style={{ color: S.muted, fontSize: '13px', marginTop: '4px' }}>{subtitle}</div>}

            {/* Barra de progresso */}
            <div style={{ marginTop: '20px', height: '10px', borderRadius: '999px', background: S.input, overflow: 'hidden', position: 'relative' }}>
              {determinate ? (
                <motion.div animate={{ width: `${pct}%` }} transition={{ ease: 'easeOut', duration: 0.25 }}
                  style={{ height: '100%', borderRadius: '999px', background: S.gradient }} />
              ) : (
                <motion.div animate={{ x: ['-40%', '140%'] }} transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
                  style={{ position: 'absolute', top: 0, height: '100%', width: '40%', borderRadius: '999px', background: S.gradient }} />
              )}
            </div>

            {determinate && (
              <div style={{ marginTop: '12px', color: S.blue, fontWeight: 800, fontSize: '22px' }}>{pct}%</div>
            )}

            <div style={{ marginTop: determinate ? '4px' : '14px', color: S.muted, fontSize: '12px' }}>
              Não feche nem recarregue a página até concluir.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
