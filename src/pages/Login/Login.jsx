import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { loginUser, logoutUser } from '../../services/auth/authService';
import { getUserProfile, setUserNickname, isNicknameTaken } from '../../services/database/userProfileService';
import { Spinner } from '../../components/common/Spinner';
import { toast } from 'react-hot-toast';
import { AuthContext } from '../../context/AuthContext';
import { ThemeContext } from '../../context/ThemeContext';
import { Eye, EyeOff, UserCircle, Check, Sun, Moon } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshProfile } = useContext(AuthContext);
  const { mode, toggleTheme } = useContext(ThemeContext);

  // Primeiro acesso — escolher apelido
  const [needNickname, setNeedNickname] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [nickname, setNickname] = useState('');
  const [savingNick, setSavingNick] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cred = await loginUser(email, password);
      const profile = await getUserProfile(cred.user.uid);
      if (!profile || !profile.nickname) {
        setPendingUser(cred.user);
        setNeedNickname(true);
        setLoading(false);
        return;
      }
      await refreshProfile(cred.user.uid);
      toast.success(`Bem-vindo, ${profile.nickname}!`);
      navigate('/admin');
    } catch {
      toast.error('Email ou senha incorretos');
      setLoading(false);
    }
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
      navigate('/admin');
    } catch {
      toast.error('Erro ao salvar apelido');
      setSavingNick(false);
    }
  };

  const handleCancelNickname = async () => {
    try { await logoutUser(); } catch {}
    setNeedNickname(false); setPendingUser(null); setNickname(''); setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', background: mode === 'light' ? '#dfe3ec' : '#080b14', position: 'relative' }}>
      {/* Toggle tema */}
      <button onClick={toggleTheme} title="Alternar tema"
        style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 5, width: '40px', height: '40px', borderRadius: '10px', background: mode === 'light' ? '#eceef4' : '#0f1624', border: `1px solid ${mode === 'light' ? '#c3c9d8' : '#1a2540'}`, color: mode === 'light' ? '#d97706' : '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        {mode === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>
      {/* Left — branding */}
      <div className="hidden lg:flex" style={{
        width: '50%', flexDirection: 'column', justifyContent: 'space-between', padding: '48px',
        background: 'linear-gradient(145deg, #0d1526 0%, #080b14 60%, #0d0e1f 100%)',
        borderRight: '1px solid #1a2540', position: 'relative', overflow: 'hidden',
      }}>
        {/* Glow blobs */}
        <div style={{ position: 'absolute', top: '-80px', left: '-80px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-100px', right: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.1), transparent 70%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 1 }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(59,130,246,0.4)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '18px', letterSpacing: '-0.5px' }}>IBIUNET</span>
        </div>

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#3b82f6', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px' }}>
            Sistema de Gestão
          </div>
          <h2 style={{ fontSize: '48px', fontWeight: 900, lineHeight: 1.1, marginBottom: '20px', color: '#f1f5f9' }}>
            Controle de<br />
            <span style={{ background: 'linear-gradient(90deg, #60a5fa, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Produtividade
            </span>
          </h2>
          <p style={{ color: '#475569', fontSize: '16px', maxWidth: '360px', lineHeight: 1.6 }}>
            Gerencie as ordens de serviço diárias da sua equipe com eficiência e clareza total.
          </p>

          {/* Feature chips */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '40px', flexWrap: 'wrap' }}>
            {[
              { label: 'Relatórios PDF', color: '#3b82f6' },
              { label: 'Controle Diário', color: '#10b981' },
              { label: 'Equipe Unificada', color: '#a78bfa' },
            ].map(({ label, color }) => (
              <div key={label} style={{ padding: '8px 16px', borderRadius: '999px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color, fontSize: '13px', fontWeight: 600 }}>
                {label}
              </div>
            ))}
          </div>
        </motion.div>

        <p style={{ color: '#1e293b', fontSize: '12px', position: 'relative', zIndex: 1 }}>© 2026 IBIUNET</p>
      </div>

      {/* Right — form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', background: '#080b14' }}>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }} style={{ width: '100%', maxWidth: '420px' }}>

          {/* Mobile logo */}
          <div className="lg:hidden" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <span style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '16px' }}>IBIUNET</span>
          </div>

          <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#f1f5f9', marginBottom: '4px' }}>Entrar</h1>
          <p style={{ color: '#475569', fontSize: '14px', marginBottom: '36px' }}>Acesse o painel de controle</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required
                style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', background: '#0f1624', border: '1px solid #1a2540', color: '#e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#1a2540'} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
                  style={{ width: '100%', padding: '14px 48px 14px 16px', borderRadius: '12px', background: '#0f1624', border: '1px solid #1a2540', color: '#e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
                  onBlur={e => e.target.style.borderColor = '#1a2540'} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: '0', display: 'flex' }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '14px', borderRadius: '12px', background: loading ? '#1a2540' : 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: loading ? 'none' : '0 0 30px rgba(99,102,241,0.3)', transition: 'all 0.2s' }}>
              {loading ? <Spinner /> : 'Entrar na plataforma'}
            </button>
          </form>
        </motion.div>
      </div>

      {/* MODAL PRIMEIRO ACESSO — ESCOLHER APELIDO */}
      <AnimatePresence>
        {needNickname && (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 49 }} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
              <div style={{ width: '100%', maxWidth: '420px', background: '#0a0f1e', border: '1px solid #3b82f6', borderRadius: '20px', boxShadow: '0 0 50px rgba(59,130,246,0.25)', padding: 'clamp(22px, 5vw, 32px)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', boxShadow: '0 0 24px rgba(59,130,246,0.4)' }}>
                    <UserCircle size={30} color="#fff" />
                  </div>
                  <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '20px' }}>Primeiro acesso</div>
                  <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '6px', lineHeight: 1.5 }}>
                    Escolha um <strong style={{ color: '#60a5fa' }}>apelido</strong> para identificar seus lançamentos. Ele aparecerá nos relatórios que você criar.
                  </div>
                </div>

                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Seu apelido</label>
                <input value={nickname} onChange={e => setNickname(e.target.value)} maxLength={20} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveNickname(); }}
                  placeholder="Ex: André R."
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', background: '#0f1624', border: '1px solid #1a2540', color: '#e2e8f0', fontSize: '15px', outline: 'none', boxSizing: 'border-box', marginBottom: '20px' }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#1a2540'} />

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleCancelNickname} disabled={savingNick}
                    style={{ flex: 1, padding: '13px', borderRadius: '12px', background: 'transparent', border: '1px solid #1a2540', color: '#94a3b8', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={handleSaveNickname} disabled={savingNick}
                    style={{ flex: 2, padding: '13px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: savingNick ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: savingNick ? 0.7 : 1 }}>
                    {savingNick ? <Spinner /> : <><Check size={16}/>Confirmar e entrar</>}
                  </button>
                </div>
                <p style={{ color: '#475569', fontSize: '11px', textAlign: 'center', marginTop: '14px' }}>
                  Sem apelido não é possível continuar.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
