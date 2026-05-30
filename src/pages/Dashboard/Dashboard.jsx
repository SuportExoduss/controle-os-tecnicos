import { useState, useEffect } from 'react';
import { getAllReports } from '../../services/database/reportService';
import { Button } from '../../components/common/Button';
import { Spinner } from '../../components/common/Spinner';
import { toast } from 'react-hot-toast';
import { formatDate } from '../../utils/formatDate';
import { ChevronDown, ChevronUp, FileText, Download } from 'lucide-react';
import { generateIndividualPDF } from '../../services/reports/pdfService';

export const Dashboard = () => {
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchDate, setSearchDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTechnician, setSearchTechnician] = useState('');
  const [expandedTechnician, setExpandedTechnician] = useState(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const data = await getAllReports();
        const reportsArray = data.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setReports(reportsArray);
        filterReports(reportsArray, searchDate, searchTechnician);
      } catch (error) {
        toast.error('Erro ao carregar relatórios');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  const filterReports = (data, date, technician) => {
    let filtered = data;

    if (date) {
      filtered = filtered.filter((r) => r.date === date);
    }

    if (technician) {
      filtered = filtered.filter((r) =>
        r.technicianName.toLowerCase().includes(technician.toLowerCase())
      );
    }

    setFilteredReports(filtered.sort((a, b) => a.technicianName.localeCompare(b.technicianName)));
  };

  const handleSearch = (date, technician) => {
    setSearchDate(date);
    setSearchTechnician(technician);
    filterReports(reports, date, technician);
  };

  const summary = {
    totalTechnicians: new Set(filteredReports.map((r) => r.technicianName)).size,
    totalOrders: filteredReports.reduce((acc, r) => acc + r.totalOrders, 0),
    totalRescheduled: filteredReports.reduce((acc, r) => acc + r.rescheduledCount, 0),
    mostCommonService: getMostCommonService(filteredReports),
  };

  function getMostCommonService(data) {
    if (data.length === 0) return 'N/A';
    const services = {};
    data.forEach((r) => {
      r.serviceTypes?.forEach((service) => {
        services[service] = (services[service] || 0) + 1;
      });
    });
    return Object.keys(services).reduce((a, b) => (services[a] > services[b] ? a : b), 'N/A');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard de Relatórios</h1>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
              <input
                type="date"
                value={searchDate}
                onChange={(e) => handleSearch(e.target.value, searchTechnician)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Técnico</label>
              <input
                type="text"
                placeholder="Buscar técnico..."
                value={searchTechnician}
                onChange={(e) => handleSearch(searchDate, e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-gray-600 text-sm">Total Técnicos</p>
              <p className="text-2xl font-bold text-blue-600">{summary.totalTechnicians}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-gray-600 text-sm">Total O.S</p>
              <p className="text-2xl font-bold text-green-600">{summary.totalOrders}</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-gray-600 text-sm">Reagendamentos</p>
              <p className="text-2xl font-bold text-orange-600">{summary.totalRescheduled}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-gray-600 text-sm">Serviço Mais Comum</p>
              <p className="text-sm font-bold text-purple-600">{summary.mostCommonService}</p>
            </div>
          </div>
        </div>

        {/* Cards Expansíveis */}
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <div key={report.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
              <button
                onClick={() =>
                  setExpandedTechnician(
                    expandedTechnician === report.id ? null : report.id
                  )
                }
                className="w-full p-6 text-left hover:bg-gray-50 transition-colors flex justify-between items-center"
              >
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    {report.technicianName}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {report.totalOrders} O.S • {formatDate(report.date)}
                  </p>
                </div>
                {expandedTechnician === report.id ? (
                  <ChevronUp className="text-blue-600" />
                ) : (
                  <ChevronDown className="text-gray-400" />
                )}
              </button>

              {expandedTechnician === report.id && (
                <div className="border-t p-6 space-y-4 bg-gray-50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-600 text-sm">Tipo de Serviços</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {report.serviceTypes?.map((service, idx) => (
                          <span
                            key={idx}
                            className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full"
                          >
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Reagendamentos</p>
                      <p className="text-2xl font-bold text-orange-600 mt-2">
                        {report.rescheduledCount || 0}
                      </p>
                    </div>
                  </div>

                  {report.observations && (
                    <div>
                      <p className="text-gray-600 text-sm">Observações</p>
                      <p className="text-gray-800 mt-1">{report.observations}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={() => generateIndividualPDF(report.technicianName, report, `report-${report.id}`)}
                    >
                      <Download size={16} />
                      PDF
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <FileText size={16} />
                      Texto
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredReports.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">Nenhum relatório encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
};
