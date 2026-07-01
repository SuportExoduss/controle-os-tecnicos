import { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  Truck, ChevronLeft, ChevronRight, ChevronRight as Chev,
  ClipboardCheck, Gauge, AlertTriangle, Table as TableIcon,
  CircleCheck, Clock, X, UserX, Copy, Download, FileText, FileSpreadsheet,
  Router, Network, Cctv, IdCard, AlertOctagon, Info, Road, AlertCircle, LogIn, Check,
} from 'lucide-react';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { loginUser, logoutUser } from '../../services/auth/authService';
import { getUserProfile } from '../../services/database/userProfileService';
import { getFrotaCadastro, getFrotaMonth } from '../../services/database/frotaService';
import { Spinner } from '../../components/common/Spinner';
import { ProgressOverlay } from '../../components/common/ProgressOverlay';
import { AreaTopbar } from '../../components/common/AreaTopbar';
import { MESES, ST, SEV, isObrig, statsOf, initials, DEFAULT_TEAMS } from './frotaCore';
import { buildTextoRelacao, exportExcelRelacao, exportPdfRelacao } from './frotaExport';

const TEAM_ICON = { fibra: Router, redes: Network, cameras: Cctv, frota: Truck, demais: IdCard };
const SEV_ICON = { critica: AlertOctagon, alta: AlertTriangle, normal: Info };
const ST_COLOR = { feito: '#34d399', atrasado: '#fbbf24', naofez: '#f87171', ausente: '#fb923c' };
const ST_LABEL = { feito: 'Feito', atrasado: 'Atrasado', naofez: 'Não fez', ausente: 'Ausente' };
const YEAR = 2026;

