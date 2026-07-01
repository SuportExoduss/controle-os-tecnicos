import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import {
  Wifi, Search, Calendar, Download, FileText, FileSpreadsheet,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2,
  Lock, LogOut, LogIn, Sun, Moon, ClipboardEdit, X,
  Copy, CheckCheck, PieChart as PieIcon, Info, Users,
  ClipboardList, Gauge, Target, ListFilter, TrendingUp, TrendingDown, Layers, Trash2,
} from 'lucide-react';
import { AuthContext } from '../../../context/AuthContext';
import { ThemeContext } from '../../../context/ThemeContext';
import { chipStyle } from '../../../utils/chipStyle';
import { loginUser, logoutUser } from '../../../services/auth/authService';
import { getUserProfile } from '../../../services/database/userProfileService';
import { getNetworkOrdersCached, deleteNetworkOrder } from '../../../services/database/networkService';
import { deleteNetworkOrderInSheet } from '../../../services/integrations/networkSheetSync';
import { Spinner } from '../../../components/common/Spinner';
import { ProgressOverlay } from '../../../components/common/ProgressOverlay';
import { AreaTopbar } from '../../../components/common/AreaTopbar';

// ─── Constantes ────────────────────────────────────────────────────────────────

// Metas de SLA (horas) por assunto. AMPLIAÇÃO DE CTO não possui meta.
const META_SLA = {
  'LINK DOWN':        10,
  'CTO EM LOS':       12,
  'CTO SINAL ALTO':   16,
  'TROCA DE POSTES':  16,
};

const ASSUNTOS = ['LINK DOWN', 'CTO EM LOS', 'CTO SINAL ALTO', 'TROCA DE POSTES', 'AMPLIAÇÃO DE CTO'];

const ASSUNTO_COLOR = {
  'CTO EM LOS':       '#fca5a5',
  'CTO SINAL ALTO':   '#fcd34d',
  'LINK DOWN':        '#60a5fa',
  'TROCA DE POSTES':  '#6ee7b7',
  'AMPLIAÇÃO DE CTO': '#a78bfa',
};

