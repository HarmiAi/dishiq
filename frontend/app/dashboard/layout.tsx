'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, restaurant, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [isAvailable, setIsAvailable] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (restaurant) {
      setIsAvailable(restaurant.isAvailable);
    }
  }, [restaurant]);

  const handleToggleStatus = async () => {
    if (isToggling) return;
    setIsToggling(true);
    const newStatus = !isAvailable;
    try {
      const res = await api.put('/restaurant/status', { isAvailable: newStatus });
      if (res.data && res.data.success) {
        setIsAvailable(res.data.isAvailable);
        toast.success(
          newStatus ? 'Restaurant is Open' : 'Restaurant is Closed',
          newStatus ? 'Customers can now scan QRs and place orders.' : 'QR Ordering has been temporarily paused.'
        );
      }
    } catch (error) {
      toast.error('Failed to update status', 'Please try again later.');
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div style={loaderContainerStyle}>
        <div className="pulse-glow-indicator" style={{ color: 'var(--primary-color)', width: 40, height: 40 }}></div>
      </div>
    );
  }

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: '🏠' },
    { name: 'Orders Manager', path: '/dashboard/orders', icon: '📋' },
    { name: 'Kitchen TV', path: '/dashboard/kitchen', icon: '🍳' },
    { name: 'Analytics', path: '/dashboard/analytics', icon: '📊' },
    { name: 'Order History', path: '/dashboard/orders/history', icon: '📁' },
    { name: 'Customers CRM', path: '/dashboard/customers', icon: '👥' },
    { name: 'Menu Editor', path: '/dashboard/menu', icon: '🍔' },
    { name: 'Tables & QR', path: '/dashboard/tables', icon: '🪑' },
    { name: 'Settings', path: '/dashboard/settings', icon: '⚙️' }
  ];

  return (
    <div style={layoutContainerStyle}>
      {/* Sidebar Navigation */}
      <aside style={sidebarStyle} className="clay-card">
        <div style={logoWrapperStyle}>
          <Link href="/dashboard" style={logoStyle}>Dishiq</Link>
          <span style={logoBadgeStyle}>SaaS</span>
        </div>

        <nav style={navStyle}>
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                style={isActive ? activeNavLinkStyle : navLinkStyle}
              >
                <span style={navIconStyle}>{item.icon}</span>
                <span style={{ fontWeight: isActive ? 600 : 500 }}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div style={sidebarFooterStyle}>
          <div style={profileInfoStyle}>
            <div style={avatarStyle}>
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div style={profileTextStyle}>
              <span style={profileEmailStyle}>{user?.email}</span>
              <span style={profileRoleStyle}>{user?.role}</span>
            </div>
          </div>
         
          <button
            onClick={() => logout()}
            className="clay-btn clay-btn-secondary"
            style={logoutBtnStyle}
          >
            Logout🚪
          </button>
          
        </div>
      </aside>

      {/* Main Panel */}
      <div style={mainAreaStyle}>
        <header style={headerStyle} className="clay-card">
          <div>
            <h2 style={restaurantNameStyle}>{restaurant?.name || 'My Restaurant'}</h2>
            <span style={restaurantSlugStyle}>r/{restaurant?.slug}</span>
          </div>

          <div style={headerActionsStyle}>
            <div style={statusWrapperStyle}>
              <span
                className="pulse-glow-indicator"
                style={{
                  color: isAvailable ? 'var(--color-success)' : 'var(--color-danger)',
                  marginRight: '8px'
                }}
              ></span>
              <span style={statusLabelStyle}>
                Status: <strong>{isAvailable ? 'Open' : 'Closed'}</strong>
              </span>
            </div>
            <button
              onClick={handleToggleStatus}
              disabled={isToggling}
              className={`clay-btn ${isAvailable ? 'clay-btn-danger' : 'clay-btn-primary'}`}
              style={toggleBtnStyle}
            >
              {isAvailable ? 'Go Offline 🛑' : 'Go Online ⚡'}
            </button>
          </div>
        </header>

        {/* Content View */}
        <main style={contentContainerStyle}>
          {children}
        </main>
      </div>
    </div>
  );
}

// Styling definitions
const loaderContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: 'var(--bg-color)'
};

const layoutContainerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '280px 1fr',
  minHeight: '100vh',
  backgroundColor: 'var(--bg-color)',
  padding: '24px',
  gap: '24px'
};

const sidebarStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: 'calc(100vh - 48px)',
  position: 'sticky',
  top: '24px',
  padding: '30px 20px',
  border: '1px solid rgba(255, 255, 255, 0.04)'
};

const logoWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '40px',
  paddingLeft: '10px'
};

const logoStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '1.6rem',
  fontWeight: 800,
  color: 'transparent',
  backgroundClip: 'text',
  backgroundImage: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
  textDecoration: 'none',
  letterSpacing: '-0.02em'
};

const logoBadgeStyle: React.CSSProperties = {
  backgroundColor: 'rgba(99, 102, 241, 0.15)',
  border: '1px solid rgba(99, 102, 241, 0.3)',
  color: 'var(--primary-color)',
  fontSize: '0.65rem',
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: '8px',
  textTransform: 'uppercase'
};

const navStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  flexGrow: 1
};

const navLinkStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  color: 'var(--text-secondary)',
  textDecoration: 'none',
  borderRadius: '12px',
  transition: 'var(--transition-clay)',
  fontSize: '0.95rem'
};

const activeNavLinkStyle: React.CSSProperties = {
  ...navLinkStyle,
  backgroundColor: 'var(--surface-bg)',
  color: 'var(--text-primary)',
  boxShadow: 'var(--clay-input-shadow)',
  border: '1px solid var(--border-color)'
};

const navIconStyle: React.CSSProperties = {
  fontSize: '1.1rem'
};

const sidebarFooterStyle: React.CSSProperties = {
  borderTop: '1px solid var(--border-color)',
  paddingTop: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px'
};

const profileInfoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  paddingLeft: '6px'
};

const avatarStyle: React.CSSProperties = {
  width: '38px',
  height: '38px',
  borderRadius: '50%',
  backgroundColor: 'var(--secondary-color)',
  color: '#fff',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontFamily: 'var(--font-heading)',
  fontWeight: 700,
  boxShadow: '2px 3px 6px rgba(0,0,0,0.3), inset -2px -2px 5px rgba(0,0,0,0.3), inset 2px 2px 5px rgba(255,255,255,0.2)'
};

const profileTextStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const profileEmailStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

const profileRoleStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const logoutBtnStyle: React.CSSProperties = {
  width: '100%',
  fontSize: '0.85rem',
  padding: '10px',
  borderRadius: '12px'
};

const mainAreaStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
  minHeight: '100vh',
  overflow: 'hidden'
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 28px',
  border: '1px solid rgba(255, 255, 255, 0.04)'
};

const restaurantNameStyle: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: 'var(--text-primary)'
};

const restaurantSlugStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)'
};

const headerActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '20px'
};

const statusWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: '0.85rem',
  color: 'var(--text-secondary)'
};

const statusLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)'
};

const toggleBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '0.8rem',
  borderRadius: '10px'
};

const contentContainerStyle: React.CSSProperties = {
  flexGrow: 1,
  display: 'flex',
  flexDirection: 'column'
};
