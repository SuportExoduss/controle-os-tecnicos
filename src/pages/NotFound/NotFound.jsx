import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';

export const NotFound = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <p className="text-xl text-blue-100 mb-8">Página não encontrada</p>
        <Link to="/dashboard">
          <Button variant="primary" size="lg">
            Voltar ao Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
};
