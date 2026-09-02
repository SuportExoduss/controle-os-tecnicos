import { R, SP, SH } from './tokens';

// Skeleton — placeholder de carregamento que IMITA a geometria do conteúdo real,
// evitando o "pisca-spinner". A animação vem da classe .ui-skeleton (index.css),
// que respeita prefers-reduced-motion.

export const SkeletonLine = ({ S, w = '100%', h = 12, style }) => (
  <span className="ui-skeleton" style={{ display: 'block', width: w, height: h, borderRadius: R.sm, background: S.input2 || S.input, ...style }} />
);

// Card de métrica em esqueleto (mesma altura/estrutura do KPI real).
export const SkeletonKpi = ({ S }) => (
  <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: R.lg, padding: SP.lg, boxShadow: SH[1], display: 'flex', flexDirection: 'column', gap: SP.sm }}>
    <span className="ui-skeleton" style={{ width: 34, height: 34, borderRadius: R.sm, background: S.input2 || S.input }} />
    <SkeletonLine S={S} w="55%" h={11} />
    <SkeletonLine S={S} w="40%" h={22} />
  </div>
);

// Linhas de lista/tabela em esqueleto.
export const SkeletonRows = ({ S, rows = 5, height = 56 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: R.md, padding: '0 16px', height, display: 'flex', alignItems: 'center', gap: SP.md }}>
        <span className="ui-skeleton" style={{ width: 30, height: 30, borderRadius: R.pill, background: S.input2 || S.input, flexShrink: 0 }} />
        <SkeletonLine S={S} w="45%" h={13} />
        <span style={{ marginLeft: 'auto' }}><SkeletonLine S={S} w={48} h={20} /></span>
      </div>
    ))}
  </div>
);

// Grade de KPIs em esqueleto (usa a mesma classe de grid da página).
export const SkeletonKpiGrid = ({ S, count = 5, className = 'r-metrics' }) => (
  <div className={className} style={{ display: 'grid' }}>
    {Array.from({ length: count }).map((_, i) => <SkeletonKpi key={i} S={S} />)}
  </div>
);
