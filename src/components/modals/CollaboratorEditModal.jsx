import { useState } from 'react';
import { Edit2, ArrowRight, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatName } from '../../utils/formatName';
import { transferTechnicianSector, renameTechnicianCanonical, SECTOR_LABEL } from '../../services/database/technicianService';
import { Modal, Button, FieldLabel, TextInput } from '../ui';

// Modal compartilhado de edição de colaborador: renomeia (via renameFn da área)
// e/ou TRANSFERE de setor (lógica única). Usado por Fibra, Redes e Câmeras.
//   renameFn(oldName, newName): faz a renomeação específica da área (doc do
//     colaborador + relatórios + planilha). Só é chamada se o nome mudar.
//   currentSector: 'fibra' | 'redes' | 'cameras'
//   onDone(): recarrega a lista da página; onClose(): fecha.
// Usa o Modal do design system (backdrop próprio, Esc, scroll).
const SECTOR_DOT = { fibra: '#2e8bff', redes: '#ffb31f', cameras: '#16d08a' };
const SECTORS = ['fibra', 'redes', 'cameras'];

// Times da escala (só aparece quando `escala` é passado — Equipe de Redes).
const ESC_TEAMS = [
  { key: 'azul',     label: 'Azul',     color: '#3b82f6' },
  { key: 'vermelho', label: 'Vermelho', color: '#ef4444' },
  { key: 'amarelo',  label: 'Amarelo',  color: '#eab308' },
];

export const CollaboratorEditModal = ({ S, collab, currentSector, renameFn, onClose, onDone, escala, onEscalaSave }) => {
  const [name, setName] = useState(collab?.name || '');
  const [sector, setSector] = useState(currentSector);
  const [saving, setSaving] = useState(false);

  // Campos de escala (Redes). undefined quando a prop não é passada.
  const hasEscala = !!escala;
  const [team, setTeam] = useState(escala?.team || '');
  const [motorista, setMotorista] = useState(escala?.motorista !== undefined ? !!escala.motorista : true);
  const [passageiro, setPassageiro] = useState(!!escala?.passageiro);

  const oldName = collab?.name || '';
  const newName = formatName(name);
  const nameChanged = newName && newName !== oldName;
  const sectorChanged = sector !== currentSector;
  const escalaChanged = hasEscala && (
    (team || '') !== (escala?.team || '') ||
    motorista !== (escala?.motorista !== undefined ? !!escala.motorista : true) ||
    passageiro !== !!escala?.passageiro
  );
  const canSave = !!newName && (nameChanged || sectorChanged || escalaChanged) && !saving;

  const handleSave = async () => {
    if (!newName) { toast.error('Informe o nome'); return; }
    setSaving(true);
    try {
      // 1. renomeia primeiro (se mudou): área (colab+relatórios+planilha) + cadastro único/Frota
      if (nameChanged) {
        await renameFn(oldName, newName);
        await renameTechnicianCanonical(oldName, newName);
      }
      // 2. transfere de setor (se mudou) — move a partir do nome canônico atual
      if (sectorChanged) {
        await transferTechnicianSector({ fullName: newName, fromSector: currentSector, toSector: sector });
      }
      // 3. escala (Redes): time + motorista/passageiro
      if (hasEscala && escalaChanged) {
        await onEscalaSave?.({ team, motorista, passageiro });
      }
      if (sectorChanged) toast.success(`${newName} movido para ${SECTOR_LABEL[sector]}`);
      else toast.success(`Salvo: "${newName}"`);
      onDone?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar: ' + (err.message || 'tente novamente'));
    } finally { setSaving(false); }
  };

  const lbl = { display: 'block', fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' };

  return (
    <Modal
      S={S} icon={Edit2} title="Editar Colaborador" subtitle="Renomeia e/ou transfere de setor" width={420}
      onClose={() => { if (!saving) onClose?.(); }}
      footer={<>
        <Button S={S} variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button S={S} variant="primary" icon={Check} onClick={handleSave} disabled={!canSave} loading={saving}>
          {sectorChanged ? 'Salvar e transferir' : 'Salvar'}
        </Button>
      </>}
    >
      {/* Nome */}
      <FieldLabel S={S}>Nome</FieldLabel>
      <TextInput S={S} value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && canSave && handleSave()} placeholder="Nome completo" autoFocus
        style={{ marginBottom: '18px' }} />

      {/* Setor */}
      <label style={lbl}>Setor</label>
      <div style={{ display: 'flex', gap: '8px', marginBottom: sectorChanged ? '14px' : '20px' }}>
        {SECTORS.map((s) => {
          const active = sector === s;
          return (
            <button key={s} type="button" className="ui-focus" onClick={() => setSector(s)}
              style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', border: `1px solid ${active ? SECTOR_DOT[s] : S.border}`, background: active ? SECTOR_DOT[s] + '1f' : 'transparent', color: active ? S.text : S.muted2, fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: SECTOR_DOT[s] }} />
              {SECTOR_LABEL[s]}
            </button>
          );
        })}
      </div>

      {/* Aviso de transferência */}
      {sectorChanged && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: SECTOR_DOT[sector] + '14', border: `1px solid ${SECTOR_DOT[sector]}40`, borderRadius: '10px', marginBottom: '20px', fontSize: '12.5px', color: S.muted2, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: S.text }}>{SECTOR_LABEL[currentSector]}</span>
          <ArrowRight size={14} color={SECTOR_DOT[sector]} />
          <span style={{ fontWeight: 700, color: SECTOR_DOT[sector] }}>{SECTOR_LABEL[sector]}</span>
          <span>· o histórico permanece; passa a lançar em {SECTOR_LABEL[sector]}.</span>
        </div>
      )}

      {/* Escala (só Redes) — time + motorista/passageiro */}
      {hasEscala && (
        <div style={{ paddingTop: '4px' }}>
          <label style={lbl}>Time da escala</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {ESC_TEAMS.map((t) => {
              const active = team === t.key;
              return (
                <button key={t.key} type="button" className="ui-focus" onClick={() => setTeam(active ? '' : t.key)}
                  style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', border: `1px solid ${active ? t.color : S.border}`, background: active ? t.color + '22' : 'transparent', color: active ? S.text : S.muted2, fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.color }} />{t.label}
                </button>
              );
            })}
          </div>
          {/* Papel no carro — escolha exclusiva (2 técnicos por carro) */}
          <label style={lbl}>Papel no carro</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { key: 'motorista',  label: 'Motorista',  sel: motorista && !passageiro, color: '#34d399', hint: 'dirige — faz o checklist nos dias de escala' },
              { key: 'passageiro', label: 'Passageiro', sel: passageiro,               color: '#38bdf8', hint: 'não dirige — sem checklist (mas sobe relatório normal)' },
            ].map(({ key, label, sel, color, hint }) => (
              <button key={key} type="button" className="ui-focus" title={hint}
                onClick={() => { if (key === 'motorista') { setMotorista(true); setPassageiro(false); } else { setPassageiro(true); setMotorista(false); } }}
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${sel ? color : S.border}`, background: sel ? color + '22' : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${sel ? color : S.muted}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {sel && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                  <span style={{ color: sel ? S.text : S.muted2, fontSize: '13px', fontWeight: 700 }}>{label}</span>
                  <span style={{ color: S.muted, fontSize: '10px', textAlign: 'left', lineHeight: 1.2 }}>{key === 'motorista' ? 'dirige · faz checklist' : 'sem checklist'}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
};
