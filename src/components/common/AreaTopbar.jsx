import {
  Cable,
  Check,
  ClipboardEdit,
  Download,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  Moon,
  Sun,
  Truck,
  Video,
  Wifi,
} from 'lucide-react';

const AREA_META = {
  fibra: { label: 'Fibra', Icon: Cable },
  redes: { label: 'Redes', Icon: Wifi },
  cameras: { label: 'WIBICAM', Icon: Video },
  frota: { label: 'Frota', Icon: Truck },
};

const EXPORT_COLORS = {
  Texto: { bg: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', border: '#60a5fa', shadow: 'rgba(59,130,246,0.3)', Icon: FileText },
  Excel: { bg: 'linear-gradient(135deg, #047857, #10b981)', border: '#34d399', shadow: 'rgba(16,185,129,0.3)', Icon: FileSpreadsheet },
  PDF: { bg: 'linear-gradient(135deg, #b91c1c, #ef4444)', border: '#f87171', shadow: 'rgba(239,68,68,0.3)', Icon: Download },
};

export const AreaTopbar = ({
  S,
  mode,
  area = 'fibra',
  variant = 'dashboard',
  isLogged = false,
  nickname,
  onTheme,
  onPrimary,
  onAuth,
  exportActions = [],
  rightSlot,
}) => {
  const meta = AREA_META[area] || AREA_META.fibra;
  const AreaIcon = meta.Icon;
  const PrimaryIcon = variant === 'admin' ? LayoutDashboard : ClipboardEdit;
  const primaryLabel = variant === 'admin' ? 'Dashboard' : 'ADM';
  const authLabel = isLogged ? 'Sair' : 'Editar';

  const iconButton = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    background: 'transparent',
    border: `1px solid ${S.border}`,
    color: mode === 'light' ? S.purple : S.orange,
    cursor: 'pointer',
    flexShrink: 0,
  };

  const navButton = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    height: '34px',
    padding: '0 12px',
    borderRadius: '8px',
    background: 'transparent',
    border: `1px solid ${S.border}`,
    color: S.muted2,
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
  };

  const authButton = {
    ...navButton,
    background: isLogged ? '#0d2d1f' : 'transparent',
    borderColor: isLogged ? '#065f46' : S.border,
    color: isLogged ? '#34d399' : S.muted2,
  };

  const renderExportButton = (action, mobile = false) => {
    const color = EXPORT_COLORS[action.label] || EXPORT_COLORS.Texto;
    const Icon = action.Icon || color.Icon;
    return (
      <button
        key={action.label}
        onClick={action.onClick}
        disabled={action.disabled}
        title={action.title || action.label}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: mobile ? 0 : '7px',
          width: mobile ? '36px' : 'auto',
          height: mobile ? '36px' : '38px',
          padding: mobile ? 0 : '0 16px',
          borderRadius: '10px',
          background: color.bg,
          border: `1px solid ${color.border}`,
          color: '#fff',
          fontSize: '13px',
          fontWeight: 800,
          cursor: action.disabled ? 'wait' : 'pointer',
          boxShadow: `0 0 16px ${color.shadow}`,
          opacity: action.disabled ? 0.7 : 1,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => { if (!action.disabled) e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
      >
        <Icon size={15} />
        {!mobile && action.label}
      </button>
    );
  };

  return (
    <header className="area-topbar" style={{ position: 'sticky', top: 0, zIndex: 30, background: S.card, borderBottom: `1px solid ${S.border}` }}>
      <div className="area-topbar-inner r-maxw">
        <div className="area-topbar-left">
          <div className="area-topbar-brand">
            <img src="/logo-frota.png" alt="IbiuNET Multiplay" className="area-topbar-logo" />
            <div className="area-topbar-user" style={{ color: nickname ? '#34d399' : S.muted }}>
              {nickname ? <><Check size={10} />{nickname}</> : <span>{meta.label}</span>}
            </div>
          </div>

          <div className="area-topbar-badge" style={{ color: S.accent || S.blue, borderColor: S.accent || S.blue, background: S.accentSoft || 'transparent' }}>
            <AreaIcon size={12} />
            <span>{variant === 'admin' ? `${meta.label} · Admin` : meta.label}</span>
          </div>

          <button onClick={onTheme} title="Alternar tema" style={iconButton}>
            {mode === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          <button onClick={onPrimary} title={variant === 'admin' ? 'Ir para o Dashboard' : 'Ir para o painel ADM'} style={navButton}>
            <PrimaryIcon size={14} />
            <span className="r-topbar-label">{primaryLabel}</span>
          </button>

          <button onClick={onAuth} title={isLogged ? 'Sair' : 'Entrar para editar'} style={authButton}>
            {isLogged ? <LogOut size={13} /> : <Lock size={13} />}
            <span className="r-topbar-label">{authLabel}</span>
          </button>
        </div>

        <div className="area-topbar-right">
          {rightSlot}
          {isLogged && exportActions.length > 0 && (
            <>
              <div className="r-dash-header-btns">{exportActions.map((action) => renderExportButton(action))}</div>
              <div className="r-dash-header-btns-sm">{exportActions.map((action) => renderExportButton(action, true))}</div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
