// Nome próprio canônico (Title Case pt-BR): conectores de/da/do/das/dos/e ficam
// minúsculos (exceto no início). Fonte única usada ao cadastrar/renomear técnico
// em qualquer área — garante que nenhum lançamento novo volte a ficar MAIÚSCULO
// ou com grafia divergente. Espelha a regra usada na migração de identidade.
const LOWER = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const stripAcc = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '');

export const formatName = (raw) =>
  String(raw || '')
    .replace(/\(.*?\)/g, ' ')          // remove sufixos entre parênteses (ex.: "(Terceirizada)")
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && LOWER.has(stripAcc(w)))
      ? w
      : w.charAt(0).toLocaleUpperCase('pt-BR') + w.slice(1))
    .join(' ')
    .trim();
