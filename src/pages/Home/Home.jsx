import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  Cable, Wifi, Video, Truck, ShieldCheck, LogIn, LogOut, Sun, Moon,
  ArrowRight, Check, UserCircle, Eye, EyeOff, LayoutDashboard,
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { ThemeContext } from '../../context/ThemeContext';
import { BRANDS } from '../../theme/palette';
import { loginUser, logoutUser } from '../../services/auth/authService';
import { getUserProfile, setUserNickname, isNicknameTaken } from '../../services/database/userProfileService';
import { Spinner } from '../../components/common/Spinner';

// Equipes — cada uma com sua rota; as cores saem da paleta de marca (fonte única)
const TEAMS = [
  { key: 'fibra', name: 'Fibra', desc: 'Produção diária da equipe de campo',
    icon: Cable, dashboard: '/fibra/dashboard', admin: '/fibra/admin' },
  { key: 'redes', name: 'Redes', desc: 'Ordens de serviço e SLA da rede',
    icon: Wifi, dashboard: '/redes/dashboard', admin: '/redes/admin' },
  { key: 'cameras', name: 'WIBICAM', desc: 'Equipe de câmeras de monitoramento',
    icon: Video, dashboard: '/cameras/dashboard', admin: '/cameras/admin' },
  { key: 'frota', name: 'Frota', desc: 'Checklist diário dos veículos',
    icon: Truck, dashboard: '/frota/dashboard', admin: '/frota/admin' },
];

