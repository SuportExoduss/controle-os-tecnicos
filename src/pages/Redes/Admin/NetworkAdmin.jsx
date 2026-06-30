import { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  LogOut, LayoutDashboard, Plus, Trash2, Edit2, X, Check,
  Wifi, AlertCircle, CheckCircle2, Sun, Moon, Upload,
  UserPlus, ChevronDown, CalendarDays, Clock, BarChart2, RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { AuthContext } from '../../../context/AuthContext';
import { ThemeContext } from '../../../context/ThemeContext';
import { logoutUser } from '../../../services/auth/authService';
import {
  saveNetworkOrder, getAllNetworkOrders,
  updateNetworkOrder, deleteNetworkOrder,
} from '../../../services/database/networkService';
import {
  getNetworkCollaborators, addNetworkCollaborator,
  deleteNetworkCollaborator, seedNetworkCollaborators,
} from '../../../services/database/networkCollaboratorService';
import {
  syncNetworkOrderToSheet, syncNetworkOrdersToSheet, deleteNetworkOrderInSheet,
  countNetworkOrdersInSheet,
} from '../../../services/integrations/networkSheetSync';

// ─── Constantes ─────────────────────────────────────────────────────────────────

const TRANSMISSORES = [
  'OLT BASE', 'OLT CANGUERA', 'OLT CARMO MESSIAS', 'OLT DIGISTAR CARAFÁ',
  'OLT DOURADINHO', 'OLT ITAPECERICA DA SERRA', 'OLT LAGEADINHO',
  'OLT PIEDADE', 'OLT PILAR DO SUL', 'OLT RESSACA',
  'OLT SÃO LOURENÇO', 'OLT SÃO ROQUE CENTRO', 'OLT TURVO',
  'OLT VARGEM DO SALTO', 'OLT VOTORANTIM',
];

const ASSUNTOS = [
  'AMPLIAÇÃO DE CTO', 'CTO EM LOS', 'CTO SINAL ALTO',
  'LINK DOWN', 'TROCA DE POSTES',
];

const ASSUNTO_COLOR = {
  'CTO EM LOS':       { bg: '#2d1010', color: '#fca5a5', border: '#991b1b' },
  'CTO SINAL ALTO':   { bg: '#1c1200', color: '#fcd34d', border: '#92400e' },
  'LINK DOWN':        { bg: '#0f1d35', color: '#60a5fa', border: '#1e3a5f' },
  'TROCA DE POSTES':  { bg: '#0f2320', color: '#6ee7b7', border: '#065f46' },
  'AMPLIAÇÃO DE CTO': { bg: '#12103a', color: '#a78bfa', border: '#4c1d95' },
};

const SLA_BADGE = {
  ok:      { bg: '#052e16', color: '#4ade80', border: '#166534', label: 'Dentro do prazo' },
  atencao: { bg: '#1c1200', color: '#fcd34d', border: '#92400e', label: 'Atenção' },
  critico: { bg: '#2d1010', color: '#f87171', border: '#991b1b', label: 'Fora do prazo' },
  aberta:  { bg: '#0f1d35', color: '#93c5fd', border: '#1e3a5f', label: 'Em aberto' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────────

const localDate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const fmtDate = (s) => {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

const calcSla = (dataAbertura, horaAbertura, dataFechamento, horaFechamento) => {
  if (!dataAbertura || !dataFechamento) return null;
  const ini = new Date(`${dataAbertura}T${horaAbertura || '00:00'}:00`);
  const fim = new Date(`${dataFechamento}T${horaFechamento || '23:59'}:00`);
  const diff = (fim - ini) / 3600000;
  if (diff < 0) return null;
  return Math.round(diff * 10) / 10;
};

const slaStatus = (horas) => {
  if (horas === null || horas === undefined) return 'aberta';
  if (horas <= 24) return 'ok';
  if (horas <= 48) return 'atencao';
  return 'critico';
};

const BLANK_FORM = {
  idOs: '', tecnico: '', transmissor: '', assunto: '',
  dataAbertura: '', horaAbertura: '',
  dataFechamento: '', horaFechamento: '',
  observacao: '',
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────────

const Glass = ({ S, children, style = {}, ...props }) => (
  <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', ...style }} {...props}>
    {children}
  </div>
);

const FieldLabel = ({ S, children }) => (
  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
    {children}
  </label>
);

const DarkSelect = ({ S, value, onChange, children, placeholder }) => (
  <select value={value} onChange={onChange}
    style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: S.input, border: `1px solid ${S.border}`, color: value ? S.text : S.muted, fontSize: '14px', outline: 'none', boxSizing: 'border-box', cursor: 'pointer', appearance: 'none', colorScheme: 'dark' }}>
    {placeholder && <option value="">{placeholder}</option>}
    {children}
  </select>
);

const DarkInput = ({ S, style = {}, ...props }) => (
  <input
    style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s', ...style }}
    onFocus={e => e.target.style.borderColor = S.blue}
    onBlur={e => e.target.style.borderColor = S.border}
    {...props}
  />
);

// ─── Componente principal ─────────────────────────────────────────────────────────

export const NetworkAdmin = () => {
  const navigate = useNavigate();
  const { user, profile } = useContext(AuthContext);
  const { S, mode, toggleTheme } = useContext(ThemeContext);

  // Orders
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [editId, setEditId] = useState(null);

  // Close OS modal
  const [closeModal, setCloseModal] = useState(null);
  const [closingDate, setClosingDate] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [closingSaving, setClosingSaving] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Import
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  // Modal de progresso da importação: { phase, fbDone, fbTotal, sheet, error }
  const [importModal, setImportModal] = useState(null);
  // Resultado da verificação planilha x firebase: { firebase, planilha } | null
  const [verifyResult, setVerifyResult] = useState(null);
  const fileInputRef = useRef(null);

  // Collaborators
  const [collaborators, setCollaborators] = useState([]);
  const [loadingCollabs, setLoadingCollabs] = useState(true);
  const [showAddCollab, setShowAddCollab] = useState(false);
  const [newCollabName, setNewCollabName] = useState('');
  const [savingCollab, setSavingCollab] = useState(false);
  const [techSearch, setTechSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Delete collab
  const [deleteCollabConfirm, setDeleteCollabConfirm] = useState(null);

  const today = localDate();

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchOrders = async () => {
    try {
      const snap = await getAllNetworkOrders();
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { toast.error('Erro ao carregar ordens'); }
    finally { setOrdersLoading(false); }
  };

  const fetchCollaborators = async () => {
    try {
      await seedNetworkCollaborators();
      const snap = await getNetworkCollaborators();
      setCollaborators(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { toast.error('Erro ao carregar técnicos'); }
    finally { setLoadingCollabs(false); }
  };

  useEffect(() => {
    fetchOrders();
    fetchCollaborators();
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setTechSearch('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Computed ─────────────────────────────────────────────────────────────────
  const todayOrders  = orders.filter(o => o.data === today);
  const openOrders   = orders.filter(o => !o.dataFechamento);
  const closedToday  = todayOrders.filter(o => o.slaHoras !== null && o.slaHoras !== undefined);
  const slaMediaHoje = closedToday.length > 0
    ? Math.round((closedToday.reduce((s, o) => s + Number(o.slaHoras), 0) / closedToday.length) * 10) / 10
    : null;

  const assuntoCounts = {};
  todayOrders.forEach(o => { if (o.assunto) assuntoCounts[o.assunto] = (assuntoCounts[o.assunto] || 0) + 1; });
  const topAssuntoEntry = Object.entries(assuntoCounts).sort((a, b) => b[1] - a[1])[0];

  const tecnicosHoje = new Set(todayOrders.map(o => o.tecnico));
  const done  = collaborators.filter(c => tecnicosHoje.has(c.name)).length;
  const total = collaborators.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const barColor = pct === 100 ? '#22c55e' : pct >= 60 ? '#3b82f6' : pct >= 30 ? '#f59e0b' : '#ef4444';

  const techStatus = (name) => {
    if (tecnicosHoje.has(name)) return { color: '#22c55e', label: 'Registrou hoje' };
    return { color: '#f59e0b', label: 'Sem registro hoje' };
  };

  const slaPreview   = calcSla(form.dataAbertura, form.horaAbertura, form.dataFechamento, form.horaFechamento);
  const statusPreview = slaStatus(slaPreview);

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const clearForm = () => { setForm(BLANK_FORM); setEditId(null); };

  // ── Save / Update ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.idOs.trim()) { toast.error('Informe o ID da O.S'); return; }
    if (!form.tecnico)     { toast.error('Selecione o técnico'); return; }
    if (!form.transmissor) { toast.error('Selecione o transmissor'); return; }
    if (!form.assunto)     { toast.error('Selecione o assunto'); return; }
    if (!form.dataAbertura){ toast.error('Informe a data de abertura'); return; }

    setSaving(true);
    const slaHoras = calcSla(form.dataAbertura, form.horaAbertura, form.dataFechamento, form.horaFechamento);
    const payload = {
      data: today,
      idOs: form.idOs.trim(),
      tecnico: form.tecnico,
      transmissor: form.transmissor,
      assunto: form.assunto,
      dataAbertura: form.dataAbertura,
      horaAbertura: form.horaAbertura || null,
      dataFechamento: form.dataFechamento || null,
      horaFechamento: form.horaFechamento || null,
      slaHoras,
      slaStatus: slaStatus(slaHoras),
      observacao: form.observacao.trim(),
      lancadoPor: profile?.nickname || user?.email || '',
    };

    try {
      if (editId) {
        await updateNetworkOrder(editId, payload);
        toast.success('Ordem atualizada!');
      } else {
        await saveNetworkOrder(payload);
        toast.success('Ordem registrada!');
      }
      syncNetworkOrderToSheet(payload); // planilha (best-effort)
      clearForm();
      await fetchOrders();
    } catch { toast.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  // ── Fechar OS ────────────────────────────────────────────────────────────────
  const handleCloseOs = async () => {
    if (!closingDate) { toast.error('Informe a data de fechamento'); return; }
    setClosingSaving(true);
    try {
      const slaHoras = calcSla(closeModal.dataAbertura, closeModal.horaAbertura, closingDate, closingTime);
      await updateNetworkOrder(closeModal.id, {
        dataFechamento: closingDate,
        horaFechamento: closingTime || null,
        slaHoras,
        slaStatus: slaStatus(slaHoras),
      });
      syncNetworkOrderToSheet({ ...closeModal, dataFechamento: closingDate, horaFechamento: closingTime || null, slaHoras });
      toast.success('O.S fechada!');
      setCloseModal(null); setClosingDate(''); setClosingTime('');
      await fetchOrders();
    } catch { toast.error('Erro ao fechar O.S'); }
    finally { setClosingSaving(false); }
  };

  // ── Editar ───────────────────────────────────────────────────────────────────
  const handleEdit = (order) => {
    setForm({
      idOs: order.idOs || '',
      tecnico: order.tecnico || '',
      transmissor: order.transmissor || '',
      assunto: order.assunto || '',
      dataAbertura: order.dataAbertura || '',
      horaAbertura: order.horaAbertura || '',
      dataFechamento: order.dataFechamento || '',
      horaFechamento: order.horaFechamento || '',
      observacao: order.observacao || '',
    });
    setEditId(order.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      const alvo = orders.find(o => o.id === id);
      await deleteNetworkOrder(id);
      if (alvo?.idOs) deleteNetworkOrderInSheet(alvo.idOs); // planilha (best-effort)
      toast.success('Ordem removida');
      setDeleteConfirm(null);
      await fetchOrders();
    } catch { toast.error('Erro ao remover'); }
  };

  // ── Colaboradores ────────────────────────────────────────────────────────────
  const handleSaveCollab = async () => {
    if (!newCollabName.trim()) return;
    setSavingCollab(true);
    try {
      await addNetworkCollaborator(newCollabName);
      toast.success('Técnico adicionado!');
      setNewCollabName(''); setShowAddCollab(false);
      await fetchCollaborators();
    } catch { toast.error('Erro ao adicionar'); }
    finally { setSavingCollab(false); }
  };

  const handleDeleteCollab = async (id) => {
    try {
      await deleteNetworkCollaborator(id);
      if (form.tecnico === deleteCollabConfirm?.name) setForm(p => ({ ...p, tecnico: '' }));
      toast.success('Técnico removido');
      setDeleteCollabConfirm(null);
      await fetchCollaborators();
    } catch { toast.error('Erro ao remover técnico'); }
  };

  // ── Import Excel ─────────────────────────────────────────────────────────────
  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames.includes('Lancamentos Redes') ? 'Lancamentos Redes' : wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
      const parseSerial = (serial) => {
        if (!serial || typeof serial !== 'number') return { date: '', time: '' };
        const d = new Date((serial - 25569) * 86400 * 1000);
        return {
          date: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
          time: `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`,
        };
      };
      const normalize = (s) => String(s || '').trim().toUpperCase();
      const valid = rows.filter(r => r['ID OS'] && r['TECNICO RESPONSAVEL']);
      if (valid.length === 0) { toast.error('Nenhum registro válido encontrado'); setImporting(false); return; }
      setImportModal({ phase: 'firebase', fbDone: 0, fbTotal: valid.length, sheet: null, error: null });
      let ok = 0, errors = 0;
      const importados = [];
      for (const r of valid) {
        const abertura   = parseSerial(r['DATA ABERTURA']);
        const fechamento = parseSerial(r['DATA FECHAMENTO']);
        const slaHoras = r['SLA'] ? Math.round(Number(r['SLA']) * 10) / 10 : null;
        // Para precisão no dashboard, a DATA do registro importado é a data de
        // encerramento (ou abertura, se ainda aberta) — como se o relatório
        // tivesse sido feito no dia do encerramento da ordem.
        const payload = {
          data: fechamento.date || abertura.date || today,
          idOs: String(r['ID OS']).trim(),
          tecnico: normalize(r['TECNICO RESPONSAVEL']),
          transmissor: normalize(r['TRANSMISSOR']),
          assunto: normalize(r['ASSUNTO']),
          dataAbertura: abertura.date, horaAbertura: abertura.time || null,
          dataFechamento: fechamento.date || null, horaFechamento: fechamento.time || null,
          slaHoras, slaStatus: slaStatus(slaHoras),
          observacao: String(r['OBSERVAÇÃO'] || '').trim(),
          lancadoPor: 'Importado',
        };
        try {
          await saveNetworkOrder(payload);
          importados.push(payload);
          ok++;
        } catch { errors++; }
        setImportModal(p => p ? { ...p, fbDone: ok + errors } : p);
      }

      // Fase 2 — sincroniza com a planilha (1 request, substituição total)
      setImportModal(p => p ? { ...p, phase: 'sheet', fbErrors: errors } : p);
      let sheetRes = null;
      if (importados.length) sheetRes = await syncNetworkOrdersToSheet(importados);

      setImportModal(p => p ? {
        ...p,
        phase: (sheetRes && sheetRes.ok) ? 'done' : 'error',
        fbDone: ok,
        fbErrors: errors,
        sheet: (sheetRes && sheetRes.ok) ? sheetRes : null,
        error: (sheetRes && !sheetRes.ok) ? ('Planilha: ' + (sheetRes.error || 'falha desconhecida')) : null,
      } : p);
      await fetchOrders();
    } catch (err) {
      console.error(err);
      setImportModal(p => p ? { ...p, phase: 'error', error: String(err.message || err) } : { phase: 'error', error: String(err.message || err) });
    }
    finally { setImporting(false); }
  };

  // ── Enviar tudo do Firebase para a planilha ───────────────────────────────────
  // 1) Corrige no Firebase os importados sem DATA (preenche com a data de
  //    ENCERRAMENTO, só a data — sem horário; o resto permanece igual).
  // 2) Envia tudo para a planilha já convertido. O Apps Script só adiciona o que
  //    falta e atualiza o que está diferente (compara pela ID OS).
  const handleSyncAll = async () => {
    if (!orders.length) { toast.error('Nenhuma O.S para enviar'); return; }
    if (!window.confirm(`Enviar ${orders.length} O.S do Firebase para a planilha?\n(Importados sem DATA recebem a data de encerramento antes do envio.)`)) return;
    setSyncing(true);
    try {
      // 1) Ajusta a DATA dos importados para a data de ENCERRAMENTO (só a data).
      //    Sobrescreve sempre (mesmo que já tenha a data da importação), pois para
      //    os importados a "data de criação do relatório" = dia do encerramento.
      let corrigidos = 0;
      const atual = orders.map(o => ({ ...o }));
      for (const o of atual) {
        if (o.lancadoPor !== 'Importado') continue;
        const novaData = o.dataFechamento || o.dataAbertura; // só a data (YYYY-MM-DD)
        if (novaData && o.data !== novaData) {
          try { await updateNetworkOrder(o.id, { data: novaData }); o.data = novaData; corrigidos++; } catch { /* ignora individual */ }
        }
      }
      if (corrigidos > 0) {
        setOrders(atual);
        toast.success(`${corrigidos} data(s) de importados ajustada(s) para o encerramento.`);
      }

      // 2) Envia tudo para a planilha (1 request, substituição total)
      const res = await syncNetworkOrdersToSheet(atual);
      if (res && res.ok) {
        const n = res.total != null ? res.total : (res.added != null ? res.added : '?');
        toast.success(`Planilha sincronizada! ${n} O.S na aba.`);
      } else {
        toast.error('Falha na planilha: ' + ((res && res.error) || 'desconhecida'));
      }
    } catch { toast.error('Erro ao enviar para a planilha'); }
    finally { setSyncing(false); }
  };

  // ── Verificar se a planilha está 100% populada (planilha x firebase) ──────────
  const handleVerifySheet = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await countNetworkOrdersInSheet();
      if (res && res.ok && typeof res.count === 'number') {
        setVerifyResult({ firebase: orders.length, planilha: res.count });
      } else {
        toast.error('Não foi possível ler a contagem da planilha. Verifique se o Apps Script está publicado.');
      }
    } catch { toast.error('Erro ao verificar a planilha'); }
    finally { setVerifying(false); }
  };

  // ── Logout ───────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try { await logoutUser(); navigate('/redes/login'); }
    catch { toast.error('Erro ao sair'); }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', background: S.bg }}>

      {/* ── HEADER ── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: S.card, borderBottom: `1px solid ${S.border}`, padding: '0 clamp(12px, 4vw, 24px)' }}>
        <div className="r-maxw" style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>

          {/* Esquerda */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
              <img src="/logo-frota.png" alt="IbiúNET" className="r-logo" style={{ width: 'clamp(116px, 20vw, 156px)', height: 'auto', display: 'block' }} />
              {profile?.nickname && (
                <div style={{ color: '#34d399', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={9} />{profile.nickname}
                </div>
              )}
            </div>

            {/* Badge REDES */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '8px', background: S.accentSoft, border: `1px solid ${S.accent}`, flexShrink: 0 }}>
              <Wifi size={12} color={S.accent} />
              <span style={{ fontSize: '12px', fontWeight: 800, color: S.accent, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Redes</span>
            </div>

            <button onClick={toggleTheme} title="Alternar tema"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px', borderRadius: '8px', background: 'transparent', border: `1px solid ${S.border}`, color: mode === 'light' ? '#7c3aed' : '#f59e0b', cursor: 'pointer', flexShrink: 0 }}>
              {mode === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            </button>

            <button onClick={() => navigate('/redes/dashboard')} title="Dashboard"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '8px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = S.blue; e.currentTarget.style.color = S.blue; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.color = S.muted2; }}>
              <LayoutDashboard size={13} /><span className="r-topbar-label">Dashboard</span>
            </button>

            <button onClick={handleLogout} title="Sair"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '8px', background: '#0d2d1f', border: '1px solid #065f46', color: '#34d399', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#2d0f0f'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = '#7f1d1d'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0d2d1f'; e.currentTarget.style.color = '#34d399'; e.currentTarget.style.borderColor = '#065f46'; }}>
              <LogOut size={13} /><span className="r-topbar-label">Sair</span>
            </button>
          </div>

          {/* Direita — verificar + sincronizar + importar */}
          <div style={{ flexShrink: 0, display: 'flex', gap: '6px' }}>
            <button onClick={handleVerifySheet} disabled={verifying} title="Verificar se a planilha está 100% populada (compara com o Firebase)"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '13px', fontWeight: 600, cursor: verifying ? 'wait' : 'pointer', background: 'transparent', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = S.blue; e.currentTarget.style.color = S.blue; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.color = S.muted2; }}>
              <CheckCircle2 size={14} /><span className="r-topbar-label">{verifying ? 'Verificando…' : 'Verificar'}</span>
            </button>
            <button onClick={handleSyncAll} disabled={syncing} title="Enviar tudo do Firebase para a planilha (corrige DATA dos importados e converte tudo)"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid #065f46', color: '#34d399', fontSize: '13px', fontWeight: 600, cursor: syncing ? 'wait' : 'pointer', background: 'transparent', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = mode === 'light' ? '#d1fae5' : '#0d2d1f'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <RefreshCw size={14} /><span className="r-topbar-label">{syncing ? 'Enviando…' : 'Enviar p/ planilha'}</span>
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportExcel} />
            <button onClick={() => fileInputRef.current?.click()} disabled={importing}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: `1px solid ${S.border}`, color: S.blue, fontSize: '13px', fontWeight: 600, cursor: importing ? 'wait' : 'pointer', background: 'transparent', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = mode === 'light' ? '#dbeafe' : '#0d1d3a'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Upload size={14} /><span className="r-topbar-label">{importing ? 'Importando…' : 'Importar Excel'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main style={{ flex: 1, width: '100%' }} className="r-page-pad r-maxw">

        {/* Cards de resumo rápido */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
          {[
            { label: 'Registradas hoje', value: todayOrders.length,  color: S.blue },
            { label: 'Em aberto',        value: openOrders.length,   color: openOrders.length > 0 ? '#f87171' : '#4ade80' },
            { label: 'Total geral',      value: orders.length,       color: S.muted2 },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ color, fontWeight: 900, fontSize: '28px', lineHeight: 1 }}>{value}</div>
              <div style={{ color: S.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '6px' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Grid principal */}
        <div className="r-admin-grid">

          {/* ── FORMULÁRIO (esquerda) ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Glass S={S} style={{ overflow: 'hidden' }}>
              {/* Card header */}
              <div style={{ padding: '24px 28px', background: mode === 'light' ? 'linear-gradient(135deg,#dbeafe 0%,#eceef4 100%)' : 'linear-gradient(135deg,#0d1e3d 0%,#0f1117 100%)', borderBottom: `1px solid ${S.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: editId ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.12)', border: `1px solid ${editId ? 'rgba(59,130,246,0.3)' : 'rgba(16,185,129,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {editId ? <Edit2 size={17} color={S.blue} /> : <Plus size={17} color="#10b981" />}
                  </div>
                  <div>
                    <div style={{ color: S.text, fontWeight: 800, fontSize: '18px' }}>
                      {editId ? 'Editar Ordem de Serviço' : 'Registrar Nova O.S'}
                    </div>
                    <div style={{ color: editId ? S.blue : '#10b981', fontSize: '13px', marginTop: '2px' }}>
                      Data de registro: {fmtDate(today)}
                    </div>
                  </div>
                  {editId && (
                    <button onClick={clearForm} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: S.muted, cursor: 'pointer', display: 'flex', padding: '4px' }}>
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>

              <div style={{ padding: 'clamp(16px,5vw,28px)', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* ID da O.S */}
                <div>
                  <FieldLabel S={S}>ID da O.S <span style={{ color: '#f87171' }}>*</span></FieldLabel>
                  <DarkInput S={S} type="text" value={form.idOs} onChange={e => set('idOs', e.target.value)} placeholder="Ex: 459875" />
                </div>

                {/* Técnico — dropdown com busca */}
                <div>
                  <FieldLabel S={S}>Técnico Responsável <span style={{ color: '#f87171' }}>*</span></FieldLabel>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {[{ c: '#22c55e', t: 'Registrou hoje' }, { c: '#f59e0b', t: 'Sem registro hoje' }].map(({ c, t }) => (
                      <span key={t} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: S.muted2 }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c, boxShadow: `0 0 5px ${c}` }} />{t}
                      </span>
                    ))}
                  </div>
                  <div style={{ position: 'relative' }} ref={dropdownRef}>
                    <button type="button" onClick={() => setDropdownOpen(!dropdownOpen)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '10px', background: S.input, border: `1px solid ${dropdownOpen ? S.blue : S.border}`, color: form.tecnico ? S.text : S.muted, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', boxSizing: 'border-box' }}>
                      <span>{form.tecnico || 'Selecione o técnico…'}</span>
                      <ChevronDown size={15} style={{ color: S.muted, transition: 'transform 0.2s', transform: dropdownOpen ? 'rotate(180deg)' : 'none' }} />
                    </button>
                    <AnimatePresence>
                      {dropdownOpen && (
                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}
                          style={{ position: 'absolute', zIndex: 20, width: '100%', marginTop: '4px', borderRadius: '12px', background: S.surface, border: `1px solid ${S.border}`, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
                          <div style={{ padding: '10px', borderBottom: `1px solid ${S.border}` }}>
                            <input autoFocus value={techSearch} onChange={e => setTechSearch(e.target.value)}
                              placeholder="Buscar técnico…"
                              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                              onFocus={e => e.target.style.borderColor = S.blue}
                              onBlur={e => e.target.style.borderColor = S.border} />
                          </div>
                          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                            {loadingCollabs ? (
                              <div style={{ padding: '16px', textAlign: 'center', color: S.muted, fontSize: '13px' }}>Carregando…</div>
                            ) : collaborators.filter(c => c.name.toLowerCase().includes(techSearch.toLowerCase())).length === 0 ? (
                              <div style={{ padding: '16px', textAlign: 'center', color: S.muted, fontSize: '13px' }}>Nenhum técnico encontrado</div>
                            ) : (
                              collaborators.filter(c => c.name.toLowerCase().includes(techSearch.toLowerCase())).map(c => {
                                const st = techStatus(c.name);
                                return (
                                  <button key={c.id} type="button"
                                    onClick={() => { set('tecnico', c.name); setDropdownOpen(false); setTechSearch(''); }}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', background: form.tecnico === c.name ? '#0d1d3a' : 'none', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#0d1d3a'}
                                    onMouseLeave={e => e.currentTarget.style.background = form.tecnico === c.name ? '#0d1d3a' : 'none'}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: st.color, flexShrink: 0, boxShadow: `0 0 6px ${st.color}` }} title={st.label} />
                                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: S.accentSoft, color: S.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>{c.name.charAt(0)}</div>
                                      <span style={{ color: form.tecnico === c.name ? S.blue : S.text, fontSize: '14px', fontWeight: form.tecnico === c.name ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                                    </div>
                                    {form.tecnico === c.name && <Check size={14} color={S.blue} style={{ flexShrink: 0 }} />}
                                  </button>
                                );
                              })
                            )}
                          </div>
                          {collaborators.length > 0 && (
                            <div style={{ borderTop: `1px solid ${S.border}` }}>
                              <button type="button" onClick={() => { setDropdownOpen(false); setShowAddCollab(true); }}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'none', border: 'none', color: S.blue, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#0d1d3a'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                <Plus size={14} />Adicionar técnico
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Transmissor + Assunto */}
                <div className="r-form-row">
                  <div>
                    <FieldLabel S={S}>Transmissor <span style={{ color: '#f87171' }}>*</span></FieldLabel>
                    <DarkSelect S={S} value={form.transmissor} onChange={e => set('transmissor', e.target.value)} placeholder="Selecione…">
                      {TRANSMISSORES.map(t => <option key={t} value={t}>{t}</option>)}
                    </DarkSelect>
                  </div>
                  <div>
                    <FieldLabel S={S}>Assunto <span style={{ color: '#f87171' }}>*</span></FieldLabel>
                    <DarkSelect S={S} value={form.assunto} onChange={e => set('assunto', e.target.value)} placeholder="Selecione…">
                      {ASSUNTOS.map(a => <option key={a} value={a}>{a}</option>)}
                    </DarkSelect>
                    {form.assunto && (
                      <div style={{ marginTop: '6px', display: 'inline-flex', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, ...ASSUNTO_COLOR[form.assunto] }}>
                        {form.assunto}
                      </div>
                    )}
                  </div>
                </div>

                {/* Abertura */}
                <div className="r-form-row">
                  <div>
                    <FieldLabel S={S}><span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CalendarDays size={11} />Data de Abertura <span style={{ color: '#f87171' }}>*</span></span></FieldLabel>
                    <DarkInput S={S} type="date" value={form.dataAbertura} onChange={e => set('dataAbertura', e.target.value)} style={{ colorScheme: mode, cursor: 'pointer' }} onClick={e => { try { e.target.showPicker(); } catch { /* */ } }} />
                  </div>
                  <div>
                    <FieldLabel S={S}><span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={11} />Horário de Abertura</span></FieldLabel>
                    <DarkInput S={S} type="time" value={form.horaAbertura} onChange={e => set('horaAbertura', e.target.value)} style={{ colorScheme: mode, cursor: 'pointer' }} />
                  </div>
                </div>

                {/* Fechamento */}
                <div className="r-form-row">
                  <div>
                    <FieldLabel S={S}><span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CalendarDays size={11} />Data de Encerramento</span></FieldLabel>
                    <DarkInput S={S} type="date" value={form.dataFechamento} onChange={e => set('dataFechamento', e.target.value)} style={{ colorScheme: mode, cursor: 'pointer' }} onClick={e => { try { e.target.showPicker(); } catch { /* */ } }} />
                  </div>
                  <div>
                    <FieldLabel S={S}><span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={11} />Horário de Encerramento</span></FieldLabel>
                    <DarkInput S={S} type="time" value={form.horaFechamento} onChange={e => set('horaFechamento', e.target.value)} style={{ colorScheme: mode, cursor: 'pointer' }} />
                  </div>
                </div>

                {/* Preview SLA */}
                {form.dataAbertura && form.dataFechamento && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '10px', background: SLA_BADGE[statusPreview].bg, border: `1px solid ${SLA_BADGE[statusPreview].border}` }}>
                    <Clock size={15} color={SLA_BADGE[statusPreview].color} />
                    <span style={{ color: SLA_BADGE[statusPreview].color, fontSize: '13px', fontWeight: 700 }}>
                      SLA: {slaPreview}h — {SLA_BADGE[statusPreview].label}
                    </span>
                  </motion.div>
                )}

                {/* Observação */}
                <div>
                  <FieldLabel S={S}>Observação</FieldLabel>
                  <textarea value={form.observacao} onChange={e => set('observacao', e.target.value)}
                    placeholder="Detalhes sobre a O.S (opcional)" rows={3}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = S.blue}
                    onBlur={e => e.target.style.borderColor = S.border} />
                </div>

                {/* Botões */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  {editId && (
                    <button onClick={clearForm} disabled={saving}
                      style={{ padding: '13px 20px', borderRadius: '12px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  )}
                  <button onClick={handleSave} disabled={saving}
                    style={{ flex: 1, padding: '13px', borderRadius: '12px', border: 'none', color: editId ? S.onAccent : '#fff', fontSize: '15px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', opacity: saving ? 0.7 : 1,
                      background: saving ? S.card : editId ? S.gradient : 'linear-gradient(135deg,#047857,#10b981)',
                      boxShadow: saving ? 'none' : editId ? `0 0 24px ${S.glow}` : '0 0 24px rgba(16,185,129,0.25)' }}>
                    {saving ? 'Salvando…' : editId ? <><Check size={16} />Atualizar O.S</> : <><Plus size={16} />Registrar O.S</>}
                  </button>
                </div>
              </div>
            </Glass>

            {/* ── OS EM ABERTO (abaixo do form) ── */}
            {openOrders.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ marginTop: '16px', background: '#1c0505', border: '1px solid #991b1b', borderRadius: '16px', padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <AlertCircle size={16} color="#f87171" />
                  <span style={{ color: '#f87171', fontWeight: 800, fontSize: '14px' }}>O.S em Aberto ({openOrders.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {openOrders.map(o => {
                    const ac = ASSUNTO_COLOR[o.assunto] || { bg: '#111', color: '#94a3b8', border: '#1e293b' };
                    return (
                      <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid #7f1d1d', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                          <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '13px' }}>#{o.idOs} — {o.tecnico}</span>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 600, ...ac }}>{o.assunto}</span>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Aberta em {fmtDate(o.dataAbertura)}</span>
                          </div>
                        </div>
                        <button onClick={() => { setCloseModal(o); setClosingDate(''); }}
                          style={{ padding: '7px 14px', borderRadius: '8px', background: 'linear-gradient(135deg,#047857,#10b981)', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                          Fechar O.S
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── OS DE HOJE (lista) ── */}
            {todayOrders.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ marginTop: '16px' }}>
                <Glass S={S} style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <CalendarDays size={15} color={S.blue} />
                    <span style={{ color: S.text, fontWeight: 800, fontSize: '14px' }}>Registradas hoje ({todayOrders.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {todayOrders.map(o => {
                      const ac = ASSUNTO_COLOR[o.assunto] || { bg: '#111', color: '#94a3b8', border: '#1e293b' };
                      const sb = SLA_BADGE[o.slaStatus || 'aberta'];
                      return (
                        <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: S.input, border: `1px solid ${S.border}`, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                            <span style={{ color: S.text, fontWeight: 700, fontSize: '13px' }}>#{o.idOs} — {o.tecnico}</span>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 600, ...ac }}>{o.assunto}</span>
                              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 600, background: sb.bg, color: sb.color, border: `1px solid ${sb.border}` }}>
                                {o.slaHoras != null ? `${o.slaHoras}h` : 'Em aberto'}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button onClick={() => handleEdit(o)}
                              style={{ padding: '7px 12px', borderRadius: '8px', background: '#0d1d3a', border: `1px solid ${S.border}`, color: S.blue, fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Edit2 size={12} />Editar
                            </button>
                            <button onClick={() => setDeleteConfirm(o.id)}
                              style={{ padding: '7px 10px', borderRadius: '8px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#2d0f0f'; e.currentTarget.style.color = '#f87171'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.muted; }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Glass>
              </motion.div>
            )}
          </motion.div>

          {/* ── SIDEBAR (direita) ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Resumo do Dia */}
            <Glass S={S} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                <BarChart2 size={15} color={S.blue} />
                <span style={{ color: S.text, fontWeight: 700, fontSize: '13px' }}>Resumo do Dia</span>
                <span style={{ background: S.accentSoft, color: S.accent, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px' }}>{fmtDate(today)}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: 'O.S Registradas',  value: todayOrders.length,           accent: S.blue },
                  { label: 'Em Aberto',         value: todayOrders.filter(o => !o.dataFechamento).length, accent: todayOrders.filter(o => !o.dataFechamento).length > 0 ? '#f87171' : '#4ade80' },
                  { label: 'SLA Médio',         value: slaMediaHoje != null ? `${slaMediaHoje}h` : '—', accent: slaMediaHoje != null ? (slaMediaHoje <= 24 ? '#4ade80' : slaMediaHoje <= 48 ? '#fcd34d' : '#f87171') : S.muted2 },
                  { label: 'Top Serviço',       value: topAssuntoEntry ? `${topAssuntoEntry[0]} (${topAssuntoEntry[1]})` : '—', accent: topAssuntoEntry ? (ASSUNTO_COLOR[topAssuntoEntry[0]]?.color || S.muted2) : S.muted2 },
                ].map(({ label, value, accent }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: S.muted, fontSize: '13px', flexShrink: 0 }}>{label}</span>
                    <span style={{ color: accent, fontSize: label === 'O.S Registradas' ? '18px' : '13px', fontWeight: 700, textAlign: 'right', minWidth: 0, wordBreak: 'break-word' }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Breakdown por assunto */}
              {Object.keys(assuntoCounts).length > 0 && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${S.border}` }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>Tipos hoje</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {Object.entries(assuntoCounts).sort((a, b) => b[1] - a[1]).map(([assunto, count]) => {
                      const ac = ASSUNTO_COLOR[assunto] || { bg: '#111', color: '#94a3b8', border: '#1e293b' };
                      const maxCount = Math.max(...Object.values(assuntoCounts));
                      return (
                        <div key={assunto} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 700, flexShrink: 0, ...ac }}>{assunto}</span>
                          <div style={{ flex: 1, height: '4px', borderRadius: '4px', background: S.input, overflow: 'hidden' }}>
                            <motion.div animate={{ width: `${(count / maxCount) * 100}%` }} style={{ height: '100%', borderRadius: '4px', background: ac.color }} />
                          </div>
                          <span style={{ color: ac.color, fontWeight: 800, fontSize: '12px', flexShrink: 0, minWidth: '16px', textAlign: 'right' }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {todayOrders.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: S.muted, fontSize: '13px' }}>
                  Nenhuma O.S registrada hoje ainda.
                </div>
              )}
            </Glass>

            {/* Colaboradores / Técnicos */}
            <Glass S={S} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserPlus size={15} color={S.blue} />
                  <span style={{ color: S.text, fontWeight: 700, fontSize: '13px' }}>Colaboradores</span>
                  <span style={{ background: S.accentSoft, color: S.accent, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px' }}>{collaborators.length}</span>
                </div>
              </div>

              {collaborators.length === 0 && !loadingCollabs ? (
                <p style={{ color: S.muted, fontSize: '12px', marginBottom: '12px' }}>Nenhum técnico cadastrado.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                  {collaborators.map(c => {
                    const st = techStatus(c.name);
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', background: S.input, border: `1px solid ${S.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: st.color, flexShrink: 0, boxShadow: `0 0 5px ${st.color}` }} title={st.label} />
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: S.accentSoft, color: S.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, flexShrink: 0 }}>{c.name.charAt(0)}</div>
                          <span style={{ color: S.muted2, fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        </div>
                        <button onClick={() => setDeleteCollabConfirm(c)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', padding: '4px', borderRadius: '6px', display: 'flex', transition: 'all 0.15s', flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = '#2d0f0f'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = 'none'; }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <button onClick={() => setShowAddCollab(true)}
                style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'transparent', border: `1px dashed ${S.accent}`, color: S.blue, fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#0d1d3a'; e.currentTarget.style.borderStyle = 'solid'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderStyle = 'dashed'; }}>
                <Plus size={14} />Adicionar técnico
              </button>
            </Glass>
          </motion.div>
        </div>
      </main>

      {/* ── OVERLAYS ── */}
      {(showAddCollab || closeModal || deleteConfirm || deleteCollabConfirm) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 49 }} />
      )}

      {/* ── MODAL DE VERIFICAÇÃO PLANILHA x FIREBASE ── */}
      <AnimatePresence>
        {verifyResult && (() => {
          const ok = verifyResult.firebase === verifyResult.planilha;
          const falta = verifyResult.firebase - verifyResult.planilha;
          return (
            <>
              <div onClick={() => setVerifyResult(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 59 }} />
              <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
                style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '16px' }}>
                <div style={{ width: '100%', maxWidth: '400px', background: S.surface, border: `1px solid ${ok ? '#065f46' : '#92400e'}`, borderRadius: '20px', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', padding: 'clamp(20px,5vw,28px)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: ok ? '#0d2d1f' : '#1c1200', border: `1px solid ${ok ? '#065f46' : '#92400e'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                      {ok ? <CheckCircle2 size={30} color="#34d399" /> : <AlertCircle size={30} color="#fbbf24" />}
                    </div>
                    <div style={{ color: S.text, fontWeight: 800, fontSize: '18px' }}>
                      {ok ? 'Planilha 100% populada' : 'Planilha incompleta'}
                    </div>
                    <div style={{ color: S.muted, fontSize: '13px', marginTop: '4px' }}>
                      {ok ? 'Firebase e planilha estão iguais.' : `Faltam ${falta > 0 ? falta : 0} O.S na planilha. Clique em "Sincronizar planilha".`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
                    <div style={{ flex: 1, background: S.input, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                      <div style={{ color: S.blue, fontWeight: 900, fontSize: '24px', lineHeight: 1 }}>{verifyResult.firebase}</div>
                      <div style={{ color: S.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '6px' }}>Firebase</div>
                    </div>
                    <div style={{ flex: 1, background: S.input, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                      <div style={{ color: ok ? '#34d399' : '#fbbf24', fontWeight: 900, fontSize: '24px', lineHeight: 1 }}>{verifyResult.planilha}</div>
                      <div style={{ color: S.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '6px' }}>Planilha</div>
                    </div>
                  </div>
                  <button onClick={() => setVerifyResult(null)}
                    style={{ width: '100%', padding: '13px', borderRadius: '12px', background: S.gradient, border: 'none', color: S.onAccent, fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Check size={16} />Fechar
                  </button>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* ── MODAL DE PROGRESSO DA IMPORTAÇÃO ── */}
      <AnimatePresence>
        {importModal && (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 59 }} />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
              style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '16px' }}>
              <div style={{ width: '100%', maxWidth: '420px', background: S.surface, border: `1px solid ${importModal.phase === 'error' ? '#7f1d1d' : S.accent}`, borderRadius: '20px', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', padding: 'clamp(20px,5vw,28px)' }}>

                {/* Cabeçalho */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: importModal.phase === 'done' ? '#0d2d1f' : importModal.phase === 'error' ? '#2d0f0f' : S.accentSoft, border: `1px solid ${importModal.phase === 'done' ? '#065f46' : importModal.phase === 'error' ? '#7f1d1d' : S.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {importModal.phase === 'done'
                      ? <CheckCircle2 size={22} color="#34d399" />
                      : importModal.phase === 'error'
                        ? <AlertCircle size={22} color="#f87171" />
                        : <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }} style={{ display: 'flex' }}><RefreshCw size={20} color={S.blue} /></motion.div>}
                  </div>
                  <div>
                    <div style={{ color: S.text, fontWeight: 800, fontSize: '17px' }}>
                      {importModal.phase === 'done' ? 'Importação concluída' : importModal.phase === 'error' ? 'Erro na importação' : 'Importando…'}
                    </div>
                    <div style={{ color: S.muted, fontSize: '12px', marginTop: '2px' }}>
                      {importModal.phase === 'error' ? 'Veja o detalhe abaixo' : 'Não feche a página até concluir'}
                    </div>
                  </div>
                </div>

                {importModal.phase === 'error' ? (
                  <div style={{ background: '#1c0505', border: '1px solid #7f1d1d', borderRadius: '12px', padding: '14px', color: '#fca5a5', fontSize: '13px', marginBottom: '18px' }}>
                    {importModal.error || 'Falha ao ler o arquivo.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>

                    {/* Etapa 1 — Firebase */}
                    <div style={{ background: S.input, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: S.text, fontWeight: 700, fontSize: '13px' }}>
                          {importModal.fbDone >= importModal.fbTotal
                            ? <CheckCircle2 size={15} color="#34d399" />
                            : <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }} style={{ display: 'flex' }}><RefreshCw size={14} color={S.blue} /></motion.div>}
                          1. Salvando no Firebase
                        </span>
                        <span style={{ color: S.muted2, fontSize: '12px', fontWeight: 700 }}>{importModal.fbDone}/{importModal.fbTotal}</span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '999px', background: S.card, overflow: 'hidden' }}>
                        <motion.div animate={{ width: `${importModal.fbTotal ? Math.round((importModal.fbDone / importModal.fbTotal) * 100) : 0}%` }}
                          style={{ height: '100%', borderRadius: '999px', background: S.gradient }} />
                      </div>
                    </div>

                    {/* Etapa 2 — Planilha */}
                    <div style={{ background: S.input, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '14px 16px', opacity: importModal.phase === 'firebase' ? 0.55 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: S.text, fontWeight: 700, fontSize: '13px' }}>
                          {importModal.phase === 'done'
                            ? <CheckCircle2 size={15} color="#34d399" />
                            : importModal.phase === 'sheet'
                              ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }} style={{ display: 'flex' }}><RefreshCw size={14} color="#34d399" /></motion.div>
                              : <Clock size={14} color={S.muted} />}
                          2. Enviando para a planilha
                        </span>
                        {importModal.phase === 'sheet' && importModal.sheetTotal > 0 && (
                          <span style={{ color: S.muted2, fontSize: '12px', fontWeight: 700 }}>{importModal.sheetDone || 0}/{importModal.sheetTotal}</span>
                        )}
                      </div>
                      {importModal.phase === 'done' && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: S.muted2 }}>
                          {(() => {
                            const s = importModal.sheet;
                            const n = s && (s.total != null ? s.total : (s.added != null ? s.added : s.count));
                            return n != null
                              ? <><strong style={{ color: '#34d399' }}>{n}</strong> O.S gravadas na planilha</>
                              : 'Enviado para a planilha.';
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Resumo final */}
                    {importModal.phase === 'done' && (
                      <div style={{ textAlign: 'center', color: S.muted2, fontSize: '13px' }}>
                        <strong style={{ color: '#34d399' }}>{importModal.fbDone}</strong> O.S salvas no Firebase
                        {importModal.fbErrors > 0 && <span style={{ color: '#f87171' }}> · {importModal.fbErrors} falharam</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* Botão fechar (só quando termina) */}
                {(importModal.phase === 'done' || importModal.phase === 'error') && (
                  <button onClick={() => setImportModal(null)}
                    style={{ width: '100%', padding: '13px', borderRadius: '12px', background: importModal.phase === 'error' ? 'linear-gradient(135deg,#b91c1c,#ef4444)' : 'linear-gradient(135deg,#047857,#10b981)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Check size={16} />Fechar
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL — ADICIONAR TÉCNICO */}
      <AnimatePresence>
        {showAddCollab && (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '400px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', padding: 'clamp(16px,5vw,28px)', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: S.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserPlus size={20} color={S.blue} />
                  </div>
                  <div>
                    <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>Novo Técnico</div>
                    <div style={{ color: S.muted, fontSize: '12px', marginTop: '2px' }}>Será adicionado à lista da equipe de Redes</div>
                  </div>
                </div>
                <button onClick={() => { setShowAddCollab(false); setNewCollabName(''); }} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', padding: '4px' }}>
                  <X size={18} />
                </button>
              </div>
              <DarkInput S={S} type="text" value={newCollabName} onChange={e => setNewCollabName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveCollab()}
                placeholder="Nome do técnico (ex: GETÚLIO)" autoFocus style={{ marginBottom: '16px' }} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => { setShowAddCollab(false); setNewCollabName(''); }}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={handleSaveCollab} disabled={savingCollab || !newCollabName.trim()}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', background: S.gradient, border: 'none', color: S.onAccent, fontSize: '14px', fontWeight: 700, cursor: savingCollab || !newCollabName.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: savingCollab || !newCollabName.trim() ? 0.5 : 1 }}>
                  {savingCollab ? 'Adicionando…' : <><Plus size={15} />Adicionar</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL — FECHAR O.S */}
      <AnimatePresence>
        {closeModal && (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '440px', background: S.surface, border: '1px solid #065f46', borderRadius: '20px', padding: 'clamp(16px,5vw,28px)', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#0d2d1f', border: '1px solid #065f46', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={20} color="#10b981" />
                </div>
                <div>
                  <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>Fechar O.S #{closeModal.idOs}</div>
                  <div style={{ color: S.muted, fontSize: '12px', marginTop: '2px' }}>{closeModal.tecnico} · Aberta em {fmtDate(closeModal.dataAbertura)}</div>
                </div>
                <button onClick={() => { setCloseModal(null); setClosingDate(''); setClosingTime(''); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: S.muted, cursor: 'pointer', padding: '4px' }}>
                  <X size={18} />
                </button>
              </div>

              <FieldLabel S={S}>Data e Horário de Encerramento</FieldLabel>
              <div className="r-form-row" style={{ marginBottom: '12px' }}>
                <DarkInput S={S} type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)} style={{ colorScheme: mode, cursor: 'pointer' }} onClick={e => { try { e.target.showPicker(); } catch { /* */ } }} />
                <DarkInput S={S} type="time" value={closingTime} onChange={e => setClosingTime(e.target.value)} style={{ colorScheme: mode, cursor: 'pointer' }} placeholder="Horário" />
              </div>

              {closingDate && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '10px', background: '#052e16', border: '1px solid #166534' }}>
                  {(() => {
                    const h = calcSla(closeModal.dataAbertura, closeModal.horaAbertura, closingDate, closingTime);
                    const s = SLA_BADGE[slaStatus(h)];
                    return <span style={{ color: s.color, fontWeight: 700, fontSize: '13px' }}>SLA: {h}h — {s.label}</span>;
                  })()}
                </motion.div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => { setCloseModal(null); setClosingDate(''); setClosingTime(''); }} disabled={closingSaving}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={handleCloseOs} disabled={closingSaving || !closingDate}
                  style={{ flex: 2, padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg,#047857,#10b981)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: closingSaving || !closingDate ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: closingSaving || !closingDate ? 0.7 : 1 }}>
                  {closingSaving ? 'Fechando…' : <><Check size={15} />Confirmar Fechamento</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL — CONFIRMAR EXCLUSÃO DE O.S */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '400px', background: S.surface, border: `1px solid #7f1d1d`, borderRadius: '20px', padding: 'clamp(16px,5vw,28px)', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#2d0f0f', border: '1px solid #7f1d1d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={22} color="#f87171" />
                </div>
                <div>
                  <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>Remover O.S</div>
                  <div style={{ color: S.muted, fontSize: '12px', marginTop: '2px' }}>Esta ação não pode ser desfeita</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setDeleteConfirm(null)}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={() => handleDelete(deleteConfirm)}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg,#b91c1c,#ef4444)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Trash2 size={15} />Remover
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL — CONFIRMAR EXCLUSÃO DE TÉCNICO */}
      <AnimatePresence>
        {deleteCollabConfirm && (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '400px', background: S.surface, border: `1px solid #7f1d1d`, borderRadius: '20px', padding: 'clamp(16px,5vw,28px)', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#2d0f0f', border: '1px solid #7f1d1d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={22} color="#f87171" />
                </div>
                <div>
                  <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>Remover Técnico</div>
                  <div style={{ color: '#f87171', fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>{deleteCollabConfirm?.name}</div>
                </div>
              </div>
              <p style={{ color: S.muted2, fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
                O técnico será removido da lista. As O.S já registradas por ele não serão afetadas.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setDeleteCollabConfirm(null)}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={() => handleDeleteCollab(deleteCollabConfirm.id)}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg,#b91c1c,#ef4444)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Trash2 size={15} />Remover
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
