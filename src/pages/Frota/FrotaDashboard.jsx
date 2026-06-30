import { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  Truck, Sun, Moon, ClipboardEdit, LogOut, LogIn, Lock, Check, ChevronLeft, ChevronRight, ChevronRight as Chev,
  ClipboardCheck, Gauge, AlertTriangle, Table as TableIcon, CircleCheck, Clock, X, UserX, Copy, Download, FileText, FileSpreadsheet,
  Router, Network, Cctv, IdCard, AlertOctagon, Info, Road, AlertCircle,
} from 'lucide-react';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { loginUser, logoutUser } from '../../services/auth/authService';
import { getUserProfile } from '../../services/database/userProfileService';
import { getFrotaCadastro, getFrotaMonth } from '../../services/database/frotaService';
import { Spinner } from '../../components/common/Spinner';
import { ProgressOverlay } from '../../components/common/ProgressOverlay';
import { MESES, ST, SEV, isObrig, statsOf, initials, DEFAULT_TEAMS } from './frotaCore';
import { buildTextoRelacao, exportExcelRelacao, exportPdfRelacao } from './frotaExport';

const TEAM_ICON = { fibra: Router, redes: Network, cameras: Cctv, frota: Truck, demais: IdCard };
const SEV_ICON = { critica: AlertOctagon, alta: AlertTriangle, normal: Info };
const YEAR = 2026;

