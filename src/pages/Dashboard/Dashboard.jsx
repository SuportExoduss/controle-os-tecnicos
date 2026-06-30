import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getReportsByDateRange, getReportsByTechnicianAll, updateReport, deleteReport } from '../../services/database/reportService';
import { generateIndividualPDF, generateGeneralPDF } from '../../services/reports/pdfService';
import { generateExcel } from '../../services/reports/excelService';
import { syncReportToSheet, deleteRowInSheet } from '../../services/integrations/sheetSync';
import { TextReportModal } from '../../components/modals/TextReportModal';
import { Spinner } from '../../components/common/Spinner';
import { ProgressOverlay } from '../../components/common/ProgressOverlay';
import { toast } from 'react-hot-toast';
import { formatDate } from '../../utils/formatDate';
import { AuthContext } from '../../context/AuthContext';
import { ThemeContext } from '../../context/ThemeContext';
import { loginUser, logoutUser } from '../../services/auth/authService';
import { getUserProfile } from '../../services/database/userProfileService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import {
  ChevronDown, ChevronUp, FileText, Download, Users, ClipboardList,
  CalendarClock, TrendingUp, SearchX, Calendar, Search, Edit2, X,
  Check, BarChart3, FileSpreadsheet, History, Copy, CheckCheck, PieChart as PieIcon,
  Info, Lock, LogIn, LogOut, Sun, Moon, ClipboardEdit, RotateCcw, Trash2,
} from 'lucide-react';

const TYPE_COLORS = {
  'INSTALAÇÃO FIBRA': '#60a5fa', 'MANUTENÇÃO FIBRA': '#2dd4bf', 'MUDANÇA DE ENDEREÇO': '#86efac',
  'MUDANÇA DE PONTO': '#7dd3fc', 'INSTALAÇÃO WI-BINET': '#818cf8', 'REPARO WI-BINET': '#67e8f9',
  'INSTALAÇÃO TV': '#38bdf8', 'REPARO TV': '#e879f9', 'OS AMPLIAÇÃO': '#fde68a',
  'VISTORIA': '#fbbf24', 'FONTE QUEIMADA': '#fb923c', 'TROCA DE EQUIPAMENTO': '#c084fc',
  'SINAL ALTO': '#4ade80', 'REINCIDÊNCIA': '#fca5a5', 'IMPRODUTIVA': '#94a3b8',
};

// Usa hora LOCAL para evitar problema de fuso horário
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

