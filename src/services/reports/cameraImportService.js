// Importação da aba "Lancamentos Equipe Cameras" (WIBICAM).
// xlsx é carregado sob demanda (dynamic import) para não pesar o bundle inicial.

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
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return excelDateToISO(val);
  const s = String(val).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d, m, y] = s.split('/'); return `${y}-${m}-${d}`; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
};

const ACCENTS = { 'á':'a','à':'a','ã':'a','â':'a','ä':'a','é':'e','ê':'e','è':'e','ë':'e','í':'i','ì':'i','î':'i','ï':'i','ó':'o','ô':'o','õ':'o','ò':'o','ö':'o','ú':'u','ù':'u','û':'u','ü':'u','ç':'c','ñ':'n' };
const norm = (s) => String(s == null ? '' : s).trim().toLowerCase()
  .replace(/[áàãâäéêèëíìîïóôõòöúùûüçñ]/g, (c) => ACCENTS[c] || c);

const numOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

// Aliases dos campos fixos (normalizados)
const FIELD_ALIASES = {
  date:       ['data'],
  technician: ['tecnico', 'nome_tecnico', 'nome do tecnico', 'nome tecnico', 'colaborador', 'nome'],
  reagend:    ['reagendamentos', 'reagendamento', 'reagend'],
  km:         ['km rodado', 'km'],
  pontosIn:   ['pontos instalados'],
  pontosCanc: ['pontos cancelados'],
  obs:        ['observacoes', 'obs', 'observacao'],
};

// Tipos de serviço -> nomes possíveis de coluna (chave = nome EXATO usado no app, com acento)
const TYPE_ALIASES = {
  'INSTALAÇÃO WI-BICAM':              ['instalacao wi-bicam', 'instalacao wibicam', 'instalacao wi-binet'],
  'REPARO':                          ['reparo'],
  'TROCA ROTEADOR/VISTORIA/REPARO TV':['troca de roteador/vistoria fibra/reparo tv', 'troca de roteador/vistoria/reparo tv'],
  'MUDANÇA DE ENDEREÇO':             ['mudanca de endereco c/wi-bicam', 'mudanca de endereco'],
  'MUDANÇA DE PONTO':                ['mudanca de ponto c/wi-bicam', 'mudanca de ponto'],
  'VISTORIA TÉCNICA':                ['vistoria tecnica wi-bicam', 'vistoria tecnica'],
  'RETIRADA':                        ['retirada'],
};

export const parseCameraExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });

        const sheetName = wb.SheetNames.find(n =>
          /camera|câmera|cameras/i.test(n)
        ) || wb.SheetNames.find(n => /equipe|lancamento/i.test(n)) || wb.SheetNames[0];

        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rows.length < 2) { reject(new Error('Planilha vazia')); return; }

        const headers = rows[0].map(norm);
        const findCol = (aliases) => {
          for (let i = 0; i < headers.length; i++) if (aliases.indexOf(headers[i]) >= 0) return i;
          return -1;
        };

        const colDate      = findCol(FIELD_ALIASES.date);
        const colTech      = findCol(FIELD_ALIASES.technician);
        const colReagend   = findCol(FIELD_ALIASES.reagend);
        const colKm        = findCol(FIELD_ALIASES.km);
        const colPontosIn  = findCol(FIELD_ALIASES.pontosIn);
        const colPontosCanc= findCol(FIELD_ALIASES.pontosCanc);
        const colObs       = findCol(FIELD_ALIASES.obs);
        const typeCols = {};
        Object.keys(TYPE_ALIASES).forEach(t => { typeCols[t] = findCol(TYPE_ALIASES[t]); });

        const records = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every(v => !v || v === 0 || v === '')) continue;

          const technicianName = String((colTech >= 0 ? row[colTech] : '') || '').trim();
          if (!technicianName) continue;

          const date = parseDate(colDate >= 0 ? row[colDate] : row[0]);
          if (!date) continue;

          const rescheduledCount = parseInt(colReagend >= 0 ? row[colReagend] : 0) || 0;
          const kmRodado         = colKm >= 0 ? numOrNull(row[colKm]) : null;
          const pontosInstalados = colPontosIn >= 0 ? numOrNull(row[colPontosIn]) : null;
          const pontosCancelados = colPontosCanc >= 0 ? numOrNull(row[colPontosCanc]) : null;
          const observations = String((colObs >= 0 ? row[colObs] : '') || '').trim();

          const serviceTypes = [];
          Object.keys(typeCols).forEach(t => {
            const ci = typeCols[t];
            if (ci < 0) return;
            const count = parseInt(row[ci]) || 0;
            for (let k = 0; k < count; k++) serviceTypes.push(t);
          });

          records.push({
            technicianName,
            date,
            totalOrders: serviceTypes.length,
            rescheduledCount,
            rescheduled: rescheduledCount > 0,
            kmInicial: null,
            kmFinal: null,
            kmRodado,
            pontosInstalados,
            pontosCancelados,
            serviceTypes,
            observations,
            submissionTime: '00:00:00',
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
