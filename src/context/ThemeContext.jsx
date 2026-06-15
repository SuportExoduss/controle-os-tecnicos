import { createContext, useState, useEffect } from 'react';
import { getPalette } from '../theme/palette';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    localStorage.setItem('theme', mode);
    document.documentElement.style.colorScheme = mode;
    document.body.style.backgroundColor = mode === 'light' ? '#dfe3ec' : '#0f1117';
    document.body.style.color = mode === 'light' ? '#1a2236' : '#e2e8f0';
  }, [mode]);

  const toggleTheme = () => setMode(m => (m === 'light' ? 'dark' : 'light'));
  const S = getPalette(mode);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, S }}>
      {children}
    </ThemeContext.Provider>
  );
};
