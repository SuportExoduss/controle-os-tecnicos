import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { Login } from './pages/Login/Login';
import { Admin } from './pages/Admin/Admin';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { NotFound } from './pages/NotFound/NotFound';

function App() {
  return (
    <Router>
      <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster position="top-right" />
      </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
