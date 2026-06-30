import { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Truck, Sun, Moon, LayoutDashboard, LogOut, Upload, Trash2, Users, History, FileInput, CloudUpload } from 'lucide-react';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { logoutUser } from '../../services/auth/authService';
import { getFrotaCadastro, saveFrotaCadastro, saveFrotaMonth, getFrotaMonth } from '../../services/database/frotaService';
import { parseProlog, buildSheetsPayload, MESES, DEFAULT_TEAMS } from './frotaCore';

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

  useEffect(() => { getFrotaCadastro({ force: true }).then(setTeams).catch(() => {}); }, []);

  const handleLogout = async () => { try { await logoutUser(); } finally { navigate('/frota/dashboard'); } };

  const sendSheets = (tms, data, ano, mesIndex) => {
    const url = SHEETS_URL || localStorage.getItem('frota_sheets_url') || '';
    if (!url) return '(envio ao Sheets: configure a URL para ativar)';
    try {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(buildSheetsPayload(tms, data, ano, mesIndex, localStorage.getItem('frota_sheets_secret') || SHEETS_SECRET)) });
    } catch { /* */ }
    return 'Enviado ao Google Sheets.';
  };

  const importText = async (text, fname) => {
    setProg({ label: 'Importando relatório…', pct: 5 });
    let r;
    try { r = parseProlog(text, teams); } catch (e) { setProg(null); setMsg('Erro: ' + e.message); toast.error(e.message); return; }
    try {
      setProg({ label: 'Salvando no Firebase…', pct: 55 });
      const by = profile?.nickname || 'admin';
      if (r.novos > 0) await saveFrotaCadastro(r.teams);
      await saveFrotaMonth(r.ano, r.mesIndex, { data: r.data, cal: r.cal, occ: r.occ, period: r.period }, by);
      setTeams(r.teams);
      setProg({ label: 'Enviando à planilha…', pct: 85 });
      const sheetNote = sendSheets(r.teams, r.data, r.ano, r.mesIndex);
      setProg({ label: 'Concluído', pct: 100 });
      const txt = `✓ Importado: ${r.count} registros · ${r.people} colaboradores${r.novos ? ` · ${r.novos} novos` : ''} · ${MESES[r.mesIndex]}/${r.ano} (dias ${r.period.d1}–${r.period.d2}). Gravado no Firebase. ${sheetNote}`;
      setMsg(txt); toast.success('Importado e salvo no Firebase');
      setHist((h) => [{ t: 'Importado do Prolog', by: by + ' (admin)', dt: new Date().toLocaleString('pt-BR'), meta: `${fname || 'arquivo'} · ${r.count} registros`, tipo: 'import' }, ...h]);
    } catch (e) {
      setMsg('Erro ao salvar: ' + e.message); toast.error('Erro ao salvar no Firebase: ' + e.message);
    } finally { setTimeout(() => setProg(null), 500); }
  };

  const readFile = (f) => { if (!f) return; const rd = new FileReader(); rd.onload = () => importText(rd.result, f.name); rd.onerror = () => setMsg('Erro ao ler o arquivo.'); rd.readAsText(f, 'utf-8'); };

  const moveMember = async (name, toKey) => {
    const next = teams.map((t) => ({ ...t, members: t.members.filter((m) => m[0] !== name) }));
    const from = teams.find((t) => t.members.some((m) => m[0] === name));
    const m = from?.members.find((x) => x[0] === name); if (!m) return;
    next.find((t) => t.key === toKey).members.push(m);
    setTeams(next);
    try { await saveFrotaCadastro(next); toast.success('Área atualizada'); } catch { toast.error('Erro ao salvar'); }
  };

  const clearMonth = async () => {
    if (!confirm('Limpar os dados do mês de Junho/2026 no Firebase? (zera a matriz)')) return;
    setProg({ label: 'Limpando…', pct: 40 });
    try {
      const empty = {}; teams.forEach((t) => t.members.forEach((mm) => { empty[mm[0]] = {}; }));
      await saveFrotaMonth(2026, 5, { data: {}, cal: {}, occ: [], period: { d1: 1, d2: 31 } }, profile?.nickname || 'admin');
      setMsg('Dados do mês limpos. Importe um arquivo do Prolog.'); toast.success('Mês limpo no Firebase');
    } catch (e) { setMsg('Erro: ' + e.message); }
    finally { setProg({ label: 'Concluído', pct: 100 }); setTimeout(() => setProg(null), 400); }
  };

  const card = { background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px' };
  const ibtn = { display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 11px', borderRadius: '8px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '12px', fontWeight: 600, cursor: 'pointer' };
  const NAV = [['import', 'Importar / criar', FileInput], ['hist', 'Histórico', History], ['colab', 'Colaboradores', Users]];

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.text }}>
      <header style={{ background: S.card, borderBottom: `1px solid ${S.border}` }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <img src="/logo.png" alt="IbiúNET" style={{ height: '26px', width: 'auto' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: S.accent }}><Truck size={11} /> FROTA · ADMIN</div>
          </div>
          <button onClick={toggleTheme} title="Tema" style={{ ...ibtn, padding: '7px' }}>{mode === 'light' ? <Moon size={15} /> : <Sun size={15} color="#fbbf24" />}</button>
          <button onClick={() => navigate('/frota/dashboard')} style={ibtn}><LayoutDashboard size={14} /> Dashboard</button>
          <button onClick={handleLogout} style={{ ...ibtn, background: '#0d2d1f', borderColor: '#065f46', color: '#34d399', marginLeft: 'auto' }}><LogOut size={13} /> Sair</button>
        </div>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderBottom: `1px solid ${S.border}`, paddingBottom: '14px', marginBottom: '16px' }}>
          {NAV.map(([k, l, I]) => (
            <button key={k} onClick={() => setPane(k)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 15px', borderRadius: '10px', border: `1px solid ${pane === k ? S.accent : S.border}`, background: pane === k ? S.accent : S.card, color: pane === k ? '#fff' : S.muted2, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}><I size={16} />{l}</button>
          ))}
        </div>

        {pane === 'import' && (<>
          <div onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); readFile(e.dataTransfer.files[0]); }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginTop: '12px', padding: '12px 14px', border: '1px solid #7f1d1d', borderRadius: '12px', background: 'rgba(127,29,29,.12)' }}>
            <Trash2 size={20} color="#f87171" />
            <button onClick={clearMonth} style={{ background: 'linear-gradient(135deg,#b91c1c,#ef4444)', border: 'none', color: '#fff', borderRadius: '10px', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Limpar dados do mês</button>
            <span style={{ fontSize: '11.5px', color: S.muted2 }}>zera a matriz de Junho/2026 no Firebase</span>
          </div>
        </>)}

        {pane === 'hist' && (
          <div>
            {!hist.length && <div style={{ color: S.muted2, fontSize: '13px' }}>Nenhuma importação nesta sessão. (Cada import gera quem fez / quando / o tipo.)</div>}
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
            <div style={{ fontSize: '12px', color: S.muted2, marginBottom: '12px' }}>Troque a área de cada colaborador pelo seletor (salva no Firebase). Só técnicos são obrigados ao checklist.</div>
            {teams.map((t) => (
              <div key={t.key} style={{ ...card, marginBottom: '11px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px' }}><div style={{ fontSize: '14px', fontWeight: 700 }}>{t.label}</div><span style={{ marginLeft: 'auto', fontSize: '10.5px', padding: '2px 9px', borderRadius: '999px', background: t.accent + '22', color: t.accent }}>{t.short}</span></div>
                {t.members.map((m) => (
                  <div key={m[0]} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px', borderTop: `1px solid ${S.border}` }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{m[0]}</span>
                    <select value={t.key} onChange={(e) => moveMember(m[0], e.target.value)} style={{ marginLeft: 'auto', background: S.input, border: `1px solid ${S.border}`, color: S.text, borderRadius: '8px', padding: '6px 9px', fontSize: '12px', colorScheme: mode }}>
                      {teams.map((t2) => <option key={t2.key} value={t2.key}>{t2.short}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </main>

      {prog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,9,20,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80 }}>
          <div style={{ width: '300px', maxWidth: '80%', ...card, padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>{prog.label}</div>
            <div style={{ height: '8px', borderRadius: '99px', background: S.card2, overflow: 'hidden' }}><div style={{ height: '100%', width: prog.pct + '%', background: 'linear-gradient(90deg,#2f6fe0,#3d8bff)', transition: 'width .2s' }} /></div>
            <div style={{ fontSize: '12px', color: S.muted2, marginTop: '8px', textAlign: 'right' }}>{Math.round(prog.pct)}%</div>
          </div>
        </div>
      )}
    </div>
  );
};
