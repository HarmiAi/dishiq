'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Link from 'next/link';

interface DashboardStats {
  restaurantName: string;
  restaurantSlug: string;
  totalMenuItems: number;
  totalTables: number;
  isAvailable: boolean;
}

export default function DashboardPage() {
  // Query to fetch dashboard stats
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get('/restaurant/dashboard/stats');
      return res.data?.stats as DashboardStats;
    }
  });

  // Query to fetch recent orders
  const { data: ordersData, isLoading: isOrdersLoading } = useQuery({
    queryKey: ['recent-orders'],
    queryFn: async () => {
      const res = await api.get('/orders', {
        params: { limit: 4 }
      });
      return res.data;
    },
    refetchInterval: 10000 // Poll every 10 seconds for real-time dashboard updates
  });

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div style={welcomeRowStyle}>
          <div style={skeletonTitleStyle}></div>
          <div style={skeletonSubtitleStyle}></div>
        </div>
        <div style={gridStyle}>
          <div className="clay-card" style={skeletonCardStyle}></div>
          <div className="clay-card" style={skeletonCardStyle}></div>
          <div className="clay-card" style={skeletonCardStyle}></div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={containerStyle}>
        <div className="clay-card" style={{ textAlign: 'center', padding: '40px' }}>
          <span style={{ fontSize: '2.5rem' }}>⚠️</span>
          <h2 style={{ margin: '16px 0 8px' }}>Failed to Load Dashboard</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            We could not fetch stats for your restaurant. Please refresh or try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="clay-btn clay-btn-primary"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Welcome Banner */}
      <div style={welcomeRowStyle}>
        <h1 style={titleStyle}>Overview</h1>
        <p style={subtitleStyle}>
          Here is a summary of your restaurant status. Go to menu editor or tables to manage operations.
        </p>
      </div>

      {/* 3D Stats Cards Grid */}
      <div style={gridStyle}>
        {/* Card 1: Menu Items */}
        <div className="clay-card clay-card-interactive float-animation" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: '1.8rem' }}>🍔</span>
            <span className="clay-badge clay-badge-info">Active</span>
          </div>
          <h3 style={cardLabelStyle}>Menu Items</h3>
          <span style={cardValueStyle}>{data.totalMenuItems}</span>
          <p style={cardSubLabelStyle}>Categorized food items</p>
        </div>

        {/* Card 2: Tables */}
        <div className="clay-card clay-card-interactive float-animation" style={{ ...cardStyle, animationDelay: '0.2s' }}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: '1.8rem' }}>🪑</span>
            <span className="clay-badge clay-badge-success">Live QR</span>
          </div>
          <h3 style={cardLabelStyle}>Total Tables</h3>
          <span style={cardValueStyle}>{data.totalTables}</span>
          <p style={cardSubLabelStyle}>Active QR codes printed</p>
        </div>

        {/* Card 3: Restaurant Availability */}
        <div className="clay-card clay-card-interactive float-animation" style={{ ...cardStyle, animationDelay: '0.4s' }}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: '1.8rem' }}>⚡</span>
            <span className={`clay-badge ${data.isAvailable ? 'clay-badge-success' : 'clay-badge-danger'}`}>
              {data.isAvailable ? 'Online' : 'Offline'}
            </span>
          </div>
          <h3 style={cardLabelStyle}>ordering status</h3>
          <span style={cardValueStyle}>{data.isAvailable ? 'Active' : 'Paused'}</span>
          <p style={cardSubLabelStyle}>Customer QR menu accessibility</p>
        </div>
      </div>

      {/* Split Actions & Orders Layout Grid */}
      <div style={splitLayoutGridStyle}>
        {/* Quick Actions Panel */}
        <div className="clay-card" style={actionsPanelStyle}>
          <h2 style={panelTitleStyle}>Quick Settings</h2>
          <div style={actionsGridStyle}>
            <Link href="/dashboard/menu" style={actionCardLinkStyle} className="clay-card clay-card-interactive">
              <span style={actionIconStyle}>➕</span>
              <div>
                <h4 style={actionTitleStyle}>Add Menu Item</h4>
                <p style={actionDescStyle}>Create pizza, cocktails, desserts, and pricing details.</p>
              </div>
            </Link>

            <Link href="/dashboard/tables" style={actionCardLinkStyle} className="clay-card clay-card-interactive">
              <span style={actionIconStyle}>🖨️</span>
              <div>
                <h4 style={actionTitleStyle}>Generate QR Tables</h4>
                <p style={actionDescStyle}>Add new tables and display QR printable ordering links.</p>
              </div>
            </Link>

            <Link href="/dashboard/settings" style={actionCardLinkStyle} className="clay-card clay-card-interactive">
              <span style={actionIconStyle}>⚙️</span>
              <div>
                <h4 style={actionTitleStyle}>Edit Profile</h4>
                <p style={actionDescStyle}>Update address, GST code, operating hours, and cuisines.</p>
              </div>
            </Link>

            <a
              href={`/r/${data.restaurantSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={actionCardLinkStyle}
              className="clay-card clay-card-interactive"
            >
              <span style={actionIconStyle}>🔗</span>
              <div>
                <h4 style={actionTitleStyle}>View Customer Menu</h4>
                <p style={actionDescStyle}>Open the public-facing storefront menu in a new browser tab.</p>
              </div>
            </a>
          </div>
        </div>

        {/* Recent Orders Panel */}
        <div className="clay-card" style={ordersPanelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={panelTitleStyle}>Recent Orders</h2>
            <Link href="/dashboard/orders" style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600, textDecoration: 'none' }}>
              View All →
            </Link>
          </div>

          {isOrdersLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2].map((i) => (
                <div key={i} className="clay-card pulse-glow-indicator" style={{ height: '70px', borderRadius: '16px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-bg)' }}></div>
              ))}
            </div>
          ) : !ordersData?.orders || ordersData.orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '10px' }}>🛎️</span>
              <span style={{ fontSize: '0.85rem' }}>No orders placed yet.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {ordersData.orders.slice(0, 4).map((order: any) => {
                const timeStr = new Date(order.createdAt).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                });
                return (
                  <div key={order._id} className="clay-card clay-card-interactive" style={orderRowStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.875rem' }}>{order.orderNumber}</strong>
                          <span style={tableBadgeStyle}>Table {order.tableId?.tableNumber || 'N/A'}</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {order.customerName} • {timeStr}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={miniStatusBadgeStyle(order.status)}>{order.status}</span>
                        <strong style={{ fontSize: '0.875rem', color: 'var(--accent-color)' }}>
                          ₹{order.grandTotal.toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Styling definitions
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '32px',
  animation: 'fadeIn 0.4s ease'
};

const welcomeRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
};

const titleStyle: React.CSSProperties = {
  fontSize: '2rem',
  fontWeight: 800,
  letterSpacing: '-0.03em',
  color: 'var(--text-primary)'
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  color: 'var(--text-secondary)',
  maxWidth: '650px',
  lineHeight: 1.5
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '24px'
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  border: '1px solid rgba(255, 255, 255, 0.04)',
  padding: '28px'
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '4px'
};

const cardLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '0.8rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)'
};

const cardValueStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '2.5rem',
  fontWeight: 800,
  color: 'var(--text-primary)'
};

const cardSubLabelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--text-secondary)'
};

const actionsPanelStyle: React.CSSProperties = {
  padding: '32px',
  border: '1px solid rgba(255, 255, 255, 0.04)'
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 700,
  marginBottom: '24px',
  letterSpacing: '-0.02em'
};

const actionsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '20px'
};

const actionCardLinkStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '20px',
  padding: '20px',
  textDecoration: 'none',
  color: 'var(--text-primary)',
  backgroundColor: 'var(--surface-bg)',
  border: '1px solid var(--border-color)'
};

const actionIconStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  backgroundColor: 'rgba(10, 10, 11, 0.4)',
  padding: '12px',
  borderRadius: '12px',
  boxShadow: 'var(--clay-input-shadow)',
  border: '1px solid var(--border-color)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const actionTitleStyle: React.CSSProperties = {
  fontSize: '0.975rem',
  fontWeight: 600,
  marginBottom: '4px'
};

const actionDescStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--text-secondary)',
  lineHeight: 1.4
};

// Skeletons
const skeletonTitleStyle: React.CSSProperties = {
  width: '200px',
  height: '32px',
  backgroundColor: 'var(--surface-bg)',
  borderRadius: '8px'
};

const skeletonSubtitleStyle: React.CSSProperties = {
  width: '400px',
  height: '18px',
  backgroundColor: 'var(--surface-bg)',
  borderRadius: '6px',
  marginTop: '8px'
};

const skeletonCardStyle: React.CSSProperties = {
  height: '180px',
  backgroundColor: 'var(--surface-bg)',
  border: '1px solid rgba(255,255,255,0.03)'
};

const splitLayoutGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.2fr 0.8fr',
  gap: '24px',
  alignItems: 'start'
};

const ordersPanelStyle: React.CSSProperties = {
  padding: '32px',
  border: '1px solid rgba(255, 255, 255, 0.04)',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'var(--card-bg)'
};

const orderRowStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderRadius: '16px',
  backgroundColor: 'var(--surface-bg)',
  border: '1px solid var(--border-color)',
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer'
};

const tableBadgeStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: '6px',
  fontSize: '0.675rem',
  fontWeight: 600,
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-secondary)'
};

const miniStatusBadgeStyle = (status: string): React.CSSProperties => {
  let color = 'rgb(234, 179, 8)';
  if (status === 'confirmed') color = 'rgb(59, 130, 246)';
  if (status === 'preparing') color = 'rgb(168, 85, 247)';
  if (status === 'completed') color = 'rgb(34, 197, 94)';
  if (status === 'cancelled') color = 'rgb(239, 68, 68)';

  return {
    fontSize: '0.65rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color
  };
};
