'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function SuperAdminPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Redirect non-superadmin accounts
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== 'superadmin')) {
      router.push('/login');
    }
  }, [isAuthenticated, user, authLoading, router]);

  // 1. Query: Fetch global SaaS platform statistics
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['superadmin-stats'],
    queryFn: async () => {
      const res = await api.get('/superadmin/stats');
      return res.data?.stats;
    },
    enabled: isAuthenticated && user?.role === 'superadmin'
  });

  // 2. Query: Fetch paginated & filterable list of restaurants
  const { data: restaurantData, isLoading: restaurantsLoading } = useQuery({
    queryKey: ['superadmin-restaurants', search, statusFilter, page],
    queryFn: async () => {
      const res = await api.get('/superadmin/restaurants', {
        params: { search, status: statusFilter === 'all' ? '' : statusFilter, page, limit: 10 }
      });
      return res.data;
    },
    enabled: isAuthenticated && user?.role === 'superadmin'
  });

  // 3. Mutation: Toggle Suspension status
  const suspendMutation = useMutation({
    mutationFn: async ({ id, isSuspended }: { id: string; isSuspended: boolean }) => {
      const res = await api.put(`/superadmin/restaurants/${id}/suspend`, { isSuspended });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(
          'Status Synced',
          `Restaurant has been successfully ${data.restaurant?.isSuspended ? 'suspended' : 'activated'}`
        );
        queryClient.invalidateQueries({ queryKey: ['superadmin-stats'] });
        queryClient.invalidateQueries({ queryKey: ['superadmin-restaurants'] });
      }
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || 'Failed to update restaurant status';
      toast.error('Sync Error', msg);
    }
  });

  // 4. Mutation: Hard delete restaurant cascade
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/superadmin/restaurants/${id}`);
      return res.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Restaurant Deleted', 'Profile and cascade assets have been removed');
        setDeletingId(null);
        queryClient.invalidateQueries({ queryKey: ['superadmin-stats'] });
        queryClient.invalidateQueries({ queryKey: ['superadmin-restaurants'] });
      }
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || 'Failed to delete restaurant';
      toast.error('Deletion Error', msg);
      setDeletingId(null);
    }
  });

  if (authLoading || !isAuthenticated || user?.role !== 'superadmin') {
    return (
      <div style={loaderContainerStyle}>
        <div className="pulse-glow-indicator" style={{ color: 'var(--primary-color)', width: 40, height: 40 }}></div>
      </div>
    );
  }

  const restaurantsList = restaurantData?.restaurants || [];
  const pagination = restaurantData?.pagination || { totalPages: 1, currentPage: 1, totalRestaurants: 0 };

  return (
    <div style={containerStyle}>
      {/* Top Header navbar */}
      <header style={headerNavbarStyle} className="clay-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.75rem' }}>🛡️</span>
          <div>
            <h1 style={logoTextStyle}>Dishiq SaaS</h1>
            <span style={superAdminBadgeStyle}>SUPER ADMIN PANEL</span>
          </div>
        </div>
        <button onClick={() => logout()} className="clay-btn clay-btn-danger" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
          Sign Out 🚪
        </button>
      </header>

      {/* 3D platform statistics panel */}
      {statsLoading ? (
        <div style={statsGridStyle}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="clay-card pulse-glow-indicator" style={skeletonCardStyle}></div>
          ))}
        </div>
      ) : (
        statsData && (
          <div style={statsGridStyle}>
            <div className="clay-card float-animation" style={statCardStyle}>
              <span style={{ fontSize: '1.8rem' }}>🏢</span>
              <div>
                <span style={statLabelStyle}>Total Restaurants</span>
                <strong style={statValueStyle}>{statsData.totalRestaurants}</strong>
              </div>
            </div>

            <div className="clay-card float-animation" style={{ ...statCardStyle, animationDelay: '0.1s' }}>
              <span style={{ fontSize: '1.8rem' }}>🟢</span>
              <div>
                <span style={statLabelStyle}>Active Subscriptions</span>
                <strong style={statValueStyle}>{statsData.activeRestaurants}</strong>
              </div>
            </div>

            <div className="clay-card float-animation" style={{ ...statCardStyle, animationDelay: '0.2s' }}>
              <span style={{ fontSize: '1.8rem' }}>💰</span>
              <div>
                <span style={statLabelStyle}>Platform Revenue</span>
                <strong style={statValueStyle}>₹{statsData.totalRevenue.toFixed(0)}</strong>
              </div>
            </div>

            <div className="clay-card float-animation" style={{ ...statCardStyle, animationDelay: '0.3s' }}>
              <span style={{ fontSize: '1.8rem' }}>📋</span>
              <div>
                <span style={statLabelStyle}>Total Orders Processed</span>
                <strong style={statValueStyle}>{statsData.totalOrders}</strong>
              </div>
            </div>
          </div>
        )
      )}

      {/* Directory search & filter row */}
      <div style={filterBarRowStyle} className="clay-card">
        <input
          type="text"
          placeholder="Search by restaurant name, slug or email..."
          className="clay-input"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ flexGrow: 1 }}
        />
        <select
          className="clay-input"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ width: '200px' }}
        >
          <option value="all">All States</option>
          <option value="active">Active Only</option>
          <option value="suspended">Suspended Only</option>
        </select>
      </div>

      {/* Directory database table */}
      <div className="clay-card" style={{ padding: 0, overflowX: 'auto', border: '1px solid rgba(255,255,255,0.04)' }}>
        {restaurantsLoading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div className="pulse-glow-indicator" style={{ color: 'var(--primary-color)', margin: '0 auto' }}></div>
          </div>
        ) : restaurantsList.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <span style={{ fontSize: '3rem' }}>🔍</span>
            <h3 style={{ marginTop: '12px', fontSize: '1.1rem' }}>No Restaurants Configured</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No restaurant entries match your filter criteria.</p>
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr style={tableHeaderRowStyle}>
                <th style={thStyle}>Details</th>
                <th style={thStyle}>Slug</th>
                <th style={thStyle}>Owner Email</th>
                <th style={thStyle}>Joined</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {restaurantsList.map((rest: any) => (
                <tr key={rest._id} style={tableRowStyle}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={restLogoWrapperStyle}>
                        {rest.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={rest.logoUrl} alt={rest.name} style={restLogoStyle} />
                        ) : (
                          <span>🍽️</span>
                        )}
                      </div>
                      <strong style={{ fontSize: '0.95rem' }}>{rest.name}</strong>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <code style={slugCodeStyle}>/r/{rest.slug}</code>
                  </td>
                  <td style={tdStyle}>{rest.ownerId?.email || 'N/A'}</td>
                  <td style={tdStyle}>
                    {new Date(rest.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td style={tdStyle}>
                    <span className={`clay-badge ${rest.isSuspended ? 'clay-badge-danger' : 'clay-badge-success'}`}>
                      {rest.isSuspended ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        onClick={() => suspendMutation.mutate({ id: rest._id, isSuspended: !rest.isSuspended })}
                        className={`clay-btn ${rest.isSuspended ? 'clay-btn-primary' : 'clay-btn-secondary'}`}
                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                      >
                        {rest.isSuspended ? 'Activate ✅' : 'Suspend 🚫'}
                      </button>
                      <button
                        onClick={() => setDeletingId(rest._id)}
                        className="clay-btn clay-btn-danger"
                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                      >
                        Delete 🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination row */}
      {pagination.totalPages > 1 && (
        <div style={paginationRowStyle}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Showing Page <strong>{pagination.currentPage}</strong> of <strong>{pagination.totalPages}</strong>
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="clay-btn clay-btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              ◀ Prev
            </button>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="clay-btn clay-btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              Next ▶
            </button>
          </div>
        </div>
      )}

      {/* Cascade Deletion Confirmation Modal */}
      {deletingId && (
        <div style={modalBackdropStyle}>
          <div className="clay-card float-animation" style={modalContentStyle}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-danger)' }}>⚠️ Permanent Deletion Warning</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '14px 0 24px', lineHeight: 1.5 }}>
              This action is destructive and irreversible. Deleting this restaurant profile will permanently cascade delete all menu categories, items, tables, orders, customers, staff logins, and the owner account.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setDeletingId(null)} className="clay-btn clay-btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
                className="clay-btn clay-btn-danger"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Permanently Delete Cascade'}
              </button>
            </div>
          </div>
        </div>
      )}
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

const containerStyle: React.CSSProperties = {
  maxWidth: '1200px',
  width: '100%',
  margin: '0 auto',
  padding: '40px 24px 80px',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
  color: 'var(--text-primary)',
  backgroundColor: 'var(--bg-color)'
};

const headerNavbarStyle: React.CSSProperties = {
  padding: '20px 32px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--card-bg)'
};

const logoTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '1.4rem',
  fontWeight: 900,
  letterSpacing: '-0.02em',
  lineHeight: 1
};

const superAdminBadgeStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 800,
  color: 'var(--text-muted)',
  letterSpacing: '0.05em',
  display: 'block',
  marginTop: '4px'
};

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '20px'
};

const skeletonCardStyle: React.CSSProperties = {
  height: '92px',
  backgroundColor: 'var(--card-bg)',
  borderRadius: '16px'
};

const statCardStyle: React.CSSProperties = {
  padding: '20px 24px',
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '16px'
};

const statLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  display: 'block'
};

const statValueStyle: React.CSSProperties = {
  fontSize: '1.4rem',
  fontWeight: 900,
  fontFamily: 'var(--font-heading)',
  marginTop: '2px',
  display: 'block'
};

const filterBarRowStyle: React.CSSProperties = {
  padding: '16px 20px',
  display: 'flex',
  gap: '16px',
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '16px'
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  textAlign: 'left'
};

const tableHeaderRowStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border-color)',
  backgroundColor: 'rgba(255,255,255,0.01)'
};

const thStyle: React.CSSProperties = {
  padding: '16px 24px',
  fontSize: '0.8rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const tableRowStyle: React.CSSProperties = {
  borderBottom: '1px solid rgba(255,255,255,0.02)',
  transition: 'background-color 0.2s ease',
  backgroundColor: 'transparent'
};

const tdStyle: React.CSSProperties = {
  padding: '16px 24px',
  fontSize: '0.875rem',
  color: 'var(--text-secondary)'
};

const restLogoWrapperStyle: React.CSSProperties = {
  width: '38px',
  height: '38px',
  borderRadius: '10px',
  backgroundColor: 'rgba(255,255,255,0.02)',
  border: '1px solid var(--border-color)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden'
};

const restLogoStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover'
};

const slugCodeStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.03)',
  padding: '4px 8px',
  borderRadius: '6px',
  fontSize: '0.8rem',
  border: '1px solid rgba(255,255,255,0.02)'
};

const paginationRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '8px'
};

const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.85)',
  backdropFilter: 'blur(6px)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 99999,
  padding: '24px'
};

const modalContentStyle: React.CSSProperties = {
  maxWidth: '460px',
  width: '100%',
  padding: '32px',
  backgroundColor: 'var(--card-bg)',
  border: '1px solid rgba(239, 68, 68, 0.2)',
  borderRadius: '24px',
  boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
};
