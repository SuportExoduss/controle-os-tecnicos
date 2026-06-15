import * as XLSX from 'xlsx';

// Colunas exatamente como na planilha "Lancamentos Equipe Fibra"
const EXCEL_COLS = [
  { label: 'Data',                   key: 'INSTALAÇÃO FIBRA',    isDate: true },
  { label: 'Nome_Tecnico',           key: 'technicianName',      isName: true },
  { label: 'Instalação Fibra',       key: 'INSTALAÇÃO FIBRA'    },
  { label: 'Manutenção Fibra',       key: 'MANUTENÇÃO FIBRA'    },
  { label: 'Mudança de endereço',    key: 'MUDANÇA DE ENDEREÇO' },
  { label: 'Instalação Wi-biNET',    key: 'INSTALAÇÃO WI-BINET' },
  { label: 'Reparo Wi-biNET',        key: 'REPARO WI-BINET'     },
  { label: 'Instalação TV',          key: 'INSTALAÇÃO TV'       },
  { label: 'Reparo TV',              key: 'REPARO TV'           },
  { label: 'OS Ampliacao',           key: 'OS AMPLIAÇÃO'        },
  { label: 'Reagendamentos',         key: 'reagendamentos'       },
  { label: 'Total OS',               key: 'totalOrders',         isTotal: true },
  { label: 'Observacoes',            key: 'observations',        isObs: true   },
];

// Conta quantas vezes um tipo aparece no array serviceTypes
const countType = (serviceTypes = [], typeName) =>
  serviceTypes.filter(s => s === typeName).length;

// Cede a thread para o navegador repintar o overlay de progresso.
const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0));

export const generateExcel = async (reports, filename = 'relatorio-os', onProgress) => {
  const header = EXCEL_COLS.map(c => c.label);

  onProgress?.(5);
  await yieldToBrowser();

  const total = reports.length;
  const rows = [];
  for (let i = 0; i < total; i++) {
    const r = reports[i];
    rows.push(EXCEL_COLS.map(col => {
      if (col.isDate) return r.date || '';
      if (col.isName) return r.technicianName || '';
      if (col.isTotal) return r.totalOrders || 0;
      if (col.isObs) return r.observations || '';
      if (col.key === 'reagendamentos') return r.rescheduledCount || 0;
      return countType(r.serviceTypes, col.key);
    }));
    // Atualiza progresso a cada ~20 registros (ou no último) para não travar.
    if (i % 20 === 0 || i === total - 1) {
      onProgress?.(Math.round(((i + 1) / total) * 90) + 5);
      await yieldToBrowser();
    }
  }

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

  // Larguras das colunas
  ws['!cols'] = [
    { wch: 12 }, { wch: 32 }, { wch: 18 }, { wch: 18 },
    { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 16 },
    { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Lancamentos Equipe Fibra');

  XLSX.writeFile(wb, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`);
  onProgress?.(100);
};
