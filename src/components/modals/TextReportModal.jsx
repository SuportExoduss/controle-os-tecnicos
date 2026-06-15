import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDateShort } from '../../utils/formatDate';

export const TextReportModal = ({ report, onClose }) => {
  const lines = [
    '================================',
    ' RELATÓRIO DE O.S — IBIUNET',
    '================================',
    '',
    `Técnico:        ${report.technicianName || '—'}`,
    `Data:           ${formatDateShort(report.date)}`,
    `Horário:        ${report.submissionTime || '—'}`,
    '',
    `Total de O.S:   ${report.totalOrders}`,
    `Reagendamentos: ${report.rescheduledCount || 0}`,
    '',
    'TIPOS DE SERVIÇO:',
    ...(report.serviceTypes || []).map((s, i) => `  ${i + 1}. ${s}`),
    '',
  ];

  if (report.observations) {
    lines.push('OBSERVAÇÕES:');
    lines.push(`  ${report.observations}`);
    lines.push('');
  }

  lines.push('================================');
  const text = lines.join('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copiado!'));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-800">Relatório em Texto</h2>
              <p className="text-xs text-gray-400">{report.technicianName}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-blue-600 text-sm font-medium px-3 py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Copy size={13} />
                Copiar
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="p-6">
            <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap bg-gray-50 p-4 rounded-xl border border-gray-200 leading-relaxed max-h-96 overflow-y-auto">
              {text}
            </pre>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
