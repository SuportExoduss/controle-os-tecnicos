import { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { logoutUser } from '../../services/auth/authService';
import { getReportsByTechnician, deleteAllReportsByTechnician, deleteAllReportsByDate, upsertDailyReport, getReportsByDateRaw } from '../../services/database/reportService';
import { getCollaborators, addCollaborator, deleteCollaborator } from '../../services/database/collaboratorService';
import { Spinner } from '../../components/common/Spinner';
import { ProgressOverlay } from '../../components/common/ProgressOverlay';
import { AreaTopbar } from '../../components/common/AreaTopbar';
import { toast } from 'react-hot-toast';
import { AuthContext } from '../../context/AuthContext';
import { getCurrentTime } from '../../utils/formatTime';
import { LogOut, LayoutDashboard, ChevronDown, Plus, UserPlus, CheckCircle2, ListChecks, X, CalendarDays, RotateCcw, ClipboardList, ArrowRight, Check, Trash2, Upload, FileSpreadsheet, AlertCircle, Sun, Moon } from 'lucide-react';
import { ThemeContext } from '../../context/ThemeContext';
import { parseExcelFile } from '../../services/reports/importService';
import { syncReportToSheet, zeroDayInSheet, zeroTechnicianInSheet } from '../../services/integrations/sheetSync';

const localDate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const SERVICE_TYPES = [
  'INSTALAÇÃO FIBRA','MANUTENÇÃO FIBRA','MUDANÇA DE ENDEREÇO','MUDANÇA DE PONTO',
  'INSTALAÇÃO WI-BINET','REPARO WI-BINET','INSTALAÇÃO TV','REPARO TV',
  'OS AMPLIAÇÃO','VISTORIA','FONTE QUEIMADA','TROCA DE EQUIPAMENTO',
  'SINAL ALTO','REINCIDÊNCIA','IMPRODUTIVA',
];
const SVC_STYLE = {
  'INSTALAÇÃO FIBRA':     { bg:'#0f1d2d', color:'#60a5fa', border:'#1e3a5f' },
  'MANUTENÇÃO FIBRA':     { bg:'#0f2320', color:'#2dd4bf', border:'#134e4a' },
  'MUDANÇA DE ENDEREÇO':  { bg:'#1a2010', color:'#86efac', border:'#166534' },
  'MUDANÇA DE PONTO':     { bg:'#0f1f2a', color:'#7dd3fc', border:'#0c4a6e' },
  'INSTALAÇÃO WI-BINET':  { bg:'#12103a', color:'#818cf8', border:'#312e81' },
  'REPARO WI-BINET':      { bg:'#101828', color:'#67e8f9', border:'#164e63' },
  'INSTALAÇÃO TV':        { bg:'#0f1a2e', color:'#38bdf8', border:'#0c4a6e' },
  'REPARO TV':            { bg:'#1a1020', color:'#e879f9', border:'#701a75' },
  'OS AMPLIAÇÃO':         { bg:'#1a1500', color:'#fde68a', border:'#92400e' },
  'VISTORIA':             { bg:'#2a1f00', color:'#fbbf24', border:'#78350f' },
  'FONTE QUEIMADA':       { bg:'#2a1000', color:'#fb923c', border:'#7c2d12' },
  'TROCA DE EQUIPAMENTO': { bg:'#1a0f2e', color:'#c084fc', border:'#4c1d95' },
  'SINAL ALTO':           { bg:'#1a2010', color:'#4ade80', border:'#166534' },
  'REINCIDÊNCIA':         { bg:'#2d1010', color:'#fca5a5', border:'#991b1b' },
  'IMPRODUTIVA':          { bg:'#111827', color:'#6b7280', border:'#374151' },
};

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
const DarkInput = ({ S, style = {}, ...props }) => (
  <input style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s', ...style }}
    onFocus={e => e.target.style.borderColor = S.blue}
    onBlur={e => e.target.style.borderColor = S.border}
    {...props} />
);

export const Admin = () => {
  const { S, mode, toggleTheme } = useContext(ThemeContext);

  const [formData, setFormData] = useState({ technicianName: '', totalOrders: '', rescheduled: false, rescheduledCount: '', observations: '', date: localDate() });
  const [collaborators, setCollaborators] = useState([]);
  const [loadingCollabs, setLoadingCollabs] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showAddCollab, setShowAddCollab] = useState(false);
  const [newCollabName, setNewCollabName] = useState('');
  const [savingCollab, setSavingCollab] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [tempServices, setTempServices] = useState([]);
  const [showWizard, setShowWizard] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [deletingDay, setDeletingDay] = useState(false);
  const [showDeleteDay, setShowDeleteDay] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { user, profile } = useContext(AuthContext);

  // Status dos técnicos: nomes com O.S hoje e ontem
  const [todayDone, setTodayDone] = useState(new Set());
  const [showSaved, setShowSaved] = useState(false);
  const [savedName, setSavedName] = useState('');
  const [techSearch, setTechSearch] = useState('');
  const [statusLoading, setStatusLoading] = useState(true);

  const fetchStatus = async (refDate) => {
    setStatusLoading(true);
    try {
      const snap = await getReportsByDateRaw(refDate);
      const done = new Set(snap.docs.filter(d => (d.data().totalOrders || 0) > 0).map(d => d.data().technicianName));
      setTodayDone(done);
    } catch (err) { console.error('status', err); }
    finally { setStatusLoading(false); }
  };

  // verde = feito | amarelo = pendente HOJE | vermelho = faltou em dia PASSADO
  const techStatus = (name) => {
    if (statusLoading) return { color: '#475569', label: 'Carregando...' };
    if (todayDone.has(name)) return { color: '#22c55e', label: 'Feito neste dia' };
    const isToday = formData.date === localDate();
    if (isToday) return { color: '#f59e0b', label: 'Pendente hoje' };
    return { color: '#ef4444', label: 'Não registrado neste dia' };
  };
  useEffect(() => {
    const h = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const fetchCollaborators = async () => {
    try { const s = await getCollaborators(); setCollaborators(s.docs.map(d => ({ id: d.id, ...d.data() }))); }
    catch { toast.error('Erro ao carregar colaboradores'); }
    finally { setLoadingCollabs(false); }
  };

  useEffect(() => { fetchCollaborators(); }, []);
  // Recalcula status sempre que a data selecionada muda
  useEffect(() => { if (formData.date) fetchStatus(formData.date); }, [formData.date]);

  const handleDeleteCollab = async (id, name) => {
    if (!window.confirm(`Remover "${name}" e todos os relatórios dele?`)) return;
    try {
      await Promise.all([
        deleteCollaborator(id),
        deleteAllReportsByTechnician(name),
      ]);
      zeroTechnicianInSheet(name); // zera linhas na planilha (best-effort)
      if (formData.technicianName === name) setFormData(p => ({ ...p, technicianName: '' }));
      await fetchCollaborators();
      toast.success('Colaborador e relatórios removidos');
    } catch { toast.error('Erro ao remover'); }
  };

  const handleSaveCollab = async () => {
    if (!newCollabName.trim()) return;
    setSavingCollab(true);
    try {
      await addCollaborator(newCollabName);
      toast.success('Colaborador adicionado!');
      setNewCollabName(''); setShowAddCollab(false);
      await fetchCollaborators();
    } catch { toast.error('Erro ao adicionar colaborador'); }
    finally { setSavingCollab(false); }
  };

  const handleLogout = async () => { try { await logoutUser(); navigate('/fibra/login'); } catch { toast.error('Erro ao sair'); } };
  const handleChange = (e) => { const { name, value, type, checked } = e.target; setFormData(p => ({ ...p, [name]: type === 'checkbox' ? checked : value })); };
  const handleOpenWizard = () => {
    if (!formData.technicianName) { toast.error('Selecione um técnico'); return; }
    const qty = parseInt(formData.totalOrders);
    if (!qty || qty < 1) { toast.error('Informe a quantidade de O.S'); return; }
    setTempServices([]); setWizardStep(0); setShowWizard(true);
  };

  const handleSelectService = (svc) => {
    const updated = [...tempServices, svc];
    const next = wizardStep + 1;
    setTempServices(updated);
    if (next === parseInt(formData.totalOrders)) { setShowWizard(false); setShowConfirmation(true); }
    else setWizardStep(next);
  };
  const handleConfirm = async () => {
    setLoading(true);
    try {
      const existing = await getReportsByTechnician(formData.technicianName, formData.date);
      if (existing.docs.length > 0) {
        const existingRecord = existing.docs[0].data();
        const hasData = (existingRecord.totalOrders || 0) > 0 || (existingRecord.serviceTypes || []).length > 0;
        if (hasData) {
          if (!window.confirm(`Já existe registro para ${formData.technicianName} nesta data. Deseja sobrescrever?`)) { setLoading(false); return; }
        }
        // Se existente tem 0 O.S → atualiza silenciosamente
      }
      // upsert: substitui o registro do mesmo técnico+data (não duplica)
      await upsertDailyReport({
        technicianName: formData.technicianName, totalOrders: parseInt(formData.totalOrders),
        rescheduled: formData.rescheduled,
        rescheduledCount: formData.rescheduled ? parseInt(formData.rescheduledCount || 0) : 0,
        observations: formData.observations, serviceTypes: tempServices,
        date: formData.date, submissionTime: getCurrentTime(),
        createdByNickname: profile?.nickname || 'Desconhecido',
        createdByEmail: user?.email || '',
        createdByUid: user?.uid || '',
      });
      // Envia para a planilha do Google (não bloqueia se falhar)
      syncReportToSheet({
        technicianName: formData.technicianName,
        date: formData.date,
        rescheduledCount: formData.rescheduled ? parseInt(formData.rescheduledCount || 0) : 0,
        observations: formData.observations,
        serviceTypes: tempServices,
      });
      toast.success('Relatório salvo com sucesso!');
      setSavedName(formData.technicianName);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2200);
      const savedDate = formData.date;
      // Mantém a data escolhida para lançar vários relatórios do mesmo dia em sequência.
      // Só volta para "hoje" quando o usuário trocar manualmente ou recarregar (F5).
      setFormData({ technicianName: '', totalOrders: '', rescheduled: false, rescheduledCount: '', observations: '', date: savedDate });
      setTempServices([]); setWizardStep(0); setShowConfirmation(false);
      fetchStatus(savedDate);
    } catch (err) { toast.error('Erro ao salvar relatório'); console.error(err); }
    finally { setLoading(false); }
  };

const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const result = await parseExcelFile(file);
      setImportData(result);
      setShowImport(true);
    } catch (err) {
      toast.error('Erro ao ler arquivo: ' + err.message);
    } finally {
      setImportLoading(false);
      e.target.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!importData) return;
    setImporting(true);
    setImportProgress(0);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const total = importData.records.length;
    try {
      for (let i = 0; i < total; i++) {
        try {
          const res = await upsertDailyReport(importData.records[i]);
          if (res === 'created') created++; else updated++;
        } catch { skipped++; }
        setImportProgress(Math.round(((i + 1) / total) * 100));
      }
      toast.success(`Importação concluída! ${created} novos, ${updated} atualizados${skipped > 0 ? `, ${skipped} ignorados` : ''}.`);
      setShowImport(false);
      setImportData(null);
      if (formData.date) fetchStatus(formData.date);
    } catch (err) {
      toast.error('Erro na importação');
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteDay = async () => {
    setDeletingDay(true);
    try {
      const n = await deleteAllReportsByDate(formData.date);
      zeroDayInSheet(formData.date); // zera linhas na planilha (best-effort)
      toast.success(`${n} relatório(s) de ${new Date(formData.date + 'T00:00:00').toLocaleDateString('pt-BR')} apagados`);
      setShowDeleteDay(false);
      fetchStatus(formData.date);
    } catch (err) {
      toast.error('Erro ao apagar os relatórios do dia');
      console.error(err);
    } finally {
      setDeletingDay(false);
    }
  };

  const totalQty = parseInt(formData.totalOrders) || 0;
  const canConfigure = formData.technicianName && totalQty >= 1;
  // Modo "folga/ausência" — quantidade digitada explicitamente como 0
  const isZeroMode = formData.technicianName && formData.totalOrders !== '' && totalQty === 0;

  const handleZeroSubmit = () => {
    if (!formData.observations.trim()) {
      toast.error('Explique o motivo das 0 ordens (ex: férias, atestado, folga)');
      return;
    }
    setTempServices([]);
    setShowConfirmation(true);
  };

  // Atalho: marca o técnico selecionado como FOLGA (registro zerado + obs "Folga").
  // Grava no Firestore e espelha na planilha. Não passa pelo wizard.
  const handleFolga = async () => {
    if (!formData.technicianName) { toast.error('Selecione um técnico para marcar folga'); return; }
    setLoading(true);
    try {
      const existing = await getReportsByTechnician(formData.technicianName, formData.date);
      if (existing.docs.length > 0) {
        const ex = existing.docs[0].data();
        const hasData = (ex.totalOrders || 0) > 0 || (ex.serviceTypes || []).length > 0;
        if (hasData && !window.confirm(`Já existe registro com O.S para ${formData.technicianName} nesta data. Marcar folga vai zerar. Continuar?`)) { setLoading(false); return; }
      }
      await upsertDailyReport({
        technicianName: formData.technicianName, totalOrders: 0,
        rescheduled: false, rescheduledCount: 0,
        observations: 'Folga', serviceTypes: [],
        date: formData.date, submissionTime: getCurrentTime(),
        createdByNickname: profile?.nickname || 'Desconhecido',
        createdByEmail: user?.email || '', createdByUid: user?.uid || '',
      });
      syncReportToSheet({
        technicianName: formData.technicianName, date: formData.date,
        rescheduledCount: 0, observations: 'Folga', serviceTypes: [],
      });
      toast.success(`Folga registrada para ${formData.technicianName}`);
      setSavedName(formData.technicianName); setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2200);
      const savedDate = formData.date;
      setFormData({ technicianName: '', totalOrders: '', rescheduled: false, rescheduledCount: '', observations: '', date: savedDate });
      setTempServices([]); setWizardStep(0); setShowConfirmation(false);
      fetchStatus(savedDate);
    } catch (err) { toast.error('Erro ao registrar folga'); console.error(err); }
    finally { setLoading(false); }
  };
  const progress = totalQty > 0 ? (tempServices.length / totalQty) * 100 : 0;
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', background: S.bg }}>

      <AreaTopbar
        S={S}
        mode={mode}
        area="fibra"
        variant="admin"
        isLogged
        nickname={profile?.nickname}
        onTheme={toggleTheme}
        onPrimary={() => navigate('/fibra/dashboard')}
        onAuth={handleLogout}
        rightSlot={(
          <label className="area-action-btn" style={{ borderColor: S.border, color: S.blue, cursor: importLoading ? 'wait' : 'pointer' }}>
            {importLoading ? <Spinner /> : <><Upload size={14}/><span className="r-topbar-label">Importar Excel</span></>}
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        )}
      />

      {/* MAIN */}
      <main style={{ flex: 1, width: '100%' }} className="r-page-pad r-maxw">
        {/* Banner de cobertura */}
        {(() => {
          const total = collaborators.length;
          const done = collaborators.filter(c => todayDone.has(c.name)).length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const isToday = formData.date === localDate();
          const barColor = pct === 100 ? '#22c55e' : pct >= 60 ? '#3b82f6' : pct >= 30 ? '#f59e0b' : '#ef4444';
          return (
            <Glass S={S} style={{ padding: '14px 18px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: `${barColor}22`, border: `1px solid ${barColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={17} color={barColor} />
                  </div>
                  <div>
                    <div style={{ color: S.text, fontWeight: 800, fontSize: '15px' }}>
                      {done} de {total} registrados {statusLoading ? '...' : ''}
                    </div>
                    <div style={{ color: S.muted2, fontSize: '12px' }}>
                      {isToday ? 'Hoje' : new Date(formData.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      {done < total ? ` · faltam ${total - done}` : ' · todos concluíram! 🎉'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '140px', maxWidth: '320px' }}>
                  <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: S.input, overflow: 'hidden' }}>
                    <motion.div animate={{ width: `${pct}%` }} style={{ height: '100%', borderRadius: '999px', background: barColor }} />
                  </div>
                  <span style={{ color: barColor, fontWeight: 800, fontSize: '14px', minWidth: '38px', textAlign: 'right' }}>{pct}%</span>
                </div>
              </div>
            </Glass>
          );
        })()}
        <div className="r-admin-grid">

          {/* FORM */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Glass S={S} style={{ overflow: 'hidden' }}>
              {/* Card header */}
              <div style={{ padding: '24px 28px', background: mode === 'light' ? 'linear-gradient(135deg, #dbeafe 0%, #eceef4 100%)' : 'linear-gradient(135deg, #0d1e3d 0%, #0f1117 100%)', borderBottom: `1px solid ${S.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ClipboardList size={18} color={S.blue} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: S.text, fontWeight: 800, fontSize: '18px' }}>Registrar O.S do Dia</div>
                      <div style={{ color: S.blue, fontSize: '13px', marginTop: '2px' }}>Preencha os dados da produção diária</div>
                    </div>
                  </div>
                  {/* Atalho Folga — fica notável após escolher o técnico */}
                  <button type="button" onClick={handleFolga} disabled={!formData.technicianName || loading}
                    title="Marcar o técnico selecionado como folga (zerado + observação Folga)"
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: '9px', fontSize: '12px', fontWeight: 700, cursor: (formData.technicianName && !loading) ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', transition: 'all 0.2s',
                      border: `1px solid ${formData.technicianName ? S.red : S.border}`,
                      background: formData.technicianName ? 'rgba(239,68,68,0.15)' : 'transparent',
                      color: formData.technicianName ? S.red : S.muted,
                      boxShadow: formData.technicianName ? '0 0 14px rgba(239,68,68,0.35)' : 'none',
                      opacity: formData.technicianName ? 1 : 0.6 }}>
                    <CalendarDays size={14}/>Folga
                  </button>
                </div>
              </div>

              <div style={{ padding: 'clamp(16px, 5vw, 28px)', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* Técnico */}
                <div>
                  <FieldLabel S={S}>Técnico <span style={{ color: S.red }}>*</span></FieldLabel>
                  {/* Legenda de status */}
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {[
                      { c: '#22c55e', t: 'Feito' },
                      { c: '#f59e0b', t: 'Pendente hoje' },
                      { c: '#ef4444', t: 'Faltou (dia passado)' },
                    ].map(({ c, t }) => (
                      <span key={t} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: S.muted2 }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c, boxShadow: `0 0 5px ${c}` }} />{t}
                      </span>
                    ))}
                  </div>
                  <div style={{ position: 'relative' }} ref={dropdownRef}>
                    <button type="button" onClick={() => setDropdownOpen(!dropdownOpen)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '10px', background: S.input, border: `1px solid ${dropdownOpen ? S.blue : S.border}`, color: formData.technicianName ? S.text : S.muted, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', boxSizing: 'border-box' }}>
                      <span>{formData.technicianName || 'Selecione o técnico...'}</span>
                      <ChevronDown size={15} style={{ color: S.muted, transition: 'transform 0.2s', transform: dropdownOpen ? 'rotate(180deg)' : 'none' }} />
                    </button>
                    <AnimatePresence>
                      {dropdownOpen && (
                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}
                          style={{ position: 'absolute', zIndex: 20, width: '100%', marginTop: '4px', borderRadius: '12px', background: S.surface, border: `1px solid ${S.border}`, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
                          {loadingCollabs ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><Spinner /></div>
                          ) : collaborators.length === 0 ? (
                            <button type="button" onClick={() => { setDropdownOpen(false); setShowAddCollab(true); }}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', background: 'none', border: 'none', color: S.blue, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#0d1d3a'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                              <UserPlus size={16} />Criar primeiro colaborador
                            </button>
                          ) : (
                            <>
                            {/* Campo de busca */}
                            <div style={{ padding: '10px', borderBottom: `1px solid ${S.border}` }}>
                              <input autoFocus value={techSearch} onChange={e => setTechSearch(e.target.value)}
                                placeholder="Buscar técnico..."
                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                onFocus={e => e.target.style.borderColor = S.blue}
                                onBlur={e => e.target.style.borderColor = S.border} />
                            </div>
                            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                              {collaborators.filter(c => c.name.toLowerCase().includes(techSearch.toLowerCase())).length === 0 ? (
                                <div style={{ padding: '16px', textAlign: 'center', color: S.muted, fontSize: '13px' }}>Nenhum técnico encontrado</div>
                              ) : collaborators.filter(c => c.name.toLowerCase().includes(techSearch.toLowerCase())).map(c => {
                                const st = techStatus(c.name);
                                return (
                                <button key={c.id} type="button" onClick={() => { setFormData(p => ({ ...p, technicianName: c.name })); setDropdownOpen(false); setTechSearch(''); }}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: formData.technicianName === c.name ? '#0d1d3a' : 'none', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#0d1d3a'}
                                  onMouseLeave={e => e.currentTarget.style.background = formData.technicianName === c.name ? '#0d1d3a' : 'none'}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: st.color, flexShrink: 0, boxShadow: `0 0 6px ${st.color}` }} title={st.label} />
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: S.accentSoft, color: S.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>{c.name.charAt(0)}</div>
                                    <span style={{ color: formData.technicianName === c.name ? S.blue : S.text, fontSize: '14px', fontWeight: formData.technicianName === c.name ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                                  </div>
                                  {formData.technicianName === c.name && <Check size={14} color={S.blue} style={{ flexShrink: 0 }} />}
                                </button>
                              );})}
                            </div>
                            </>
                          )}
                          {collaborators.length > 0 && (
                            <div style={{ borderTop: `1px solid ${S.border}` }}>
                              <button type="button" onClick={() => { setDropdownOpen(false); setShowAddCollab(true); }}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'none', border: 'none', color: S.blue, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#0d1d3a'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                <Plus size={14} />Adicionar colaborador
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Data + Qtd */}
                <div className="r-form-row">
                  <div>
                    <FieldLabel S={S}><span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><CalendarDays size={11}/>Data</span></FieldLabel>
                    <DarkInput S={S} type="date" name="date" value={formData.date} onChange={handleChange} onClick={e => { try { e.target.showPicker(); } catch { /* ignora */ } }} style={{ colorScheme: mode, cursor: 'pointer', borderColor: formData.date !== localDate() ? S.orange : undefined }} />
                    {formData.date !== localDate() && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px', fontSize: '11px', fontWeight: 600, color: S.orange }}>
                        <CalendarDays size={11}/>Lançando para {new Date(formData.date + 'T00:00:00').toLocaleDateString('pt-BR')} · a data fica fixa até você trocar ou recarregar
                      </div>
                    )}
                    <button type="button" onClick={() => setShowDeleteDay(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '8px', padding: '4px 0', background: 'none', border: 'none', color: S.muted, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.color = S.red}
                      onMouseLeave={e => e.currentTarget.style.color = S.muted}>
                      <Trash2 size={11}/>Apagar todos os relatórios deste dia
                    </button>
                  </div>
                  <div>
                    <FieldLabel S={S}>Quantidade de O.S <span style={{ color: S.red }}>*</span></FieldLabel>
                    <DarkInput S={S} type="number" name="totalOrders" value={formData.totalOrders} onChange={handleChange} min="1" max="50" placeholder="Ex: 8" />
                  </div>
                </div>

                {/* Reagendamento */}
                <div onClick={() => setFormData(p => ({ ...p, rescheduled: !p.rescheduled }))}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '10px', cursor: 'pointer', userSelect: 'none', transition: 'all 0.2s', background: formData.rescheduled ? '#1c1000' : S.input, border: `1px solid ${formData.rescheduled ? '#78350f' : S.border}` }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '6px', border: `2px solid ${formData.rescheduled ? S.orange : S.muted}`, background: formData.rescheduled ? S.orange : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
                    {formData.rescheduled && <Check size={12} color="white" />}
                  </div>
                  <RotateCcw size={15} color={formData.rescheduled ? S.orange : S.muted} />
                  <span style={{ color: formData.rescheduled ? '#fcd34d' : S.muted2, fontSize: '14px', fontWeight: 500 }}>Houve reagendamento?</span>
                </div>

                <AnimatePresence>
                  {formData.rescheduled && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                      <FieldLabel S={S}>Quantidade de Reagendamentos</FieldLabel>
                      <DarkInput S={S} type="number" name="rescheduledCount" value={formData.rescheduledCount} onChange={handleChange} min="0" placeholder="Ex: 2" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Observações */}
                <div>
                  <FieldLabel S={S}>{isZeroMode ? 'Motivo das 0 ordens *' : 'Observações'}</FieldLabel>
                  <textarea name="observations" value={formData.observations} onChange={handleChange}
                    placeholder={isZeroMode ? 'Ex: férias, atestado, folga, dia sem produção...' : 'Observações adicionais (opcional)'} rows={3}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: S.input, border: `1px solid ${isZeroMode ? '#b45309' : S.border}`, color: S.text, fontSize: '14px', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = isZeroMode ? '#f59e0b' : S.blue}
                    onBlur={e => e.target.style.borderColor = isZeroMode ? '#b45309' : S.border} />
                </div>

                {/* Serviços tags */}
                <AnimatePresence>
                  {tempServices.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ padding: '16px', borderRadius: '10px', background: S.input, border: `1px solid ${S.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ color: S.blue, fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                          <ListChecks size={13} style={{ display: 'inline', marginRight: '5px' }} />
                          Serviços ({tempServices.length}/{totalQty})
                        </span>
                        <button onClick={handleOpenWizard} style={{ color: S.blue, fontSize: '12px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Refazer</button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {tempServices.map((svc, i) => {
                          const c = SVC_STYLE[svc] || { bg:'#111', color:S.muted2, border:S.border };
                          return <motion.span key={i} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '999px', background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontWeight: 600 }}>{i+1}. {svc}</motion.span>;
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* CTA Button */}
                <button type="button"
                  onClick={tempServices.length > 0 ? () => setShowConfirmation(true) : isZeroMode ? handleZeroSubmit : handleOpenWizard}
                  disabled={!canConfigure && !isZeroMode}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: (canConfigure || isZeroMode) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s',
                    background: (!canConfigure && !isZeroMode) ? S.card2 : tempServices.length > 0 ? 'linear-gradient(135deg, #059669, #10b981)' : isZeroMode ? 'linear-gradient(135deg, #b45309, #f59e0b)' : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                    opacity: (!canConfigure && !isZeroMode) ? 0.4 : 1,
                    boxShadow: (canConfigure || isZeroMode) ? (tempServices.length > 0 ? '0 0 24px rgba(16,185,129,0.25)' : isZeroMode ? '0 0 24px rgba(245,158,11,0.25)' : '0 0 24px rgba(99,102,241,0.25)') : 'none',
                  }}>
                  {tempServices.length > 0
                    ? <><CheckCircle2 size={17}/>Revisar e Salvar</>
                    : isZeroMode
                      ? <><ListChecks size={17}/>Explicar Motivo <ArrowRight size={14}/></>
                      : <><ListChecks size={17}/>Configurar Tipos de Serviço <ArrowRight size={14}/></>}
                </button>
              </div>
            </Glass>
          </motion.div>

          {/* SIDE */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Resumo */}
            <Glass S={S} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <ListChecks size={15} color={S.blue} />
                <span style={{ color: S.text, fontWeight: 700, fontSize: '13px' }}>Resumo do Registro</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label:'Técnico', value: formData.technicianName || '—' },
                  { label:'Data', value: formData.date ? new Date(formData.date+'T00:00:00').toLocaleDateString('pt-BR') : '—' },
                  { label:'Total O.S', value: formData.totalOrders || '—', accent: S.blue },
                  { label:'Reagendamentos', value: formData.rescheduled ? (formData.rescheduledCount || '0') : '—', accent: formData.rescheduled ? S.orange : null },
                ].map(({ label, value, accent }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: S.muted, fontSize: '13px' }}>{label}</span>
                    <span style={{ color: accent || S.muted2, fontSize: accent && label === 'Total O.S' ? '18px' : '13px', fontWeight: 700 }}>{value}</span>
                  </div>
                ))}
              </div>
              {totalQty > 0 && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${S.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: S.muted, marginBottom: '6px' }}>
                    <span>Serviços configurados</span>
                    <span style={{ color: S.text, fontWeight: 700 }}>{tempServices.length}/{totalQty}</span>
                  </div>
                  <div style={{ height: '4px', borderRadius: '4px', background: S.card2, overflow: 'hidden' }}>
                    <motion.div style={{ height: '100%', borderRadius: '4px', background: progress === 100 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #3b82f6, #818cf8)' }}
                      animate={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </Glass>

            {/* Colaboradores */}
            <Glass S={S} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserPlus size={15} color={S.blue} />
                  <span style={{ color: S.text, fontWeight: 700, fontSize: '13px' }}>Colaboradores</span>
                  <span style={{ background: S.accentSoft, color: S.accent, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px' }}>{collaborators.length}</span>
                </div>
              </div>

              {collaborators.length === 0 ? (
                <p style={{ color: S.muted, fontSize: '12px', marginBottom: '12px' }}>Nenhum colaborador cadastrado.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px', maxHeight: '180px', overflowY: 'auto' }}>
                  {collaborators.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', background: S.input, border: `1px solid ${S.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: S.accentSoft, color: S.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>{c.name.charAt(0)}</div>
                        <span style={{ color: S.muted2, fontSize: '13px', fontWeight: 500 }}>{c.name}</span>
                      </div>
                      <button onClick={() => handleDeleteCollab(c.id, c.name)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', padding: '4px', borderRadius: '6px', display: 'flex', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.color = S.red; e.currentTarget.style.background = '#2d0f0f'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = 'none'; }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

<button onClick={() => setShowAddCollab(true)}
                style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'transparent', border: `1px dashed ${S.accent}`, color: S.blue, fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s', marginBottom: '6px' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#0d1d3a'; e.currentTarget.style.borderStyle = 'solid'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderStyle = 'dashed'; }}>
                <Plus size={14} />Adicionar colaborador
              </button>
            </Glass>
          </motion.div>
        </div>
      </main>

      {/* OVERLAY helper */}
      {(showAddCollab || showWizard || showConfirmation) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 49 }} />
      )}

      {/* MODAL — ADICIONAR COLABORADOR */}
      <AnimatePresence>
        {showAddCollab && (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '400px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', padding: 'clamp(16px, 5vw, 28px)', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: S.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserPlus size={20} color={S.blue} />
                  </div>
                  <div>
                    <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>Novo Colaborador</div>
                    <div style={{ color: S.muted, fontSize: '12px', marginTop: '2px' }}>Será adicionado à lista de técnicos</div>
                  </div>
                </div>
                <button onClick={() => { setShowAddCollab(false); setNewCollabName(''); }} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', padding: '4px' }}>
                  <X size={18} />
                </button>
              </div>
              <DarkInput S={S} type="text" value={newCollabName} onChange={e => setNewCollabName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveCollab()} placeholder="Nome do colaborador" autoFocus style={{ marginBottom: '16px' }} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => { setShowAddCollab(false); setNewCollabName(''); }}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={handleSaveCollab} disabled={savingCollab || !newCollabName.trim()}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: savingCollab || !newCollabName.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: savingCollab || !newCollabName.trim() ? 0.5 : 1 }}>
                  {savingCollab ? <Spinner /> : <><Plus size={15}/>Adicionar</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WIZARD MODAL */}
      <AnimatePresence>
        {showWizard && (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '460px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Wizard header — fixo */}
              <div style={{ padding: '24px 28px', background: 'linear-gradient(135deg, #0d1e3d, #080b14)', borderBottom: `1px solid ${S.border}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ color: '#3b82f660', fontSize: '12px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Selecionando serviços</span>
                  <span style={{ background: 'rgba(59,130,246,0.15)', color: S.blue, fontSize: '12px', fontWeight: 800, padding: '3px 10px', borderRadius: '999px', border: '1px solid rgba(59,130,246,0.2)' }}>{wizardStep + 1} / {totalQty}</span>
                </div>
                <div style={{ height: '3px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', marginBottom: '16px' }}>
                  <motion.div style={{ height: '100%', borderRadius: '3px', background: 'linear-gradient(90deg, #3b82f6, #818cf8)' }} animate={{ width: `${(wizardStep / totalQty) * 100}%` }} />
                </div>
                <div style={{ color: S.text, fontWeight: 800, fontSize: '22px' }}>O.S {wizardStep + 1}</div>
                <div style={{ color: S.muted, fontSize: '13px', marginTop: '2px' }}>
                  Técnico: <span style={{ color: S.text, fontWeight: 600 }}>{formData.technicianName}</span>
                </div>
              </div>

              {/* Conteúdo rolável */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Tipo de serviço</div>
                {SERVICE_TYPES.map(svc => {
                  const c = SVC_STYLE[svc] || { bg:'#111', color:S.muted2, border:S.border };
                  return (
                    <motion.button key={svc} type="button" whileHover={{ scale: 1.01, x: 3 }} whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectService(svc)}
                      style={{ width: '100%', padding: '13px 16px', textAlign: 'left', borderRadius: '10px', background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                      {svc}<ArrowRight size={14} style={{ opacity: 0.5 }} />
                    </motion.button>
                  );
                })}
              </div>

              {/* Cancelar — fixo no rodapé */}
              <div style={{ padding: '12px 24px 20px', borderTop: `1px solid ${S.border}`, flexShrink: 0, background: S.surface }}>
                <button type="button" onClick={() => { setShowWizard(false); setTempServices([]); setWizardStep(0); }}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONFIRMAÇÃO MODAL */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '460px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Header fixo */}
              <div style={{ padding: '24px 28px 20px', borderBottom: `1px solid ${S.border}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: S.okBg, border: `1px solid ${S.okBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckCircle2 size={22} color={S.green} />
                  </div>
                  <div>
                    <div style={{ color: S.text, fontWeight: 800, fontSize: '18px' }}>Confirmar Registro</div>
                    <div style={{ color: S.muted, fontSize: '12px', marginTop: '2px' }}>Revise antes de salvar — aparecerá no Dashboard após confirmação</div>
                  </div>
                </div>
              </div>

              {/* Conteúdo rolável */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: S.input, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '16px' }}>
                  {[
                    { label:'Técnico', value: formData.technicianName },
                    { label:'Data', value: new Date(formData.date+'T00:00:00').toLocaleDateString('pt-BR') },
                    { label:'Total de O.S', value: formData.totalOrders, big: true },
                    { label:'Reagendamentos', value: formData.rescheduled ? (formData.rescheduledCount || 0) : '—', orange: formData.rescheduled && parseInt(formData.rescheduledCount) > 0 },
                  ].map(({ label, value, big, orange }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${S.border}` }}>
                      <span style={{ color: S.muted, fontSize: '13px' }}>{label}</span>
                      <span style={{ fontWeight: 700, fontSize: big ? '20px' : '14px', color: big ? S.blue : orange ? S.orange : S.text }}>{value}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>Tipos de Serviço</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {tempServices.map((svc, i) => {
                      const c = SVC_STYLE[svc] || { bg:'#111', color:S.muted2, border:S.border };
                      return <span key={i} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '999px', background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontWeight: 600 }}>{i+1}. {svc}</span>;
                    })}
                  </div>
                </div>

                {formData.observations && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Observações</div>
                    <p style={{ color: S.muted2, fontSize: '13px', background: S.input, border: `1px solid ${S.border}`, padding: '12px', borderRadius: '10px' }}>{formData.observations}</p>
                  </div>
                )}
              </div>

              {/* Botões fixos no rodapé */}
              <div style={{ padding: '16px 28px 24px', borderTop: `1px solid ${S.border}`, flexShrink: 0, display: 'flex', gap: '12px', background: S.surface }}>
                <button onClick={() => { setShowConfirmation(false); setTempServices([]); setWizardStep(0); setShowWizard(true); }} disabled={loading}
                  style={{ flex: 1, padding: '13px', borderRadius: '10px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Voltar
                </button>
                <button onClick={handleConfirm} disabled={loading}
                  style={{ flex: 1, padding: '13px', borderRadius: '10px', background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: loading ? 0.7 : 1, boxShadow: '0 0 20px rgba(16,185,129,0.25)' }}>
                  {loading ? <Spinner /> : <><Check size={16}/>Salvar no Dashboard</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* CONFIRMAÇÃO VISUAL */}
      <AnimatePresence>
        {showSaved && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, pointerEvents: 'none' }}>
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              style={{ background: 'rgba(5,20,12,0.95)', border: '1px solid #10b981', borderRadius: '20px', padding: '32px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', boxShadow: '0 0 60px rgba(16,185,129,0.4)' }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
                style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #059669, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(16,185,129,0.6)' }}>
                <Check size={36} color="#fff" strokeWidth={3} />
              </motion.div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '18px' }}>Relatório Salvo!</div>
                <div style={{ color: '#6ee7b7', fontSize: '13px', marginTop: '4px' }}>{savedName}</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL IMPORTAÇÃO */}
      <AnimatePresence>
        {showImport && importData && (
          <>
            <div onClick={() => { setShowImport(false); setImportData(null); }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 49 }} />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
              style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
              <div style={{ width: '100%', maxWidth: '700px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '24px 28px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: S.okBg, border: `1px solid ${S.okBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileSpreadsheet size={20} color={S.green} />
                    </div>
                    <div>
                      <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>Importar Planilha Excel</div>
                      <div style={{ color: S.muted, fontSize: '12px', marginTop: '2px' }}>
                        Aba: <strong style={{ color: S.muted2 }}>{importData.sheetName}</strong> · {importData.records.length} registros encontrados
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setShowImport(false); setImportData(null); }} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}>
                    <X size={18} />
                  </button>
                </div>

                {/* Prévia */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', background: S.okBg, border: `1px solid ${S.okBorder}` }}>
                    <AlertCircle size={15} color={S.green} />
                    <span style={{ color: S.green, fontSize: '13px', fontWeight: 600 }}>
                      {importData.records.length} registros serão importados para o Firestore
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {importData.records.slice(0, 20).map((r, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', background: S.card, border: `1px solid ${S.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: S.accentSoft, color: S.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>
                            {(r.technicianName || '?').charAt(0)}
                          </div>
                          <div>
                            <div style={{ color: S.text, fontSize: '13px', fontWeight: 600 }}>{r.technicianName}</div>
                            <div style={{ color: S.muted, fontSize: '11px' }}>{r.date}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ background: S.accentSoft, color: S.accent, fontSize: '11px', padding: '3px 8px', borderRadius: '999px', fontWeight: 700 }}>
                            {r.totalOrders} O.S
                          </span>
                          {r.rescheduledCount > 0 && (
                            <span style={{ background: S.warnBg, color: S.orange, fontSize: '11px', padding: '3px 8px', borderRadius: '999px', fontWeight: 700 }}>
                              {r.rescheduledCount} reagend.
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {importData.records.length > 20 && (
                      <div style={{ textAlign: 'center', color: S.muted, fontSize: '12px', padding: '8px' }}>
                        + {importData.records.length - 20} registros adicionais...
                      </div>
                    )}
                  </div>
                </div>

                {/* Botões */}
                <div style={{ padding: '16px 28px 24px', borderTop: `1px solid ${S.border}`, display: 'flex', gap: '12px', flexShrink: 0, background: S.surface }}>
                  <button onClick={() => { setShowImport(false); setImportData(null); }}
                    style={{ flex: 1, padding: '13px', borderRadius: '10px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={handleConfirmImport} disabled={importing}
                    style={{ flex: 2, padding: '13px', borderRadius: '10px', background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: importing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: importing ? 0.7 : 1 }}>
                    {importing ? <><Spinner />Importando...</> : <><Upload size={16}/>Confirmar Importação ({importData.records.length} registros)</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL — APAGAR TODOS OS RELATÓRIOS DO DIA */}
      <AnimatePresence>
        {showDeleteDay && (
          <>
            <div onClick={() => !deletingDay && setShowDeleteDay(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 49 }} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
              <div style={{ width: '100%', maxWidth: '420px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', padding: 'clamp(16px, 5vw, 28px)', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#2d0f0f', border: '1px solid #7f1d1d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertCircle size={22} color={S.red} />
                  </div>
                  <div>
                    <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>Apagar relatórios do dia</div>
                    <div style={{ color: S.muted, fontSize: '12px', marginTop: '2px' }}>Esta ação não pode ser desfeita</div>
                  </div>
                </div>
                <p style={{ color: S.muted2, fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
                  Todos os relatórios de <strong style={{ color: S.text }}>{new Date(formData.date + 'T00:00:00').toLocaleDateString('pt-BR')}</strong> (de todos os técnicos) serão apagados permanentemente.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setShowDeleteDay(false)} disabled={deletingDay}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: deletingDay ? 'not-allowed' : 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={handleDeleteDay} disabled={deletingDay}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, #b91c1c, #ef4444)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: deletingDay ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: deletingDay ? 0.7 : 1 }}>
                    {deletingDay ? <Spinner /> : <><Trash2 size={15}/>Apagar tudo</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* OVERLAY DE PROGRESSO — Importação (bloqueia o site até concluir) */}
      <ProgressOverlay
        open={importing}
        progress={importProgress}
        title="Importando relatórios…"
        subtitle={importData ? `Salvando no Firestore · ${importData.records.length} registros` : 'Salvando no Firestore'} />
    </div>
  );
};
