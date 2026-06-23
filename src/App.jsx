import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './routes/ProtectedRoute';

// Rotas carregadas sob demanda (code-splitting) — reduz o bundle inicial
const Login            = lazy(() => import('./pages/Login/Login').then(m => ({ default: m.Login })));
const Admin            = lazy(() => import('./pages/Admin/Admin').then(m => ({ default: m.Admin })));
const Dashboard        = lazy(() => import('./pages/Dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const NetworkAdmin     = lazy(() => import('./pages/Redes/Admin/NetworkAdmin').then(m => ({ default: m.NetworkAdmin })));
const NetworkDashboard = lazy(() => import('./pages/Redes/Dashboard/NetworkDashboard').then(m => ({ default: m.NetworkDashboard })));
const CameraAdmin      = lazy(() => import('./pages/Cameras/Admin/CameraAdmin').then(m => ({ default: m.CameraAdmin })));
const CameraDashboard  = lazy(() => import('./pages/Cameras/Dashboard/CameraDashboard').then(m => ({ default: m.CameraDashboard })));
const Home             = lazy(() => import('./pages/Home/Home').then(m => ({ default: m.Home })));
const NotFound         = lazy(() => import('./pages/NotFound/NotFound').then(m => ({ default: m.NotFound })));

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