export const Home = () => {
  const navigate = useNavigate();
  const { S, mode, toggleTheme } = useContext(ThemeContext);
  const { user, profile, refreshProfile } = useContext(AuthContext);
  const isLogged = !!user && !!profile?.nickname;

  // adminMode = mostra os cards apontando para os ADMs (em vez das dashboards)
  const [adminMode, setAdminMode] = useState(false);

  // Login popup
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Primeiro acesso — apelido
  const [needNickname, setNeedNickname] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [nickname, setNickname] = useState('');
  const [savingNick, setSavingNick] = useState(false);

  const closeLogin = () => {
    setShowLogin(false); setLoginEmail(''); setLoginPass(''); setShowPass(false);
    setNeedNickname(false); setPendingUser(null); setNickname('');
  };

  const handleAdminClick = () => {
    if (isLogged) setAdminMode(true);
    else setShowLogin(true);
  };

  const handleCardClick = (team) => {
    navigate(adminMode ? team.admin : team.dashboard);
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPass) { toast.error('Preencha email e senha'); return; }
    setLoginLoading(true);
    try {
      const cred = await loginUser(loginEmail, loginPass);
      const p = await getUserProfile(cred.user.uid);
      if (!p || !p.nickname) {
        setPendingUser(cred.user);
        setNeedNickname(true);
        setLoginLoading(false);
        return;
      }
      await refreshProfile(cred.user.uid);
      toast.success(`Bem-vindo, ${p.nickname}!`);
      setLoginLoading(false);
      closeLogin();
      setAdminMode(true);
    } catch { toast.error('Email ou senha incorretos'); setLoginLoading(false); }
  };

  const handleSaveNickname = async () => {
    const nick = nickname.trim();
    if (nick.length < 2) { toast.error('Escolha um apelido com pelo menos 2 letras'); return; }
    setSavingNick(true);
    try {
      const taken = await isNicknameTaken(nick, pendingUser.uid);
      if (taken) { toast.error('Esse apelido já está em uso. Escolha outro.'); setSavingNick(false); return; }
      await setUserNickname(pendingUser.uid, pendingUser.email, nick);
      await refreshProfile(pendingUser.uid);
      toast.success(`Apelido definido: ${nick}`);
      setSavingNick(false);
      closeLogin();
      setAdminMode(true);
    } catch { toast.error('Erro ao salvar apelido'); setSavingNick(false); }
  };

  const handleLogout = async () => {
    try { await logoutUser(); setAdminMode(false); toast.success('Sessão encerrada'); }
    catch { toast.error('Erro ao sair'); }
  };

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', background: S.bg, position: 'relative', overflow: 'hidden' }}>
      {/* Glow de fundo */}
      <div style={{ position: 'absolute', top: '-120px', left: '-120px', width: '460px', height: '460px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12), transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-160px', right: '-140px', width: '560px', height: '560px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.10), transparent 70%)', pointerEvents: 'none' }} />
      <style>{`
        @media (max-width: 1020px) {
          .home-brand-mark {
            position: static !important;
            width: min(280px, 72vw) !important;
            max-width: none !important;
            margin: 0 auto -8px !important;
          }
        }
      `}</style>

      {/* HEADER */}
      <header style={{ position: 'relative', zIndex: 2, padding: '0 clamp(16px, 5vw, 32px)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div aria-hidden="true" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <button onClick={toggleTheme} title="Alternar tema"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: '10px', background: 'transparent', border: `1px solid ${S.border}`, color: mode === 'light' ? S.purple : S.orange, cursor: 'pointer', flexShrink: 0 }}>
              {mode === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            {isLogged && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '10px', background: S.card, border: `1px solid ${S.border}`, color: S.green, fontSize: '12px', fontWeight: 700, minWidth: 0 }}>
                  <Check size={12} style={{ flexShrink: 0 }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '22vw' }}>{profile.nickname}</span>
                </div>
                <button onClick={handleLogout} title="Sair"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '10px', background: '#0d2d1f', border: '1px solid #065f46', color: '#34d399', fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                  <LogOut size={13} />Sair
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main style={{ position: 'relative', zIndex: 2, flex: 1, width: '100%', maxWidth: '1100px', margin: '0 auto', padding: 'clamp(24px, 6vw, 56px) clamp(16px, 5vw, 32px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'clamp(28px, 5vw, 44px)' }}>
        <motion.img
          src="/logo-frota.png"
          alt="IbiúNET Multiplay"
          className="home-brand-mark"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08, duration: 0.45 }}
          style={{
            position: 'absolute',
            left: 'clamp(-18px, -1.2vw, 4px)',
            top: 'clamp(2px, 2.6vw, 30px)',
            width: 'clamp(240px, 28vw, 380px)',
            maxWidth: '35%',
            height: 'auto',
            pointerEvents: 'none',
            filter: 'drop-shadow(0 18px 38px rgba(46,139,255,0.20))',
          }}
        />

        {/* Título + botão Administração */}
        <div style={{ textAlign: 'center', width: '100%' }}>
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            style={{ fontSize: '12px', fontWeight: 700, color: S.blue, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '12px' }}>
            Controle de O.S — IBIUNET
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            style={{ fontSize: 'clamp(28px, 6vw, 44px)', fontWeight: 900, color: S.text, lineHeight: 1.1, margin: 0 }}>
            {adminMode ? 'Escolha o painel de Administração' : 'Selecione a equipe'}
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            style={{ color: S.muted2, fontSize: 'clamp(13px, 2.5vw, 15px)', marginTop: '10px' }}>
            {adminMode
              ? 'Você está no modo administração — selecione a equipe para lançar/editar.'
              : 'Acompanhe a produtividade de cada equipe em tempo real.'}
          </motion.p>

          {/* Botão Administração / Voltar */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}
            style={{ marginTop: '22px', display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {adminMode ? (
              <button onClick={() => setAdminMode(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 22px', borderRadius: '12px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = S.blue; e.currentTarget.style.color = S.blue; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.color = S.muted2; }}>
                <LayoutDashboard size={16} />Ver dashboards
              </button>
            ) : (
              <button onClick={handleAdminClick}
                style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '12px 26px', borderRadius: '12px', background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid #334155', color: '#e2e8f0', fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 30px rgba(0,0,0,0.35)', transition: 'transform 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <ShieldCheck size={17} color={S.accent} />ADMINISTRAÇÃO
              </button>
            )}
          </motion.div>
        </div>

        {/* Cards das equipes */}
        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'clamp(14px, 3vw, 22px)' }}>
          {TEAMS.map((team, i) => {
            const Icon = team.icon;
            const b = BRANDS[team.key][mode];
            const grad = b.gradient, accent = b.accent, glow = b.glow, onAccent = b.onAccent;
            return (
              <motion.button key={team.key} type="button"
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
                onClick={() => handleCardClick(team)}
                style={{ position: 'relative', textAlign: 'left', overflow: 'hidden', cursor: 'pointer', padding: '26px', borderRadius: '20px', background: S.card, border: `1px solid ${S.border}`, transition: 'transform 0.18s, border-color 0.18s, box-shadow 0.18s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = accent; e.currentTarget.style.boxShadow = `0 18px 50px ${glow}`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = S.border; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: glow, filter: 'blur(40px)', pointerEvents: 'none' }} />
                <div style={{ width: '54px', height: '54px', borderRadius: '15px', background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px', boxShadow: `0 8px 24px ${glow}` }}>
                  <Icon size={26} color={onAccent} />
                </div>
                <div style={{ color: S.text, fontWeight: 900, fontSize: '22px', letterSpacing: team.key === 'cameras' ? '1px' : 0 }}>{team.name}</div>
                <div style={{ color: S.muted2, fontSize: '13px', marginTop: '6px', lineHeight: 1.5 }}>{team.desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '18px', color: accent, fontSize: '13px', fontWeight: 700 }}>
                  {adminMode ? 'Abrir Admin' : 'Abrir Dashboard'} <ArrowRight size={15} />
                </div>
              </motion.button>
            );
          })}
        </div>

        <p style={{ color: S.muted, fontSize: '12px' }}>© 2026 IBIUNET · Sistema de Controle de O.S</p>
      </main>

      {/* MODAL LOGIN */}
      <AnimatePresence>
        {showLogin && (
          <>
            <div onClick={() => !loginLoading && !savingNick && closeLogin()}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 49 }} />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
              style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
              <div style={{ width: '100%', maxWidth: '410px', background: S.surface, border: `1px solid ${S.accent}`, borderRadius: '20px', boxShadow: `0 0 50px ${S.glow}`, padding: 'clamp(22px, 5vw, 32px)' }}>

                {!needNickname ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '22px' }}>
                      <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                        <ShieldCheck size={26} color={S.accent} />
                      </div>
                      <div style={{ color: S.text, fontWeight: 800, fontSize: '18px' }}>Administração</div>
                      <div style={{ color: S.muted2, fontSize: '13px', marginTop: '4px' }}>Entre para acessar os painéis de lançamento</div>
                    </div>

                    <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Email" autoFocus
                      style={{ width: '100%', padding: '13px 16px', borderRadius: '12px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }}
                      onFocus={e => e.target.style.borderColor = S.accent} onBlur={e => e.target.style.borderColor = S.border} />
                    <div style={{ position: 'relative', marginBottom: '20px' }}>
                      <input type={showPass ? 'text' : 'password'} value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="Senha"
                        onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                        style={{ width: '100%', padding: '13px 46px 13px 16px', borderRadius: '12px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                        onFocus={e => e.target.style.borderColor = S.accent} onBlur={e => e.target.style.borderColor = S.border} />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: S.muted, background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                        {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={closeLogin}
                        style={{ flex: 1, padding: '13px', borderRadius: '12px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                        Cancelar
                      </button>
                      <button onClick={handleLogin} disabled={loginLoading}
                        style={{ flex: 2, padding: '13px', borderRadius: '12px', background: S.gradient, border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: loginLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: loginLoading ? 0.7 : 1 }}>
                        {loginLoading ? <Spinner /> : <><LogIn size={16} />Entrar</>}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '20px' }}>
                      <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: S.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', boxShadow: `0 0 24px ${S.glow}` }}>
                        <UserCircle size={28} color="#fff" />
                      </div>
                      <div style={{ color: S.text, fontWeight: 800, fontSize: '19px' }}>Primeiro acesso</div>
                      <div style={{ color: S.muted2, fontSize: '13px', marginTop: '6px', lineHeight: 1.5 }}>
                        Escolha um <strong style={{ color: S.blue }}>apelido</strong> — ele aparecerá nos relatórios que você criar.
                      </div>
                    </div>
                    <input value={nickname} onChange={e => setNickname(e.target.value)} maxLength={20} autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveNickname(); }}
                      placeholder="Ex: André R."
                      style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', background: S.input, border: `1px solid ${S.border}`, color: S.text, fontSize: '15px', outline: 'none', boxSizing: 'border-box', marginBottom: '20px' }}
                      onFocus={e => e.target.style.borderColor = S.accent} onBlur={e => e.target.style.borderColor = S.border} />
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={closeLogin} disabled={savingNick}
                        style={{ flex: 1, padding: '13px', borderRadius: '12px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                        Cancelar
                      </button>
                      <button onClick={handleSaveNickname} disabled={savingNick}
                        style={{ flex: 2, padding: '13px', borderRadius: '12px', background: S.gradient, border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: savingNick ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: savingNick ? 0.7 : 1 }}>
                        {savingNick ? <Spinner /> : <><Check size={16} />Confirmar e entrar</>}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