export const FrotaDashboard = () => {
  const navigate = useNavigate();
  const { S, mode, toggleTheme } = useContext(ThemeContext);
  const { user, profile, refreshProfile } = useContext(AuthContext);
  const isLogged = !!user && !!profile?.nickname;

  const [teams, setTeams] = useState(DEFAULT_TEAMS);
  const [month, setMonth] = useState(5); // junho
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('geral');
  const [modePane, setModePane] = useState('diario');
  const [exp, setExp] = useState({});
  const [selMember, setSelMember] = useState(null); // {name, team}
  // Login modal
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [redirectAfterLogin, setRedirectAfterLogin] = useState(null);
  // Exports
  const [showText, setShowText] = useState(false);
  const [exportTask, setExportTask] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { getFrotaCadastro().then(setTeams).catch(() => {}); }, []);
  useEffect(() => {
    setLoading(true);
    getFrotaMonth(YEAR, month).then((d) => { setDoc(d); setLoading(false); }).catch(() => { setDoc(null); setLoading(false); });
  }, [month]);

  // Relatório conta do dia 1 até o último dia do mês
  const lastDay = new Date(YEAR, month + 1, 0).getDate();
  const d1 = 1, d2 = lastDay;
  const data = doc?.data || {};
  const st = (name) => statsOf(data, name, d1, d2);

  const totals = useMemo(() => {
    let f = 0, a = 0, n = 0, au = 0;
    teams.forEach((t) => t.members.forEach((m) => { const s = statsOf(data, m.name, d1, d2); f += s.f; a += s.a; n += s.n; au += s.au; }));
    return { f, a, n, au };
  }, [teams, doc, month]); // eslint-disable-line

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
  const runExport = async (title, fn) => { setExportTask({ title, progress: 0 }); try { await fn((p) => setExportTask({ title, progress: p })); } catch { toast.error('Erro ao gerar arquivo'); } finally { setTimeout(() => setExportTask(null), 400); } };
  const handleTexto = () => { if (!doc) { toast.error('Sem dados para exportar'); return; } setShowText(true); };
  const handleExcel = () => { if (!doc) { toast.error('Sem dados para exportar'); return; } runExport('Gerando Excel…', (op) => exportExcelRelacao(teams, doc, month, YEAR, op)); };
  const handlePdf = () => { if (!doc) { toast.error('Sem dados para exportar'); return; } runExport('Gerando PDF…', (op) => exportPdfRelacao(teams, doc, month, YEAR, op)); };
  const handleCopy = async () => { try { await navigator.clipboard.writeText(buildTextoRelacao(teams, doc, month, YEAR)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { toast.error('Erro ao copiar'); } };

  const card = { background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px' };

  const KP = [
    { k: 'geral', I: ClipboardCheck, c: S.accent, v: totals.f + totals.a, l: 'Checklists' },
    { k: 'feito', I: CircleCheck, c: '#34d399', v: totals.f, l: 'Feitos' },
    { k: 'atrasado', I: Clock, c: '#fbbf24', v: totals.a, l: 'Atrasados' },
    { k: 'naofez', I: X, c: '#f87171', v: totals.n, l: 'Não feitos' },
    { k: 'ausente', I: UserX, c: '#fb923c', v: totals.au, l: 'Ausentes' },
  ];
  const SEG = [['geral', 'Visão geral', S.accent], ['feito', 'Feitos', '#34d399'], ['atrasado', 'Atrasados', '#fbbf24'], ['naofez', 'Não feitos', '#f87171'], ['ausente', 'Ausentes', '#fb923c'], ['troca', 'Troca de carro', '#38bdf8']];
  const MODES = [['diario', 'Checklist diário', ClipboardCheck], ['cal', 'Calibragem', Gauge], ['occ', 'Ocorrências', AlertTriangle], ['trocas', 'Trocas de carro', Road], ['rel', 'Relação do mês', TableIcon]];

  if (loading && !doc) return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}><Spinner /><p style={{ color: S.muted2, fontSize: '14px', marginTop: '12px' }}>Carregando…</p></div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.text }}>
      <AreaTopbar S={S} mode={mode} area="frota" variant="dashboard" isLogged={isLogged} nickname={profile?.nickname}
        onTheme={toggleTheme} onPrimary={openAdmin} onAuth={() => (isLogged ? handleDashLogout() : setShowLoginModal(true))}
        exportActions={[
          { label: 'Texto', onClick: handleTexto },
          { label: 'Excel', onClick: handleExcel },
          { label: 'PDF', onClick: handlePdf },
        ]}
      />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px' }}>
        {/* ABAS DE MODO */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderBottom: `1px solid ${S.border}`, paddingBottom: '14px', marginBottom: '16px' }}>
          {MODES.map(([k, l, I]) => (
            <button key={k} onClick={() => setModePane(k)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 15px', borderRadius: '10px', border: `1px solid ${modePane === k ? S.accent : S.border}`, background: modePane === k ? S.accent : S.card, color: modePane === k ? '#fff' : S.muted2, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}><I size={16} />{l}</button>
          ))}
        </div>

        {/* NAVEGAÇÃO DE MÊS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <button disabled={month <= 0} onClick={() => setMonth((m) => Math.max(0, m - 1))} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: `1px solid ${S.border}`, background: S.card, color: S.text, fontSize: '13px', fontWeight: 600, cursor: month <= 0 ? 'not-allowed' : 'pointer', opacity: month <= 0 ? 0.4 : 1 }}><ChevronLeft size={16} /> Mês anterior</button>
          <div style={{ flex: 1, textAlign: 'center', fontSize: '15px', fontWeight: 700 }}>{MESES[month]} {YEAR}{loading ? ' · carregando…' : ''}</div>
          <button disabled={month >= 11} onClick={() => setMonth((m) => Math.min(11, m + 1))} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: `1px solid ${S.border}`, background: S.card, color: S.text, fontSize: '13px', fontWeight: 600, cursor: month >= 11 ? 'not-allowed' : 'pointer', opacity: month >= 11 ? 0.4 : 1 }}>Próximo mês <ChevronRight size={16} /></button>
        </div>

        {!doc && !loading && <div style={{ textAlign: 'center', color: S.muted2, padding: '40px', ...card }}>Sem dados de {MESES[month]} {YEAR} — importe o relatório desse mês no ADM.</div>}

        {/* ── CHECKLIST DIÁRIO ─────────────────────────────────── */}
        {doc && modePane === 'diario' && (<>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {SEG.map(([k, l, c]) => (
              <button key={k} onClick={() => setTab(k)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: '999px', border: `1px solid ${tab === k ? c : S.border}`, background: S.card, color: tab === k ? S.text : S.muted2, fontSize: '12.5px', cursor: 'pointer' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />{l}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(108px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            {KP.map(({ k, I, c, v, l }) => (
              <button key={k} onClick={() => setTab(k)} style={{ ...card, padding: '18px', textAlign: 'left', cursor: 'pointer', borderColor: tab === k ? c : S.border, position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: c + '22', color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}><I size={17} /></div>
                <div style={{ fontSize: '25px', fontWeight: 800 }}>{v}</div>
                <div style={{ fontSize: '12px', color: S.muted2, marginTop: '4px' }}>{l}</div>
              </button>
            ))}
          </div>

          {/* CARDS DE EQUIPE */}
          {teams.map((t) => {
            const Ic = TEAM_ICON[t.key] || IdCard;
            let tf = 0, ta = 0, tn = 0, tau = 0;
            t.members.forEach((m) => { const s = st(m.name); tf += s.f; ta += s.a; tn += s.n; tau += s.au; });
            const ob = isObrig(t.key);
            return (
              <div key={t.key} style={{ ...card, marginBottom: '11px', overflow: 'hidden' }}>
                <div onClick={() => setExp((e) => ({ ...e, [t.key]: !e[t.key] }))} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '14px 16px', cursor: 'pointer' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: t.accent + '22', color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic size={20} /></div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700 }}>{t.label}</div>
                    <div style={{ fontSize: '11.5px', color: S.muted2 }}>{t.members.length} colaboradores · {ob ? <span style={{ color: '#34d399' }}>obrigatório</span> : 'não obrigatório'}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '9px' }}>
                    {[['#34d399', tf], ['#fbbf24', ta], ['#f87171', tn], ['#fb923c', tau]].map(([c, v], i) => (
                      <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', background: S.card2, borderRadius: '8px', padding: '3px 9px' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c }} />{v}</span>
                    ))}
                    <Chev size={16} color={S.muted2} style={{ transform: exp[t.key] ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                  </div>
                </div>
                {exp[t.key] && (
                  <div style={{ padding: '0 12px 12px' }}>
                    {[...t.members].map((m) => ({ m, s: st(m.name) }))
                      .sort((x, y) => {
                        const key = { feito: 'f', atrasado: 'a', naofez: 'n', ausente: 'au', troca: 'tr' }[tab];
                        return key ? y.s[key] - x.s[key] : 0;
                      })
                      .map(({ m, s }) => (
                        <div key={m.name}
                          onClick={() => setSelMember({ name: m.name, team: t })}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderTop: `1px solid ${S.border}`, cursor: 'pointer', borderRadius: '8px', transition: 'background .15s' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = S.card2}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          <span style={{ width: '30px', height: '30px', borderRadius: '50%', background: t.accent, color: '#081427', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>{initials(m.name)}</span>
                          <span style={{ fontSize: '13px', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                          <span style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                            {[['f', '#34d399'], ['a', '#fbbf24'], ['n', '#f87171'], ['au', '#fb923c']].map(([k, c]) => (
                              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', padding: '2px 8px', borderRadius: '7px', background: c + '22', color: c }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: c }} />{s[k]}
                              </span>
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

        {doc && modePane === 'cal' && <CalView S={S} teams={teams} cal={doc.cal || {}} onSelect={(name, team) => setSelMember({ name, team })} />}
        {doc && modePane === 'occ' && <OccView S={S} teams={teams} occ={doc.occ || []} onSelect={(name, team) => setSelMember({ name, team })} />}
        {doc && modePane === 'trocas' && <SwapView S={S} teams={teams} data={data} month={month} year={YEAR} lastDay={lastDay} onSelect={(name, team) => setSelMember({ name, team })} />}
        {doc && modePane === 'rel' && <RelView S={S} teams={teams} st={st} lastDay={lastDay} onSelect={(name, team) => setSelMember({ name, team })} />}
      </main>

      <ProgressOverlay open={!!exportTask} progress={exportTask?.progress ?? 0} title={exportTask?.title || 'Gerando…'} />

      {/* ── POPUP CALENDÁRIO DO COLABORADOR ──────────────────────── */}
      <AnimatePresence>
        {selMember && (
          <>
            <motion.div key="sel-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelMember(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(8px)', zIndex: 49 }} />
            <motion.div key="sel-modal" initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
              style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px', pointerEvents: 'none' }}>
              <div style={{ pointerEvents: 'auto' }}>
                <MemberCalendarModal S={S} name={selMember.name} team={selMember.team} data={data} month={month} year={YEAR} lastDay={lastDay} onClose={() => setSelMember(null)} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── LOGIN MODAL ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showLoginModal && (<>
          <div onClick={() => setShowLoginModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 49 }} />
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
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

      {/* ── MODAL TEXTO ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showText && (<>
          <div onClick={() => setShowText(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 49 }} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
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

// ── POPUP CALENDÁRIO INDIVIDUAL ─────────────────────────────────────────────
function MemberCalendarModal({ S, name, team, data, month, year, lastDay, onClose }) {
  const [selDay, setSelDay] = useState(null);
  const memberData = (data && data[name]) || {};

  // Stats do mês completo (dia 1 → lastDay)
  let f = 0, a = 0, n = 0, au = 0;
  for (let d = 1; d <= lastDay; d++) {
    const x = memberData[d];
    if (!x) continue;
    if (x.st === 'feito') f++;
    else if (x.st === 'atrasado') a++;
    else if (x.st === 'naofez') n++;
    else au++;
  }
  const total = f + a + n + au;
  const pct = total > 0 ? Math.round((f + a) / total * 100) : 0;

  // Calendário — semana começa segunda
  const firstDow = new Date(year, month, 1).getDay(); // 0=Dom
  const offset = firstDow === 0 ? 6 : firstDow - 1;  // Seg=0
  const WEEK = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const selInfo = selDay != null ? memberData[selDay] : null;

  const card2 = { background: S.card2, borderRadius: '10px', padding: '10px 13px' };

  return (
    <div style={{ width: '100%', maxWidth: '440px', background: S.surface || S.card, border: `1px solid ${S.accent}40`, borderRadius: '20px', boxShadow: `0 0 60px ${S.glow}`, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${S.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ width: '44px', height: '44px', borderRadius: '50%', background: team.accent, color: '#081427', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '15px', flexShrink: 0 }}>
            {initials(name)}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            <span style={{ fontSize: '10.5px', padding: '2px 8px', borderRadius: '999px', background: team.accent + '22', color: team.accent, fontWeight: 700 }}>{team.short}</span>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', color: S.muted2 }}>Comprometimento</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: pct >= 70 ? '#34d399' : pct >= 40 ? '#fbbf24' : '#f87171' }}>{pct}%</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
        </div>

        {/* Stat chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '7px', marginTop: '14px' }}>
          {[['Feito', f, '#34d399'], ['Atrasado', a, '#fbbf24'], ['Não fez', n, '#f87171'], ['Ausente', au, '#fb923c']].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: 'center', padding: '9px 4px', background: c + '18', borderRadius: '10px', border: `1px solid ${c}35` }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: c, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: '10px', color: S.muted2, marginTop: '3px' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Calendário */}
      <div style={{ padding: '16px 20px' }}>
        {/* Cabeçalho dias da semana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px', marginBottom: '4px' }}>
          {WEEK.map((d) => (
            <div key={d} style={{ textAlign: 'center', fontSize: '10px', color: S.muted2, fontWeight: 700, padding: '3px 0' }}>{d}</div>
          ))}
        </div>
        {/* Células dos dias */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
          {Array.from({ length: offset }).map((_, i) => <div key={'pad' + i} />)}
          {Array.from({ length: lastDay }).map((_, i) => {
            const d = i + 1;
            const x = memberData[d];
            const dow = new Date(year, month, d).getDay(); // 0=Dom
            const isSun = dow === 0;
            const col = x ? ST_COLOR[x.st] : null;
            const hasSwap = x?.swaps?.length > 0;
            const isSel = selDay === d;
            return (
              <div key={d}
                onClick={() => x || isSun ? setSelDay(isSel ? null : d) : null}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '5px 2px', borderRadius: '7px', cursor: x ? 'pointer' : 'default',
                  background: isSel ? (col || S.border) + '30' : 'transparent',
                  border: `1px solid ${isSel ? (col || S.border) : 'transparent'}`,
                  opacity: isSun ? 0.35 : 1,
                  transition: 'background .12s',
                }}
                onMouseEnter={(e) => { if (x) e.currentTarget.style.background = (col || S.border) + '20'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = isSel ? (col || S.border) + '30' : 'transparent'; }}
              >
                <div style={{ fontSize: '11px', fontWeight: isSel ? 700 : 400, color: isSel ? S.text : S.muted2, lineHeight: 1 }}>{d}</div>
                <div style={{ position: 'relative', marginTop: '3px' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: col || 'transparent', border: col ? 'none' : `1px solid ${S.border}40` }} />
                  {hasSwap && <div style={{ position: 'absolute', top: '-2px', right: '-3px', width: '5px', height: '5px', borderRadius: '50%', background: '#38bdf8', border: `1px solid ${S.surface || S.card}` }} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detalhe do dia selecionado */}
        <AnimatePresence>
          {selDay != null && (
            <motion.div key={selDay} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              style={{ marginTop: '12px', ...card2 }}>
              {selInfo ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: ST_COLOR[selInfo.st], flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>Dia {selDay} de {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][month]}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: ST_COLOR[selInfo.st] + '22', color: ST_COLOR[selInfo.st], fontWeight: 700 }}>{ST_LABEL[selInfo.st]}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12px', color: S.muted2, marginBottom: selInfo.swaps?.length ? '10px' : 0 }}>
                    {selInfo.time && <span><Clock size={12} style={{ verticalAlign: '-2px', marginRight: '4px' }} />{selInfo.time}</span>}
                    {selInfo.plate && <span style={{ color: S.text, fontWeight: 700 }}>{selInfo.plate}</span>}
                    {selInfo.kmIni != null && <span>KM {selInfo.kmIni.toLocaleString('pt-BR')} → {selInfo.kmFim?.toLocaleString('pt-BR') ?? '?'}</span>}
                  </div>
                  {selInfo.swaps?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <div style={{ fontSize: '10.5px', color: S.muted2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Trocas de carro neste dia</div>
                      {selInfo.swaps.map((sw, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 10px', background: '#38bdf818', borderRadius: '8px', border: '1px solid #38bdf830', fontSize: '12px' }}>
                          <span style={{ fontWeight: 700, color: S.text }}>{sw.plateFrom}</span>
                          <span style={{ color: '#38bdf8', fontWeight: 700 }}>→</span>
                          <span style={{ fontWeight: 700, color: S.text }}>{sw.plateTo}</span>
                          <span style={{ marginLeft: 'auto', color: S.muted2, fontSize: '11px' }}>{sw.timeFrom} → {sw.timeTo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '12.5px', color: S.muted2 }}>
                  Dia {selDay} — {new Date(year, month, selDay).getDay() === 0 ? 'domingo (sem checklist)' : 'sem registro neste dia'}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Legenda */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${S.border}` }}>
          {Object.entries(ST_COLOR).map(([k, c]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: S.muted2 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />{ST_LABEL[k]}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: S.muted2 }}>
            <span style={{ position: 'relative', width: '10px', height: '10px' }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#38bdf8' }} />
            </span>
            Troca de carro
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TROCAS DE CARRO ─────────────────────────────────────────────────────────
function SwapView({ S, teams, data, month, year, lastDay, onSelect }) {
  const MESES_LOCAL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  // Coleta todas as trocas do mês de todos os colaboradores
  const swaps = [];
  teams.forEach((t) => t.members.forEach((m) => {
    const mData = (data && data[m.name]) || {};
    for (let d = 1; d <= lastDay; d++) {
      const entry = mData[d];
      if (entry?.swaps?.length) {
        entry.swaps.forEach((sw) => swaps.push({ name: m.name, team: t, day: d, ...sw }));
      }
    }
  }));
  // Ordena por dia, depois por horário
  swaps.sort((a, b) => a.day !== b.day ? a.day - b.day : (a.timeFrom < b.timeFrom ? -1 : 1));

  const card = { background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px' };

  if (!swaps.length) return (
    <div style={{ textAlign: 'center', color: S.muted2, padding: '40px', ...card }}>
      <Road size={28} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
      <div>Nenhuma troca de carro detectada em {MESES_LOCAL[month]}.</div>
      <div style={{ fontSize: '11.5px', marginTop: '6px' }}>Trocas são detectadas automaticamente quando um colaborador usa placas diferentes no mesmo dia.</div>
    </div>
  );

  // Agrupa por dia
  const byDay = {};
  swaps.forEach((sw) => { if (!byDay[sw.day]) byDay[sw.day] = []; byDay[sw.day].push(sw); });

  return (<>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', padding: '10px 14px', background: '#38bdf815', border: '1px solid #38bdf830', borderRadius: '12px' }}>
      <Road size={18} color="#38bdf8" />
      <span style={{ fontSize: '13px', color: S.muted2 }}>
        <b style={{ color: S.text }}>{swaps.length} troca{swaps.length !== 1 ? 's' : ''}</b> detectada{swaps.length !== 1 ? 's' : ''} em {MESES_LOCAL[month]} · {Object.keys(byDay).length} dia{Object.keys(byDay).length !== 1 ? 's' : ''} com troca
      </span>
    </div>

    {Object.entries(byDay).map(([day, list]) => (
      <div key={day} style={{ ...card, marginBottom: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${S.border}`, fontSize: '13px', fontWeight: 700, color: S.text }}>
          Dia {day} de {MESES_LOCAL[month]}
          <span style={{ marginLeft: '8px', fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>
            {list.length} troca{list.length !== 1 ? 's' : ''}
          </span>
        </div>
        {list.map((sw, i) => (
          <div key={i}
            onClick={() => onSelect?.(sw.name, sw.team)}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderTop: i > 0 ? `1px solid ${S.border}` : 'none', cursor: 'pointer', transition: 'background .15s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = S.card2}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            {/* Avatar */}
            <span style={{ width: '34px', height: '34px', borderRadius: '50%', background: sw.team.accent, color: '#081427', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
              {initials(sw.name)}
            </span>
            {/* Nome + equipe */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sw.name}</div>
              <div style={{ fontSize: '11px', color: S.muted2 }}>{sw.team.short}</div>
            </div>
            {/* Troca: placa de → placa para */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: S.text, fontFamily: 'monospace' }}>{sw.plateFrom}</div>
                <div style={{ fontSize: '10px', color: S.muted2 }}>{sw.timeFrom}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <Road size={16} color="#38bdf8" />
                <div style={{ fontSize: '9px', color: '#38bdf8', fontWeight: 600 }}>TROCA</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>{sw.plateTo}</div>
                <div style={{ fontSize: '10px', color: S.muted2 }}>{sw.timeTo}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    ))}
  </>);
}

// ── CALIBRAGEM ──────────────────────────────────────────────────────────────
function CalView({ S, teams, cal, onSelect }) {
  let f = 0, a = 0, n = 0;
  teams.forEach((t) => t.members.forEach((m) => { const c = cal[m.name]; if (!c || c.st === 'naofez') n++; else if (c.st === 'feito') f++; else a++; }));
  const card = { background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px' };
  return (<>
    <div style={{ fontSize: '12px', color: S.muted2, marginBottom: '12px' }}>Calibragem semanal — deve ser feita toda <b style={{ color: S.text }}>segunda-feira</b>. Em outro dia = atrasado.</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '16px' }}>
      {[['Feita na segunda', f, '#34d399'], ['Atrasada', a, '#fbbf24'], ['Não fez', n, '#f87171']].map(([l, v, c]) => (
        <div key={l} style={{ ...card, padding: '18px' }}><div style={{ fontSize: '25px', fontWeight: 800, color: c }}>{v}</div><div style={{ fontSize: '12px', color: S.muted2 }}>{l}</div></div>
      ))}
    </div>
    {teams.map((t) => (
      <div key={t.key} style={{ ...card, marginBottom: '11px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: '14px' }}>{t.label}</div>
        {t.members.map((m) => {
          const c = cal[m.name] || { st: 'naofez' };
          const col = c.st === 'feito' ? '#34d399' : c.st === 'atrasado' ? '#fbbf24' : '#f87171';
          const txt = c.st === 'feito' ? 'Feita na segunda' : c.st === 'atrasado' ? 'Atrasada' : 'Não fez';
          return (
            <div key={m.name} onClick={() => onSelect?.(m.name, t)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px', borderTop: `1px solid ${S.border}`, cursor: 'pointer', transition: 'background .15s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = S.card2}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: t.accent, color: '#081427', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>{initials(m.name)}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, flex: 1 }}>{m.name}</span>
              <span style={{ fontSize: '11.5px', padding: '2px 8px', borderRadius: '7px', background: col + '22', color: col, fontWeight: 600 }}>{txt}</span>
            </div>
          );
        })}
      </div>
    ))}
  </>);
}

// ── OCORRÊNCIAS ─────────────────────────────────────────────────────────────
function OccView({ S, teams, occ, onSelect }) {
  const ord = { critica: 0, alta: 1, normal: 2 };
  const list = [...occ].sort((a, b) => ord[a.sev] - ord[b.sev]);
  if (!list.length) return <div style={{ textAlign: 'center', color: S.muted2, padding: '30px' }}>Nenhuma ocorrência neste mês.</div>;
  return (<>
    <div style={{ fontSize: '12px', color: S.muted2, marginBottom: '12px' }}><AlertTriangle size={13} style={{ verticalAlign: '-2px', color: '#fb923c' }} /> Ocorrências — avaliar socorro ou manutenção. Ordenado por gravidade.</div>
    {list.map((o, i) => {
      const sv = SEV[o.sev]; const Ic = SEV_ICON[o.sev];
      const t = teams.find((tt) => tt.members.some((m) => m.name === o.name));
      return (
        <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderLeft: `3px solid ${sv.c}`, borderRadius: '12px', padding: '13px 15px', marginBottom: '10px', cursor: 'pointer' }}
          onClick={() => onSelect?.(o.name, t)}>
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
      );
    })}
  </>);
}

// ── RELAÇÃO DO MÊS ──────────────────────────────────────────────────────────
function RelView({ S, teams, st, lastDay, onSelect }) {
  const rows = [];
  teams.forEach((t) => t.members.forEach((m) => {
    const s = st(m.name); const total = s.f + s.a + s.n + s.au;
    rows.push({ name: m.name, eq: t, s, total, ok: total === s.rec });
  }));
  const th = { textAlign: 'center', color: S.muted2, fontWeight: 400, padding: '8px 5px', borderBottom: `1px solid ${S.border}`, fontSize: '11px' };
  const td = { padding: '8px 5px', borderBottom: `1px solid ${S.border}`, textAlign: 'center' };
  return (<>
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '14px', fontWeight: 600 }}>Relação do mês — dia 1 a {lastDay}</div>
      <div style={{ fontSize: '11.5px', color: S.muted2 }}>Números para a diretoria observar. "Confere" valida a soma. Clique em um colaborador para ver o calendário.</div>
    </div>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
        <thead><tr>
          <th style={{ ...th, textAlign: 'left' }}>Colaborador</th>
          <th style={th}>Equipe</th><th style={th}>Obrig.</th>
          <th style={th}>Fez</th><th style={th}>Atras.</th>
          <th style={th}>Não fez</th><th style={th}>Ausente</th>
          <th style={th}>Total</th><th style={th}>Confere</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} onClick={() => onSelect?.(r.name, r.eq)} style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => e.currentTarget.style.background = S.card2}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
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
