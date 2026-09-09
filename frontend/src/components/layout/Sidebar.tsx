/**
 * Sidebar Navigation
 * ==================
 * Clean, product-focused navigation for HypothesiAI.
 * Centers on the core user journey:
 *   Dashboard -> Discover Papers -> Research Corpora -> Research Gaps -> Hypotheses -> Knowledge Graph
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Folders,
  BookOpen,
  TrendingUp,
  Lightbulb,
  Network,
  Settings,
  Search,
  Zap,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
}

const navItems: NavItem[] = [
  { name: 'Dashboard',             path: '/dashboard',       icon: LayoutDashboard },
  { name: 'Discover Papers',       path: '/discover',        icon: BookOpen },
  { name: 'Research Corpora',      path: '/corpus',          icon: Folders },
  { name: 'Research Gaps',         path: '/research-gaps',   icon: TrendingUp },
  { name: 'Hypotheses',            path: '/hypotheses',      icon: Lightbulb },
  { name: 'Knowledge Graph',       path: '/knowledge-graph', icon: Network },
  { name: 'Paper Library',         path: '/papers',          icon: BookOpen },
  { name: 'Search',                path: '/search',          icon: Search },
  { name: 'Settings',              path: '/settings',        icon: Settings },
];

const NavItemLink: React.FC<{ item: NavItem }> = ({ item }) => {
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
        <Icon size={17} />
        <span>{item.name}</span>
      </div>
      {item.badge && (
        <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(55, 65, 81, 0.8)', color: 'var(--text-muted)' }}>
          {item.badge}
        </span>
      )}
    </NavLink>
  );
};

export const Sidebar: React.FC = () => {
  return (
    <aside
      style={{
        width: '240px',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100vh - 64px)',
        padding: '1.25rem 0.625rem',
        gap: '0.5rem',
        overflowY: 'auto',
      }}
    >
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 0.75rem 0.25rem' }}>
        Platform Navigation
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {navItems.map((item) => (
          <NavItemLink key={item.path} item={item} />
        ))}
      </nav>

      {/* Footer Info Card */}
      <div
        style={{
          marginTop: 'auto',
          padding: '0.875rem',
          backgroundColor: 'rgba(11, 15, 25, 0.6)',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-color)',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', color: '#34d399', fontWeight: 600 }}>
          <Zap size={13} />
          <span>Research Intelligence</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', lineHeight: '1.4', margin: 0 }}>
          Upload scientific PDFs to automatically synthesize research gaps and testable hypotheses.
        </p>
      </div>
    </aside>
  );
};
