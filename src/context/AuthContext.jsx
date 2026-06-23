import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChangedListener, logoutUser } from '../services/auth/authService';
import { getUserProfile } from '../services/database/userProfileService';
import { toast } from 'react-hot-toast';

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext();

const INACTIVITY_MS = 60 * 60 * 1000; // 1 hora sem uso
const CHECK_INTERVAL_MS = 30 * 1000;  // verifica a cada 30s
const ACTIVITY_KEY = 'ibiunet_last_activity'; // compartilha atividade entre abas

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // { nickname, email }
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const refreshProfile = useCallback(async (uid) => {
    if (!uid) { setProfile(null); return null; }
    try {
      const p = await getUserProfile(uid);
      setProfile(p);
      return p;
    } catch { setProfile(null); return null; }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) await refreshProfile(currentUser.uid);
      else setProfile(null);
      setLoading(false);
    });
    return unsubscribe;
  }, [refreshProfile]);

  // Auto-logout por INATIVIDADE real, COMPARTILHADA ENTRE ABAS.
  // A última atividade é guardada num timestamp no localStorage (chave própria,
  // não interfere no Firebase). Qualquer aba em uso atualiza esse timestamp, então
  // só desloga quando NENHUMA aba foi usada por 1h. Cada aba checa a cada 30s.
  useEffect(() => {
    if (!user) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    let lastWrite = 0;
    const markActivity = () => {
      const now = Date.now();
      if (now - lastWrite > 10000) { // grava no máx. 1x a cada 10s
        lastWrite = now;
        try { localStorage.setItem(ACTIVITY_KEY, String(now)); } catch { /* ignore */ }
      }
    };
    // marca atividade ao montar (abrir/carregar a aba conta como uso)
    try { localStorage.setItem(ACTIVITY_KEY, String(Date.now())); } catch { /* ignore */ }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];
    events.forEach(ev => window.addEventListener(ev, markActivity, { passive: true }));

    timerRef.current = setInterval(async () => {
      const shared = Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
      if (Date.now() - shared < INACTIVITY_MS) return; // alguma aba teve uso → não desloga
      clearInterval(timerRef.current);
      try { await logoutUser(); } catch { /* ignore */ }
      toast.error('Sessão encerrada após 1 hora sem uso. Faça login novamente.');
    }, CHECK_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      events.forEach(ev => window.removeEventListener(ev, markActivity));
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
