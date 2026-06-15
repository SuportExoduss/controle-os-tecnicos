import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChangedListener, logoutUser } from '../services/auth/authService';
import { getUserProfile } from '../services/database/userProfileService';
import { toast } from 'react-hot-toast';

export const AuthContext = createContext();

const INACTIVITY_MS = 60 * 60 * 1000; // 1 hora sem uso
const CHECK_INTERVAL_MS = 30 * 1000;  // verifica a cada 30s

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

  // Auto-logout global por INATIVIDADE real (vale para Admin e Dashboard).
  // Em vez de um timeout que pode disparar mesmo em uso, guardamos o instante
  // da última atividade e checamos periodicamente se passou de 1h sem uso.
  useEffect(() => {
    if (!user) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    let lastActivity = Date.now();
    const markActivity = () => { lastActivity = Date.now(); };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'wheel', 'visibilitychange'];
    events.forEach(ev => window.addEventListener(ev, markActivity, { passive: true }));

    timerRef.current = setInterval(async () => {
      if (Date.now() - lastActivity < INACTIVITY_MS) return; // houve uso → não desloga
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
