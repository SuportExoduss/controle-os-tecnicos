import { R, SP, FS } from './tokens';

// Rótulo de formulário — sempre legível e ligado ao campo (padrão único).
export const FieldLabel = ({ S, children, required, htmlFor }) => (
  <label htmlFor={htmlFor} style={{
    display: 'block', fontSize: FS.xs, fontWeight: 700, color: S.muted,
    letterSpacing: '1px', textTransform: 'uppercase', marginBottom: SP.sm,
  }}>
    {children}{required && <span style={{ color: S.red, marginLeft: 4 }}>*</span>}
  </label>
);

const inputBase = (S) => ({
  width: '100%', padding: '12px 14px', borderRadius: R.sm, background: S.input,
  border: `1px solid ${S.border}`, color: S.text, fontSize: FS.body, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color .15s',
});

// Input de texto/número/data com foco consistente.
export const TextInput = ({ S, style, ...rest }) => (
  <input
    className="ui-focus"
    style={{ ...inputBase(S), ...style }}
    onFocus={(e) => { e.target.style.borderColor = S.accent; }}
    onBlur={(e) => { e.target.style.borderColor = S.border; }}
    {...rest}
  />
);

// Textarea consistente.
export const Textarea = ({ S, rows = 3, style, ...rest }) => (
  <textarea
    rows={rows} className="ui-focus"
    style={{ ...inputBase(S), resize: 'none', ...style }}
    onFocus={(e) => { e.target.style.borderColor = S.accent; }}
    onBlur={(e) => { e.target.style.borderColor = S.border; }}
    {...rest}
  />
);

// Select — valor atual sempre visível; herda o esquema de cor do tema (:root).
export const Select = ({ S, children, style, ...rest }) => (
  <select
    className="ui-focus"
    style={{ ...inputBase(S), cursor: 'pointer', ...style }}
    onFocus={(e) => { e.target.style.borderColor = S.accent; }}
    onBlur={(e) => { e.target.style.borderColor = S.border; }}
    {...rest}
  >
    {children}
  </select>
);

// Campo completo: rótulo + controle + ajuda/erro (agrupa o padrão).
export const Field = ({ S, label, required, hint, error, children }) => (
  <div>
    {label && <FieldLabel S={S} required={required}>{label}</FieldLabel>}
    {children}
    {error ? (
      <div style={{ color: S.red, fontSize: FS.sm, marginTop: 6 }}>{error}</div>
    ) : hint ? (
      <div style={{ color: S.muted2, fontSize: FS.sm, marginTop: 6 }}>{hint}</div>
    ) : null}
  </div>
);
