import { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit2, X, ArrowRight, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatName } from '../../utils/formatName';
import { transferTechnicianSector, renameTechnicianCanonical, SECTOR_LABEL } from '../../services/database/technicianService';
import { Spinner } from '../common/Spinner';

// Modal compartilhado de edição de colaborador: renomeia (via renameFn da área)
// e/ou TRANSFERE de setor (lógica única). Usado por Fibra, Redes e Câmeras.
//   renameFn(oldName, newName): faz a renomeação específica da área (doc do
//     colaborador + relatórios + planilha). Só é chamada se o nome mudar.
//   currentSector: 'fibra' | 'redes' | 'cameras'
//   onDone(): recarrega a lista da página; onClose(): fecha.
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

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
      style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', padding: 'clamp(16px, 5vw, 28px)', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: S.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Edit2 size={20} color={S.accent} />
            </div>
            <div>
              <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>Editar Colaborador</div>
              <div style={{ color: S.muted, fontSize: '12px', marginTop: '2px' }}>Renomeia e/ou transfere de setor</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', padding: '4px' }}><X size={18} /></button>
        </div>

        {/* Nome */}
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Nome</label>
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && canSave && handleSave()} placeholder="Nome completo" autoFocus
          style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '18px' }}
          onFocus={(e) => e.target.style.borderColor = S.accent} onBlur={(e) => e.target.style.borderColor = S.border} />

        {/* Setor */}
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Setor</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: sectorChanged ? '14px' : '20px' }}>
          {SECTORS.map((s) => {
            const active = sector === s;
            return (
              <button key={s} onClick={() => setSector(s)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', border: `1px solid ${active ? SECTOR_DOT[s] : S.border}`, background: active ? SECTOR_DOT[s] + '1f' : 'transparent', color: active ? S.text : S.muted2, fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: SECTOR_DOT[s] }} />
                {SECTOR_LABEL[s]}
              </button>
            );
          })}
        </div>

        {/* Aviso de transferência */}
        {sectorChanged && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: SECTOR_DOT[sector] + '14', border: `1px solid ${SECTOR_DOT[sector]}40`, borderRadius: '10px', marginBottom: '20px', fontSize: '12.5px', color: S.muted2 }}>
            <span style={{ fontWeight: 700, color: S.text }}>{SECTOR_LABEL[currentSector]}</span>
            <ArrowRight size={14} color={SECTOR_DOT[sector]} />
            <span style={{ fontWeight: 700, color: SECTOR_DOT[sector] }}>{SECTOR_LABEL[sector]}</span>
            <span>· o histórico permanece; passa a lançar em {SECTOR_LABEL[sector]}.</span>
          </div>
        )}

        {/* Escala (só Redes) — time + motorista/passageiro */}
        {hasEscala && (
          <div style={{ marginBottom: '20px', paddingTop: '4px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Time da escala</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {ESC_TEAMS.map((t) => {
                const active = team === t.key;
                return (
                  <button key={t.key} type="button" onClick={() => setTeam(active ? '' : t.key)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', border: `1px solid ${active ? t.color : S.border}`, background: active ? t.color + '22' : 'transparent', color: active ? S.text : S.muted2, fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.color }} />{t.label}
                  </button>
                );
              })}
            </div>
            {/* Papel no carro — escolha exclusiva (2 técnicos por carro) */}
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Papel no carro</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { key: 'motorista',  label: 'Motorista',  sel: motorista && !passageiro, color: '#34d399', hint: 'dirige — faz o checklist nos dias de escala' },
                { key: 'passageiro', label: 'Passageiro', sel: passageiro,               color: '#38bdf8', hint: 'não dirige — sem checklist (mas sobe relatório normal)' },
              ].map(({ key, label, sel, color, hint }) => (
                <button key={key} type="button" title={hint}
                  onClick={() => { if (key === 'motorista') { setMotorista(true); setPassageiro(false); } else { setPassageiro(true); setMotorista(false); } }}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${sel ? color : S.border}`, background: sel ? color + '22' : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
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

        {/* Botões */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} disabled={saving}
            style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={!canSave}
            style={{ flex: 1.4, padding: '12px', borderRadius: '10px', background: S.gradient, border: 'none', color: S.onAccent, fontSize: '14px', fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: canSave ? 1 : 0.5 }}>
            {saving ? <Spinner /> : <><Check size={15} />{sectorChanged ? 'Salvar e transferir' : 'Salvar'}</>}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
