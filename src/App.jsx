import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './routes/ProtectedRoute';

// lazy() resiliente a deploy: quando o chunk pedido some (fizemos um deploy novo
// e o navegador ainda tem o index.html antigo), o import() falha e a página
// ficava PRETA. Aqui detectamos essa falha e recarregamos a página UMA vez para
// pegar o index/chunks novos. sessionStorage evita loop de reload infinito.
const lazyRetry = (factory) => lazy(() =>
  factory().catch((err) => {
    const msg = String(err && err.message || err);
    const isChunkErr = /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError|error loading/i.test(msg);
    const KEY = 'chunk_reload_at';
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (isChunkErr && (!last || Date.now() - last > 15000)) {
      sessionStorage.setItem(KEY, String(Date.now()));
      window.location.reload();
      return new Promise(() => {}); // segura o render até o reload assumir
    }
    throw err; // não é chunk velho (ou já recarregou há pouco) → deixa estourar
  })
);

// Rotas carregadas sob demanda (code-splitting) — reduz o bundle inicial
const Login            = lazyRetry(() => import('./pages/Login/Login').then(m => ({ default: m.Login })));
const Admin            = lazyRetry(() => import('./pages/Admin/Admin').then(m => ({ default: m.Admin })));
const Dashboard        = lazyRetry(() => import('./pages/Dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const NetworkAdmin     = lazyRetry(() => import('./pages/Redes/Admin/NetworkAdmin').then(m => ({ default: m.NetworkAdmin })));
const NetworkDashboard = lazyRetry(() => import('./pages/Redes/Dashboard/NetworkDashboard').then(m => ({ default: m.NetworkDashboard })));
const CameraAdmin      = lazyRetry(() => import('./pages/Cameras/Admin/CameraAdmin').then(m => ({ default: m.CameraAdmin })));
const CameraDashboard  = lazyRetry(() => import('./pages/Cameras/Dashboard/CameraDashboard').then(m => ({ default: m.CameraDashboard })));
const FrotaDashboard   = lazyRetry(() => import('./pages/Frota/FrotaDashboard').then(m => ({ default: m.FrotaDashboard })));
const FrotaAdmin       = lazyRetry(() => import('./pages/Frota/FrotaAdmin').then(m => ({ default: m.FrotaAdmin })));
const Home             = lazyRetry(() => import('./pages/Home/Home').then(m => ({ default: m.Home })));
const NotFound         = lazyRetry(() => import('./pages/NotFound/NotFound').then(m => ({ default: m.NotFound })));

const PageFallback = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080b14' }}>
    <div style={{ width: '40px', height: '40px', border: '3px solid #1a2540', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

function App() {
  return (
    <Router>
      <ThemeProvider>
      <AuthProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Fibra */}
            <Route path="/fibra/login" element={<Login />} />
            <Route
              path="/fibra/admin"
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route path="/fibra/dashboard" element={<Dashboard />} />

            {/* Redes */}
            <Route path="/redes/login" element={<Login />} />
            <Route
              path="/redes/admin"
              element={
                <ProtectedRoute>
                  <NetworkAdmin />
                </ProtectedRoute>
              }
            />
            <Route path="/redes/dashboard" element={<NetworkDashboard />} />

            {/* Câmeras (WIBICAM) */}
            <Route path="/cameras/login" element={<Login />} />
            <Route
              path="/cameras/admin"
              element={
                <ProtectedRoute>
                  <CameraAdmin />
                </ProtectedRoute>
              }
            />
            <Route path="/cameras/dashboard" element={<CameraDashboard />} />

            {/* Frota — checklist de veículos (mockup nas rotas reais por enquanto) */}
            <Route path="/frota" element={<Navigate to="/frota/dashboard" replace />} />
            <Route path="/frota/login" element={<Login />} />
            <Route path="/frota/dashboard" element={<FrotaDashboard />} />
            <Route
              path="/frota/admin"
              element={
                <ProtectedRoute>
                  <FrotaAdmin />
                </ProtectedRoute>
              }
            />

            {/* Raiz → tela de escolha de equipe (Home) */}
            <Route path="/" element={<Home />} />
            {/* Rotas legadas → fibra (padrão antigo) */}
            <Route path="/dashboard" element={<Navigate to="/fibra/dashboard" replace />} />
            <Route path="/admin" element={<Navigate to="/fibra/admin" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Toaster position="top-right" />
      </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
