import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronDown, CalendarDays, UserCheck, Pencil, X, RotateCcw, Check } from 'lucide-react';
import { ESCALA_TEAMS, ESCALA_TEAM_KEYS, resolvedTeamsOnDay, collabWorksResolved, daysInMonth } from '../escalaCore';
import { getEscalaMonth, setEscalaDayOverride } from '../../../services/database/escalaService';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Calendário COMPACTO da escala de Redes (lateral). Só admin.
//   collaborators: [{ id, name, team, motorista, passageiro }]
//   orders: network_orders (pontinhos de quem trabalhou fora da escala)
//   onAplicarFrota(year, monthIndex, overrides): grava folgas/passageiros no índice da Frota.
export const EscalaMes = ({ S, collaborators = [], orders = [], onAplicarFrota, applying, collapsed = false, onToggleCollapse }) => {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth());
  const [overrides, setOverrides] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [dayModal, setDayModal] = useState(null); // dia selecionado (popup)

  const nDias = daysInMonth(ano, mes);
  const firstDow = new Date(ano, mes, 1).getDay();
  const comTime = collaborators.filter((c) => c.team);
  const semTime = collaborators.filter((c) => !c.team);

  // Carrega overrides do mês visível
  useEffect(() => {
    let alive = true;
    getEscalaMonth(ano, mes).then((ov) => { if (alive) setOverrides(ov || {}); }).catch(() => {});
    return () => { alive = false; };
  }, [ano, mes]);

  // "Trabalhou" naquele dia (por técnico) — a partir das O.S reais (não ausências).
  const workedByDay = useMemo(() => {
    const map = {};
    (orders || []).forEach((o) => {
      if (o.tipo === 'ausencia' || String(o.idOs).trim() === '00000') return;
      [o.data, o.dataAbertura, o.dataFechamento].forEach((d) => {
        if (!d || !d.startsWith(`${ano}-${String(mes + 1).padStart(2, '0')}`)) return;
        (map[d] = map[d] || new Set()).add(o.tecnico);
      });
    });
    return map;
  }, [orders, ano, mes]);

  const prevMonth = () => { const d = new Date(ano, mes - 1, 1); setAno(d.getFullYear()); setMes(d.getMonth()); };
  const nextMonth = () => { const d = new Date(ano, mes + 1, 1); setAno(d.getFullYear()); setMes(d.getMonth()); };

  // Trabalhou fora da escala nesse dia? → pontinho da cor do time
  const trabalhouNaFolga = (day) => {
    const nomes = workedByDay[iso(ano, mes, day)];
    if (!nomes) return [];
    return comTime.filter((c) => nomes.has(c.name) && !collabWorksResolved(c, ano, mes, day, overrides)).map((c) => c.team);
  };

  const isRule = (day) => !Array.isArray(overrides[day]);

  // Salva override de um dia (lista de times) ou volta à regra (null)
  const saveDay = async (day, teamKeys) => {
    try {
      await setEscalaDayOverride(ano, mes, day, teamKeys);
      setOverrides((prev) => {
        const next = { ...prev };
        if (teamKeys === null) delete next[day]; else next[day] = teamKeys;
        return next;
      });
    } catch { /* best-effort */ }
  };

  const toggleTeamOnDay = (day, teamKey) => {
    const cur = resolvedTeamsOnDay(ano, mes, day, overrides);
    const next = cur.includes(teamKey) ? cur.filter((k) => k !== teamKey) : [...cur, teamKey];
    saveDay(day, next);
  };

  const cell = { background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px' };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ ...cell, padding: '16px' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: collapsed ? 0 : '10px' }}>
        <div onClick={onToggleCollapse} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, cursor: onToggleCollapse ? 'pointer' : 'default', flex: 1 }}>
          <CalendarDays size={15} color={S.blue} />
          <span style={{ color: S.text, fontWeight: 800, fontSize: '13px' }}>Escala do Mês</span>
        </div>
        {!collapsed && (
          <button onClick={() => setEditMode((v) => !v)} title={editMode ? 'Sair da edição' : 'Alterar a escala'}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 8px', borderRadius: '8px', background: editMode ? '#7c3aed22' : 'transparent', border: `1px solid ${editMode ? '#7c3aed' : S.border}`, color: editMode ? '#a78bfa' : S.muted2, fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
            <Pencil size={13} />{editMode ? 'Editando' : 'Editar'}
          </button>
        )}
        {onToggleCollapse && (
          <button onClick={onToggleCollapse} title={collapsed ? 'Expandir' : 'Recolher'}
            style={{ display: 'flex', background: 'none', border: 'none', color: S.muted2, cursor: 'pointer', padding: '2px' }}>
            <ChevronDown size={16} style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        )}
      </div>

      {!collapsed && (<>

      {/* Navegação de mês */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <button onClick={prevMonth} style={{ display: 'flex', padding: '5px', borderRadius: '7px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, cursor: 'pointer' }}><ChevronLeft size={15} /></button>
        <span style={{ color: S.text, fontWeight: 700, fontSize: '12px', textTransform: 'capitalize' }}>{MESES[mes]} {ano}</span>
        <button onClick={nextMonth} style={{ display: 'flex', padding: '5px', borderRadius: '7px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, cursor: 'pointer' }}><ChevronRight size={15} /></button>
      </div>

      {/* Legenda compacta */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {ESCALA_TEAM_KEYS.map((k) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', color: S.muted2 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: ESCALA_TEAMS[k].color, boxShadow: `0 0 5px ${ESCALA_TEAMS[k].color}` }} />
            {ESCALA_TEAMS[k].label.replace('Time ', '')}
          </div>
        ))}
      </div>

      {editMode && (
        <div style={{ fontSize: '10.5px', color: '#a78bfa', marginBottom: '8px' }}>Clique num dia para ajustar quais times trabalham.</div>
      )}

      {/* Dias da semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '3px' }}>
        {WD.map((w, i) => <div key={i} style={{ textAlign: 'center', fontSize: '9px', fontWeight: 700, color: S.muted }}>{w}</div>)}
      </div>

      {/* Grade compacta */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
        {Array.from({ length: firstDow }).map((_, i) => <div key={`b${i}`} />)}
        {Array.from({ length: nDias }, (_, i) => i + 1).map((day) => {
          const times = resolvedTeamsOnDay(ano, mes, day, overrides);
          const doze = times.includes('azul') ? 'azul' : times.includes('vermelho') ? 'vermelho' : null;
          const corBase = doze ? ESCALA_TEAMS[doze].color : S.muted;
          const amarelo = times.includes('amarelo');
          const folgaTrab = trabalhouNaFolga(day);
          const isToday = ano === now.getFullYear() && mes === now.getMonth() && day === now.getDate();
          const edited = !isRule(day);
          return (
            <button key={day} onClick={() => setDayModal(day)}
              title={`${day}/${mes + 1} — ${times.map((t) => ESCALA_TEAMS[t].label).join(', ') || 'sem escala'}`}
              style={{ position: 'relative', minHeight: '34px', borderRadius: '8px', background: doze ? corBase + '22' : S.input, border: `1px solid ${isToday ? S.blue : edited ? '#a78bfa' : (doze ? corBase + '55' : S.border)}`, padding: '3px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', cursor: 'pointer' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: isToday ? S.blue : S.text, lineHeight: 1 }}>{String(day).padStart(2, '0')}</span>
              <span style={{ display: 'flex', gap: '2px', alignItems: 'center', minHeight: '8px' }}>
                {doze && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: corBase }} />}
                {amarelo && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: ESCALA_TEAMS.amarelo.color }} />}
                {folgaTrab.map((tk, i) => <span key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: ESCALA_TEAMS[tk].color, border: `1.5px solid ${S.text}` }} />)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Rodapé */}
      <div style={{ marginTop: '12px' }}>
        {semTime.length > 0 && (
          <div style={{ fontSize: '10.5px', color: '#fbbf24', marginBottom: '8px' }}>{semTime.length} sem time — defina no editar do colaborador.</div>
        )}
        {onAplicarFrota && (
          <button onClick={() => onAplicarFrota(ano, mes, overrides)} disabled={applying}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', borderRadius: '10px', background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: applying ? 'wait' : 'pointer', opacity: applying ? 0.7 : 1 }}>
            <UserCheck size={13} />{applying ? 'Aplicando…' : 'Aplicar folgas à Frota'}
          </button>
        )}
      </div>
      </>)}

      {/* ── POPUP DO DIA ── */}
      <AnimatePresence>
        {dayModal && (() => {
          const day = dayModal;
          const times = resolvedTeamsOnDay(ano, mes, day, overrides);
          const nomesTrab = workedByDay[iso(ano, mes, day)] || new Set();
          return (
            <>
              <div onClick={() => setDayModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 59 }} />
              <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
                style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '16px' }}>
                <div style={{ width: '100%', maxWidth: '420px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '20px', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ padding: '18px 22px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: S.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CalendarDays size={18} color={S.blue} />
                      </div>
                      <div>
                        <div style={{ color: S.text, fontWeight: 800, fontSize: '16px' }}>{String(day).padStart(2, '0')} de {MESES[mes]}</div>
                        <div style={{ color: S.muted, fontSize: '12px' }}>{editMode ? 'Editando a escala do dia' : (times.length ? 'Times de plantão' : 'Sem escala — todos de folga')}</div>
                      </div>
                    </div>
                    <button onClick={() => setDayModal(null)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}><X size={18} /></button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
                    {/* Modo edição: toggles de times */}
                    {editMode && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: S.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Times que trabalham neste dia</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {ESCALA_TEAM_KEYS.map((k) => {
                            const on = times.includes(k);
                            return (
                              <button key={k} onClick={() => toggleTeamOnDay(day, k)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', border: `1px solid ${on ? ESCALA_TEAMS[k].color : S.border}`, background: on ? ESCALA_TEAMS[k].color + '22' : 'transparent', color: on ? S.text : S.muted2, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: ESCALA_TEAMS[k].color }} />
                                {ESCALA_TEAMS[k].label.replace('Time ', '')}{on && <Check size={13} />}
                              </button>
                            );
                          })}
                        </div>
                        {!isRule(day) && (
                          <button onClick={() => saveDay(day, null)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', padding: '7px 12px', borderRadius: '9px', background: 'transparent', border: `1px solid ${S.border}`, color: S.muted2, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                            <RotateCcw size={13} />Voltar à regra automática
                          </button>
                        )}
                      </div>
                    )}

                    {/* Times e quem trabalhou */}
                    {times.length === 0 ? (
                      <div style={{ textAlign: 'center', color: S.muted, fontSize: '13px', padding: '10px 0' }}>Nenhum time escalado neste dia.</div>
                    ) : times.map((k) => {
                      const membros = comTime.filter((c) => c.team === k);
                      return (
                        <div key={k} style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: ESCALA_TEAMS[k].color, boxShadow: `0 0 6px ${ESCALA_TEAMS[k].color}` }} />
                            <span style={{ color: S.text, fontWeight: 700, fontSize: '13px' }}>{ESCALA_TEAMS[k].label}</span>
                            <span style={{ color: S.muted, fontSize: '11px' }}>· {ESCALA_TEAMS[k].tipo} · {membros.length}</span>
                          </div>
                          {membros.length === 0 ? (
                            <div style={{ color: S.muted, fontSize: '12px', paddingLeft: '17px' }}>Nenhum técnico neste time.</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '17px' }}>
                              {membros.map((c) => {
                                const trab = nomesTrab.has(c.name);
                                return (
                                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 10px', borderRadius: '8px', background: S.input, border: `1px solid ${S.border}` }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                                      <span style={{ color: S.text, fontSize: '12.5px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                                      <span style={{ fontSize: '10px', color: c.passageiro ? '#38bdf8' : S.muted, background: c.passageiro ? '#38bdf822' : S.card, border: `1px solid ${c.passageiro ? '#38bdf855' : S.border}`, padding: '1px 6px', borderRadius: '999px' }}>{c.passageiro ? 'Passageiro' : 'Motorista'}</span>
                                    </span>
                                    {trab && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#34d399', fontWeight: 700 }}><UserCheck size={13} />Trabalhou</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Quem trabalhou FORA da escala */}
                    {(() => {
                      const foraEscala = comTime.filter((c) => nomesTrab.has(c.name) && !times.includes(c.team));
                      if (!foraEscala.length) return null;
                      return (
                        <div style={{ marginTop: '8px', paddingTop: '12px', borderTop: `1px solid ${S.border}` }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24', letterSpacing: '0.5px', marginBottom: '6px' }}>Trabalhou fora da escala</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {foraEscala.map((c) => (
                              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 10px', borderRadius: '8px', background: S.input, border: `1px solid ${ESCALA_TEAMS[c.team]?.color || S.border}55` }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: ESCALA_TEAMS[c.team]?.color, border: `1.5px solid ${S.text}` }} />
                                <span style={{ color: S.text, fontSize: '12.5px' }}>{c.name}</span>
                                <span style={{ color: S.muted, fontSize: '11px', marginLeft: 'auto' }}>{ESCALA_TEAMS[c.team]?.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </motion.div>
  );
};
