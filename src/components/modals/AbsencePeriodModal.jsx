import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Calendar, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Spinner } from '../common/Spinner';

// Popup de ausência POR PERÍODO (Férias / Atestado): técnico + 2 datas.
// A página passa onConfirm(name, start, end) que grava os relatórios do período,
// marca a Frota e espelha na planilha. Todos os dias do intervalo; dias com O.S
// são preservados (a lógica fica no serviço).
export const AbsencePeriodModal = ({ S, collaborators, motivo, accent, onClose, onConfirm }) => {
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const cor = accent || '#fbbf24';

  const canSave = name && start && end && start <= end && !saving;

  const handleSave = async () => {
    if (!name) { toast.error('Selecione o técnico'); return; }
    if (!start || !end) { toast.error('Selecione as duas datas'); return; }
    if (start > end) { toast.error('A data inicial não pode ser depois da final'); return; }
    setSaving(true);
    try {
      const res = await onConfirm(name, start, end);
      const n = res?.count;
      toast.success(`${motivo} registrada para ${name}${n != null ? ` (${n} dia${n !== 1 ? 's' : ''})` : ''}`);
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao registrar: ' + (err.message || 'tente novamente'));
    } finally { setSaving(false); }
  };

  const inp = { width: '100%', padding: '12px 14px', borderRadius: '10px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' };
  const lbl = { display: 'block', fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' };

  return (
    <>
      <div onClick={() => !saving && onClose?.()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 59 }} />
      <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
        style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '16px' }}>
        <div style={{ width: '100%', maxWidth: '420px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', padding: 'clamp(16px, 5vw, 28px)', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: cor + '22', border: `1px solid ${cor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={20} color={cor} />
              </div>
              <div>
                <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>{motivo} por período</div>
                <div style={{ color: S.muted, fontSize: '12px', marginTop: '2px' }}>Marca todos os dias do intervalo</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', padding: '4px' }}><X size={18} /></button>
          </div>

          {/* Técnico */}
          <label style={lbl}>Técnico</label>
          <select value={name} onChange={(e) => setName(e.target.value)} style={{ ...inp, cursor: 'pointer', marginBottom: '16px' }}>
            <option value="">— selecione —</option>
            {collaborators.map((c) => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
          </select>

          {/* Datas */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Início</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={inp}
                onClick={(e) => { try { e.target.showPicker(); } catch { /* */ } }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Fim</label>
              <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} style={inp}
                onClick={(e) => { try { e.target.showPicker(); } catch { /* */ } }} />
            </div>
          </div>

          {/* Aviso */}
          <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', background: cor + '14', border: `1px solid ${cor}40`, borderRadius: '10px', marginBottom: '20px', fontSize: '12.5px', color: S.muted2 }}>
            Todos os dias do intervalo viram <b style={{ color: cor }}>{motivo}</b>. Dias que já têm O.S são <b style={{ color: S.text }}>preservados</b>. Também marca <b style={{ color: S.text }}>ausente</b> na Frota.
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} disabled={saving}
              style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={handleSave} disabled={!canSave}
              style={{ flex: 1.5, padding: '12px', borderRadius: '10px', background: cor, border: 'none', color: '#1a1305', fontSize: '14px', fontWeight: 800, cursor: canSave ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: canSave ? 1 : 0.5 }}>
              {saving ? <Spinner /> : <><Check size={15} />Salvar {motivo}</>}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
};