const ASSUNTO_BADGE = {
  'CTO EM LOS':       { bg: '#2d1010', color: '#fca5a5', border: '#991b1b' },
  'CTO SINAL ALTO':   { bg: '#1c1200', color: '#fcd34d', border: '#92400e' },
  'LINK DOWN':        { bg: '#0f1d35', color: '#60a5fa', border: '#1e3a5f' },
  'TROCA DE POSTES':  { bg: '#0f2320', color: '#6ee7b7', border: '#065f46' },
  'AMPLIAÇÃO DE CTO': { bg: '#12103a', color: '#a78bfa', border: '#4c1d95' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

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

const fmtDateShort = (s) => {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const round1 = (n) => Math.round(n * 10) / 10;

// O.S encerrada = tem data de fechamento e SLA calculado
const isClosed = (o) => !!o.dataFechamento && o.slaHoras != null;

// Situação da média vs meta
const sitFromMedia = (media, meta) => {
  if (media == null) return { c: '#64748b', label: 'Sem dados' };
  if (meta == null)  return { c: '#a78bfa', label: 'Sem meta' };
  if (media <= meta)        return { c: '#4ade80', label: 'Dentro da meta' };
  if (media <= meta * 1.3)  return { c: '#fcd34d', label: 'Atenção' };
  return { c: '#f87171', label: 'Acima da meta' };
};

const fmtSaldo = (h) => `${h >= 0 ? '+' : '−'}${round1(Math.abs(h))}h`;

// Estatística de um conjunto de O.S, opcionalmente filtrado por assunto
const computeStats = (ords, assunto) => {
  const rel = assunto ? ords.filter(o => o.assunto === assunto) : ords;
  const closed = rel.filter(isClosed);
  const media = closed.length ? closed.reduce((a, o) => a + o.slaHoras, 0) / closed.length : null;
  let saldo = 0, metaSum = 0, metaN = 0;
  closed.forEach(o => {
    const m = META_SLA[o.assunto];
    if (m != null) { saldo += m - o.slaHoras; metaSum += m; metaN++; }
  });
  const metaRef = assunto ? (META_SLA[assunto] ?? null) : (metaN ? metaSum / metaN : null);
  const abertas = rel.filter(o => !o.dataFechamento).length;
  return {
    total: rel.length, closedCount: closed.length, abertas,
    media: media != null ? round1(media) : null,
    saldo: round1(saldo), hasMeta: metaN > 0,
    metaRef: metaRef != null ? round1(metaRef) : null,
  };
};

// ─── Componente principal ───────────────────────────────────────────────────────

export const NetworkDashboard = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useContext(AuthContext);
  const { S, mode, toggleTheme } = useContext(ThemeContext);

  const isLogged = !!user && !!profile?.nickname;

  const [orders, setOrders]     = useState([]);
  const [filtered, setFiltered] = useState([]); // agrupado por técnico
  const [loading, setLoading]   = useState(true);
  const [exportTask, setExportTask] = useState(null);

  // Filtros
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [searchTech, setSearchTech] = useState('');

  // Assunto selecionado (funil) — null = visão geral
  const [selectedAssunto, setSelectedAssunto] = useState(null);

  // UI
  const [expandedId, setExpandedId] = useState(null);
  const [showPie, setShowPie]       = useState(false);
  const [showTechPie, setShowTechPie] = useState(false);
  const [expandedTech, setExpandedTech] = useState(null);
  const [showText, setShowText]     = useState(false);
  const [copied, setCopied]         = useState(false);
  const [infoModal, setInfoModal]   = useState(null);

  // Login modal
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail]         = useState('');
  const [loginPass, setLoginPass]           = useState('');
  const [loginLoading, setLoginLoading]     = useState(false);
  const [redirectAfterLogin, setRedirectAfterLogin] = useState(null);

  // Excel modal
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelFrom, setExcelFrom] = useState('');
  const [excelTo, setExcelTo]     = useState('');

  const today        = localDate();
  const firstOfMonth = `${today.slice(0, 7)}-01`;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchOrders = async ({ force = false } = {}) => {
    try {
      const data = await getNetworkOrdersCached({ force });
      setOrders(data);
      filterOrders(data, '', '', '');
    } catch { toast.error('Erro ao carregar dados'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, []); // eslint-disable-line

  // Data "efetiva" para contabilizar no dashboard.
  // Registros importados são contados pela data de encerramento (ou abertura),
  // como se o relatório tivesse sido feito no dia do encerramento da ordem.
  // Registros lançados manualmente continuam sendo contados pela data de registro.
  const effDate = (o) => (
    o.lancadoPor === 'Importado'
      ? (o.dataFechamento || o.dataAbertura || o.data)
      : o.data
  ) || '';

  // ── Filtro + agrupamento por técnico ────────────────────────────────────────
  const filterOrders = (data, from, to, tech) => {
    const ef = from || firstOfMonth;
    const et = to   || today;

    let f = data.filter(o => { const d = effDate(o); return d >= ef && d <= et; });
    if (tech) f = f.filter(o => (o.tecnico || '').toLowerCase().includes(tech.toLowerCase()));

    const map = {};
    f.forEach(o => {
      const name = o.tecnico || 'Sem técnico';
      if (!map[name]) map[name] = { tecnico: name, _orders: [] };
      map[name]._orders.push(o);
    });
    setFiltered(Object.values(map));
  };

  const handleSearch = (from, to, tech) => {
    setDateFrom(from); setDateTo(to); setSearchTech(tech);
    filterOrders(orders, from, to, tech);
  };

  const goToPrevMonth = () => {
    const ref = dateFrom || firstOfMonth;
    const d = new Date(ref + 'T00:00:00');
    d.setMonth(d.getMonth() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const last = new Date(y, d.getMonth() + 1, 0).getDate();
    handleSearch(`${y}-${m}-01`, `${y}-${m}-${String(last).padStart(2, '0')}`, searchTech);
  };

  const goToNextMonth = () => {
    const ref = dateFrom || firstOfMonth;
    const d = new Date(ref + 'T00:00:00');
    d.setMonth(d.getMonth() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const last = new Date(y, d.getMonth() + 1, 0).getDate();
    const to = `${y}-${m}-${String(last).padStart(2, '0')}`;
    handleSearch(`${y}-${m}-01`, to > today ? today : to, searchTech);
  };

  const monthLabel = () => {
    const ref = dateFrom || firstOfMonth;
    return new Date(ref + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  // ── Métricas gerais ──────────────────────────────────────────────────────────
  const allFiltered = filtered.flatMap(g => g._orders);
  const totalOs     = allFiltered.length;
  const encerradas  = allFiltered.filter(isClosed).length;
  const abertas     = allFiltered.filter(o => !o.dataFechamento).length;
  const closedAll   = allFiltered.filter(isClosed);
  const slaMedioGeral = closedAll.length
    ? round1(closedAll.reduce((a, o) => a + o.slaHoras, 0) / closedAll.length)
    : null;

  // ── Agregado por assunto (sidebar + pizza) ────────────────────────────────────
  const assuntoStats = {};
  ASSUNTOS.forEach(a => { assuntoStats[a] = { count: 0, closed: 0, soma: 0, saldo: 0 }; });
  allFiltered.forEach(o => {
    const a = o.assunto;
    if (!assuntoStats[a]) assuntoStats[a] = { count: 0, closed: 0, soma: 0, saldo: 0 };
    assuntoStats[a].count++;
    if (isClosed(o)) {
      assuntoStats[a].closed++;
      assuntoStats[a].soma += o.slaHoras;
      const m = META_SLA[a];
      if (m != null) assuntoStats[a].saldo += m - o.slaHoras;
    }
  });
  const assuntoMedia = (a) => assuntoStats[a]?.closed ? round1(assuntoStats[a].soma / assuntoStats[a].closed) : null;

  // ── Pizza por assunto ─────────────────────────────────────────────────────────
  const pieData = ASSUNTOS
    .filter(a => assuntoStats[a]?.count > 0)
    .map(a => {
      const total = totalOs || 1;
      return {
        name: a, value: assuntoStats[a].count,
        pct: Math.round((assuntoStats[a].count / total) * 100),
        color: ASSUNTO_COLOR[a] || '#94a3b8',
        media: assuntoMedia(a), meta: META_SLA[a] ?? null, saldo: round1(assuntoStats[a].saldo),
      };
    })
    .sort((a, b) => b.value - a.value);

  // ── Linhas por técnico (conteúdo principal, respeitando o funil) ──────────────
  const techRows = filtered
    .map(g => ({ tecnico: g.tecnico, orders: g._orders, stats: computeStats(g._orders, selectedAssunto) }))
    .filter(r => r.stats.total > 0)
    .sort((a, b) => a.tecnico.localeCompare(b.tecnico, 'pt-BR', { sensitivity: 'base' }));

  const canExport = !!(dateFrom && dateTo);

  // ── Export helpers ──────────────────────────────────────────────────────────
  const runExport = async ({ title, subtitle, fn }) => {
    setExportTask({ progress: 0, title, subtitle });
    try { await fn(pct => setExportTask(t => t ? { ...t, progress: pct } : t)); }
    catch { toast.error('Erro ao exportar'); }
    finally { setExportTask(null); }
  };

  const handleExcelGenerate = () => {
    if (!excelFrom || !excelTo) { toast.error('Selecione início e fim'); return; }
    const rows = orders.filter(o => (o.data || '') >= excelFrom && (o.data || '') <= excelTo);
    if (!rows.length) { toast.error('Nenhuma O.S no período'); return; }

    setShowExcelModal(false);
    runExport({
      title: 'Gerando Excel…',
      subtitle: `${rows.length} O.S`,
      fn: async (onProgress) => {
        onProgress(10);
        const header = ['DATA REGISTRO', 'ID O.S', 'TÉCNICO', 'ASSUNTO', 'TRANSMISSOR', 'DATA ABERTURA', 'HORA ABERTURA', 'DATA FECHAMENTO', 'HORA FECHAMENTO', 'SLA (HORAS)', 'META (HORAS)', 'SALDO vs META', 'OBSERVAÇÃO'];
        const csvRows = [header, ...rows.map(o => {
          const meta = META_SLA[o.assunto];
          const saldo = (isClosed(o) && meta != null) ? round1(meta - o.slaHoras) : '';
          return [
            fmtDate(o.data), o.idOs, o.tecnico, o.assunto, o.transmissor,
            fmtDate(o.dataAbertura), o.horaAbertura || '', fmtDate(o.dataFechamento), o.horaFechamento || '',
            o.slaHoras ?? '', meta ?? '', saldo, o.observacao || '',
          ];
        })];
        onProgress(60);
        const csv = csvRows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `redes-${excelFrom}_a_${excelTo}.csv`;
        a.click(); URL.revokeObjectURL(url);
        onProgress(100);
        toast.success(`Excel gerado! ${rows.length} O.S`);
      },
    });
  };

  // ── Texto do relatório ──────────────────────────────────────────────────────
  const buildText = () => {
    const ef = dateFrom || firstOfMonth;
    const et = dateTo   || today;
    const fmt = s => new Date(s + 'T00:00:00').toLocaleDateString('pt-BR');
    const lines = [
      '╔══════════════════════════════════════════╗',
      '║   RELATÓRIO DE SLA — REDES IBIUNET       ║',
      '╚══════════════════════════════════════════╝',
      `Período: ${fmt(ef)} a ${fmt(et)}`,
      `Técnicos: ${techRows.length}  |  Encerradas: ${encerradas}  |  Em aberto: ${abertas}`,
      `SLA Médio Geral: ${slaMedioGeral != null ? slaMedioGeral + 'h' : 'N/A'}`,
      '─'.repeat(46),
      '\nMETAS DE SLA POR ASSUNTO:',
      ...ASSUNTOS.map(a => `  • ${a}: ${META_SLA[a] != null ? META_SLA[a] + 'h' : 'sem meta'}`),
      '─'.repeat(46),
      '\nSLA MÉDIO POR ASSUNTO:',
      ...ASSUNTOS.filter(a => assuntoStats[a]?.closed > 0).map(a => {
        const med = assuntoMedia(a);
        const meta = META_SLA[a];
        const sit = sitFromMedia(med, meta).label;
        return `  • ${a}: ${med}h ${meta != null ? `(meta ${meta}h, saldo ${fmtSaldo(assuntoStats[a].saldo)}) — ${sit}` : '(sem meta)'}`;
      }),
      '─'.repeat(46),
    ];
    techRows.forEach((r, i) => {
      const s = r.stats;
      lines.push(`\n[${i + 1}] ${r.tecnico}`);
      lines.push(`    Encerradas: ${s.closedCount}  |  Em aberto: ${s.abertas}  |  SLA médio: ${s.media != null ? s.media + 'h' : 'N/A'}${s.hasMeta ? `  |  Saldo: ${fmtSaldo(s.saldo)}` : ''}`);
    });
    lines.push('\n' + '─'.repeat(46));
    lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
    return lines.join('\n');
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(buildText());
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Erro ao copiar'); }
  };

  // ── Login ───────────────────────────────────────────────────────────────────
  const handleDashLogin = async () => {
    if (!loginEmail || !loginPass) { toast.error('Preencha email e senha'); return; }
    setLoginLoading(true);
    try {
      const cred = await loginUser(loginEmail, loginPass);
      const p = await getUserProfile(cred.user.uid);
      if (!p?.nickname) {
        toast.error('Faça o primeiro login pela tela de login para definir seu apelido.');
        await logoutUser(); setLoginLoading(false); return;
      }
      await refreshProfile(cred.user.uid);
      toast.success(`Bem-vindo, ${p.nickname}!`);
      setShowLoginModal(false); setLoginEmail(''); setLoginPass('');
      if (redirectAfterLogin) { navigate(redirectAfterLogin); setRedirectAfterLogin(null); }
    } catch { toast.error('Email ou senha incorretos'); }
    finally { setLoginLoading(false); }
  };

  const handleDashLogout = async () => {
    try { await logoutUser(); toast.success('Modo edição desativado'); } catch { /* ignora */ }
  };

  // ── Excluir O.S (somente logado) ──────────────────────────────────────────────
  const handleDeleteOrder = async (o) => {
    if (!window.confirm(`Excluir a O.S #${o.idOs} de ${o.tecnico}? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteNetworkOrder(o.id);
      deleteNetworkOrderInSheet(o.idOs); // planilha (best-effort)
      const novos = orders.filter(x => x.id !== o.id);
      setOrders(novos);
      filterOrders(novos, dateFrom, dateTo, searchTech);
      toast.success('O.S excluída');
    } catch { toast.error('Erro ao excluir'); }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <Spinner />
        <p style={{ color: S.muted, fontSize: '14px', marginTop: '12px' }}>Carregando...</p>
      </div>
    </div>
  );

  const slaColorGeral = slaMedioGeral == null ? S.muted : slaMedioGeral <= 12 ? '#4ade80' : slaMedioGeral <= 18 ? '#fcd34d' : '#f87171';

  const metrics = [
    { icon: Users,         label: 'Técnicos',       value: techRows.length, color: S.blue,  bg: '#0f1d35', glow: 'rgba(96,165,250,0.12)' },
    { icon: CheckCircle2,  label: 'O.S Encerradas', value: encerradas,      color: S.green, bg: '#0d2d1f', glow: 'rgba(52,211,153,0.12)' },
    { icon: Gauge,         label: 'SLA Médio Geral', value: slaMedioGeral != null ? `${slaMedioGeral}h` : 'N/A', color: slaColorGeral, bg: '#1c1200', glow: 'rgba(251,191,36,0.12)', small: true, onClick: () => setShowPie(true) },
  ];

  // ── Pizza de desempenho por técnico ───────────────────────────────────────────
  // Fatia maior = mais O.S encerradas + melhor SLA. Cor: verde (bom) → vermelho (ruim).
  const perfColor = (t) => `hsl(${Math.round((1 - t) * 130)}, 68%, 52%)`; // t: 0=melhor, 1=pior
  const techScored = techRows
    .map(r => {
      const s = r.stats;
      // fator de qualidade: meta/média (mais rápido = maior). Sem meta/dados → neutro.
      const quality = (s.media != null && s.metaRef) ? Math.min(Math.max(s.metaRef / s.media, 0.3), 2)
        : (s.media != null ? 1 : 0.4);
      const score = Math.max(s.closedCount * quality, 0.1);
      return { tecnico: r.tecnico, score, media: s.media, closed: s.closedCount, saldo: s.saldo, hasMeta: s.hasMeta };
    })
    .sort((a, b) => b.score - a.score);
  const techScoreTotal = techScored.reduce((a, t) => a + t.score, 0) || 1;
  const techPieData = techScored.map((t, i) => ({
    ...t,
    name: t.tecnico,
    value: round1(t.score),
    pct: Math.round((t.score / techScoreTotal) * 100),
    color: perfColor(techScored.length > 1 ? i / (techScored.length - 1) : 0),
  }));

  // ── Visibilidade das seções (montagem por partes) ─────────────────────────────
  const SHOW = {
    filtros:            true,
    metricas:           true,
    navMes:             true,
    pizzaTecnicos:      true,
    botaoPizzaAssunto:  false,
    conteudo:           false,
    sidebar:            true,
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', background: S.bg }}>

      <AreaTopbar
        S={S}
        mode={mode}
        area="redes"
        variant="dashboard"
        isLogged={isLogged}
        nickname={profile?.nickname}
        onTheme={toggleTheme}
        onPrimary={() => { if (isLogged) navigate('/redes/admin'); else { setRedirectAfterLogin('/redes/admin'); setShowLoginModal(true); } }}
        onAuth={() => isLogged ? handleDashLogout() : setShowLoginModal(true)}
        exportActions={[
          { label: 'Texto', onClick: () => { if (!canExport) { toast.error('Selecione período para exportar'); return; } if (!allFiltered.length) { toast.error('Nenhuma O.S no período'); return; } setShowText(true); } },
          { label: 'Excel', onClick: () => { setExcelFrom(dateFrom || firstOfMonth); setExcelTo(dateTo || today); setShowExcelModal(true); } },
        ]}
      />

      <main style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }} className="r-page-pad r-maxw">

        {/* ── FILTROS — só logado ── */}
        {SHOW.filtros && isLogged && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '13px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }} className="r-filter-grid">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' }}>
                  <Calendar size={11} />INÍCIO
                </div>
                <input type="date" value={dateFrom} onChange={e => handleSearch(e.target.value, dateTo, searchTech)}
                  onClick={e => { try { e.target.showPicker(); } catch { /* */ } }}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', background: S.input2, border: '1px solid #2a4a7f', color: dateFrom ? S.text : S.muted2, fontSize: '13px', outline: 'none', boxSizing: 'border-box', colorScheme: mode, cursor: 'pointer' }}
                  onFocus={e => e.target.style.borderColor = S.blue} onBlur={e => e.target.style.borderColor = '#2a4a7f'} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' }}>
                  <Calendar size={11} />FIM
                </div>
                <input type="date" value={dateTo} onChange={e => handleSearch(dateFrom, e.target.value, searchTech)}
                  onClick={e => { try { e.target.showPicker(); } catch { /* */ } }}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', background: S.input2, border: '1px solid #2a4a7f', color: dateTo ? S.text : S.muted2, fontSize: '13px', outline: 'none', boxSizing: 'border-box', colorScheme: mode, cursor: 'pointer' }}
                  onFocus={e => e.target.style.borderColor = S.blue} onBlur={e => e.target.style.borderColor = '#2a4a7f'} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' }}>
                  <Search size={11} />TÉCNICO
                </div>
                <input type="text" placeholder="Buscar técnico..." value={searchTech}
                  onChange={e => handleSearch(dateFrom, dateTo, e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box', colorScheme: mode }}
                  onFocus={e => e.target.style.borderColor = S.blue} onBlur={e => e.target.style.borderColor = S.border} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button onClick={goToPrevMonth}
                  style={{ padding: '4px 10px', borderRadius: '7px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>← Mês anterior</button>
                <button onClick={goToNextMonth}
                  style={{ padding: '4px 10px', borderRadius: '7px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Próximo mês →</button>
              </div>
              {(dateFrom || dateTo || searchTech) && (
                <button onClick={() => handleSearch('', '', '')}
                  style={{ fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '7px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, cursor: 'pointer' }}>Limpar filtros</button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── OUTER: esquerda (métricas+nav+pizza) | direita (assuntos) ── */}
        <div className="r-redes-outer">
        <div className="r-redes-left">

        {/* ── MÉTRICAS (topo) ── */}
        {SHOW.metricas && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="r-metrics3">
          {metrics.map(({ icon: Icon, label, value, color, glow, small, onClick, hint }) => (
            <div key={label} onClick={onClick}
              style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '20px', position: 'relative', overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', transition: 'all 0.15s' }}
              onMouseEnter={onClick ? (e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = color; }) : undefined}
              onMouseLeave={onClick ? (e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = S.border; }) : undefined}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', borderRadius: '50%', background: glow, filter: 'blur(30px)', pointerEvents: 'none' }} />
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: glow, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                <Icon size={17} color={color} />
              </div>
              <div style={{ color: S.muted, fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
              <div className={small ? '' : 'r-metric-value'} style={{ color, fontWeight: 900, fontSize: small ? '24px' : undefined, lineHeight: 1 }}>{value}</div>
              {onClick && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '10px', fontWeight: 700, color, letterSpacing: '0.5px', textTransform: 'uppercase', opacity: 0.85 }}>
                  <PieIcon size={10} />{hint || 'ver por assunto'}
                </div>
              )}
            </div>
          ))}
        </motion.div>
        )}

        {/* ── NAVEGAÇÃO MÊS — visitante ── */}
        {SHOW.navMes && !isLogged && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="r-month-nav">
            <button onClick={goToPrevMonth}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px 16px', borderRadius: '12px', background: S.card, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
              <ChevronDown size={16} style={{ transform: 'rotate(90deg)' }} />Mês anterior
            </button>
            <button onClick={goToNextMonth}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px 16px', borderRadius: '12px', background: S.card, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
              Próximo mês<ChevronDown size={16} style={{ transform: 'rotate(-90deg)' }} />
            </button>
          </motion.div>
        )}

        {/* ── PIZZA DE DESEMPENHO POR TÉCNICO ── */}
        {SHOW.pizzaTecnicos && techPieData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="r-pizza-panel"
            style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <PieIcon size={15} color={S.blue} />
              <span style={{ color: S.text, fontWeight: 800, fontSize: '14px' }}>Desempenho por Técnico</span>
            </div>
            <div style={{ color: S.muted, fontSize: '11px', marginBottom: '14px' }}>
              Fatia maior = mais O.S encerradas e melhor SLA · {selectedAssunto || 'todos os assuntos'} · {monthLabel()}
            </div>
            <div className="r-pizza-flex">
              <div className="r-pizza-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={techPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={92} paddingAngle={2} stroke={S.surface} strokeWidth={2}>
                      {techPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <RTooltip
                      contentStyle={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', color: S.text, fontSize: '13px' }}
                      formatter={(v, n) => {
                        const t = techPieData.find(x => x.name === n);
                        return [`${t?.closed ?? 0} encerradas · SLA ${t?.media != null ? t.media + 'h' : 'N/A'}`, n];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="r-pizza-legend">
                {techPieData.map((d, i) => {
                  const open = expandedTech === d.tecnico;
                  return (
                  <button key={d.name} onClick={() => setExpandedTech(open ? null : d.tecnico)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '10px', background: open ? '#11182a' : S.input, border: `1px solid ${open ? d.color : S.border}`, cursor: 'pointer', transition: 'all 0.15s', gap: '10px', textAlign: 'left' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = d.color; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = open ? d.color : S.border; }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: S.muted, minWidth: '16px' }}>{i + 1}º</span>
                      <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: d.color, flexShrink: 0 }} />
                      <span style={{ color: S.text, fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.tecnico}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{ background: S.accentSoft, color: S.accent, border: `1px solid ${S.accent}`, fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '999px' }}>{d.closed} O.S</span>
                      <span style={{ color: d.color, fontWeight: 800, fontSize: '13px', minWidth: '42px', textAlign: 'right' }}>{d.media != null ? `${d.media}h` : '—'}</span>
                    </div>
                  </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── BOTÃO GRÁFICO PIZZA POR ASSUNTO ── */}
        {SHOW.botaoPizzaAssunto && (
        <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          onClick={() => setShowPie(true)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', border: '1px solid #c4b5fd', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 16px rgba(167,139,250,0.3)', transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
          <PieIcon size={16} />Relatório de SLA por Assunto (Pizza)
        </motion.button>
        )}

        </div>{/* fim r-redes-left */}

        {/* ── COLUNA DIREITA: CONTEÚDO (funil) + SIDEBAR (assuntos) ── */}
        {(SHOW.conteudo || SHOW.sidebar) && (
        <div className={(SHOW.conteudo && SHOW.sidebar) ? 'r-redes-grid' : ''} style={{ minWidth: 0 }}>

          {/* SIDEBAR — assuntos clicáveis (à direita) */}
          {SHOW.sidebar && (
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className="r-redes-side"
            style={{ order: 2, background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <ListFilter size={15} color={S.blue} />
              <span style={{ color: S.text, fontWeight: 800, fontSize: '13px' }}>Assuntos</span>
            </div>
            <div className="r-redes-side-list">
              {/* Visão geral */}
              <button onClick={() => setSelectedAssunto(null)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: selectedAssunto === null ? '#0d1d3a' : S.input, border: `1px solid ${selectedAssunto === null ? S.blue : S.border}`, cursor: 'pointer', transition: 'all 0.15s', flex: '1 1 auto', minWidth: '150px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: S.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Layers size={14} color="#fff" />
                </div>
                <div style={{ minWidth: 0, textAlign: 'left' }}>
                  <div style={{ color: selectedAssunto === null ? S.blue : S.text, fontWeight: 700, fontSize: '12px' }}>Visão Geral</div>
                  <div style={{ color: S.muted, fontSize: '10px' }}>{slaMedioGeral != null ? `Média ${slaMedioGeral}h` : 'Todos'}</div>
                </div>
              </button>

              {ASSUNTOS.map(a => {
                const st = assuntoStats[a] || { count: 0 };
                const med = assuntoMedia(a);
                const meta = META_SLA[a] ?? null;
                const sit = sitFromMedia(med, meta);
                const sel = selectedAssunto === a;
                return (
                  <button key={a} onClick={() => setSelectedAssunto(sel ? null : a)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: sel ? '#11182a' : S.input, border: `1px solid ${sel ? ASSUNTO_COLOR[a] : S.border}`, cursor: 'pointer', transition: 'all 0.15s', flex: '1 1 auto', minWidth: '150px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: ASSUNTO_COLOR[a], flexShrink: 0, boxShadow: `0 0 6px ${ASSUNTO_COLOR[a]}` }} />
                    <div style={{ minWidth: 0, textAlign: 'left', flex: 1 }}>
                      <div style={{ color: sel ? ASSUNTO_COLOR[a] : S.text, fontWeight: 700, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a}</div>
                      <div style={{ color: S.muted, fontSize: '10px' }}>
                        {med != null ? `${med}h` : 's/ dados'}{meta != null ? ` · meta ${meta}h` : ' · sem meta'}
                      </div>
                    </div>
                    <span style={{ flexShrink: 0, background: S.accentSoft, color: S.accent, border: `1px solid ${S.accent}`, fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '999px' }}>{st.count}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
          )}

          {/* CONTEÚDO — relatório por técnico (funil) */}
          {SHOW.conteudo && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            style={{ order: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Barra de contexto do funil */}
            <div style={{ background: S.card, border: `1px solid ${selectedAssunto ? ASSUNTO_COLOR[selectedAssunto] : S.border}`, borderRadius: '14px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {selectedAssunto
                  ? <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: ASSUNTO_COLOR[selectedAssunto], boxShadow: `0 0 8px ${ASSUNTO_COLOR[selectedAssunto]}` }} />
                  : <Target size={16} color={S.blue} />}
                <div>
                  <div style={{ color: S.text, fontWeight: 800, fontSize: '14px' }}>
                    {selectedAssunto || 'SLA Geral por Técnico'}
                  </div>
                  <div style={{ color: S.muted, fontSize: '11px' }}>
                    {selectedAssunto
                      ? `Meta ${META_SLA[selectedAssunto] != null ? META_SLA[selectedAssunto] + 'h' : 'não definida'} · ${monthLabel()}`
                      : `Média de todos os assuntos · ${monthLabel()}`}
                  </div>
                </div>
              </div>
              {selectedAssunto && (
                <button onClick={() => setSelectedAssunto(null)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '8px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  <X size={12} />Limpar funil
                </button>
              )}
            </div>

            {techRows.length === 0 ? (
              <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '60px 20px', textAlign: 'center' }}>
                <Gauge size={40} color={S.border} style={{ margin: '0 auto 16px' }} />
                <p style={{ color: S.muted2, fontWeight: 700, fontSize: '16px' }}>Nenhuma O.S em {monthLabel()}</p>
                <p style={{ color: S.muted, fontSize: '13px', marginTop: '6px', marginBottom: '20px' }}>
                  {selectedAssunto ? 'Nenhum registro deste assunto no período.' : 'Não há registros neste período.'}
                </p>
                <button onClick={goToPrevMonth}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', background: S.gradient, border: 'none', color: S.onAccent, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  ← Ver mês anterior
                </button>
              </div>
            ) : techRows.map((r, idx) => {
              const s = r.stats;
              const sit = sitFromMedia(s.media, s.metaRef);
              // funil: largura da barra relativa (média vs meta)
              const scale = s.metaRef ? Math.max(s.metaRef, s.media || 0) * 1.4 || 1 : (s.media || 1) * 1.4;
              const fillPct = s.media != null ? Math.min((s.media / scale) * 100, 100) : 0;
              const markerPct = s.metaRef ? Math.min((s.metaRef / scale) * 100, 100) : null;
              const expanded = expandedId === r.tecnico;
              return (
                <motion.div key={r.tecnico} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                  style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', overflow: 'hidden' }}>

                  {/* Cabeçalho */}
                  <div onClick={() => setExpandedId(expanded ? null : r.tecnico)}
                    style={{ padding: '16px 20px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '16px', flexShrink: 0 }}>
                          {(r.tecnico || '?').charAt(0)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: S.text, fontWeight: 700, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.tecnico}</div>
                          <div style={{ color: S.muted, fontSize: '12px', marginTop: '2px' }}>
                            {s.closedCount} encerrada{s.closedCount !== 1 ? 's' : ''}
                            {s.abertas > 0 && <span style={{ color: '#f87171', marginLeft: '6px' }}>· {s.abertas} em aberto</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {/* Média SLA */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: sit.c, fontWeight: 900, fontSize: '20px', lineHeight: 1 }}>
                            {s.media != null ? `${s.media}h` : '—'}
                          </div>
                          <div style={{ color: S.muted, fontSize: '10px', fontWeight: 600 }}>SLA médio</div>
                        </div>
                        <div style={{ color: expanded ? S.blue : S.muted, display: 'flex', padding: '4px' }}>
                          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>

                    {/* Barra funil média vs meta */}
                    <div style={{ position: 'relative', height: '10px', borderRadius: '999px', background: S.input, overflow: 'visible', marginBottom: '8px' }}>
                      <motion.div animate={{ width: `${fillPct}%` }} transition={{ duration: 0.5 }}
                        style={{ height: '100%', borderRadius: '999px', background: sit.c }} />
                      {markerPct != null && (
                        <div style={{ position: 'absolute', top: '-3px', left: `${markerPct}%`, width: '2px', height: '16px', background: S.text, opacity: 0.6 }} title={`Meta ${s.metaRef}h`} />
                      )}
                    </div>

                    {/* Saldo de carga + situação */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: sit.c }}>{sit.label}{s.metaRef ? ` · meta ${s.metaRef}h` : ''}</span>
                      {s.hasMeta && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '999px',
                          background: s.saldo >= 0 ? '#052e16' : '#2d1010', color: s.saldo >= 0 ? '#4ade80' : '#f87171', border: `1px solid ${s.saldo >= 0 ? '#166534' : '#991b1b'}` }}>
                          {s.saldo >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                          {s.saldo >= 0 ? 'Folga ' : 'Atraso '}{fmtSaldo(s.saldo)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expandido — O.S do técnico (respeitando funil) */}
                  <AnimatePresence>
                    {expanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '14px 20px', borderTop: `1px solid ${S.border}`, background: S.input, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                            {(selectedAssunto ? r.orders.filter(o => o.assunto === selectedAssunto) : r.orders)
                              .sort((a, b) => (a.dataAbertura || '').localeCompare(b.dataAbertura || ''))
                              .map(o => {
                                const ab = chipStyle(ASSUNTO_BADGE[o.assunto], mode);
                                const meta = META_SLA[o.assunto];
                                const closed = isClosed(o);
                                const saldoOs = (closed && meta != null) ? round1(meta - o.slaHoras) : null;
                                const slaColor = !closed ? '#93c5fd' : meta == null ? '#a78bfa' : o.slaHoras <= meta ? '#4ade80' : o.slaHoras <= meta * 1.3 ? '#fcd34d' : '#f87171';
                                return (
                                  <div key={o.id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                                        <span style={{ color: S.blue, fontWeight: 700, fontSize: '12px' }}>O.S #{o.idOs}</span>
                                        <span style={{ fontSize: '11px', color: S.muted }}>{fmtDateShort(o.dataAbertura)}</span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                        <span style={{ background: '#0d1424', color: slaColor, border: `1px solid ${slaColor}55`, fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>
                                          {closed ? `${o.slaHoras}h` : 'Em aberto'}
                                        </span>
                                        {saldoOs != null && (
                                          <span style={{ fontSize: '10px', fontWeight: 800, color: saldoOs >= 0 ? '#4ade80' : '#f87171' }}>{fmtSaldo(saldoOs)}</span>
                                        )}
                                        <button onClick={() => setInfoModal(o)} title="Detalhes"
                                          style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', padding: '2px', display: 'flex' }}
                                          onMouseEnter={e => e.currentTarget.style.color = S.blue}
                                          onMouseLeave={e => e.currentTarget.style.color = S.muted}>
                                          <Info size={14} />
                                        </button>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                      <span style={{ background: ab.bg, color: ab.color, border: `1px solid ${ab.border}`, fontSize: '11px', padding: '3px 9px', borderRadius: '999px', fontWeight: 600 }}>{o.assunto}</span>
                                      <span style={{ background: S.surface, color: S.muted2, fontSize: '11px', padding: '3px 9px', borderRadius: '999px', border: `1px solid ${S.border}`, fontWeight: 600 }}>{o.transmissor}</span>
                                      {meta != null && <span style={{ background: S.surface, color: S.muted, fontSize: '11px', padding: '3px 9px', borderRadius: '999px', border: `1px solid ${S.border}` }}>meta {meta}h</span>}
                                    </div>
                                    {o.observacao && <p style={{ color: S.muted, fontSize: '11px', marginTop: '6px', fontStyle: 'italic' }}>"{o.observacao}"</p>}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
          )}
        </div>
        )}

        </div>{/* fim r-redes-outer */}
      </main>

      {/* ── OVERLAYS ── */}
      {(showLoginModal || showText || showPie || showTechPie || infoModal || expandedTech) && (
        <div onClick={() => { setShowLoginModal(false); setShowText(false); setShowPie(false); setShowTechPie(false); setInfoModal(null); setExpandedTech(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 49 }} />
      )}
      {showExcelModal && (
        <div onClick={() => setShowExcelModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 49 }} />
      )}

      {/* ── MODAL LOGIN ── */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '400px', background: S.surface, border: `1px solid ${S.accent}`, borderRadius: '20px', boxShadow: `0 0 50px ${S.glow}`, padding: 'clamp(22px, 5vw, 32px)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '22px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: S.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', boxShadow: `0 0 24px ${S.glow}` }}>
                  <LogIn size={26} color={S.onAccent} />
                </div>
                <div style={{ color: S.text, fontWeight: 800, fontSize: '18px' }}>Modo Edição</div>
                <div style={{ color: S.muted, fontSize: '13px', marginTop: '4px' }}>Entre para registrar e editar ordens de serviço</div>
              </div>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Email"
                style={{ width: '100%', padding: '13px 16px', borderRadius: '12px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }}
                onFocus={e => e.target.style.borderColor = S.accent} onBlur={e => e.target.style.borderColor = S.border} />
              <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="Senha"
                onKeyDown={e => { if (e.key === 'Enter') handleDashLogin(); }}
                style={{ width: '100%', padding: '13px 16px', borderRadius: '12px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '20px' }}
                onFocus={e => e.target.style.borderColor = S.accent} onBlur={e => e.target.style.borderColor = S.border} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowLoginModal(false)}
                  style={{ flex: 1, padding: '13px', borderRadius: '12px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={handleDashLogin} disabled={loginLoading}
                  style={{ flex: 2, padding: '13px', borderRadius: '12px', background: S.gradient, border: 'none', color: S.onAccent, fontSize: '14px', fontWeight: 700, cursor: loginLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: loginLoading ? 0.7 : 1 }}>
                  {loginLoading ? <Spinner /> : <><LogIn size={16} />Entrar</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL TEXTO ── */}
      <AnimatePresence>
        {showText && (
          <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '580px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', padding: 'clamp(16px, 5vw, 28px)', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: S.card2, border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={17} color={S.muted2} />
                  </div>
                  <div>
                    <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>Relatório de SLA</div>
                    <div style={{ color: S.muted, fontSize: '12px' }}>{encerradas} encerradas · {techRows.length} técnico(s)</div>
                  </div>
                </div>
                <button onClick={() => setShowText(false)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <pre style={{ flex: 1, overflowY: 'auto', background: S.input, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '16px', color: S.muted2, fontSize: '12px', lineHeight: 1.7, fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                {buildText()}
              </pre>
              <button onClick={handleCopyText}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', background: copied ? 'linear-gradient(135deg, #059669, #10b981)' : S.gradient, border: 'none', color: copied ? '#fff' : S.onAccent, fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
                {copied ? <><CheckCheck size={16} />Copiado!</> : <><Copy size={16} />Copiar Texto</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL EXCEL ── */}
      <AnimatePresence>
        {showExcelModal && (
          <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '440px', background: S.surface, border: '1px solid #047857', borderRadius: '20px', boxShadow: '0 0 40px rgba(16,185,129,0.2)', padding: 'clamp(20px, 5vw, 28px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: S.okBg, border: `1px solid ${S.okBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileSpreadsheet size={20} color="#10b981" />
                  </div>
                  <div>
                    <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>Exportar Excel</div>
                    <div style={{ color: S.muted, fontSize: '12px' }}>Escolha o período exato</div>
                  </div>
                </div>
                <button onClick={() => setShowExcelModal(false)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>De</div>
                  <input type="date" value={excelFrom} onChange={e => setExcelFrom(e.target.value)}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', background: S.input2, border: '1px solid #047857', color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', colorScheme: mode, cursor: 'pointer' }} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Até</div>
                  <input type="date" value={excelTo} onChange={e => setExcelTo(e.target.value)}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', background: S.input2, border: '1px solid #047857', color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', colorScheme: mode, cursor: 'pointer' }} />
                </div>
              </div>
              <button onClick={handleExcelGenerate}
                style={{ width: '100%', padding: '13px', borderRadius: '12px', background: 'linear-gradient(135deg, #047857, #10b981)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 0 20px rgba(16,185,129,0.25)' }}>
                <Download size={16} />Gerar Excel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL PIZZA / SLA POR ASSUNTO ── */}
      <AnimatePresence>
        {showPie && (
          <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '560px', background: S.surface, border: '1px solid #4c1d95', borderRadius: '20px', boxShadow: '0 0 50px rgba(124,58,237,0.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#2e1065', border: '1px solid #7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Gauge size={20} color="#a78bfa" />
                  </div>
                  <div>
                    <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>SLA Geral por Assunto</div>
                    <div style={{ color: S.muted, fontSize: '12px' }}>{encerradas} encerradas · média geral {slaMedioGeral != null ? slaMedioGeral + 'h' : 'N/A'}</div>
                  </div>
                </div>
                <button onClick={() => setShowPie(false)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                {pieData.length === 0 ? (
                  <p style={{ color: S.muted, textAlign: 'center', padding: '40px 0' }}>Nenhuma O.S no período</p>
                ) : (
                  <>
                    <div style={{ width: '100%', height: '220px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={92} paddingAngle={2} stroke={S.surface} strokeWidth={2}>
                            {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <RTooltip
                            contentStyle={{ background: S.surface, border: '1px solid #4c1d95', borderRadius: '10px', color: S.text, fontSize: '13px' }}
                            formatter={(v, n) => [`${v} O.S (${pieData.find(t => t.name === n)?.pct || 0}%)`, n]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '16px' }}>
                      {pieData.map(d => {
                        const sit = sitFromMedia(d.media, d.meta);
                        return (
                          <button key={d.name} onClick={() => { setSelectedAssunto(d.name); setShowPie(false); }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '10px', background: S.card, border: `1px solid ${S.border}`, transition: 'all 0.15s', cursor: 'pointer', gap: '10px', textAlign: 'left' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = d.color; e.currentTarget.style.background = '#11182a'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.card; }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: d.color, flexShrink: 0 }} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ color: S.text, fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                                <div style={{ color: S.muted, fontSize: '11px' }}>
                                  {d.value} O.S · {d.meta != null ? `meta ${d.meta}h` : 'sem meta'}
                                  {d.meta != null && d.media != null && ` · saldo ${fmtSaldo(d.saldo)}`}
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ color: sit.c, fontWeight: 900, fontSize: '15px' }}>{d.media != null ? `${d.media}h` : '—'}</div>
                              <div style={{ color: sit.c, fontSize: '10px', fontWeight: 600 }}>{sit.label}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL PIZZA / DESEMPENHO POR TÉCNICO ── */}
      <AnimatePresence>
        {showTechPie && (
          <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '560px', background: S.surface, border: '1px solid #4c1d95', borderRadius: '20px', boxShadow: '0 0 50px rgba(124,58,237,0.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#2e1065', border: '1px solid #7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PieIcon size={20} color="#a78bfa" />
                  </div>
                  <div>
                    <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>Desempenho por Técnico</div>
                    <div style={{ color: S.muted, fontSize: '12px' }}>Fatia maior = mais O.S encerradas e melhor SLA · {selectedAssunto || 'todos os assuntos'}</div>
                  </div>
                </div>
                <button onClick={() => setShowTechPie(false)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                {techPieData.length === 0 ? (
                  <p style={{ color: S.muted, textAlign: 'center', padding: '40px 0' }}>Nenhuma O.S no período</p>
                ) : (
                  <>
                    <div style={{ width: '100%', height: '220px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={techPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={92} paddingAngle={2} stroke={S.surface} strokeWidth={2}>
                            {techPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <RTooltip
                            contentStyle={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', color: S.text, fontSize: '13px' }}
                            formatter={(v, n) => {
                              const t = techPieData.find(x => x.name === n);
                              return [`${t?.closed ?? 0} encerradas · SLA ${t?.media != null ? t.media + 'h' : 'N/A'}`, n];
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '16px' }}>
                      {techPieData.map((d, i) => (
                        <button key={d.name} onClick={() => { handleSearch(dateFrom, dateTo, searchTech === d.tecnico ? '' : d.tecnico); setShowTechPie(false); }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '10px', background: S.card, border: `1px solid ${S.border}`, cursor: 'pointer', transition: 'all 0.15s', gap: '10px', textAlign: 'left' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = d.color; e.currentTarget.style.background = '#11182a'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.card; }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: S.muted, minWidth: '18px' }}>{i + 1}º</span>
                            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: d.color, flexShrink: 0 }} />
                            <span style={{ color: S.text, fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.tecnico}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                            <span style={{ color: S.muted, fontSize: '11px' }}>{d.closed} O.S</span>
                            <span style={{ color: d.color, fontWeight: 800, fontSize: '14px', minWidth: '42px', textAlign: 'right' }}>{d.media != null ? `${d.media}h` : '—'}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL O.S DO TÉCNICO ── */}
      <AnimatePresence>
        {expandedTech && (() => {
          const row = techRows.find(r => r.tecnico === expandedTech);
          const list = row ? (selectedAssunto ? row.orders.filter(o => o.assunto === selectedAssunto) : row.orders)
            .slice().sort((a, b) => (b.dataAbertura || '').localeCompare(a.dataAbertura || '')) : [];
          const stat = row ? row.stats : null;
          return (
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
              style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
              <div style={{ width: '100%', maxWidth: '520px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Cabeçalho */}
                <div style={{ padding: '20px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: S.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.onAccent, fontWeight: 900, fontSize: '16px', flexShrink: 0 }}>
                      {(expandedTech || '?').charAt(0)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: S.text, fontWeight: 800, fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{expandedTech}</div>
                      <div style={{ color: S.muted, fontSize: '12px' }}>
                        {selectedAssunto || 'Todos os assuntos'} · {list.length} O.S
                        {stat && stat.media != null && <span style={{ color: sitFromMedia(stat.media, stat.metaRef).c, fontWeight: 700 }}> · SLA {stat.media}h</span>}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setExpandedTech(null)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', flexShrink: 0 }}><X size={18} /></button>
                </div>
                {/* Lista com scroll */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {list.length === 0 ? (
                    <div style={{ textAlign: 'center', color: S.muted, fontSize: '13px', padding: '30px 0' }}>Nenhuma O.S deste assunto.</div>
                  ) : list.map(o => {
                    const ab = chipStyle(ASSUNTO_BADGE[o.assunto], mode);
                    const meta = META_SLA[o.assunto];
                    const closed = isClosed(o);
                    const saldoOs = (closed && meta != null) ? round1(meta - o.slaHoras) : null;
                    const slaColor = !closed ? '#93c5fd' : meta == null ? '#a78bfa' : o.slaHoras <= meta ? '#4ade80' : o.slaHoras <= meta * 1.3 ? '#fcd34d' : '#f87171';
                    return (
                      <div key={o.id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <span style={{ color: S.blue, fontWeight: 800, fontSize: '13px' }}>O.S #{o.idOs}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ background: '#0d1424', color: slaColor, border: `1px solid ${slaColor}55`, fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>
                              {closed ? `SLA ${o.slaHoras}h` : 'Em aberto'}
                            </span>
                            {saldoOs != null && (
                              <span style={{ fontSize: '11px', fontWeight: 800, color: saldoOs >= 0 ? '#4ade80' : '#f87171' }}>{fmtSaldo(saldoOs)}</span>
                            )}
                            {isLogged && (
                              <button onClick={() => handleDeleteOrder(o)} title="Excluir O.S"
                                style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', padding: '2px', display: 'flex', borderRadius: '6px' }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = '#2d0f0f'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = S.muted; e.currentTarget.style.background = 'none'; }}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                          <span style={{ background: ab.bg, color: ab.color, border: `1px solid ${ab.border}`, fontSize: '11px', padding: '3px 9px', borderRadius: '999px', fontWeight: 600 }}>{o.assunto}</span>
                          <span style={{ background: S.surface, color: S.muted2, fontSize: '11px', padding: '3px 9px', borderRadius: '999px', border: `1px solid ${S.border}`, fontWeight: 600 }}>{o.transmissor}</span>
                          {meta != null && <span style={{ background: S.surface, color: S.muted, fontSize: '11px', padding: '3px 9px', borderRadius: '999px', border: `1px solid ${S.border}` }}>meta {meta}h</span>}
                        </div>
                        <div className="r-os-info">
                          <div style={{ color: S.muted }}>Abertura: <span style={{ color: S.muted2, fontWeight: 600 }}>{fmtDate(o.dataAbertura)}{o.horaAbertura ? ' ' + o.horaAbertura : ''}</span></div>
                          <div style={{ color: S.muted }}>Encerramento: <span style={{ color: S.muted2, fontWeight: 600 }}>{o.dataFechamento ? `${fmtDate(o.dataFechamento)}${o.horaFechamento ? ' ' + o.horaFechamento : ''}` : '—'}</span></div>
                          <div style={{ color: S.muted }}>Registro: <span style={{ color: S.muted2, fontWeight: 600 }}>{fmtDate(o.data)}</span></div>
                          <div style={{ color: S.muted }}>Por: <span style={{ color: '#34d399', fontWeight: 600 }}>{o.lancadoPor || '—'}</span></div>
                        </div>
                        {o.observacao && <p style={{ color: S.muted, fontSize: '11px', marginTop: '6px', fontStyle: 'italic' }}>"{o.observacao}"</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── MODAL INFO O.S ── */}
      <AnimatePresence>
        {infoModal && (
          <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '400px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', padding: 'clamp(20px, 5vw, 28px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: S.accentSoft, border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Info size={20} color={S.blue} />
                  </div>
                  <div>
                    <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>O.S #{infoModal.idOs}</div>
                    <div style={{ color: S.muted, fontSize: '12px' }}>{infoModal.tecnico}</div>
                  </div>
                </div>
                <button onClick={() => setInfoModal(null)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(() => {
                  const meta = META_SLA[infoModal.assunto];
                  const closed = isClosed(infoModal);
                  const saldoOs = (closed && meta != null) ? fmtSaldo(round1(meta - infoModal.slaHoras)) : '—';
                  const slaColor = !closed ? '#93c5fd' : meta == null ? '#a78bfa' : infoModal.slaHoras <= meta ? '#4ade80' : infoModal.slaHoras <= meta * 1.3 ? '#fcd34d' : '#f87171';
                  return [
                    { label: 'Transmissor',        value: infoModal.transmissor || '—' },
                    { label: 'Tipo de Ocorrência', value: infoModal.assunto || '—', color: ASSUNTO_COLOR[infoModal.assunto] },
                    { label: 'Abertura',           value: `${fmtDate(infoModal.dataAbertura)}${infoModal.horaAbertura ? ' ' + infoModal.horaAbertura : ''}` },
                    { label: 'Encerramento',       value: infoModal.dataFechamento ? `${fmtDate(infoModal.dataFechamento)}${infoModal.horaFechamento ? ' ' + infoModal.horaFechamento : ''}` : '—' },
                    { label: 'SLA',                value: closed ? `${infoModal.slaHoras}h` : 'Em aberto', color: slaColor },
                    { label: 'Meta do assunto',    value: meta != null ? `${meta}h` : 'Sem meta' },
                    { label: 'Saldo vs meta',      value: saldoOs, color: saldoOs !== '—' ? (saldoOs.startsWith('+') ? '#4ade80' : '#f87171') : undefined },
                    { label: 'Data de Registro',   value: fmtDate(infoModal.data) },
                    { label: 'Registrado por',     value: infoModal.lancadoPor || '—', color: '#34d399' },
                    ...(infoModal.observacao ? [{ label: 'Observação', value: infoModal.observacao }] : []),
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: S.card, border: `1px solid ${S.border}`, gap: '12px' }}>
                      <span style={{ color: S.muted, fontSize: '12px', flexShrink: 0 }}>{label}</span>
                      <span style={{ color: color || S.text, fontSize: '13px', fontWeight: 700, textAlign: 'right' }}>{value}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProgressOverlay
        open={!!exportTask}
        progress={exportTask?.progress ?? 0}
        title={exportTask?.title || 'Gerando arquivo…'}
        subtitle={exportTask?.subtitle || ''} />
    </div>
  );
};