export const FrotaDashboard = () => {
  const navigate = useNavigate();
  const { S, mode, toggleTheme } = useContext(ThemeContext);
  const { user, profile, refreshProfile } = useContext(AuthContext);
  const isLogged = !!user && !!profile?.nickname;

  const [teams, setTeams] = useState(DEFAULT_TEAMS);
  const [month, setMonth] = useState(5); // junho
  const [doc, setDoc] = useState(null);  // { data, cal, occ, period } do mês
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('geral');
  const [modePane, setModePane] = useState('diario');
  const [exp, setExp] = useState({}); // cards fechados (Fibra fechado)
  // Modo edição (login modal) + exports — mesmo modus operandi das outras áreas
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [redirectAfterLogin, setRedirectAfterLogin] = useState(null);
  const [showText, setShowText] = useState(false);
  const [exportTask, setExportTask] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { getFrotaCadastro().then(setTeams).catch(() => {}); }, []);
  useEffect(() => {
    setLoading(true);
    getFrotaMonth(YEAR, month).then((d) => { setDoc(d); setLoading(false); }).catch(() => { setDoc(null); setLoading(false); });
  }, [month]);

  const data = doc?.data || {};
  const d1 = doc?.period?.d1 || 1, d2 = doc?.period?.d2 || 31;
  const st = (name) => statsOf(data, name, d1, d2);

  const totals = useMemo(() => {
    let f = 0, a = 0, n = 0, au = 0;
    teams.forEach((t) => t.members.forEach((m) => { const s = st(name(m)); f += s.f; a += s.a; n += s.n; au += s.au; }));
    return { f, a, n, au };
  }, [teams, doc, d1, d2]); // eslint-disable-line

  function name(m) { return m[0]; }
  const openAdmin = () => { if (isLogged) navigate('/frota/admin'); else { setRedirectAfterLogin('/frota/admin'); setShowLoginModal(true); } };
  const handleDashLogin = async () => {
    if (!loginEmail || !loginPass) { toast.error('Preencha email e senha'); return; }
    setLoginLoading(true);
    try {
      const cred = await loginUser(loginEmail, loginPass);
      const p = await getUserProfile(cred.user.uid);
      if (!p || !p.nickname) { toast.error('Faça o primeiro login pela tela inicial para definir seu apelido.'); await logoutUser(); setLoginLoading(false); return; }
      await refreshProfile(cred.user.uid);
      toast.success(`Bem-vindo, ${p.nickname}!`);
      setShowLoginModal(false); setLoginEmail(''); setLoginPass('');
      if (redirectAfterLogin) { const d = redirectAfterLogin; setRedirectAfterLogin(null); navigate(d); }
    } catch { toast.error('Email ou senha incorretos'); } finally { setLoginLoading(false); }
  };
  const handleDashLogout = async () => { try { await logoutUser(); toast.success('Modo edição desativado'); } catch { /* */ } };
  const runExport = async (title, fn) => { setExportTask({ title, progress: 0 }); try { await fn((p) => setExportTask({ title, progress: p })); } catch (e) { toast.error('Erro ao gerar arquivo'); } finally { setTimeout(() => setExportTask(null), 400); } };
  const handleTexto = () => { if (!doc) { toast.error('Sem dados para exportar'); return; } setShowText(true); };
  const handleExcel = () => { if (!doc) { toast.error('Sem dados para exportar'); return; } runExport('Gerando Excel…', (op) => exportExcelRelacao(teams, doc, month, YEAR, op)); };
  const handlePdf = () => { if (!doc) { toast.error('Sem dados para exportar'); return; } runExport('Gerando PDF…', (op) => exportPdfRelacao(teams, doc, month, YEAR, op)); };
  const handleCopy = async () => { try { await navigator.clipboard.writeText(buildTextoRelacao(teams, doc, month, YEAR)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { toast.error('Erro ao copiar'); } };

  const card = { background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px' };
  const ibtn = { display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 11px', borderRadius: '8px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '12px', fontWeight: 600, cursor: 'pointer' };

  const KP = [
    { k: 'geral', I: ClipboardCheck, c: S.accent, v: totals.f + totals.a, l: 'Checklists' },
    { k: 'feito', I: CircleCheck, c: '#34d399', v: totals.f, l: 'Feitos' },
    { k: 'atrasado', I: Clock, c: '#fbbf24', v: totals.a, l: 'Atrasados' },
    { k: 'naofez', I: X, c: '#f87171', v: totals.n, l: 'Não feitos' },
    { k: 'ausente', I: UserX, c: '#fb923c', v: totals.au, l: 'Ausentes' },
  ];
  const SEG = [['geral', 'Visão geral', S.accent], ['feito', 'Feitos', '#34d399'], ['atrasado', 'Atrasados', '#fbbf24'], ['naofez', 'Não feitos', '#f87171'], ['ausente', 'Ausentes', '#fb923c'], ['troca', 'Troca de carro', '#38bdf8']];
  const MODES = [['diario', 'Checklist diário', ClipboardCheck], ['cal', 'Calibragem', Gauge], ['occ', 'Ocorrências', AlertTriangle], ['rel', 'Relação do mês', TableIcon]];

  if (loading && !doc) return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}><Spinner /><p style={{ color: S.muted2, fontSize: '14px', marginTop: '12px' }}>Carregando…</p></div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.text }}>
      {/* HEADER */}
      <header style={{ background: S.card, borderBottom: `1px solid ${S.border}`, position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <img src="/logo-frota.png" alt="IbiúNET" style={{ width: 'clamp(116px, 20vw, 156px)', height: 'auto', display: 'block' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: S.accent }}><Truck size={11} /> FROTA</div>
            {isLogged && <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#34d399' }}><Check size={11} />{profile.nickname}</div>}
          </div>
          <button onClick={toggleTheme} title="Tema" style={{ ...ibtn, padding: '7px' }}>{mode === 'light' ? <Moon size={15} /> : <Sun size={15} color="#fbbf24" />}</button>
          <button onClick={openAdmin} title="Painel Admin" style={ibtn}><ClipboardEdit size={14} /> ADM</button>
          <button onClick={() => (isLogged ? handleDashLogout() : setShowLoginModal(true))} title={isLogged ? 'Sair do modo edição' : 'Entrar para editar'} style={{ ...ibtn, ...(isLogged ? { background: '#0d2d1f', borderColor: '#065f46', color: '#34d399' } : {}) }}>{isLogged ? <><LogOut size={13} /> Sair</> : <><Lock size={13} /> Editar</>}</button>
          {isLogged && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '7px' }}>
              {[['Texto', '#3b82f6', FileText, handleTexto], ['Excel', '#10b981', FileSpreadsheet, handleExcel], ['PDF', '#ef4444', Download, handlePdf]].map(([l, c, Ic, fn]) => (
                <button key={l} onClick={fn} style={{ padding: '9px 16px', borderRadius: '10px', border: 'none', background: c, color: '#fff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Ic size={15} /> {l}</button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px' }}>
        {/* MODES */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderBottom: `1px solid ${S.border}`, paddingBottom: '14px', marginBottom: '16px' }}>
          {MODES.map(([k, l, I]) => (
            <button key={k} onClick={() => setModePane(k)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 15px', borderRadius: '10px', border: `1px solid ${modePane === k ? S.accent : S.border}`, background: modePane === k ? S.accent : S.card, color: modePane === k ? '#fff' : S.muted2, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}><I size={16} />{l}</button>
          ))}
        </div>

        {/* MONTH NAV */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <button disabled={month <= 0} onClick={() => setMonth((m) => Math.max(0, m - 1))} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: `1px solid ${S.border}`, background: S.card, color: S.text, fontSize: '13px', fontWeight: 600, cursor: month <= 0 ? 'not-allowed' : 'pointer', opacity: month <= 0 ? 0.4 : 1 }}><ChevronLeft size={16} /> Mês anterior</button>
          <div style={{ flex: 1, textAlign: 'center', fontSize: '15px', fontWeight: 700 }}>{MESES[month]} {YEAR}{loading ? ' · carregando…' : ''}</div>
          <button disabled={month >= 11} onClick={() => setMonth((m) => Math.min(11, m + 1))} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: `1px solid ${S.border}`, background: S.card, color: S.text, fontSize: '13px', fontWeight: 600, cursor: month >= 11 ? 'not-allowed' : 'pointer', opacity: month >= 11 ? 0.4 : 1 }}>Próximo mês <ChevronRight size={16} /></button>
        </div>

        {!doc && !loading && <div style={{ textAlign: 'center', color: S.muted2, padding: '40px', ...card }}>Sem dados de {MESES[month]} {YEAR} — importe o relatório desse mês no ADM.</div>}

        {doc && modePane === 'diario' && (<>
          {/* SEG */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {SEG.map(([k, l, c]) => (
              <button key={k} onClick={() => setTab(k)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: '999px', border: `1px solid ${tab === k ? c : S.border}`, background: S.card, color: tab === k ? S.text : S.muted2, fontSize: '12.5px', cursor: 'pointer' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />{l}</button>
            ))}
          </div>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(108px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            {KP.map(({ k, I, c, v, l }) => (
              <button key={k} onClick={() => setTab(k)} style={{ ...card, padding: '18px', textAlign: 'left', cursor: 'pointer', borderColor: tab === k ? c : S.border, position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: c + '22', color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}><I size={17} /></div>
                <div style={{ fontSize: '25px', fontWeight: 800 }}>{v}</div>
                <div style={{ fontSize: '12px', color: S.muted2, marginTop: '4px' }}>{l}</div>
              </button>
            ))}
          </div>
          {/* TEAM CARDS */}
          {teams.map((t) => {
            const Ic = TEAM_ICON[t.key] || IdCard;
            let tf = 0, ta = 0, tn = 0, tau = 0; t.members.forEach((m) => { const s = st(m[0]); tf += s.f; ta += s.a; tn += s.n; tau += s.au; });
            const ob = isObrig(t.key);
            return (
              <div key={t.key} style={{ ...card, marginBottom: '11px', overflow: 'hidden' }}>
                <div onClick={() => setExp((e) => ({ ...e, [t.key]: !e[t.key] }))} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '14px 16px', cursor: 'pointer' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: t.accent + '22', color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic size={20} /></div>
                  <div><div style={{ fontSize: '15px', fontWeight: 700 }}>{t.label}</div><div style={{ fontSize: '11.5px', color: S.muted2 }}>{t.members.length} colaboradores · {ob ? <span style={{ color: '#34d399' }}>obrigatório</span> : 'não obrigatório'}</div></div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '9px' }}>
                    {[['#34d399', tf], ['#fbbf24', ta], ['#f87171', tn], ['#fb923c', tau]].map(([c, v], i) => (
                      <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', background: S.card2, borderRadius: '8px', padding: '3px 9px' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c }} />{v}</span>
                    ))}
                    <Chev size={16} color={S.muted2} style={{ transform: exp[t.key] ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                  </div>
                </div>
                {exp[t.key] && (
                  <div style={{ padding: '0 12px 12px' }}>
                    {[...t.members].map((m) => ({ m, s: st(m[0]) })).sort((x, y) => ({ feito: 'f', atrasado: 'a', naofez: 'n', ausente: 'au', troca: 'tr' }[tab] ? y.s[{ feito: 'f', atrasado: 'a', naofez: 'n', ausente: 'au', troca: 'tr' }[tab]] - x.s[{ feito: 'f', atrasado: 'a', naofez: 'n', ausente: 'au', troca: 'tr' }[tab]] : 0)).map(({ m, s }) => (
                      <div key={m[0]} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderTop: `1px solid ${S.border}` }}>
                        <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: t.accent, color: '#081427', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>{initials(m[0])}</span>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{m[0]}</span>
                        <span style={{ marginLeft: 'auto', display: 'flex', gap: '5px' }}>
                          {[['f', '#34d399'], ['a', '#fbbf24'], ['n', '#f87171'], ['au', '#fb923c']].map(([k, c]) => (
                            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', padding: '2px 8px', borderRadius: '7px', background: c + '22', color: c }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: c }} />{s[k]}</span>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>)}

        {doc && modePane === 'cal' && <CalView S={S} teams={teams} cal={doc.cal || {}} />}
        {doc && modePane === 'occ' && <OccView S={S} teams={teams} occ={doc.occ || []} />}
        {doc && modePane === 'rel' && <RelView S={S} teams={teams} st={st} />}
      </main>

      <ProgressOverlay open={!!exportTask} progress={exportTask?.progress ?? 0} title={exportTask?.title || 'Gerando…'} />

      <AnimatePresence>
        {showLoginModal && (<>
          <div onClick={() => setShowLoginModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 49 }} />
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '400px', background: S.surface, border: `1px solid ${S.accent}`, borderRadius: '20px', boxShadow: `0 0 50px ${S.glow}`, padding: '28px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '22px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: S.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}><LogIn size={26} color={S.onAccent} /></div>
                <div style={{ color: S.text, fontWeight: 800, fontSize: '18px' }}>Modo Edição</div>
                <div style={{ color: S.muted2, fontSize: '13px', marginTop: '4px' }}>Entre para gerenciar a frota</div>
              </div>
              <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="Email" style={{ width: '100%', padding: '13px 16px', borderRadius: '12px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }} />
              <input type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} placeholder="Senha" onKeyDown={(e) => { if (e.key === 'Enter') handleDashLogin(); }} style={{ width: '100%', padding: '13px 16px', borderRadius: '12px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '20px' }} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowLoginModal(false)} style={{ flex: 1, padding: '13px', borderRadius: '12px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleDashLogin} disabled={loginLoading} style={{ flex: 2, padding: '13px', borderRadius: '12px', background: S.gradient, border: 'none', color: S.onAccent, fontSize: '14px', fontWeight: 700, cursor: loginLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: loginLoading ? 0.7 : 1 }}>{loginLoading ? <Spinner /> : <><LogIn size={16} />Entrar</>}</button>
              </div>
            </div>
          </motion.div>
        </>)}
      </AnimatePresence>

      <AnimatePresence>
        {showText && (<>
          <div onClick={() => setShowText(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 49 }} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '640px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', padding: '22px', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ fontWeight: 800, fontSize: '16px', color: S.text }}>Relatório em texto — {MESES[month]} {YEAR}</div>
                <button onClick={handleCopy} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: 'none', background: S.gradient, color: S.onAccent, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}><Copy size={14} />{copied ? 'Copiado!' : 'Copiar'}</button>
                <button onClick={() => setShowText(false)} style={{ marginLeft: '8px', background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <pre style={{ flex: 1, overflow: 'auto', background: S.input, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '14px', color: S.text, fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0 }}>{doc ? buildTextoRelacao(teams, doc, month, YEAR) : ''}</pre>
            </div>
          </motion.div>
        </>)}
      </AnimatePresence>
    </div>
  );
};

function CalView({ S, teams, cal }) {
  let f = 0, a = 0, n = 0; teams.forEach((t) => t.members.forEach((m) => { const c = cal[m[0]]; if (!c || c.st === 'naofez') n++; else if (c.st === 'feito') f++; else a++; }));
  const card = { background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px' };
  return (<>
    <div style={{ fontSize: '12px', color: S.muted2, marginBottom: '12px' }}>Calibragem é semanal — deve ser feita toda <b style={{ color: S.text }}>segunda-feira</b>. Em outro dia = atrasado.</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '16px' }}>
      {[['Feita na segunda', f, '#34d399'], ['Atrasada', a, '#fbbf24'], ['Não fez', n, '#f87171']].map(([l, v, c]) => (
        <div key={l} style={{ ...card, padding: '18px' }}><div style={{ fontSize: '25px', fontWeight: 800, color: c }}>{v}</div><div style={{ fontSize: '12px', color: S.muted2 }}>{l}</div></div>
      ))}
    </div>
    {teams.map((t) => (
      <div key={t.key} style={{ ...card, marginBottom: '11px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: '14px' }}>{t.label}</div>
        {t.members.map((m) => { const c = cal[m[0]] || { st: 'naofez' }; const col = ST[c.st === 'feito' ? 'feito' : c.st === 'atrasado' ? 'atrasado' : 'naofez'].c; const txt = c.st === 'feito' ? 'Feita na segunda' : c.st === 'atrasado' ? 'Atrasada' : 'Não fez'; return (
          <div key={m[0]} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px', borderTop: `1px solid ${S.border}` }}>
            <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: t.accent, color: '#081427', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>{initials(m[0])}</span>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>{m[0]}</span>
            <span style={{ marginLeft: 'auto', fontSize: '11.5px', padding: '2px 8px', borderRadius: '7px', background: col + '22', color: col }}>{txt}</span>
          </div>); })}
      </div>
    ))}
  </>);
}

function OccView({ S, teams, occ }) {
  const ord = { critica: 0, alta: 1, normal: 2 };
  const list = [...occ].sort((a, b) => ord[a.sev] - ord[b.sev]);
  if (!list.length) return <div style={{ textAlign: 'center', color: S.muted2, padding: '30px' }}>Nenhuma ocorrência neste mês.</div>;
  return (<>
    <div style={{ fontSize: '12px', color: S.muted2, marginBottom: '12px' }}><AlertTriangle size={13} style={{ verticalAlign: '-2px', color: '#fb923c' }} /> Ocorrências — avaliar socorro ou manutenção. Ordenado por gravidade.</div>
    {list.map((o, i) => { const sv = SEV[o.sev]; const Ic = SEV_ICON[o.sev]; const t = teams.find((tt) => tt.members.some((m) => m[0] === o.name)); return (
      <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderLeft: `3px solid ${sv.c}`, borderRadius: '12px', padding: '13px 15px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '7px' }}>
          <span style={{ width: '34px', height: '34px', borderRadius: '50%', background: (t?.accent || '#93a6c6'), color: '#081427', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>{initials(o.name)}</span>
          <div><div style={{ fontSize: '13.5px', fontWeight: 600 }}>{o.name}</div><div style={{ fontSize: '11px', color: S.muted2 }}>{t?.short || ''} · {o.plate}</div></div>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '2px 9px', borderRadius: '999px', fontWeight: 600, background: sv.c + '22', color: sv.c }}><Ic size={12} /> {sv.l}</span>
        </div>
        <div style={{ fontSize: '13px', margin: '6px 0' }}>&quot;{o.obs}&quot;</div>
        <div style={{ fontSize: '11.5px', color: S.muted2, display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          <span><Clock size={13} style={{ verticalAlign: '-2px' }} /> {o.dt}</span>
          <span><AlertCircle size={13} style={{ verticalAlign: '-2px' }} /> {o.nok} itens NOK</span>
          <span><Road size={13} style={{ verticalAlign: '-2px' }} /> {(o.km || 0).toLocaleString('pt-BR')} km</span>
        </div>
      </div>
    ); })}
  </>);
}

function RelView({ S, teams, st }) {
  const rows = [];
  teams.forEach((t) => t.members.forEach((m) => { const s = st(m[0]); const total = s.f + s.a + s.n + s.au; rows.push({ name: m[0], eq: t, s, total, ok: total === s.rec }); }));
  const th = { textAlign: 'center', color: S.muted2, fontWeight: 400, padding: '8px 5px', borderBottom: `1px solid ${S.border}`, fontSize: '11px' };
  const td = { padding: '8px 5px', borderBottom: `1px solid ${S.border}`, textAlign: 'center' };
  return (<>
    <div style={{ marginBottom: '10px' }}><div style={{ fontSize: '14px', fontWeight: 600 }}>Relação do mês</div><div style={{ fontSize: '11.5px', color: S.muted2 }}>números para a diretoria observar e definir bonificação (sem cálculo automático). "Confere" valida a soma. Só técnicos (Fibra/Redes/Câmeras) são obrigados.</div></div>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
        <thead><tr><th style={{ ...th, textAlign: 'left' }}>Colaborador</th><th style={th}>Equipe</th><th style={th}>Obrig.</th><th style={th}>Fez</th><th style={th}>Atras.</th><th style={th}>Não fez</th><th style={th}>Ausente</th><th style={th}>Total</th><th style={th}>Confere</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td style={{ ...td, textAlign: 'left' }}>{r.name}</td>
              <td style={td}><span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '999px', fontWeight: 600, background: r.eq.accent + '22', color: r.eq.accent }}>{r.eq.short}</span></td>
              <td style={td}>{isObrig(r.eq.key) ? <Check size={14} color="#34d399" /> : <span style={{ color: S.muted2 }}>—</span>}</td>
              <td style={{ ...td, color: '#34d399' }}>{r.s.f}</td>
              <td style={{ ...td, color: '#fbbf24' }}>{r.s.a}</td>
              <td style={{ ...td, color: '#f87171' }}>{r.s.n}</td>
              <td style={{ ...td, color: '#fb923c' }}>{r.s.au}</td>
              <td style={td}>{r.total}</td>
              <td style={td}>{r.ok ? <CircleCheck size={15} color="#34d399" /> : <AlertTriangle size={15} color="#fbbf24" />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>);
}
