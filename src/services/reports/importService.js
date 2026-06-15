import * as XLSX from 'xlsx';

// Converte serial date do Excel para YYYY-MM-DD
const excelDateToISO = (serial) => {
  if (!serial || isNaN(serial)) return null;
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  const d = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Tenta converter data em vários formatos
const parseDate = (val) => {
  if (!val) return null;
  if (typeof val === 'number') return excelDateToISO(val);
  // dd/mm/yyyy
  const s = String(val).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return `${y}-${m}-${d}`;
  }
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
};

// Mapeamento: coluna do Excel → tipo no site
const COL_TO_TYPE = {
  'Instalacão Fibra':     'INSTALAÇÃO FIBRA',
  'Instalação Fibra':     'INSTALAÇÃO FIBRA',
  'Manutenção Fibra':     'MANUTENÇÃO FIBRA',
  'Manutencão Fibra':     'MANUTENÇÃO FIBRA',
  'Mudança de endereço':  'MUDANÇA DE ENDEREÇO',
  'Mudanca de endereco':  'MUDANÇA DE ENDEREÇO',
  'Instalação Wi-biNET':  'INSTALAÇÃO WI-BINET',
  'Instalacão Wi-biNET':  'INSTALAÇÃO WI-BINET',
  'Reparo Wi-biNET':      'REPARO WI-BINET',
  'Instalação TV':        'INSTALAÇÃO TV',
  'Reparo TV':            'REPARO TV',
  'OS Ampliacao':         'OS AMPLIAÇÃO',
  'OS Ampliação':         'OS AMPLIAÇÃO',
};

export const parseExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });

        // Busca a aba de Fibra
        const sheetName = wb.SheetNames.find(n =>
          n.toLowerCase().includes('fibra') || n.toLowerCase().includes('equipe')
        ) || wb.SheetNames[0];

        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (rows.length < 2) { reject(new Error('Planilha vazia')); return; }

        const header = rows[0].map(h => String(h).trim());
        const records = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every(v => !v || v === 0 || v === '')) continue;

          const get = (colName) => {
            const idx = header.indexOf(colName);
            return idx >= 0 ? row[idx] : '';
          };

          // Nome do técnico
          const technicianName = String(get('Nome_Tecnico') || get('Nome Tecnico') || '').trim();
          if (!technicianName) continue;

          // Data
          const dateRaw = get('Data') || row[0];
          const date = parseDate(dateRaw);
          if (!date) continue;

          // Reagendamentos e total
          const rescheduledCount = parseInt(get('Reagendamentos') || 0) || 0;
          const totalOrders = parseInt(get('Total OS') || get('Total_OS') || 0) || 0;
          const observations = String(get('Observacoes') || get('Observações') || '').trim();

          // Montar array serviceTypes a partir das contagens
          const serviceTypes = [];
          for (const [colLabel, typeName] of Object.entries(COL_TO_TYPE)) {
            const count = parseInt(get(colLabel) || 0) || 0;
            for (let k = 0; k < count; k++) serviceTypes.push(typeName);
          }

          records.push({
            technicianName,
            date,
            totalOrders: totalOrders || serviceTypes.length,
            rescheduledCount,
            rescheduled: rescheduledCount > 0,
            serviceTypes,
            observations,
            submissionTime: '00:00:00',
            createdAt: new Date().toISOString(),
            importedFromExcel: true,
          });
        }

        resolve({ records, sheetName, totalRows: rows.length - 1 });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
};
