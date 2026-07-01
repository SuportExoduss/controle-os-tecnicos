import { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Upload, Trash2, Users, History, FileInput, CloudUpload,
  CheckCircle, AlertTriangle, Calendar, BarChart2, PenLine, Plus,
  X, Road, Clock, ChevronDown, Save, UserX, UserCheck, CalendarCheck,
} from 'lucide-react';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { logoutUser } from '../../services/auth/authService';
import { getFrotaCadastro, saveFrotaCadastro, saveFrotaMonth, saveFrotaManualEntry, saveFrotaAbsences } from '../../services/database/frotaService';
import { AreaTopbar } from '../../components/common/AreaTopbar';
import { parseProlog, buildSheetsPayload, MESES, DEFAULT_TEAMS, initials } from './frotaCore';

const SHEETS_URL = import.meta.env.VITE_FROTA_SHEETS_URL || '';
const SHEETS_SECRET = import.meta.env.VITE_FROTA_SHEETS_SECRET || 'ibiunet-frota-TROQUE-ESTE-TOKEN';

export const FrotaAdmin = () => {
  const navigate = useNavigate();
  const { S, mode, toggleTheme } = useContext(ThemeContext);
  const { profile } = useContext(AuthContext);
  const fileRef = useRef(null);

  const [teams, setTeams] = useState(DEFAULT_TEAMS);
  const [pane, setPane] = useState('import');
  const [msg, setMsg] = useState('');
  const [prog, setProg] = useState(null); // {label, pct}
  const [hist, setHist] = useState([]);
  const [preview, setPreview] = useState(null); // dados parsed aguardando confirmação

  useEffect(() => { getFrotaCadastro({ force: true }).then(setTeams).catch(() => {}); }, []);

  const handleLogout = async () => { try { await logoutUser(); } finally { navigate('/frota/dashboard'); } };

  const sendSheets = (tms, data, ano, mesIndex) => {
    const url = SHEETS_URL || localStorage.getItem('frota_sheets_url') || '';
    if (!url) return '(Sheets: configure VITE_FROTA_SHEETS_URL para ativar)';
    try {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(buildSheetsPayload(tms, data, ano, mesIndex, localStorage.getItem('frota_sheets_secret') || SHEETS_SECRET)) });
    } catch { /* */ }
    return 'Enviado ao Google Sheets.';
  };

  // Fase 1: apenas parseia e exibe confirmação
  const importText = async (text, fname) => {
    setProg({ label: 'Analisando arquivo…', pct: 5 });
    let r;
    try { r = parseProlog(text, teams); } catch (e) { setProg(null); setMsg('Erro: ' + e.message); toast.error(e.message); return; }
    setProg(null);
    setPreview({ ...r, fname });
  };

  // Fase 2: confirmado pelo usuário → salva com animação 1→100
  const confirmImport = async () => {
    const r = preview; setPreview(null);
    const by = profile?.nickname || 'admin';
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

    let done = false;
    // Animação smooth: 1→99 em 3s, depois 100 ao finalizar
    (async () => {
      for (let i = 1; i <= 99; i++) {
        if (done) break;
        setProg({
          pct: i,
          label: i < 28 ? 'Salvando cadastro…' : i < 62 ? 'Gravando no Firebase…' : i < 88 ? 'Enviando à planilha…' : 'Finalizando…',
        });
        await sleep(30);
      }
      // Segura em 99 até salvar
      while (!done) { await sleep(50); }
    })();

    try {
      if (r.novos > 0) await saveFrotaCadastro(r.teams);
      await saveFrotaMonth(r.ano, r.mesIndex, { data: r.data, cal: r.cal, occ: r.occ, period: r.period }, by);
      setTeams(r.teams);
      const sheetNote = sendSheets(r.teams, r.data, r.ano, r.mesIndex);
      done = true;
      // 99→100 suavemente
      for (let i = 99; i <= 100; i++) { setProg({ pct: i, label: 'Concluído!' }); await sleep(30); }
      const txt = `✓ ${r.count} registros · ${r.people} colaboradores${r.novos ? ` · ${r.novos} novos` : ''} · ${MESES[r.mesIndex]}/${r.ano}. ${sheetNote}`;
      setMsg(txt); toast.success('Importado e salvo no Firebase!');
      setHist((h) => [{ t: 'Importado do Prolog', by: by + ' (admin)', dt: new Date().toLocaleString('pt-BR'), meta: `${r.fname || 'arquivo'} · ${r.count} registros`, tipo: 'import' }, ...h]);

      // ── FLUXO SÁBADO: detecta se hoje é sábado → abre tela de ausentes ──
      const todayDate = new Date();
      if (todayDate.getDay() === 6) {
        const todayDay = todayDate.getDate();
        const todayMonth = todayDate.getMonth();
        const todayYear = todayDate.getFullYear();
        // Quem fez checklist hoje (feito ou atrasado) → presente
        const presents = new Set();
        r.teams.forEach((t) => t.members.forEach((m) => {
          const entry = r.data[m.name]?.[todayDay];
          if (entry && (entry.st === 'feito' || entry.st === 'atrasado')) presents.add(m.name);
        }));
        setSatFlow({ day: todayDay, month: todayMonth, year: todayYear, teams: r.teams, presents });
      }
    } catch (e) {
      done = true;
      setMsg('Erro ao salvar: ' + e.message); toast.error('Erro ao salvar: ' + e.message);
    } finally { setTimeout(() => setProg(null), 700); }
  };

  const readFile = (f) => { if (!f) return; const rd = new FileReader(); rd.onload = () => importText(rd.result, f.name); rd.onerror = () => setMsg('Erro ao ler o arquivo.'); rd.readAsText(f, 'utf-8'); };

  const moveMember = async (name, toKey) => {
    const next = teams.map((t) => ({ ...t, members: t.members.filter((m) => m.name !== name) }));
    const from = teams.find((t) => t.members.some((m) => m.name === name));
    const m = from?.members.find((x) => x.name === name); if (!m) return;
    next.find((t) => t.key === toKey).members.push(m);
    setTeams(next);
    try { await saveFrotaCadastro(next); toast.success('Área atualizada'); } catch { toast.error('Erro ao salvar'); }
  };

  const clearMonth = async () => {
    if (!confirm('Limpar os dados de Junho/2026 no Firebase?')) return;
    setProg({ label: 'Limpando…', pct: 40 });
    try {
      await saveFrotaMonth(2026, 5, { data: {}, cal: {}, occ: [], period: { d1: 1, d2: 31 } }, profile?.nickname || 'admin');
      setMsg('Mês limpo. Importe um arquivo do Prolog.'); toast.success('Mês limpo no Firebase');
    } catch (e) { setMsg('Erro: ' + e.message); }
    finally { setProg({ label: 'Concluído', pct: 100 }); setTimeout(() => setProg(null), 400); }
  };

  const [showManual, setShowManual] = useState(false);
  const [satFlow, setSatFlow] = useState(null); // fluxo de ausentes do sábado
  const card = { background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px' };
  const NAV = [['import', 'Importar / criar', FileInput], ['hist', 'Histórico', History], ['colab', 'Colaboradores', Users]];

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.text }}>
      <AreaTopbar S={S} mode={mode} area="frota" variant="admin" isLogged nickname={profile?.nickname}
        onTheme={toggleTheme} onPrimary={() => navigate('/frota/dashboard')} onAuth={handleLogout} />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderBottom: `1px solid ${S.border}`, paddingBottom: '14px', marginBottom: '16px' }}>
          {NAV.map(([k, l, I]) => (
            <button key={k} onClick={() => setPane(k)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 15px', borderRadius: '10px', border: `1px solid ${pane === k ? S.accent : S.border}`, background: pane === k ? S.accent : S.card, color: pane === k ? '#fff' : S.muted2, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}><I size={16} />{l}</button>
          ))}
        </div>

        {pane === 'import' && (<>
          <div onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); readFile(e.dataTransfer.files[0]); }}
            style={{ border: `1.5px dashed ${S.border}`, borderRadius: '16px', background: S.card, padding: '30px', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: S.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: S.accent }}><CloudUpload size={26} /></div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Solte o arquivo do Prolog aqui</div>
            <div style={{ fontSize: '12px', color: S.muted2, marginTop: '10px' }}>arraste · ou clique para escolher na pasta</div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => readFile(e.target.files[0])} />
            {msg && <div style={{ fontSize: '12px', color: S.accent, marginTop: '10px' }}>{msg}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', padding: '11px 14px', border: `1px solid ${S.border}`, borderRadius: '12px', fontSize: '11.5px', color: S.muted2 }}>
            <CloudUpload size={18} color={S.accent} /> A cada importação o relatório é gravado no Firebase (1 doc/mês, o novo prevalece) e enviado ao Google Sheets.
          </div>
          {/* Botão Relatório Manual */}
          <button onClick={() => setShowManual(true)} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', marginTop: '12px', padding: '14px 18px', border: `1.5px dashed ${S.accent}60`, borderRadius: '14px', background: S.accent + '08', color: S.accent, fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'background .15s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = S.accent + '18'}
            onMouseLeave={(e) => e.currentTarget.style.background = S.accent + '08'}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: S.accent + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><PenLine size={20} /></div>
            <div style={{ textAlign: 'left' }}>
              <div>Relatório Manual</div>
              <div style={{ fontSize: '11.5px', fontWeight: 400, color: S.muted2, marginTop: '2px' }}>Adicione ou edite uma entrada sem precisar do arquivo do Prolog</div>
            </div>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginTop: '12px', padding: '12px 14px', border: '1px solid #7f1d1d', borderRadius: '12px', background: 'rgba(127,29,29,.12)' }}>
            <Trash2 size={20} color="#f87171" />
            <button onClick={clearMonth} style={{ background: 'linear-gradient(135deg,#b91c1c,#ef4444)', border: 'none', color: '#fff', borderRadius: '10px', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Limpar dados do mês</button>
            <span style={{ fontSize: '11.5px', color: S.muted2 }}>zera a matriz de Junho/2026 no Firebase</span>
          </div>
        </>)}

        {pane === 'hist' && (
          <div>
            {!hist.length && <div style={{ color: S.muted2, fontSize: '13px' }}>Nenhuma importação nesta sessão.</div>}
            {hist.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '11px', ...card, padding: '10px 13px', marginBottom: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#3d8bff22', color: '#3d8bff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Upload size={16} /></div>
                <div><div style={{ fontSize: '13px', fontWeight: 600 }}>{h.t}</div><div style={{ fontSize: '11.5px', color: S.muted2 }}>{h.by} · {h.dt} · {h.meta}</div></div>
                <span style={{ marginLeft: 'auto', fontSize: '11px', padding: '2px 9px', borderRadius: '999px', fontWeight: 600, background: '#3d8bff22', color: '#3d8bff' }}>Importado</span>
              </div>
            ))}
          </div>
        )}

        {pane === 'colab' && (
          <div>
            <div style={{ fontSize: '12px', color: S.muted2, marginBottom: '12px' }}>Troque a área de cada colaborador pelo seletor (salva no Firebase).</div>
            {teams.map((t) => (
              <div key={t.key} style={{ ...card, marginBottom: '11px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px' }}><div style={{ fontSize: '14px', fontWeight: 700 }}>{t.label}</div><span style={{ marginLeft: 'auto', fontSize: '10.5px', padding: '2px 9px', borderRadius: '999px', background: t.accent + '22', color: t.accent }}>{t.short}</span></div>
                {t.members.map((m) => (
                  <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px', borderTop: `1px solid ${S.border}` }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{m.name}</span>
                    <select value={t.key} onChange={(e) => moveMember(m.name, e.target.value)} style={{ marginLeft: 'auto', background: S.input, border: `1px solid ${S.border}`, color: S.text, borderRadius: '8px', padding: '6px 9px', fontSize: '12px', colorScheme: mode }}>
                      {teams.map((t2) => <option key={t2.key} value={t2.key}>{t2.short}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── MODAL DE CONFIRMAÇÃO ─────────────────────────────────────── */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '500px', background: S.card, border: `1px solid ${S.accent}`, borderRadius: '20px', padding: '26px', boxShadow: `0 0 50px ${S.glow}` }}>
            {/* Título */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: S.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={20} color={S.onAccent} /></div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '16px' }}>Confirmar importação</div>
                <div style={{ fontSize: '11.5px', color: S.muted2, marginTop: '2px' }}>{preview.fname}</div>
              </div>
            </div>

            {/* Chips de resumo */}
            <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {[
                [`${MESES[preview.mesIndex]} ${preview.ano}`, Calendar, S.accent],
                [`Dias ${preview.period.d1}–${preview.period.d2}`, Calendar, S.accent],
                [`${preview.count} registros`, BarChart2, '#34d399'],
                [`${preview.people} colaboradores`, Users, '#60a5fa'],
                ...(preview.novos ? [[`${preview.novos} novos`, AlertTriangle, '#fbbf24']] : []),
              ].map(([label, Icon, color], i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '999px', background: color + '18', border: `1px solid ${color}40`, fontSize: '12px', color, fontWeight: 600 }}>
                  <Icon size={12} />{label}
                </span>
              ))}
            </div>

            {/* Breakdown por equipe */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '16px' }}>
              {preview.teams.map((t) => (
                <div key={t.key} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', background: S.card2, borderRadius: '10px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: t.accent, marginRight: '10px' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, flex: 1 }}>{t.label}</span>
                  <span style={{ fontSize: '12px', color: S.muted2 }}>{t.members.length} colaboradores</span>
                </div>
              ))}
            </div>

            {/* Alerta novos colaboradores */}
            {preview.novos > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '10px 13px', background: '#78350f22', border: '1px solid #78350f66', borderRadius: '10px', marginBottom: '16px' }}>
                <AlertTriangle size={16} color="#fbbf24" />
                <span style={{ fontSize: '12px', color: '#fbbf24' }}>{preview.novos} colaborador(es) novo(s) serão adicionados ao cadastro.</span>
              </div>
            )}

            {/* Botões */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setPreview(null)} style={{ flex: 1, padding: '13px', borderRadius: '12px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={confirmImport} style={{ flex: 2, padding: '13px', borderRadius: '12px', background: S.gradient, border: 'none', color: S.onAccent, fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <CheckCircle size={16} />Confirmar importação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FLUXO SÁBADO: AUSENTES DO DIA ──────────────────────────── */}
      <AnimatePresence>
        {satFlow && (
          <>
            <motion.div key="sat-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(12px)', zIndex: 75 }} />
            <motion.div key="sat-modal" initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 32 }}
              style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 76, padding: '16px' }}>
              <SaturdayAbsenceFlow S={S} flow={satFlow} profile={profile}
                onSkip={() => setSatFlow(null)}
                onSaved={(count) => {
                  toast.success(`${count} técnico${count !== 1 ? 's' : ''} marcado${count !== 1 ? 's' : ''} como ausente${count !== 1 ? 's' : ''}!`);
                  setHist((h) => [{ t: 'Ausentes do sábado', by: profile?.nickname || 'admin', dt: new Date().toLocaleString('pt-BR'), meta: `${count} ausentes · dia ${satFlow.day}/${satFlow.month + 1}/${satFlow.year}`, tipo: 'sabado' }, ...h]);
                  setSatFlow(null);
                }} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── MODAL RELATÓRIO MANUAL ──────────────────────────────────── */}
      <AnimatePresence>
        {showManual && (
          <>
            <motion.div key="manual-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowManual(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(10px)', zIndex: 70 }} />
            <motion.div key="manual-modal" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
              style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 71, padding: '16px', pointerEvents: 'none' }}>
              <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: '580px', maxHeight: '92vh', overflow: 'auto' }}>
                <ManualEntryModal S={S} teams={teams} profile={profile}
                  onClose={() => setShowManual(false)}
                  onSaved={(entry) => {
                    toast.success('Entrada salva!');
                    setHist((h) => [{ t: 'Entrada manual', by: profile?.nickname || 'admin', dt: new Date().toLocaleString('pt-BR'), meta: `${entry.name} · dia ${entry.day}/${entry.mesIndex + 1}/${entry.ano}`, tipo: 'manual' }, ...h]);
                    setShowManual(false);
                  }} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── PROGRESS OVERLAY ────────────────────────────────────────── */}
      {prog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,9,20,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80 }}>
          <div style={{ width: '320px', maxWidth: '80%', ...card, padding: '24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '14px' }}>{prog.label}</div>
            <div style={{ height: '8px', borderRadius: '99px', background: S.card2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: prog.pct + '%', background: S.gradient, transition: 'width .08s linear' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <div style={{ fontSize: '11px', color: S.muted2 }}>Importando relatório Prolog…</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: S.accent }}>{Math.round(prog.pct)}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── FLUXO DE AUSENTES DO SÁBADO ─────────────────────────────────────────────
function SaturdayAbsenceFlow({ S, flow, profile, onSaved, onSkip }) {
  const { day, month, year, teams, presents } = flow;
  const MESES_LOC = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const [phase, setPhase] = useState('select'); // 'select' | 'confirm'
  const [saving, setSaving] = useState(false);

  // Inicializa: todos sem checklist hoje → ausente por padrão
  const [absent, setAbsent] = useState(() => {
    const s = new Set();
    teams.forEach((t) => t.members.forEach((m) => { if (!presents.has(m.name)) s.add(m.name); }));
    return s;
  });

  const totalMembers = teams.reduce((acc, t) => acc + t.members.length, 0);
  const absentList = [...absent];
  const presentCount = presents.size + (totalMembers - presents.size - absent.size); // presentes + os que o admin desmarcou como ausente

  const toggle = (name) => {
    if (presents.has(name)) return;
    setAbsent((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  };
  const markAll = () => { const s = new Set(); teams.forEach((t) => t.members.forEach((m) => { if (!presents.has(m.name)) s.add(m.name); })); setAbsent(s); };
  const clearAll = () => setAbsent(new Set());

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveFrotaAbsences(year, month, day, absentList, profile?.nickname || 'admin');
      onSaved(absentList.length);
    } catch (e) { toast.error('Erro: ' + e.message); }
    finally { setSaving(false); }
  };

  const dateStr = `${String(day).padStart(2,'0')}/${String(month + 1).padStart(2,'0')}/${year}`;
  const card2 = { background: S.card2, borderRadius: '10px' };

  // ── FASE 1: SELEÇÃO ──────────────────────────────────────────────────────
  if (phase === 'select') return (
    <div style={{ width: '100%', maxWidth: '600px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: S.card, border: '1px solid #fb923c60', borderRadius: '22px', boxShadow: '0 0 80px #fb923c30', overflow: 'hidden' }}>
      {/* Banner sábado */}
      <div style={{ background: 'linear-gradient(135deg, #c2410c, #fb923c)', padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '13px', background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CalendarCheck size={24} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '17px', color: '#fff' }}>Técnicos Ausentes — Sábado</div>
            <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,.8)', marginTop: '2px' }}>{dateStr} · Confirme quem não compareceu hoje</div>
          </div>
          <button onClick={onSkip} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '8px', padding: '7px', display: 'flex', alignItems: 'center' }}><X size={18} /></button>
        </div>

        {/* Contadores */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
          {[
            [presents.size, 'Presentes', '#bbf7d0', '#166534'],
            [absent.size, 'Ausentes', '#fed7aa', '#9a3412'],
            [totalMembers - presents.size - absent.size, 'Não contabilizados', 'rgba(255,255,255,.3)', 'rgba(255,255,255,.9)'],
          ].map(([v, l, bg, col]) => (
            <div key={l} style={{ flex: 1, textAlign: 'center', padding: '8px 6px', background: bg, borderRadius: '10px' }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: col, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: '10px', color: col, marginTop: '3px', fontWeight: 600 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ações rápidas */}
      <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderBottom: `1px solid ${S.border}` }}>
        <button onClick={markAll} style={{ fontSize: '12px', padding: '6px 13px', borderRadius: '8px', border: `1px solid #fb923c60`, background: '#fb923c18', color: '#fb923c', fontWeight: 600, cursor: 'pointer' }}>Marcar todos como ausentes</button>
        <button onClick={clearAll} style={{ fontSize: '12px', padding: '6px 13px', borderRadius: '8px', border: `1px solid ${S.border}`, background: 'transparent', color: S.muted2, fontWeight: 600, cursor: 'pointer' }}>Limpar seleção</button>
      </div>

      {/* Lista de colaboradores */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {teams.map((t) => (
          <div key={t.key} style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: t.accent, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', paddingLeft: '4px' }}>
              {t.label}
            </div>
            {t.members.map((m) => {
              const isPresent = presents.has(m.name);
              const isAbsent = absent.has(m.name);
              return (
                <div key={m.name}
                  onClick={() => toggle(m.name)}
                  style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 12px', borderRadius: '10px', marginBottom: '4px', cursor: isPresent ? 'default' : 'pointer', background: isPresent ? '#16a34a12' : isAbsent ? '#fb923c12' : S.card2, border: `1px solid ${isPresent ? '#16a34a30' : isAbsent ? '#fb923c40' : S.border}`, transition: 'all .12s', opacity: isPresent ? 0.75 : 1 }}>
                  <span style={{ width: '34px', height: '34px', borderRadius: '50%', background: t.accent, color: '#081427', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                    {initials(m.name)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    {m.plate && m.plate !== '—' && <div style={{ fontSize: '10.5px', color: S.muted2 }}>{m.plate}</div>}
                  </div>
                  {isPresent ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', padding: '4px 10px', borderRadius: '999px', background: '#16a34a22', color: '#34d399', fontWeight: 700, flexShrink: 0 }}>
                      <UserCheck size={13} /> Presente
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', padding: '4px 10px', borderRadius: '999px', background: isAbsent ? '#fb923c22' : S.card2, color: isAbsent ? '#fb923c' : S.muted2, fontWeight: 700, border: `1px solid ${isAbsent ? '#fb923c40' : S.border}`, flexShrink: 0, transition: 'all .12s' }}>
                      <UserX size={13} /> {isAbsent ? 'Ausente' : 'Não contab.'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Rodapé */}
      <div style={{ padding: '14px 16px', borderTop: `1px solid ${S.border}`, display: 'flex', gap: '10px' }}>
        <button onClick={onSkip} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Pular</button>
        <button onClick={() => setPhase('confirm')} disabled={absent.size === 0}
          style={{ flex: 2, padding: '12px', borderRadius: '12px', background: absent.size === 0 ? S.card2 : 'linear-gradient(135deg,#c2410c,#fb923c)', border: 'none', color: absent.size === 0 ? S.muted2 : '#fff', fontSize: '13px', fontWeight: 700, cursor: absent.size === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <UserX size={16} /> Confirmar {absent.size} ausente{absent.size !== 1 ? 's' : ''} →
        </button>
      </div>
    </div>
  );

  // ── FASE 2: CONFIRMAÇÃO ──────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', maxWidth: '480px', background: S.card, border: '1px solid #fb923c60', borderRadius: '22px', boxShadow: '0 0 80px #fb923c30', overflow: 'hidden' }}>
      <div style={{ background: 'linear-gradient(135deg,#c2410c,#fb923c)', padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserX size={22} color="#fff" /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px', color: '#fff' }}>Confirmar ausências</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.8)' }}>Sábado, {dateStr}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        {/* Aviso */}
        <div style={{ display: 'flex', gap: '10px', padding: '11px 13px', background: '#fb923c12', border: '1px solid #fb923c35', borderRadius: '11px', marginBottom: '16px' }}>
          <AlertTriangle size={16} color="#fb923c" style={{ flexShrink: 0, marginTop: '1px' }} />
          <span style={{ fontSize: '12.5px', color: S.muted2 }}>
            Os técnicos abaixo serão registrados como <b style={{ color: '#fb923c' }}>AUSENTE</b> no sábado {dateStr}, não como "Não fez".
          </span>
        </div>

        {/* Lista dos ausentes */}
        <div style={{ fontSize: '12px', color: S.muted2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
          {absentList.length} técnico{absentList.length !== 1 ? 's' : ''} serão marcados como ausentes
        </div>
        <div style={{ maxHeight: '220px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '18px' }}>
          {teams.map((t) => t.members.filter((m) => absent.has(m.name)).map((m) => (
            <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 11px', background: '#fb923c10', border: '1px solid #fb923c30', borderRadius: '9px' }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: t.accent, color: '#081427', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>{initials(m.name)}</span>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{m.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: '10.5px', padding: '2px 7px', borderRadius: '999px', background: t.accent + '22', color: t.accent, fontWeight: 600 }}>{t.short}</span>
            </div>
          )))}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setPhase('select')} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>← Voltar</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: '12px', borderRadius: '12px', background: saving ? S.card2 : 'linear-gradient(135deg,#c2410c,#fb923c)', border: 'none', color: saving ? S.muted2 : '#fff', fontSize: '13px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: saving ? 0.7 : 1 }}>
            <Save size={15} />{saving ? 'Salvando…' : 'Salvar ausências'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MODAL DE RELATÓRIO MANUAL ────────────────────────────────────────────────
const ANOS = [2025, 2026, 2027];
const ST_OPS = [['feito', 'Feito ✓', '#34d399'], ['atrasado', 'Atrasado ⏱', '#fbbf24'], ['naofez', 'Não fez ✗', '#f87171'], ['ausente', 'Ausente ○', '#fb923c']];
const TIPO_OPS = [['padrao', 'Checklist Padrão'], ['semanal', 'Calibragem Semanal'], ['ocorrencia', 'Ocorrência']];
const SEV_OPS = [['normal', 'Normal'], ['alta', 'Alta'], ['critica', 'Crítica']];

function ManualEntryModal({ S, teams, profile, onClose, onSaved }) {
  const today = new Date();
  const [ano, setAno] = useState(today.getFullYear());
  const [mesIndex, setMesIndex] = useState(today.getMonth());
  const [day, setDay] = useState(today.getDate());
  const [tipo, setTipo] = useState('padrao');
  const [selName, setSelName] = useState('');
  const [plate, setPlate] = useState('');
  const [time, setTime] = useState('08:00');
  const [st, setSt] = useState('feito');
  const [kmIni, setKmIni] = useState('');
  const [kmFim, setKmFim] = useState('');
  const [swaps, setSwaps] = useState([]); // [{plateFrom, plateTo, timeFrom, timeTo}]
  const [obs, setObs] = useState('');
  const [nok, setNok] = useState('');
  const [sev, setSev] = useState('normal');
  const [saving, setSaving] = useState(false);

  const lastDay = new Date(ano, mesIndex + 1, 0).getDate();
  const days = Array.from({ length: lastDay }, (_, i) => i + 1);

  // Quando muda colaborador, pré-preenche placa padrão dele
  const handleSelectName = (name) => {
    setSelName(name);
    const team = teams.find((t) => t.members.some((m) => m.name === name));
    const member = team?.members.find((m) => m.name === name);
    if (member?.plate && member.plate !== '—') setPlate(member.plate);
    else setPlate('');
  };

  const addSwap = () => setSwaps((s) => [...s, { plateFrom: plate || '', plateTo: '', timeFrom: time, timeTo: '' }]);
  const removeSwap = (i) => setSwaps((s) => s.filter((_, idx) => idx !== i));
  const updateSwap = (i, field, val) => setSwaps((s) => s.map((sw, idx) => idx === i ? { ...sw, [field]: val } : sw));

  const handleSave = async () => {
    if (!selName) { toast.error('Selecione um colaborador'); return; }
    if (!day) { toast.error('Selecione o dia'); return; }
    setSaving(true);
    try {
      const by = profile?.nickname || 'admin';
      const entry = { name: selName, day, ano, mesIndex };

      if (tipo === 'padrao') {
        entry.st = st; entry.plate = plate || null; entry.time = time;
        if (kmIni) entry.kmIni = +kmIni;
        if (kmFim) entry.kmFim = +kmFim;
        const validSwaps = swaps.filter((sw) => sw.plateTo && sw.timeTo);
        if (validSwaps.length) { entry.swaps = validSwaps; entry.p2 = validSwaps[validSwaps.length - 1].plateTo; }
      } else if (tipo === 'semanal') {
        const wd = new Date(ano, mesIndex, day).getDay();
        entry.calEntry = { day, st: wd === 1 ? 'feito' : 'atrasado' };
        entry.st = null; // não grava em data[name][day] — é calendário
      } else if (tipo === 'ocorrencia') {
        entry.plate = plate || null; entry.time = time;
        if (kmIni) entry.kmIni = +kmIni; if (kmFim) entry.kmFim = +kmFim;
        entry.occEntry = { obs: obs || '(sem observação)', nok: +nok || 0, sev, plate: plate || null,
          dt: `${String(day).padStart(2,'0')}/${String(mesIndex+1).padStart(2,'0')} ${time}`, km: +kmIni || 0, pa: sev === 'alta' ? 1 : 0, pc: sev === 'critica' ? 1 : 0 };
        entry.st = null;
      }

      await saveFrotaManualEntry(ano, mesIndex, entry, by);
      onSaved(entry);
    } catch (e) { toast.error('Erro ao salvar: ' + e.message); } finally { setSaving(false); }
  };

  const inp = { width: '100%', padding: '10px 13px', borderRadius: '10px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box' };
  const lbl = { fontSize: '11.5px', color: S.muted2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '5px', display: 'block' };
  const sel = { ...inp, cursor: 'pointer', colorScheme: 'dark' };
  const row = { display: 'flex', gap: '10px' };
  const col = (flex = 1) => ({ flex, minWidth: 0 });

  return (
    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '20px', boxShadow: `0 0 60px ${S.glow}`, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 20px', borderBottom: `1px solid ${S.border}` }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: S.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><PenLine size={20} color={S.onAccent} /></div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '16px' }}>Relatório Manual</div>
          <div style={{ fontSize: '12px', color: S.muted2 }}>Adicione ou edite uma entrada diretamente</div>
        </div>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: S.muted, cursor: 'pointer', padding: '6px' }}><X size={20} /></button>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Colaborador */}
        <div>
          <label style={lbl}>Colaborador</label>
          <select value={selName} onChange={(e) => handleSelectName(e.target.value)} style={sel}>
            <option value="">— selecione —</option>
            {teams.map((t) => (
              <optgroup key={t.key} label={t.label}>
                {t.members.map((m) => <option key={m.name} value={m.name}>{m.name}{m.plate && m.plate !== '—' ? ` (${m.plate})` : ''}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Data */}
        <div style={row}>
          <div style={col(1)}>
            <label style={lbl}>Ano</label>
            <select value={ano} onChange={(e) => setAno(+e.target.value)} style={sel}>
              {ANOS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={col(2)}>
            <label style={lbl}>Mês</label>
            <select value={mesIndex} onChange={(e) => setMesIndex(+e.target.value)} style={sel}>
              {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div style={col(1)}>
            <label style={lbl}>Dia</label>
            <select value={day} onChange={(e) => setDay(+e.target.value)} style={sel}>
              {days.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Tipo de checklist */}
        <div>
          <label style={lbl}>Tipo de checklist</label>
          <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
            {TIPO_OPS.map(([k, l]) => (
              <button key={k} onClick={() => setTipo(k)} style={{ padding: '8px 14px', borderRadius: '9px', border: `1px solid ${tipo === k ? S.accent : S.border}`, background: tipo === k ? S.accent + '22' : 'transparent', color: tipo === k ? S.accent : S.muted2, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Campos de padrão / ocorrência */}
        {(tipo === 'padrao' || tipo === 'ocorrencia') && (<>
          <div style={row}>
            <div style={col(2)}>
              <label style={lbl}>Placa</label>
              <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="ABC1D23" style={inp} />
            </div>
            <div style={col(1)}>
              <label style={lbl}>Horário</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inp} />
            </div>
          </div>
          <div style={row}>
            <div style={col()}>
              <label style={lbl}>KM Inicial</label>
              <input type="number" value={kmIni} onChange={(e) => setKmIni(e.target.value)} placeholder="0" style={inp} />
            </div>
            <div style={col()}>
              <label style={lbl}>KM Final</label>
              <input type="number" value={kmFim} onChange={(e) => setKmFim(e.target.value)} placeholder="0" style={inp} />
            </div>
          </div>
        </>)}

        {/* Status — só para padrão */}
        {tipo === 'padrao' && (
          <div>
            <label style={lbl}>Status</label>
            <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
              {ST_OPS.map(([k, l, c]) => (
                <button key={k} onClick={() => setSt(k)} style={{ padding: '8px 14px', borderRadius: '9px', border: `1px solid ${st === k ? c : S.border}`, background: st === k ? c + '22' : 'transparent', color: st === k ? c : S.muted2, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
          </div>
        )}

        {/* Calibragem — info extra */}
        {tipo === 'semanal' && (
          <div style={{ padding: '12px 14px', background: '#fbbf2415', border: '1px solid #fbbf2440', borderRadius: '10px', fontSize: '12.5px', color: S.muted2 }}>
            A calibragem será marcada como <b style={{ color: '#34d399' }}>Feita</b> se o dia selecionado for <b style={{ color: S.text }}>segunda-feira</b>, ou como <b style={{ color: '#fbbf24' }}>Atrasada</b> nos demais dias.
          </div>
        )}

        {/* Ocorrência — campos extras */}
        {tipo === 'ocorrencia' && (<>
          <div>
            <label style={lbl}>Observações</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder="Descreva a ocorrência..." style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div style={row}>
            <div style={col()}>
              <label style={lbl}>Itens NOK</label>
              <input type="number" value={nok} onChange={(e) => setNok(e.target.value)} placeholder="0" style={inp} />
            </div>
            <div style={col(2)}>
              <label style={lbl}>Gravidade</label>
              <div style={{ display: 'flex', gap: '7px' }}>
                {SEV_OPS.map(([k, l]) => {
                  const c = k === 'critica' ? '#f87171' : k === 'alta' ? '#fbbf24' : '#3d8bff';
                  return <button key={k} onClick={() => setSev(k)} style={{ flex: 1, padding: '9px 6px', borderRadius: '9px', border: `1px solid ${sev === k ? c : S.border}`, background: sev === k ? c + '22' : 'transparent', color: sev === k ? c : S.muted2, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>{l}</button>;
                })}
              </div>
            </div>
          </div>
        </>)}

        {/* Trocas de carro — só para padrão */}
        {tipo === 'padrao' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ ...lbl, margin: 0 }}>Trocas de carro</label>
              <button onClick={addSwap} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 11px', borderRadius: '8px', border: `1px solid ${S.accent}60`, background: S.accent + '15', color: S.accent, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={14} /> Adicionar troca
              </button>
            </div>
            {!swaps.length && <div style={{ fontSize: '12px', color: S.muted2 }}>Nenhuma troca. Clique em "Adicionar troca" para registrar uma mudança de veículo.</div>}
            {swaps.map((sw, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: '#38bdf808', border: '1px solid #38bdf825', borderRadius: '10px', marginBottom: '7px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <Road size={14} color="#38bdf8" />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>Troca {i + 1}</span>
                  <button onClick={() => removeSwap(i)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: S.muted, cursor: 'pointer', padding: '2px' }}><X size={14} /></button>
                </div>
                <div style={row}>
                  <div style={col()}>
                    <label style={{ ...lbl, textTransform: 'none', letterSpacing: 0 }}>De (placa)</label>
                    <input value={sw.plateFrom} onChange={(e) => updateSwap(i, 'plateFrom', e.target.value.toUpperCase())} placeholder="ABC1D23" style={{ ...inp, fontSize: '12px', padding: '8px 11px' }} />
                  </div>
                  <div style={col(0.7)}>
                    <label style={{ ...lbl, textTransform: 'none', letterSpacing: 0 }}>Às</label>
                    <input type="time" value={sw.timeFrom} onChange={(e) => updateSwap(i, 'timeFrom', e.target.value)} style={{ ...inp, fontSize: '12px', padding: '8px 11px' }} />
                  </div>
                </div>
                <div style={row}>
                  <div style={col()}>
                    <label style={{ ...lbl, textTransform: 'none', letterSpacing: 0 }}>Para (placa)</label>
                    <input value={sw.plateTo} onChange={(e) => updateSwap(i, 'plateTo', e.target.value.toUpperCase())} placeholder="XYZ9H99" style={{ ...inp, fontSize: '12px', padding: '8px 11px' }} />
                  </div>
                  <div style={col(0.7)}>
                    <label style={{ ...lbl, textTransform: 'none', letterSpacing: 0 }}>Às</label>
                    <input type="time" value={sw.timeTo} onChange={(e) => updateSwap(i, 'timeTo', e.target.value)} style={{ ...inp, fontSize: '12px', padding: '8px 11px' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Botões */}
        <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: '12px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '13px', borderRadius: '12px', background: S.gradient, border: 'none', color: S.onAccent, fontSize: '14px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: saving ? 0.7 : 1 }}>
            <Save size={16} />{saving ? 'Salvando…' : 'Salvar entrada'}
          </button>
        </div>
      </div>
    </div>
  );
}
