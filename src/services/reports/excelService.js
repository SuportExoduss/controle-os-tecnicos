// xlsx é carregado sob demanda (dynamic import) para não pesar o bundle inicial.

// Colunas — agora com TODOS os 15 tipos de serviço (mesma ordem do sistema)
const EXCEL_COLS = [
  { label: 'Data',                   key: 'INSTALAÇÃO FIBRA',    isDate: true },
  { label: 'Nome_Tecnico',           key: 'technicianName',      isName: true },
  { label: 'Instalação Fibra',       key: 'INSTALAÇÃO FIBRA'      },
  { label: 'Manutenção Fibra',       key: 'MANUTENÇÃO FIBRA'      },
  { label: 'Mudança de endereço',    key: 'MUDANÇA DE ENDEREÇO'   },
  { label: 'Mudança de ponto',       key: 'MUDANÇA DE PONTO'      },
  { label: 'Instalação Wi-biNET',    key: 'INSTALAÇÃO WI-BINET'   },
  { label: 'Reparo Wi-biNET',        key: 'REPARO WI-BINET'       },
  { label: 'Instalação TV',          key: 'INSTALAÇÃO TV'         },
  { label: 'Reparo TV',              key: 'REPARO TV'             },
  { label: 'OS Ampliacao',           key: 'OS AMPLIAÇÃO'          },
  { label: 'Vistoria',               key: 'VISTORIA'              },
  { label: 'Fonte Queimada',         key: 'FONTE QUEIMADA'        },
  { label: 'Troca de Equipamento',   key: 'TROCA DE EQUIPAMENTO'  },
  { label: 'Sinal Alto',             key: 'SINAL ALTO'            },
  { label: 'Reincidência',           key: 'REINCIDÊNCIA'          },
  { label: 'Improdutiva',            key: 'IMPRODUTIVA'           },
  { label: 'Reagendamentos',         key: 'reagendamentos'        },
  { label: 'Total OS',               key: 'totalOrders',          isTotal: true },
  { label: 'Observacoes',            key: 'observations',         isObs: true   },
];

// Conta quantas vezes um tipo aparece no array serviceTypes
const countType = (serviceTypes = [], typeName) =>
  serviceTypes.filter(s => s === typeName).length;

// Cede a thread para o navegador repintar o overlay de progresso.
const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0));

export const generateExcel = async (reports, filename = 'relatorio-os', onProgress) => {
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

  // Larguras das colunas (derivadas das colunas, sempre em sincronia)
  ws['!cols'] = EXCEL_COLS.map(col => {
    if (col.isDate) return { wch: 12 };
    if (col.isName) return { wch: 32 };
    if (col.isObs) return { wch: 30 };
    if (col.isTotal) return { wch: 10 };
    if (col.key === 'reagendamentos') return { wch: 14 };
    return { wch: 18 };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Lancamentos Equipe Fibra');

  XLSX.writeFile(wb, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`);
  onProgress?.(100);
};
