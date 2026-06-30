import { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redireciona para o login do setor correto (mantém /redes em /redes)
  const loginDest = location.pathname.startsWith('/redes') ? '/redes/login'
    : location.pathname.startsWith('/cameras') ? '/cameras/login'
    : location.pathname.startsWith('/frota') ? '/frota/login'
    : '/fibra/login';

  return user ? children : <Navigate to={loginDest} replace />;
};
