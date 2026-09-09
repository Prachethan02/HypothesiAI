import React from 'react';
import { Sparkles, LogOut, User as UserIcon, LogIn } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header style={{
      height: '64px',
      borderBottom: '1px solid var(--border-color)',
      backgroundColor: 'rgba(17, 24, 39, 0.8)',
      backdropFilter: 'blur(8px)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.5rem',
    }}>
      {/* Brand Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
        }}>
          <Sparkles size={20} />
        </div>
        <div>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 style={{ fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              HypothesiAI
            </h1>
          </Link>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Scientific Literature & Hypothesis Engine</p>
        </div>
      </div>

      {/* Quick Actions & Auth Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>

        {isAuthenticated && user ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            borderLeft: '1px solid var(--border-color)',
            paddingLeft: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}>
                <UserIcon size={16} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ffffff', lineHeight: 1.2 }}>
                  {user.full_name || user.email.split('@')[0]}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  {user.role}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="btn-secondary"
              title="Sign Out"
              style={{
                fontSize: '0.75rem',
                padding: '0.4rem 0.6rem',
                color: '#f87171',
                borderColor: 'rgba(239, 68, 68, 0.3)',
              }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            borderLeft: '1px solid var(--border-color)',
            paddingLeft: '1rem',
          }}>
            <Link
              to="/login"
              className="btn-primary"
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', gap: '0.4rem' }}
            >
              <LogIn size={14} />
              <span>Sign In</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
