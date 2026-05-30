import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../../services/auth/authService';
import { saveDailyReport, getReportsByTechnician } from '../../services/database/reportService';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { toast } from 'react-hot-toast';
import { AuthContext } from '../../context/AuthContext';
import { getCurrentTime } from '../../utils/formatTime';
import { LogOut, Plus } from 'lucide-react';

export const Admin = () => {
  const [formData, setFormData] = useState({
    technician: '',
    totalOrders: '',
    rescheduled: false,
    rescheduledCount: '',
    observations: '',
    serviceTypes: [],
    date: new Date().toISOString().split('T')[0],
  });

  const [serviceWizardStep, setServiceWizardStep] = useState(0);
  const [tempServices, setTempServices] = useState([]);
  const [showWizard, setShowWizard] = useState(false);
  const [submissionTime, setSubmissionTime] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const SERVICE_TYPES = [
    'LOS',
    'INSTALAÇÃO',
    'INSTALAÇÃO WIBINET',
    'VISTORIA',
    'FONTE QUEIMADA',
    'TROCA DE EQUIPAMENTO',
    'IMPRODUTIVA',
  ];

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login');
      toast.success('Logout realizado com sucesso');
    } catch (error) {
      toast.error('Erro ao fazer logout');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleAddService = (service) => {
    setTempServices([...tempServices, service]);
    setServiceWizardStep(serviceWizardStep + 1);

    if (serviceWizardStep + 1 === parseInt(formData.totalOrders)) {
      setShowWizard(false);
      setFormData({ ...formData, serviceTypes: tempServices });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Verificar duplicidade
      const existing = await getReportsByTechnician(formData.technician, formData.date);
      if (existing.docs.length > 0) {
        const confirmOverwrite = window.confirm(
          'Já existe registro para este técnico nesta data. Deseja sobrescrever?'
        );
        if (!confirmOverwrite) {
          setLoading(false);
          return;
        }
      }

      const reportData = {
        ...formData,
        totalOrders: parseInt(formData.totalOrders),
        rescheduledCount: formData.rescheduled ? parseInt(formData.rescheduledCount || 0) : 0,
        serviceTypes: tempServices.length > 0 ? tempServices : formData.serviceTypes,
        submissionTime: getCurrentTime(),
      };

      await saveDailyReport(reportData);
      toast.success('Relatório salvo com sucesso!');
      
      // Resetar formulário
      setFormData({
        technician: '',
        totalOrders: '',
        rescheduled: false,
        rescheduledCount: '',
        observations: '',
        serviceTypes: [],
        date: new Date().toISOString().split('T')[0],
      });
      setTempServices([]);
      setServiceWizardStep(0);
      setShowWizard(false);
    } catch (error) {
      toast.error('Erro ao salvar relatório');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (parseInt(formData.totalOrders) > 0 && tempServices.length === 0) {
      setShowWizard(true);
      setServiceWizardStep(0);
    }
  }, [formData.totalOrders]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="flex justify-between items-center bg-white rounded-lg shadow-lg p-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Registro de O.S</h1>
            <p className="text-gray-600 text-sm mt-1">
              Data: {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </div>

      {/* Formulário Principal */}
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6 space-y-6">
        
        <Input
          label="Técnico"
          name="technician"
          value={formData.technician}
          onChange={handleInputChange}
          placeholder="Selecione o técnico"
          required
        />

        <Input
          label="Quantidade de O.S"
          type="number"
          name="totalOrders"
          value={formData.totalOrders}
          onChange={handleInputChange}
          min="1"
          required
        />

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="rescheduled"
            name="rescheduled"
            checked={formData.rescheduled}
            onChange={handleInputChange}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <label htmlFor="rescheduled" className="text-gray-700 font-medium">
            Houve reagendamento?
          </label>
        </div>

        {formData.rescheduled && (
          <Input
            label="Quantidade de Reagendamentos"
            type="number"
            name="rescheduledCount"
            value={formData.rescheduledCount}
            onChange={handleInputChange}
            min="0"
          />
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observações
          </label>
          <textarea
            name="observations"
            value={formData.observations}
            onChange={handleInputChange}
            placeholder="Digite as observações (opcional)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="4"
          />
        </div>

        {/* Exibir serviços selecionados */}
        {tempServices.length > 0 && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">Serviços Registrados:</h3>
            <div className="flex flex-wrap gap-2">
              {tempServices.map((service, idx) => (
                <span key={idx} className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
                  {service}
                </span>
              ))}
            </div>
          </div>
        )}

        <Button
          type="submit"
          variant="success"
          size="lg"
          className="w-full"
          disabled={loading || !formData.technician || !formData.totalOrders}
        >
          {loading ? 'Salvando...' : 'Salvar Relatório'}
        </Button>
      </form>

      {/* Modal Wizard */}
      {showWizard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              O.S {serviceWizardStep + 1} de {formData.totalOrders}
            </h2>
            
            <p className="text-gray-600 mb-6">Selecione o tipo de serviço:</p>
            
            <div className="grid grid-cols-1 gap-2 mb-6">
              {SERVICE_TYPES.map((service) => (
                <button
                  key={service}
                  type="button"
                  onClick={() => handleAddService(service)}
                  className="p-3 text-left bg-gray-100 hover:bg-blue-600 hover:text-white rounded-lg transition-colors font-medium"
                >
                  {service}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowWizard(false);
                  setTempServices([]);
                  setServiceWizardStep(0);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
