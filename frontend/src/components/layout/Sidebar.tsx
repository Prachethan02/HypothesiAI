import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Compass,
  Lightbulb,
  Settings,
  Activity,
  Layers,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Paper Library', path: '/papers', icon: FileText },
  { name: 'Research Gaps', path: '/research-gaps', icon: Compass },
  { name: 'Hypothesis Studio', path: '/hypotheses', icon: Lightbulb },
  { name: 'Settings', path: '/settings', icon: Settings },
  { name: 'System Diagnostics', path: '/health', icon: Activity },
];

export const Sidebar: React.FC = () => {
  return (
    <aside
      style={{
        width: '260px',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100vh - 64px)',
        padding: '1.25rem 0.75rem',
        gap: '1.5rem',
      }}
    >
      <div>
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '0 0.75rem 0.5rem',
          }}
        >
          Research Discovery
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '0.5rem',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s ease',
                })}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Icon size={18} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(55, 65, 81, 0.8)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Stage Tracker Indicator */}
      <div
        style={{
          marginTop: 'auto',
          padding: '1rem',
          backgroundColor: 'rgba(11, 15, 25, 0.6)',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-color)',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#818cf8', fontWeight: 600 }}>
          <Layers size={14} />
          <span>Stage 4 Active</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', lineHeight: '1.4' }}>
          Responsive UI, academic discovery components, and state architecture active.
        </p>
      </div>
    </aside>
  );
};
