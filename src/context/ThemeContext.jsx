import { createContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getPalette, getBrandMeta } from '../theme/palette';

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext();

// Deriva a área (identidade visual) a partir da URL
const brandFromPath = (pathname) => {
  if (pathname.startsWith('/redes')) return 'redes';
  if (pathname.startsWith('/cameras')) return 'cameras';
  if (pathname.startsWith('/frota')) return 'frota';
  return 'fibra';
};

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => localStorage.getItem('theme') || 'dark');
  const { pathname } = useLocation();
  const brand = brandFromPath(pathname);

  const S = getPalette(mode, brand);

  useEffect(() => {
    localStorage.setItem('theme', mode);
    document.documentElement.style.colorScheme = mode;
    document.body.style.backgroundColor = S.bg;
    document.body.style.color = S.text;
  }, [mode, brand, S.bg, S.text]);

  const toggleTheme = () => setMode(m => (m === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, S, brand, brandMeta: getBrandMeta(brand) }}>
      {children}
    </ThemeContext.Provider>
  );
};
