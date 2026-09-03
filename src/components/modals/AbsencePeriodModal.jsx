import { useState } from 'react';
import { Calendar, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Modal, Button, FieldLabel, Select, TextInput } from '../ui';

// Popup de ausência POR PERÍODO (Férias / Atestado): técnico + 2 datas.
// A página passa onConfirm(name, start, end) que grava os relatórios do período,
// marca a Frota e espelha na planilha. Todos os dias do intervalo; dias com O.S
// são preservados (a lógica fica no serviço). Usa o Modal do design system.
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

  const openPicker = (e) => { try { e.target.showPicker(); } catch { /* */ } };

  return (
    <Modal
      S={S} icon={Calendar} accent={cor} width={420}
      title={`${motivo} por período`} subtitle="Marca todos os dias do intervalo"
      onClose={() => { if (!saving) onClose?.(); }}
      footer={<>
        <Button S={S} variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button S={S} icon={Check} onClick={handleSave} disabled={!canSave} loading={saving}
          style={{ background: cor, color: '#1a1305', border: 'none', boxShadow: `0 6px 18px ${cor}55` }}>
          Salvar {motivo}
        </Button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <FieldLabel S={S}>Técnico</FieldLabel>
          <Select S={S} value={name} onChange={(e) => setName(e.target.value)}>
            <option value="">— selecione —</option>
            {collaborators.map((c) => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
          </Select>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <FieldLabel S={S}>Início</FieldLabel>
            <TextInput S={S} type="date" value={start} onChange={(e) => setStart(e.target.value)} onClick={openPicker} style={{ cursor: 'pointer' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <FieldLabel S={S}>Fim</FieldLabel>
            <TextInput S={S} type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} onClick={openPicker} style={{ cursor: 'pointer' }} />
          </div>
        </div>

        <div style={{ padding: '11px 13px', background: cor + '14', border: `1px solid ${cor}40`, borderRadius: '10px', fontSize: '12.5px', lineHeight: 1.55, color: S.muted2 }}>
          Marca <b style={{ color: cor }}>{motivo.toLowerCase()}</b> em todos os dias do intervalo. Os dias que já têm O.S são <b style={{ color: S.text }}>preservados</b>, e o período fica como <b style={{ color: S.text }}>ausente</b> na Frota.
        </div>
      </div>
    </Modal>
  );
};