export const Dashboard = () => {
  const navigate = useNavigate();
  const { S, mode, toggleTheme } = useContext(ThemeContext);
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTechnician, setSearchTechnician] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [textModalReport, setTextModalReport] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  // Overlay bloqueante de exportação: null = fechado | { progress, title, subtitle }
  const [exportTask, setExportTask] = useState(null);

  const [editReport, setEditReport] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // Feature 2 — History
  const [historyTech, setHistoryTech] = useState(null);

  // Feature 6 — General text report
  const [showGeneralText, setShowGeneralText] = useState(false);
  const [copied, setCopied] = useState(false);

  // Top 3 popup
  const [top3Modal, setTop3Modal] = useState(null);
  // Gráfico de pizza
  const [showPie, setShowPie] = useState(false);
  // Detalhamento pessoal por técnico (badge "X O.S")
  const [personalModal, setPersonalModal] = useState(null);
  // Modal exportar Excel com período
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelFrom, setExcelFrom] = useState('');
  const [excelTo, setExcelTo] = useState('');

  // Autenticação / modo edição
  const { user, profile, refreshProfile } = useContext(AuthContext);
  const isLogged = !!user && !!profile?.nickname;
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [redirectAfterLogin, setRedirectAfterLogin] = useState(null);
  // Modal de info de autoria
  const [infoModal, setInfoModal] = useState(null);

  const handleDashLogin = async () => {
    if (!loginEmail || !loginPass) { toast.error('Preencha email e senha'); return; }
    setLoginLoading(true);
    try {
      const cred = await loginUser(loginEmail, loginPass);
      const p = await getUserProfile(cred.user.uid);
      if (!p || !p.nickname) {
        toast.error('Faça o primeiro login pela tela inicial para definir seu apelido.');
        await logoutUser();
        setLoginLoading(false);
        return;
      }
      await refreshProfile(cred.user.uid);
      toast.success(`Bem-vindo, ${p.nickname}!`);
      setShowLoginModal(false); setLoginEmail(''); setLoginPass('');
      if (redirectAfterLogin) { const dest = redirectAfterLogin; setRedirectAfterLogin(null); navigate(dest); }
    } catch { toast.error('Email ou senha incorretos'); }
    finally { setLoginLoading(false); }
  };

  const handleDashLogout = async () => {
    try { await logoutUser(); toast.success('Modo edição desativado'); } catch { /* ignora */ }
  };

  // Carrega SÓ o período pedido (mês visível por padrão). Cache + invalidação
  // nas gravações economizam a cota de leituras do Firestore.
  const loadRange = async (from, to, tech, { force = false } = {}) => {
    try {
      setLoading(true);
      const today = localDate();
      const start = from || `${today.slice(0, 7)}-01`;
      const end   = to   || today;
      const arr = await getReportsByDateRange(start, end, { force });
      setReports(arr);
      filterReports(arr, from, to, tech);
    } catch (err) { toast.error('Erro ao carregar relatórios'); console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadRange('', '', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filterReports = (data, from, to, tech) => {
    // Sem filtro → dia 1 do mês atual até hoje
    const today = localDate();
    const firstOfMonth = `${today.slice(0, 7)}-01`;
    const effectiveFrom = from || firstOfMonth;
    const effectiveTo   = to   || today;

    let f = data;
    f = f.filter(r => r.date >= effectiveFrom && r.date <= effectiveTo);
    if (tech) f = f.filter(r => (r.technicianName || '').toLowerCase().includes(tech.toLowerCase()));

    // Sempre agrupa por colaborador — 1 card por técnico
    const map = {};
    f.forEach(r => {
      const name = r.technicianName || 'Sem nome';
      if (!map[name]) {
        map[name] = { ...r, totalOrders: 0, rescheduledCount: 0, serviceTypes: [], observations: '', _dias: 0, _records: [] };
      }
      map[name].totalOrders      += r.totalOrders || 0;
      map[name].rescheduledCount += r.rescheduledCount || 0;
      map[name].serviceTypes      = [...map[name].serviceTypes, ...(r.serviceTypes || [])];
      // só conta como "dia registrado" se houve O.S nesse dia
      if ((r.totalOrders || 0) > 0) {
        map[name]._dias += 1;
        map[name]._records.push(r);
        if (!map[name]._lastDate || r.date > map[name]._lastDate) {
          map[name]._lastDate = r.date;
          map[name].date = r.date;
        }
      }
    });
    const grouped = Object.values(map)
      .filter(r => r.totalOrders > 0)
      .sort((a, b) => b.totalOrders - a.totalOrders);
    setFilteredReports(grouped);
  };

  const handleSearch = (from, to, tech) => {
    setDateFrom(from); setDateTo(to); setSearchTechnician(tech);
    loadRange(from, to, tech);
  };

  const goToPrevMonth = () => {
    const today = localDate();
    const ref = dateFrom || `${today.slice(0, 7)}-01`;
    const d = new Date(ref + 'T00:00:00');
    d.setMonth(d.getMonth() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
    handleSearch(`${y}-${m}-01`, `${y}-${m}-${String(lastDay).padStart(2,'0')}`, searchTechnician);
  };

  const goToNextMonth = () => {
    const today = localDate();
    const ref = dateFrom || `${today.slice(0, 7)}-01`;
    const d = new Date(ref + 'T00:00:00');
    d.setMonth(d.getMonth() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
    const to = `${y}-${m}-${String(lastDay).padStart(2,'0')}`;
    handleSearch(`${y}-${m}-01`, to > today ? today : to, searchTechnician);
  };

  const currentMonthLabel = () => {
    const ref = dateFrom || `${localDate().slice(0, 7)}-01`;
    return new Date(ref + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const getMostCommonService = (list = filteredReports) => {
    if (!list.length) return 'N/A';
    const counts = {};
    list.forEach(r => (r.serviceTypes || []).forEach(s => { counts[s] = (counts[s] || 0) + 1; }));
    if (!Object.keys(counts).length) return 'N/A';
    const top = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    return `${top} (${counts[top]})`;
  };

  const summary = {
    totalTechnicians: new Set(filteredReports.map(r => r.technicianName)).size,
    totalOrders: filteredReports.reduce((acc, r) => acc + (r.totalOrders || 0), 0),
    totalRescheduled: filteredReports.reduce((acc, r) => acc + (r.rescheduledCount || 0), 0),
    mostCommonService: getMostCommonService(),
  };

  // Scroll de dias: dia 1 do mês atual até hoje (ou período filtrado)
  const scrollDays = (() => {
    const today = localDate();
    const firstOfMonth = `${today.slice(0, 7)}-01`;
    const start = dateFrom || firstOfMonth;
    const end   = dateTo   || today;
    const days = [];
    const cur = new Date(start + 'T00:00:00');
    const endD = new Date(end + 'T00:00:00');
    const techFilter = searchTechnician.trim().toLowerCase();
    while (cur <= endD) {
      const key = localDate(cur);
      const total = reports
        .filter(r => r.date === key && (!techFilter || (r.technicianName || '').toLowerCase().includes(techFilter)))
        .reduce((acc, r) => acc + (r.totalOrders || 0), 0);
      days.push({
        date: key,
        day: cur.getDate(),
        weekday: cur.toLocaleDateString('pt-BR', { weekday: 'short' }),
        total,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  })();
  const maxDayTotal = Math.max(...scrollDays.map(d => d.total), 1);

  // Totais por tipo de serviço (período filtrado)
  const typeData = (() => {
    const counts = {};
    filteredReports.forEach(r => (r.serviceTypes || []).forEach(s => { counts[s] = (counts[s] || 0) + 1; }));
    const totalSum = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, pct: Math.round((value / totalSum) * 100), color: TYPE_COLORS[name] || '#94a3b8' }))
      .sort((a, b) => b.value - a.value);
  })();

  const canExport = !!(dateFrom && dateTo);

  // Executor genérico de exportação: mostra o overlay bloqueante com % e só
  // libera o site ao terminar. Cada gerador recebe um callback onProgress(0-100).
  const runExport = async ({ title, subtitle, successMsg, fn }) => {
    setExportTask({ progress: 0, title, subtitle });
    try {
      await fn(pct => setExportTask(t => (t ? { ...t, progress: pct } : t)));
      if (successMsg) toast.success(successMsg);
    } catch (err) {
      toast.error('Erro ao gerar arquivo');
      console.error(err);
    } finally {
      setExportTask(null);
    }
  };

  const handleGeneralPDF = async () => {
    if (!canExport) { toast.error('Selecione o período (início e fim) para exportar'); return; }
    if (!filteredReports.length) { toast.error('Nenhum relatório no período'); return; }
    setGeneratingPDF(true);
    await runExport({
      title: 'Gerando PDF geral…',
      subtitle: `${filteredReports.length} técnico(s)`,
      successMsg: 'PDF geral gerado!',
      fn: (onProgress) => generateGeneralPDF(filteredReports, onProgress),
    });
    setGeneratingPDF(false);
  };

  const handleTechExcel = (report) => {
    const records = (report._records && report._records.length) ? report._records : [report];
    runExport({
      title: 'Gerando Excel…',
      subtitle: report.technicianName || '',
      successMsg: 'Excel gerado!',
      fn: (onProgress) => generateExcel(records, `relatorio-${(report.technicianName || 'tecnico').split(' ')[0]}`, onProgress),
    });
  };

  const handleTechPDF = (report) => {
    runExport({
      title: 'Gerando PDF…',
      subtitle: report.technicianName || '',
      successMsg: 'PDF gerado!',
      fn: (onProgress) => generateIndividualPDF(report.technicianName || 'tecnico', report, onProgress),
    });
  };

  // Abre o modal de seleção de período (pré-preenche com filtro atual)
  const handleExcel = () => {
    setExcelFrom(dateFrom || `${localDate().slice(0,7)}-01`);
    setExcelTo(dateTo || localDate());
    setShowExcelModal(true);
  };

  const handleExcelGenerate = async () => {
    if (!excelFrom || !excelTo) { toast.error('Selecione início e fim'); return; }
    setShowExcelModal(false);
    // Busca exatamente o período pedido (pode ser maior que o mês carregado)
    let data;
    try { data = await getReportsByDateRange(excelFrom, excelTo); }
    catch (err) { toast.error('Erro ao buscar dados do período'); console.error(err); return; }
    // registros brutos (todos os dias com O.S no período) sem agrupar
    const records = data
      .filter(r => (r.totalOrders || 0) > 0)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.technicianName||'').localeCompare(b.technicianName||''));
    if (!records.length) { toast.error('Nenhum relatório no período selecionado'); return; }
    runExport({
      title: 'Gerando Excel…',
      subtitle: `${records.length} registro(s)`,
      successMsg: `Excel gerado! ${records.length} registros`,
      fn: (onProgress) => generateExcel(records, `relatorio-${excelFrom}_a_${excelTo}`, onProgress),
    });
  };

  // Helpers do editor de dia: quantidade por tipo de serviço
  const editTypeCount = (svc) => (editReport?.serviceTypes || []).filter(s => s === svc).length;
  const setEditTypeCount = (svc, qty) => {
    setEditReport(p => {
      const counts = {};
      (p.serviceTypes || []).forEach(s => { counts[s] = (counts[s] || 0) + 1; });
      counts[svc] = Math.max(0, qty);
      // Reconstrói o array em ordem canônica (mantém também tipos fora da lista padrão)
      const next = [];
      SERVICE_TYPES.forEach(t => { for (let i = 0; i < (counts[t] || 0); i++) next.push(t); });
      Object.keys(counts).filter(t => !SERVICE_TYPES.includes(t)).forEach(t => { for (let i = 0; i < counts[t]; i++) next.push(t); });
      return { ...p, serviceTypes: next };
    });
  };
  const clearEditReport = () => setEditReport(p => ({ ...p, serviceTypes: [], rescheduled: false, rescheduledCount: '', observations: '' }));

  // Feature 1 — Save edit (substitui o dia completo; total derivado dos tipos)
  const handleSaveEdit = async () => {
    if (!editReport) return;
    setEditLoading(true);
    try {
      const { id, ...data } = editReport;
      const types = data.serviceTypes || [];
      await updateReport(id, {
        totalOrders: types.length, // sempre = nº de tipos (quantidade e tipos sempre batem)
        rescheduled: data.rescheduled,
        rescheduledCount: data.rescheduled ? parseInt(data.rescheduledCount || 0) : 0,
        observations: data.observations || '',
        serviceTypes: types,
        editedByNickname: profile?.nickname || 'Desconhecido',
        editedByEmail: user?.email || '',
        editedAt: new Date().toISOString(),
      });
      // Espelha a edição na planilha do Google (não bloqueia se falhar)
      syncReportToSheet({ technicianName: editReport.technicianName, date: editReport.date, rescheduledCount: data.rescheduled ? parseInt(data.rescheduledCount || 0) : 0, observations: data.observations || '', serviceTypes: types });
      toast.success('Dia atualizado!');
      setEditReport(null);
      await loadRange(dateFrom, dateTo, searchTechnician, { force: true });
    } catch (err) { toast.error('Erro ao atualizar'); console.error(err); }
    finally { setEditLoading(false); }
  };

  // Excluir lançamento (1 técnico + 1 dia) — APAGA a linha da planilha (não zera).
  const handleDeleteRecord = async (rec) => {
    const quando = new Date(rec.date + 'T00:00:00').toLocaleDateString('pt-BR');
    if (!window.confirm(`Excluir o lançamento de ${rec.technicianName} (${quando})?\n\nA LINHA será apagada da planilha — esta ação não pode ser desfeita.`)) return;
    try {
      await deleteReport(rec.id);
      deleteRowInSheet(rec.date, rec.technicianName); // planilha (best-effort)
      toast.success('Lançamento excluído');
      await loadRange(dateFrom, dateTo, searchTechnician, { force: true });
    } catch (err) { toast.error('Erro ao excluir'); console.error(err); }
  };

  // Feature 6 — General text
  const buildGeneralText = () => {
    const lines = [];
    lines.push('╔══════════════════════════════════════════╗');
    lines.push('║       RELATÓRIO GERAL DE O.S — IBIUNET       ║');
    lines.push('╚══════════════════════════════════════════╝');
    const _today = localDate();
    const _first = `${_today.slice(0, 7)}-01`;
    const f = dateFrom || _first;
    const t = dateTo   || _today;
    const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
    lines.push(`Período: ${fmt(f)} a ${fmt(t)}`);
    lines.push(`Total de técnicos: ${summary.totalTechnicians} | Total O.S: ${summary.totalOrders} | Reagendamentos: ${summary.totalRescheduled}`);
    lines.push('─'.repeat(48));
    filteredReports.forEach((r, i) => {
      lines.push(`\n[${i + 1}] ${r.technicianName}`);
      lines.push(`    O.S: ${r.totalOrders}  |  Horário: ${r.submissionTime || '—'}  |  Reagend.: ${r.rescheduledCount || 0}`);
      lines.push(`    Serviços: ${(r.serviceTypes || []).join(', ') || '—'}`);
      if (r.observations) lines.push(`    Obs: ${r.observations}`);
    });
    lines.push('\n' + '─'.repeat(48));
    lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
    return lines.join('\n');
  };

  const handleCopyGeneral = async () => {
    try {
      await navigator.clipboard.writeText(buildGeneralText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Erro ao copiar'); }
  };

  // Feature 2 — History (busca COMPLETA sob demanda, inclui folgas/faltas zeradas,
  // pois o dashboard agora lê só os > 0 e o cache não tem os zerados).
  const [techHistory, setTechHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  useEffect(() => {
    if (!historyTech) { setTechHistory([]); return; }
    let cancelled = false;
    setHistoryLoading(true);
    getReportsByTechnicianAll(historyTech)
      .then(arr => { if (!cancelled) setTechHistory(arr.sort((a, b) => b.date.localeCompare(a.date))); })
      .catch(() => { if (!cancelled) setTechHistory([]); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [historyTech]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}><Spinner /><p style={{ color: S.muted, fontSize: '14px', marginTop: '12px' }}>Carregando...</p></div>
    </div>
  );

  const metrics = [
    { icon: Users, label: 'Técnicos', value: summary.totalTechnicians, color: S.blue, bg: '#0f1d35', glow: 'rgba(96,165,250,0.12)' },
    { icon: ClipboardList, label: 'Total O.S', value: summary.totalOrders, color: S.green, bg: '#0d2d1f', glow: 'rgba(52,211,153,0.12)', onClick: () => setShowPie(true) },
    { icon: CalendarClock, label: 'Reagendamentos', value: summary.totalRescheduled, color: S.orange, bg: '#1c1200', glow: 'rgba(251,191,36,0.12)' },
    { icon: TrendingUp, label: 'Serviço Top', value: summary.mostCommonService, color: S.purple, bg: '#140f26', glow: 'rgba(167,139,250,0.12)', small: true },
  ];

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', background: S.bg }}>

      {/* TOPBAR */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: S.card, borderBottom: `1px solid ${S.border}` }}>
        <div className="r-maxw" style={{ padding: '0 16px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flexShrink: 0 }}>
              <img src="/logo-frota.png" alt="IbiúNET Multiplay" className="r-logo" style={{ width: 'clamp(116px, 20vw, 156px)', height: 'auto', display: 'block' }} />
              {isLogged && (
                <div style={{ color: '#34d399', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={10}/>{profile.nickname}
                </div>
              )}
            </div>
            {/* Toggle tema */}
            <button onClick={toggleTheme} title="Alternar tema"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px', borderRadius: '8px', background: 'transparent', border: `1px solid ${S.border}`, color: mode === 'light' ? S.purple : S.orange, cursor: 'pointer', flexShrink: 0, marginLeft: '4px' }}>
              {mode === 'light' ? <Moon size={15}/> : <Sun size={15}/>}
            </button>
            {/* Botão ADM */}
            <button onClick={() => { if (isLogged) navigate('/fibra/admin'); else { setRedirectAfterLogin('/fibra/admin'); setShowLoginModal(true); } }} title="Ir para o painel Admin"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '8px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = S.blue; e.currentTarget.style.color = S.blue; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.color = S.muted2; }}>
              <ClipboardEdit size={14}/><span className="r-topbar-label">ADM</span>
            </button>
            {/* Botão login/logout colado ao nome */}
            <button onClick={() => isLogged ? handleDashLogout() : setShowLoginModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '8px', background: isLogged ? '#0d2d1f' : 'transparent', border: `1px solid ${isLogged ? '#065f46' : S.border}`, color: isLogged ? '#34d399' : S.muted2, fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s', marginLeft: '4px' }}
              title={isLogged ? 'Sair do modo edição' : 'Entrar para editar'}>
              {isLogged ? <><LogOut size={13}/><span className="r-topbar-label">Sair</span></> : <><Lock size={13}/><span className="r-topbar-label">Editar</span></>}
            </button>
          </div>

          {/* Desktop buttons — exportações só para quem está logado */}
          <div className="r-dash-header-btns">
            {isLogged && (<>
            <button onClick={() => { if (!canExport) { toast.error('Selecione a data de início e fim para exportar'); return; } if (!filteredReports.length) { toast.error('Nenhum relatório'); return; } setShowGeneralText(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', border: '1px solid #60a5fa', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 16px rgba(59,130,246,0.3)', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
              <FileText size={15} />Texto
            </button>
            <button onClick={handleExcel}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #047857, #10b981)', border: '1px solid #34d399', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 16px rgba(16,185,129,0.3)', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
              <FileSpreadsheet size={15} />Excel
            </button>
            <button onClick={handleGeneralPDF} disabled={generatingPDF}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #b91c1c, #ef4444)', border: '1px solid #f87171', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 16px rgba(239,68,68,0.3)', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
              <Download size={15} />{generatingPDF ? '...' : 'PDF'}
            </button>
            </>)}
          </div>

          {/* Mobile icon buttons — exportações só para quem está logado */}
          <div className="r-dash-header-btns-sm">
            {isLogged && (<>
            <button onClick={() => { if (!canExport) { toast.error('Selecione a data de início e fim para exportar'); return; } setShowGeneralText(true); }}
              style={{ padding: '8px', borderRadius: '8px', background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', border: '1px solid #60a5fa', color: '#fff', cursor: 'pointer', display: 'flex' }} title="Texto Geral">
              <FileText size={16} />
            </button>
            <button onClick={handleExcel}
              style={{ padding: '8px', borderRadius: '8px', background: 'linear-gradient(135deg, #047857, #10b981)', border: '1px solid #34d399', color: '#fff', cursor: 'pointer', display: 'flex' }} title="Excel">
              <FileSpreadsheet size={16} />
            </button>
            <button onClick={handleGeneralPDF} disabled={generatingPDF}
              style={{ padding: '8px', borderRadius: '8px', background: 'linear-gradient(135deg, #b91c1c, #ef4444)', border: '1px solid #f87171', color: '#fff', cursor: 'pointer', display: 'flex' }} title="PDF Geral">
              <Download size={16} />
            </button>
            </>)}
          </div>
        </div>
      </header>

      <main style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }} className="r-page-pad r-maxw">

        {/* FILTERS — completos só para quem está logado */}
        {isLogged && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }} className="r-filter-grid">
            {/* Início */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
                <Calendar size={11}/>INÍCIO
              </div>
              <input type="date" value={dateFrom} onChange={e => handleSearch(e.target.value, dateTo, searchTechnician)}
                onClick={e => { try { e.target.showPicker(); } catch { /* ignora */ } }}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: S.input2, border: `1px solid #2a4a7f`, color: dateFrom ? S.text : S.muted2, fontSize: '14px', outline: 'none', boxSizing: 'border-box', colorScheme: mode, cursor: 'pointer' }}
                onFocus={e => e.target.style.borderColor = S.blue} onBlur={e => e.target.style.borderColor = '#2a4a7f'} />
            </div>
            {/* Fim */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
                <Calendar size={11}/>FIM
              </div>
              <input type="date" value={dateTo} onChange={e => handleSearch(dateFrom, e.target.value, searchTechnician)}
                onClick={e => { try { e.target.showPicker(); } catch { /* ignora */ } }}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: S.input2, border: `1px solid #2a4a7f`, color: dateTo ? S.text : S.muted2, fontSize: '14px', outline: 'none', boxSizing: 'border-box', colorScheme: mode, cursor: 'pointer' }}
                onFocus={e => e.target.style.borderColor = S.blue} onBlur={e => e.target.style.borderColor = '#2a4a7f'} />
            </div>
            {/* Técnico */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
                <Search size={11}/>TÉCNICO
              </div>
              <input type="text" placeholder="Buscar técnico..." value={searchTechnician}
                onChange={e => handleSearch(dateFrom, dateTo, e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', colorScheme: mode }}
                onFocus={e => e.target.style.borderColor = S.blue} onBlur={e => e.target.style.borderColor = S.border} />
            </div>
          </div>
          {/* Navegação mês + Limpar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button onClick={goToPrevMonth}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '8px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = S.blue; e.currentTarget.style.color = S.blue; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.color = S.muted2; }}>
                ← Mês anterior
              </button>
              <button onClick={goToNextMonth}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '8px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = S.blue; e.currentTarget.style.color = S.blue; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.color = S.muted2; }}>
                Próximo mês →
              </button>
            </div>
            {(dateFrom || dateTo || searchTechnician) && (
              <button onClick={() => handleSearch('', '', '')}
                style={{ fontSize: '12px', fontWeight: 600, padding: '5px 14px', borderRadius: '8px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, cursor: 'pointer' }}>
                Limpar filtros
              </button>
            )}
          </div>
        </motion.div>
        )}

        {/* METRICS */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="r-metrics">
          {metrics.map(({ icon: Icon, label, value, color, bg, glow, small, onClick }) => (
            <div key={label} onClick={onClick}
              style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '20px', position: 'relative', overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', transition: 'all 0.15s' }}
              onMouseEnter={onClick ? (e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = color; }) : undefined}
              onMouseLeave={onClick ? (e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = S.border; }) : undefined}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', borderRadius: '50%', background: glow, filter: 'blur(30px)', pointerEvents: 'none' }} />
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                <Icon size={17} color={color} />
              </div>
              <div style={{ color: S.muted, fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
              <div className={small ? '' : 'r-metric-value'} style={{ color, fontWeight: 900, fontSize: small ? '14px' : undefined, lineHeight: 1 }}>{value}</div>
              {onClick && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '10px', fontWeight: 700, color, letterSpacing: '0.5px', textTransform: 'uppercase', opacity: 0.85 }}>
                  <PieIcon size={10} />ver tipos
                </div>
              )}
            </div>
          ))}
        </motion.div>

        {/* NAVEGAÇÃO DE MÊS — só para quem NÃO está logado (visitante) */}
        {!isLogged && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="r-month-nav">
            <button onClick={goToPrevMonth}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px 16px', borderRadius: '12px', background: S.card, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = S.blue; e.currentTarget.style.color = S.blue; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.color = S.text; }}>
              <ChevronDown size={16} style={{ transform: 'rotate(90deg)' }} />Mês anterior
            </button>
            <button onClick={goToNextMonth}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px 16px', borderRadius: '12px', background: S.card, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = S.blue; e.currentTarget.style.color = S.blue; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.color = S.text; }}>
              Próximo mês<ChevronDown size={16} style={{ transform: 'rotate(-90deg)' }} />
            </button>
          </motion.div>
        )}

        {/* SCROLL DE PRODUTIVIDADE */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '20px 24px' }}>
          {/* TOP 3 — Pódio */}
          {(() => {
            const top = filteredReports
              .filter(r => !(r.technicianName || '').toLowerCase().includes('terceirizada'))
              .sort((a, b) => b.totalOrders - a.totalOrders)
              .slice(0, 3);
            if (!top.length) return null;

            const shortName = (name = '') => {
              const p = name.split(' ');
              return p[0] + (p[1] ? ' ' + p[1] : '');
            };

            const COLS = [
              { idx: 0, color: '#f59e0b', borderColor: '#d97706' },
              { idx: 1, color: '#94a3b8', borderColor: '#475569' },
              { idx: 2, color: '#cd7f32', borderColor: '#92400e' },
            ];

            return (
              <div style={{ marginBottom: '14px', padding: '1.5px', borderRadius: '12px', background: 'linear-gradient(135deg, #78350f55, #d97706bb, #78350f55)' }}>
                <div style={{ borderRadius: '11px', background: mode === 'light' ? '#fffaf0' : '#0a0d16', padding: '7px 12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {/* Título centrado no topo */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5"><path d="M8 21h8M12 17v4M17 3H7l-2 7h14l-2-7z"/><path d="M5 10c0 3.31 3.13 6 7 6s7-2.69 7-6"/></svg>
                      <span style={{ color: '#f59e0b', fontWeight: 900, fontSize: '11px', letterSpacing: '2px' }}>TOP 3 DO MÊS</span>
                    </div>
                    {/* Nomes — empilha no mobile, 3 colunas no desktop */}
                    <div className="r-top3-grid">
                      {COLS.map(({ idx, color, borderColor }) => {
                        const r = top[idx];
                        if (!r) return <div key={idx} style={{ display: 'none' }} />;
                        return (
                          <button key={idx} onClick={() => setTop3Modal(r)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${borderColor}66`, background: `${borderColor}1a`, cursor: 'pointer', transition: 'all 0.15s', minWidth: 0 }}
                            onMouseEnter={e => { e.currentTarget.style.background = `${borderColor}2e`; e.currentTarget.style.borderColor = borderColor; }}
                            onMouseLeave={e => { e.currentTarget.style.background = `${borderColor}1a`; e.currentTarget.style.borderColor = `${borderColor}66`; }}>
                            <span style={{ fontSize: '14px', lineHeight: 1, flexShrink: 0 }}>{['🥇','🥈','🥉'][idx]}</span>
                            <span style={{ color, fontWeight: 700, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{shortName(r.technicianName)}</span>
                            <span style={{ color: `${color}cc`, fontWeight: 800, fontSize: '11px', flexShrink: 0 }}>{r.totalOrders}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Botão gráfico de pizza — entre ranking e produtividade */}
          <button onClick={() => setShowPie(true)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', marginBottom: '16px', borderRadius: '10px', background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', border: '1px solid #c4b5fd', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 16px rgba(167,139,250,0.3)', transition: 'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
            <PieIcon size={15} />Tipos de Serviço
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={15} color={S.blue} />
              <span style={{ color: S.text, fontWeight: 700, fontSize: '13px' }}>Produtividade</span>
            </div>
            {(dateFrom || dateTo) && (
              <span style={{ color: S.muted, fontSize: '12px' }}>
                {dateFrom && new Date(dateFrom+'T00:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })}
                {dateFrom && dateTo && dateFrom !== dateTo ? ' → ' : ''}
                {dateTo && dateTo !== dateFrom && new Date(dateTo+'T00:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })}
              </span>
            )}
          </div>

          {/* Scroll horizontal */}
          <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', minWidth: 'max-content', paddingBottom: '2px' }}>
              {scrollDays.map(({ date, day, weekday, total }) => {
                const isSelected = dateFrom === date && dateTo === date;
                const inRange = dateFrom && dateTo && date >= dateFrom && date <= dateTo && dateFrom !== dateTo;
                const barH = total > 0 ? Math.max(Math.round((total / maxDayTotal) * 56), 8) : 4;
                const today = localDate();
                const isToday = date === today;
                return (
                  <button key={date} onClick={() => {
                    if (isSelected) handleSearch('', '', searchTechnician);
                    else handleSearch(date, date, searchTechnician);
                  }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '6px 4px', borderRadius: '10px', border: `1px solid ${isSelected ? '#6366f1' : inRange ? '#1e3a5f' : 'transparent'}`, background: isSelected ? '#1a1d3a' : inRange ? '#0d1220' : 'transparent', cursor: 'pointer', minWidth: '36px', transition: 'all 0.15s' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#0d1220'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = inRange ? '#0d1220' : 'transparent'; }}>
                    {/* Barra */}
                    <div style={{ width: '20px', height: '60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <div style={{ width: '100%', height: `${barH}px`, borderRadius: '4px 4px 0 0', background: isSelected ? '#6366f1' : inRange ? '#3b82f6' : total > 0 ? '#1e3a5f' : '#0f1624', transition: 'all 0.2s' }} />
                    </div>
                    {/* Total */}
                    {total > 0 && <span style={{ fontSize: '9px', fontWeight: 700, color: isSelected ? '#818cf8' : S.muted, lineHeight: 1 }}>{total}</span>}
                    {/* Dia */}
                    <span style={{ fontSize: '11px', fontWeight: isToday ? 800 : 600, color: isToday ? S.blue : isSelected ? S.text : S.muted2, lineHeight: 1 }}>{String(day).padStart(2,'0')}</span>
                    {/* Semana */}
                    <span style={{ fontSize: '9px', color: S.muted, lineHeight: 1, textTransform: 'capitalize' }}>{weekday.replace('.','')}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </motion.div>

        {/* REPORT CARDS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredReports.length === 0 ? (
            <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '60px 20px', textAlign: 'center' }}>
              <SearchX size={40} color={S.border} style={{ margin: '0 auto 16px' }} />
              <p style={{ color: S.muted2, fontWeight: 700, fontSize: '16px' }}>
                Nenhum registro em {currentMonthLabel()}
              </p>
              <p style={{ color: S.muted, fontSize: '13px', marginTop: '6px', marginBottom: '20px' }}>
                Não há O.S registradas neste período.
              </p>
              <button onClick={goToPrevMonth}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                ← Ver mês anterior
              </button>
            </div>
          ) : filteredReports.map((report, idx) => (
            <motion.div key={report.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
              style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', overflow: 'hidden' }}>
              <div onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '16px', flexShrink: 0 }}>
                    {(report.technicianName || '?').charAt(0)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="r-report-name" style={{ color: S.text }}>{report.technicianName || 'Sem nome'}</span>
                    </div>
                    <div style={{ color: S.muted, fontSize: '12px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {report.totalOrders} O.S · {report._dias > 1 ? `${report._dias} dias registrados` : formatDate(report.date)}{!report._dias && report.submissionTime ? ` · ${report.submissionTime}` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span className="r-badge-os" onClick={(e) => { e.stopPropagation(); setPersonalModal(report); }}
                    title="Ver tipos de O.S deste técnico"
                    style={{ background: '#0f1d35', color: S.blue, fontSize: '12px', padding: '4px 10px', borderRadius: '999px', fontWeight: 700, border: '1px solid #3a2f12', alignItems: 'center', gap: '4px', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#13243f'; e.currentTarget.style.borderColor = '#574517'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#0f1d35'; e.currentTarget.style.borderColor = '#3a2f12'; }}>
                    <ClipboardList size={11}/>{report.totalOrders} O.S
                  </span>
                  {report.rescheduledCount > 0 && (
                    <span style={{ background: '#1c1200', color: S.orange, fontSize: '12px', padding: '4px 10px', borderRadius: '999px', fontWeight: 700, border: '1px solid #78350f' }}>
                      {report.rescheduledCount} reagend.
                    </span>
                  )}
                  <div style={{ color: expandedId === report.id ? S.blue : S.muted, display: 'flex', padding: '4px' }}>
                    {expandedId === report.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {expandedId === report.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '16px 24px', borderTop: `1px solid ${S.border}`, background: S.input, display: 'flex', flexDirection: 'column', gap: '8px' }}>

                      {/* Registros por dia — máx 7 visíveis, depois scroll */}
                      <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                      {(report._records || [])
                        .filter(r => r.totalOrders > 0)
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((rec, i) => {
                          // conta tipos únicos com quantidade
                          const typeCounts = {};
                          (rec.serviceTypes || []).forEach(s => { typeCounts[s] = (typeCounts[s] || 0) + 1; });
                          return (
                            <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '12px 16px' }}>
                              {/* Cabeçalho do dia */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ color: S.blue, fontWeight: 700, fontSize: '12px' }}>
                                    {new Date(rec.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                  </span>
                                  {rec.submissionTime && <span style={{ color: S.muted, fontSize: '11px' }}>{rec.submissionTime}</span>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                                  <span style={{ background: '#0f1d35', color: S.blue, fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 700, border: '1px solid #1e3a5f' }}>
                                    {rec.totalOrders} O.S
                                  </span>
                                  {rec.rescheduledCount > 0 && (
                                    <span style={{ background: '#1c1200', color: S.orange, fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                                      {rec.rescheduledCount} reagend.
                                    </span>
                                  )}
                                  {/* Info de autoria */}
                                  <button onClick={() => setInfoModal(rec)} title="Informações do registro"
                                    style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', padding: '2px', display: 'flex', borderRadius: '4px' }}
                                    onMouseEnter={e => e.currentTarget.style.color = S.blue}
                                    onMouseLeave={e => e.currentTarget.style.color = S.muted}>
                                    <Info size={14} />
                                  </button>
                                  {/* Editar (só logado) */}
                                  {isLogged && (
                                    <button onClick={() => setEditReport({ ...rec })} title="Corrigir O.S (zera/edita)"
                                      style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', padding: '2px', display: 'flex', borderRadius: '4px' }}
                                      onMouseEnter={e => e.currentTarget.style.color = '#f59e0b'}
                                      onMouseLeave={e => e.currentTarget.style.color = '#fbbf24'}>
                                      <Edit2 size={14} />
                                    </button>
                                  )}
                                  {/* Excluir — apaga a LINHA da planilha (só logado) */}
                                  {isLogged && (
                                    <button onClick={() => handleDeleteRecord(rec)} title="Excluir lançamento (apaga a linha da planilha)"
                                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px', display: 'flex', borderRadius: '4px' }}
                                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                      onMouseLeave={e => e.currentTarget.style.color = '#f87171'}>
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {/* Serviços com contagem */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                {Object.entries(typeCounts).map(([svc, qty]) => (
                                  <span key={svc} style={{ background: S.surface, color: S.muted2, fontSize: '11px', padding: '3px 9px', borderRadius: '999px', border: `1px solid ${S.border}`, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ color: S.blue, fontWeight: 800 }}>{qty}x</span>{svc}
                                  </span>
                                ))}
                              </div>
                              {rec.observations && (
                                <p style={{ color: S.muted, fontSize: '11px', marginTop: '6px', fontStyle: 'italic' }}>"{rec.observations}"</p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Botões — exportações só para quem está logado */}
                      {isLogged && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setTextModalReport(report)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', border: '1px solid #60a5fa', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 12px rgba(59,130,246,0.25)' }}>
                          <FileText size={13}/>Texto
                        </button>
                        <button onClick={() => handleTechExcel(report)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #047857, #10b981)', border: '1px solid #34d399', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 12px rgba(16,185,129,0.25)' }}>
                          <FileSpreadsheet size={13}/>Excel
                        </button>
                        <button onClick={() => handleTechPDF(report)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #b91c1c, #ef4444)', border: '1px solid #f87171', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 12px rgba(239,68,68,0.25)' }}>
                          <Download size={13}/>PDF
                        </button>
                      </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </main>

      {/* OVERLAY */}
      {(editReport || historyTech || showGeneralText) && (
        <div onClick={() => { setEditReport(null); setHistoryTech(null); setShowGeneralText(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 49 }} />
      )}

      {/* MODAL — EDIT (Feature 1) */}
      <AnimatePresence>
        {editReport && (
          <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '500px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', padding: 'clamp(16px, 5vw, 28px)', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Edit2 size={17} color={S.blue} />
                  </div>
                  <div>
                    <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>Editar dia completo</div>
                    <div style={{ color: S.muted, fontSize: '12px' }}>{editReport.technicianName} · {editReport.date ? new Date(editReport.date + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</div>
                  </div>
                </div>
                <button onClick={() => setEditReport(null)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Total derivado — sempre igual à soma dos tipos */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px', background: S.input, border: `1px solid ${S.border}` }}>
                  <span style={{ color: S.muted, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Total de O.S</span>
                  <span style={{ color: S.green, fontWeight: 900, fontSize: '22px' }}>{(editReport.serviceTypes || []).length}</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Tipos de Serviço · quantidade por tipo</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {SERVICE_TYPES.map(svc => {
                      const qty = editTypeCount(svc);
                      const color = TYPE_COLORS[svc] || S.muted2;
                      return (
                        <div key={svc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '7px 10px 7px 12px', borderRadius: '10px', background: qty > 0 ? '#0f1d35' : S.input, border: `1px solid ${qty > 0 ? '#1e3a5f' : S.border}`, transition: 'all 0.15s' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: color, flexShrink: 0 }} />
                            <span style={{ color: qty > 0 ? S.text : S.muted2, fontSize: '13px', fontWeight: qty > 0 ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <button type="button" onClick={() => setEditTypeCount(svc, qty - 1)} disabled={qty === 0}
                              style={{ width: '26px', height: '26px', borderRadius: '8px', border: `1px solid ${S.border}`, background: 'transparent', color: qty === 0 ? S.muted : S.text, fontSize: '16px', fontWeight: 700, cursor: qty === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, opacity: qty === 0 ? 0.4 : 1 }}>−</button>
                            <span style={{ minWidth: '18px', textAlign: 'center', color: qty > 0 ? color : S.muted, fontWeight: 800, fontSize: '14px' }}>{qty}</span>
                            <button type="button" onClick={() => setEditTypeCount(svc, qty + 1)}
                              style={{ width: '26px', height: '26px', borderRadius: '8px', border: `1px solid ${S.blue}`, background: 'transparent', color: S.blue, fontSize: '16px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '10px', background: S.input, border: `1px solid ${S.border}`, cursor: 'pointer' }}
                  onClick={() => setEditReport(p => ({ ...p, rescheduled: !p.rescheduled }))}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '5px', border: `2px solid ${editReport.rescheduled ? S.orange : S.muted}`, background: editReport.rescheduled ? S.orange : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {editReport.rescheduled && <Check size={11} color="white" />}
                  </div>
                  <span style={{ color: S.muted2, fontSize: '13px' }}>Houve reagendamento?</span>
                </div>

                {editReport.rescheduled && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Quantidade Reagendamentos</label>
                    <input type="number" value={editReport.rescheduledCount || ''} onChange={e => setEditReport(p => ({ ...p, rescheduledCount: e.target.value }))}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Observações</label>
                  <textarea value={editReport.observations || ''} onChange={e => setEditReport(p => ({ ...p, observations: e.target.value }))} rows={3}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>

                {/* Limpar todo o relatório do dia */}
                <button onClick={clearEditReport} type="button"
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'transparent', border: `1px dashed ${S.border}`, color: S.muted2, fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = S.red; e.currentTarget.style.borderColor = '#7f1d1d'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = S.muted2; e.currentTarget.style.borderColor = S.border; }}>
                  <RotateCcw size={14}/>Limpar tudo (zerar o dia)
                </button>

                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  <button onClick={() => setEditReport(null)}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={handleSaveEdit} disabled={editLoading}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: editLoading ? 0.7 : 1 }}>
                    {editLoading ? <Spinner /> : <><Check size={16}/>Salvar dia</>}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL — HISTORY (Feature 2) */}
      <AnimatePresence>
        {historyTech && (
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
            className="r-history-panel" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50, background: S.surface, borderLeft: `1px solid ${S.border}`, boxShadow: '-20px 0 60px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#140f26', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <History size={17} color={S.purple} />
                </div>
                <div>
                  <div style={{ color: S.text, fontWeight: 800, fontSize: '15px' }}>{historyTech}</div>
                  <div style={{ color: S.muted, fontSize: '12px' }}>{techHistory.length} registro(s)</div>
                </div>
              </div>
              <button onClick={() => setHistoryTech(null)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {historyLoading ? (
                <p style={{ color: S.muted, fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>Carregando histórico…</p>
              ) : techHistory.length === 0 ? (
                <p style={{ color: S.muted, fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>Nenhum registro encontrado</p>
              ) : techHistory.map((r) => (
                <div key={r.id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ color: S.text, fontWeight: 700, fontSize: '13px' }}>{formatDate(r.date)}</span>
                    <span style={{ background: '#0f1d35', color: S.blue, fontSize: '11px', padding: '3px 8px', borderRadius: '999px', fontWeight: 700 }}>{r.totalOrders} O.S</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: r.observations ? '8px' : 0 }}>
                    {(r.serviceTypes || []).map((s, j) => (
                      <span key={j} style={{ background: '#1a2540', color: S.muted2, fontSize: '11px', padding: '2px 8px', borderRadius: '999px' }}>{s}</span>
                    ))}
                  </div>
                  {r.rescheduledCount > 0 && <div style={{ color: S.orange, fontSize: '12px', fontWeight: 600 }}>⟳ {r.rescheduledCount} reagendamento(s)</div>}
                  {r.observations && <div style={{ color: S.muted, fontSize: '12px', marginTop: '4px', fontStyle: 'italic' }}>"{r.observations}"</div>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL — GENERAL TEXT (Feature 6) */}
      <AnimatePresence>
        {showGeneralText && (
          <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '580px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', padding: 'clamp(16px, 5vw, 28px)', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: S.card2, border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={17} color={S.muted2} />
                  </div>
                  <div>
                    <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>Relatório Geral em Texto</div>
                    <div style={{ color: S.muted, fontSize: '12px' }}>{filteredReports.length} técnico(s)</div>
                  </div>
                </div>
                <button onClick={() => setShowGeneralText(false)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <pre style={{ flex: 1, overflowY: 'auto', background: S.input, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '16px', color: S.muted2, fontSize: '12px', lineHeight: 1.7, fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                {buildGeneralText()}
              </pre>
              <button onClick={handleCopyGeneral}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', background: copied ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
                {copied ? <><CheckCheck size={16}/>Copiado!</> : <><Copy size={16}/>Copiar Texto</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {textModalReport && <TextReportModal report={textModalReport} onClose={() => setTextModalReport(null)} />}

      {/* MODAL — Detalhamento pessoal de O.S por tipo (badge do técnico) */}
      <AnimatePresence>
        {personalModal && (() => {
          const recs = (personalModal._records && personalModal._records.length) ? personalModal._records : [personalModal];
          const counts = {};
          recs.forEach(r => (r.serviceTypes || []).forEach(s => { counts[s] = (counts[s] || 0) + 1; }));
          const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
          const totalSvc = rows.reduce((a, [, v]) => a + v, 0);
          return (
            <>
              <div onClick={() => setPersonalModal(null)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)', zIndex: 49 }} />
              <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
                style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
                <div style={{ width: '100%', maxWidth: '480px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ padding: '20px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '16px', flexShrink: 0 }}>
                        {(personalModal.technicianName || '?').charAt(0)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: S.text, fontWeight: 800, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{personalModal.technicianName}</div>
                        <div style={{ color: S.muted, fontSize: '12px' }}>{personalModal.totalOrders} O.S · {personalModal._dias > 1 ? `${personalModal._dias} dias` : '1 dia'}</div>
                      </div>
                    </div>
                    <button onClick={() => setPersonalModal(null)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', flexShrink: 0 }}><X size={18} /></button>
                  </div>
                  {/* Lista de tipos */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                    {rows.length === 0 ? (
                      <p style={{ color: S.muted, textAlign: 'center', padding: '30px 0' }}>Sem tipos de serviço registrados</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {rows.map(([svc, qty]) => {
                          const color = TYPE_COLORS[svc] || S.muted2;
                          return (
                            <div key={svc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', background: S.card, border: `1px solid ${S.border}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: color, flexShrink: 0 }} />
                                <span style={{ color: S.text, fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc}</span>
                              </div>
                              <span style={{ color, fontWeight: 800, fontSize: '15px', flexShrink: 0 }}>{qty}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Rodapé total */}
                  <div style={{ padding: '14px 24px', borderTop: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <span style={{ color: S.muted, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Total de serviços</span>
                    <span style={{ color: S.blue, fontWeight: 900, fontSize: '18px' }}>{totalSvc}</span>
                  </div>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* OVERLAY DE PROGRESSO — Exportações (bloqueia o site até concluir) */}
      <ProgressOverlay
        open={!!exportTask}
        progress={exportTask?.progress ?? 0}
        title={exportTask?.title || 'Gerando arquivo…'}
        subtitle={exportTask?.subtitle || ''} />


      {/* MODAL LOGIN (MODO EDIÇÃO) */}
      <AnimatePresence>
        {showLoginModal && (
          <>
            <div onClick={() => setShowLoginModal(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 49 }} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
              <div style={{ width: '100%', maxWidth: '400px', background: S.surface, border: '1px solid #3b82f6', borderRadius: '20px', boxShadow: '0 0 50px rgba(59,130,246,0.25)', padding: 'clamp(22px, 5vw, 32px)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '22px' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', boxShadow: '0 0 24px rgba(59,130,246,0.4)' }}>
                    <LogIn size={26} color="#fff" />
                  </div>
                  <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '18px' }}>Modo Edição</div>
                  <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>Entre para corrigir ordens de serviço</div>
                </div>
                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Email"
                  style={{ width: '100%', padding: '13px 16px', borderRadius: '12px', background: '#0f1624', border: '1px solid #1a2540', color: '#e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#1a2540'} />
                <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="Senha"
                  onKeyDown={e => { if (e.key === 'Enter') handleDashLogin(); }}
                  style={{ width: '100%', padding: '13px 16px', borderRadius: '12px', background: '#0f1624', border: '1px solid #1a2540', color: '#e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '20px' }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#1a2540'} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowLoginModal(false)}
                    style={{ flex: 1, padding: '13px', borderRadius: '12px', background: 'transparent', border: '1px solid #1a2540', color: '#94a3b8', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={handleDashLogin} disabled={loginLoading}
                    style={{ flex: 2, padding: '13px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: loginLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: loginLoading ? 0.7 : 1 }}>
                    {loginLoading ? <Spinner /> : <><LogIn size={16}/>Entrar</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL INFO DE AUTORIA */}
      <AnimatePresence>
        {infoModal && (
          <>
            <div onClick={() => setInfoModal(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)', zIndex: 49 }} />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
              style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
              <div style={{ width: '100%', maxWidth: '400px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', padding: 'clamp(20px, 5vw, 28px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#0f1d35', border: '1px solid #1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Info size={20} color={S.blue} />
                    </div>
                    <div>
                      <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>{infoModal.technicianName}</div>
                      <div style={{ color: S.muted, fontSize: '12px' }}>{formatDate(infoModal.date)}</div>
                    </div>
                  </div>
                  <button onClick={() => setInfoModal(null)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}><X size={18} /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { label: 'Lançado por', value: infoModal.createdByNickname || '—', color: '#34d399' },
                    { label: 'Registrado em', value: infoModal.createdAt ? new Date(infoModal.createdAt).toLocaleString('pt-BR') : (infoModal.submissionTime ? `${formatDate(infoModal.date)} às ${infoModal.submissionTime}` : '—') },
                    { label: 'Total de O.S', value: `${infoModal.totalOrders} ordens`, color: S.blue },
                    { label: 'Reagendamentos', value: `${infoModal.rescheduledCount || 0}`, color: (infoModal.rescheduledCount > 0 ? S.orange : S.muted2) },
                    ...(infoModal.importedFromExcel ? [{ label: 'Origem', value: 'Importado de planilha', color: '#a78bfa' }] : []),
                    ...(infoModal.editedByNickname ? [
                      { label: 'Editado por', value: infoModal.editedByNickname, color: '#fbbf24' },
                      { label: 'Editado em', value: infoModal.editedAt ? new Date(infoModal.editedAt).toLocaleString('pt-BR') : '—' },
                    ] : []),
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: S.card, border: `1px solid ${S.border}`, gap: '12px' }}>
                      <span style={{ color: S.muted, fontSize: '12px', flexShrink: 0 }}>{label}</span>
                      <span style={{ color: color || S.text, fontSize: '13px', fontWeight: 700, textAlign: 'right' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL EXPORTAR EXCEL */}
      <AnimatePresence>
        {showExcelModal && (
          <>
            <div onClick={() => setShowExcelModal(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)', zIndex: 49 }} />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
              style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
              <div style={{ width: '100%', maxWidth: '440px', background: S.surface, border: '1px solid #047857', borderRadius: '20px', boxShadow: '0 0 40px rgba(16,185,129,0.2)', padding: 'clamp(20px, 5vw, 28px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#052e1a', border: '1px solid #047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileSpreadsheet size={20} color="#10b981" />
                    </div>
                    <div>
                      <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>Exportar Excel</div>
                      <div style={{ color: S.muted, fontSize: '12px' }}>Escolha o período exato</div>
                    </div>
                  </div>
                  <button onClick={() => setShowExcelModal(false)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}><X size={18} /></button>
                </div>

                <div className="r-excel-dates" style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>De</div>
                    <input type="date" value={excelFrom} onChange={e => setExcelFrom(e.target.value)} onClick={e => { try { e.target.showPicker(); } catch { /* ignora */ } }}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', background: S.input2, border: '1px solid #047857', color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', colorScheme: mode, cursor: 'pointer' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Até</div>
                    <input type="date" value={excelTo} onChange={e => setExcelTo(e.target.value)} onClick={e => { try { e.target.showPicker(); } catch { /* ignora */ } }}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', background: S.input2, border: '1px solid #047857', color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', colorScheme: mode, cursor: 'pointer' }} />
                  </div>
                </div>

                <button onClick={handleExcelGenerate}
                  style={{ width: '100%', padding: '13px', borderRadius: '12px', background: 'linear-gradient(135deg, #047857, #10b981)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 0 20px rgba(16,185,129,0.25)' }}>
                  <Download size={16} />Gerar Excel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL GRÁFICO PIZZA */}
      <AnimatePresence>
        {showPie && (
          <>
            <div onClick={() => setShowPie(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)', zIndex: 49 }} />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
              style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
              <div style={{ width: '100%', maxWidth: '560px', background: S.surface, border: '1px solid #4c1d95', borderRadius: '20px', boxShadow: '0 0 50px rgba(124,58,237,0.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#2e1065', border: '1px solid #7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PieIcon size={20} color="#a78bfa" />
                    </div>
                    <div>
                      <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>Tipos de Serviço</div>
                      <div style={{ color: S.muted, fontSize: '12px' }}>{typeData.reduce((a, b) => a + b.value, 0)} O.S no período</div>
                    </div>
                  </div>
                  <button onClick={() => setShowPie(false)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}><X size={18} /></button>
                </div>

                {/* Conteúdo */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                  {typeData.length === 0 ? (
                    <p style={{ color: S.muted, textAlign: 'center', padding: '40px 0' }}>Nenhum serviço no período</p>
                  ) : (
                    <>
                      {/* Gráfico */}
                      <div style={{ width: '100%', height: '240px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2} stroke={S.surface} strokeWidth={2}>
                              {typeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                            </Pie>
                            <RTooltip
                              contentStyle={{ background: S.surface, border: '1px solid #4c1d95', borderRadius: '10px', color: S.text, fontSize: '13px' }}
                              formatter={(v, n) => [`${v} O.S (${typeData.find(t => t.name === n)?.pct || 0}%)`, n]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Legenda detalhada */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '16px' }}>
                        {typeData.map(d => (
                          <div key={d.name}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '10px', background: S.card, border: `1px solid ${S.border}`, transition: 'all 0.15s', cursor: 'default' }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.borderColor = d.color; e.currentTarget.style.background = '#11182a'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.card; }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: d.color, flexShrink: 0 }} />
                              <span style={{ color: S.text, fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                              <span style={{ color: d.color, fontWeight: 800, fontSize: '14px' }}>{d.value}</span>
                              <span style={{ color: S.muted, fontSize: '12px', minWidth: '36px', textAlign: 'right' }}>{d.pct}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL TOP 3 */}
      <AnimatePresence>
        {top3Modal && (
          <>
            <div onClick={() => setTop3Modal(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 49 }} />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
              style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
              <div style={{ width: '100%', maxWidth: '520px', background: S.surface, border: '1px solid #d97706', borderRadius: '20px', boxShadow: '0 0 40px rgba(217,119,6,0.2)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '22px 24px 18px', borderBottom: `1px solid ${S.border}`, flexShrink: 0, background: 'linear-gradient(135deg, #12100a, #0a0f1e)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid #d97706', background: '#78350f22', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', fontWeight: 900, fontSize: '18px' }}>
                        {(top3Modal.technicianName || '?').charAt(0)}
                      </div>
                      <div>
                        <div style={{ color: '#f59e0b', fontWeight: 900, fontSize: '16px' }}>{top3Modal.technicianName}</div>
                        <div style={{ color: S.muted, fontSize: '12px', marginTop: '2px' }}>
                          {top3Modal.totalOrders} O.S · {top3Modal._dias || 1} dia(s) · {top3Modal.rescheduledCount || 0} reagend.
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setTop3Modal(null)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}><X size={18} /></button>
                  </div>
                </div>

                {/* Conteúdo por dia */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(top3Modal._records || [])
                    .filter(r => r.totalOrders > 0)
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((rec, i) => {
                      const typeCounts = {};
                      (rec.serviceTypes || []).forEach(s => { typeCounts[s] = (typeCounts[s] || 0) + 1; });
                      return (
                        <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: S.blue, fontWeight: 700, fontSize: '12px' }}>
                                {new Date(rec.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                              </span>
                              {rec.submissionTime && <span style={{ color: S.muted, fontSize: '11px' }}>{rec.submissionTime}</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <span style={{ background: '#0f1d35', color: S.blue, fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 700, border: '1px solid #1e3a5f' }}>{rec.totalOrders} O.S</span>
                              {rec.rescheduledCount > 0 && <span style={{ background: '#1c1200', color: S.orange, fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>{rec.rescheduledCount} reagend.</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {Object.entries(typeCounts).map(([svc, qty]) => (
                              <span key={svc} style={{ background: S.surface, color: S.muted2, fontSize: '11px', padding: '3px 9px', borderRadius: '999px', border: `1px solid ${S.border}`, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ color: S.blue, fontWeight: 800 }}>{qty}x</span>{svc}
                              </span>
                            ))}
                          </div>
                          {rec.observations && <p style={{ color: S.muted, fontSize: '11px', marginTop: '6px', fontStyle: 'italic' }}>"{rec.observations}"</p>}
                        </div>
                      );
                    })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
