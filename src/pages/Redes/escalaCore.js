// ─────────────────────────────────────────────────────────────────────────
// ESCALA DA EQUIPE DE REDES — rotação determinística (sem armazenar por mês).
//   • 3 times: Azul (12x36, dias ÍMPARES), Vermelho (12x36, dias PARES),
//     Amarelo (5x2, seg–sex).
//   • Cada colaborador pertence a 1 time e é Motorista ou Passageiro.
//     Passageiro = não dirige → não é obrigado a fazer o CHECKLIST no seu dia.
//   • Dias fora da escala do colaborador = FOLGA automática.
//   O objetivo é evitar "checklist não feito" errado na Frota.
// ─────────────────────────────────────────────────────────────────────────

export const ESCALA_TEAMS = {
  azul:     { key: 'azul',     label: 'Time Azul',     color: '#3b82f6', tipo: '12x36', dias: 'Dias ímpares' },
  vermelho: { key: 'vermelho', label: 'Time Vermelho', color: '#ef4444', tipo: '12x36', dias: 'Dias pares' },
  amarelo:  { key: 'amarelo',  label: 'Time Amarelo',  color: '#eab308', tipo: '5x2',   dias: 'Seg a sex' },
};
export const ESCALA_TEAM_KEYS = ['azul', 'vermelho', 'amarelo'];

// Um time trabalha nesse dia? (year, monthIndex 0-11, day 1-31)
export const teamWorksOnDay = (teamKey, year, monthIndex, day) => {
  if (teamKey === 'azul')     return day % 2 === 1;               // ímpares
  if (teamKey === 'vermelho') return day % 2 === 0;               // pares
  if (teamKey === 'amarelo') {                                    // 5x2: seg–sex
    const dow = new Date(year, monthIndex, day).getDay();         // 0=dom … 6=sáb
    return dow >= 1 && dow <= 5;
  }
  return false;
};

// Times que trabalham nesse dia (para colorir a célula do calendário).
export const teamsOnDay = (year, monthIndex, day) =>
  ESCALA_TEAM_KEYS.filter((k) => teamWorksOnDay(k, year, monthIndex, day));

// Um colaborador trabalha nesse dia? (depende do time dele)
export const collabWorksOnDay = (collab, year, monthIndex, day) =>
  !!collab?.team && teamWorksOnDay(collab.team, year, monthIndex, day);

// Times que trabalham no dia CONSIDERANDO overrides manuais.
// overrides[dia] (lista de times) substitui a regra; [] = ninguém.
export const resolvedTeamsOnDay = (year, monthIndex, day, overrides) => {
  const ov = overrides && overrides[day];
  if (Array.isArray(ov)) return ov;
  return teamsOnDay(year, monthIndex, day);
};

// Um colaborador trabalha no dia, considerando overrides.
export const collabWorksResolved = (collab, year, monthIndex, day, overrides) =>
  !!collab?.team && resolvedTeamsOnDay(year, monthIndex, day, overrides).includes(collab.team);

// Nº de dias do mês
export const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();
