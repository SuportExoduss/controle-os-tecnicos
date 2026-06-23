// Excel da equipe de câmeras (WIBICAM). xlsx é carregado sob demanda.

// Colunas — espelham a aba "Lancamentos Equipe Cameras"
const EXCEL_COLS = [
  { label: 'Data',                                    key: 'date',                isDate: true },
  { label: 'Tecnico',                                 key: 'technicianName',      isName: true },
  { label: 'instalação Wi-bicam',                     key: 'INSTALAÇÃO WI-BICAM'   },
  { label: 'Reparo',                                  key: 'REPARO'                },
  { label: 'Troca de Roteador/Vistoria Fibra/Reparo TV', key: 'TROCA ROTEADOR/VISTORIA/REPARO TV' },
  { label: 'Mudança de endereço c/wi-bicam',          key: 'MUDANÇA DE ENDEREÇO'    },
  { label: 'Mudança de ponto C/Wi-bicam',             key: 'MUDANÇA DE PONTO'       },
  { label: 'Vistoria técnica wi-bicam',               key: 'VISTORIA TÉCNICA'       },
  { label: 'Retirada',                                key: 'RETIRADA'               },
  { label: 'KM Rodado',                               key: 'kmRodado',             isKm: true },
  { label: 'Reagendamentos',                          key: 'reagendamentos'        },
  { label: 'Pontos Instalados',                       key: 'pontosInstalados',     isNum: true },
  { label: 'Pontos Cancelados',                       key: 'pontosCancelados',     isNum: true },
  { label: 'Total OS',                                key: 'totalOrders',          isTotal: true },
  { label: 'Observações',                             key: 'observations',         isObs: true },
];

// Conta quantas vezes um tipo aparece no array serviceTypes
const countType = (serviceTypes = [], typeName) =>
  serviceTypes.filter(s => s === typeName).length;

// Cede a thread para o navegador repintar o overlay de progresso.
const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0));

export const generateCameraExcel = async (reports, filename = 'relatorio-wibicam', onProgress) => {
  const XLSX = await import('xlsx');
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
      if (col.isKm) return r.kmRodado != null ? r.kmRodado : '';
      if (col.isNum) return r[col.key] != null ? r[col.key] : '';
      if (col.key === 'reagendamentos') return r.rescheduledCount || 0;
      return countType(r.serviceTypes, col.key);
    }));
    if (i % 20 === 0 || i === total - 1) {
      onProgress?.(Math.round(((i + 1) / total) * 90) + 5);
      await yieldToBrowser();
    }
  }

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

  ws['!cols'] = EXCEL_COLS.map(col => {
    if (col.isDate) return { wch: 12 };
    if (col.isName) return { wch: 28 };
    if (col.isObs) return { wch: 30 };
    if (col.isTotal) return { wch: 10 };
    if (col.key === 'reagendamentos') return { wch: 14 };
    return { wch: 18 };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Lancamentos Equipe Cameras');

  XLSX.writeFile(wb, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`);
  onProgress?.(100);
};
