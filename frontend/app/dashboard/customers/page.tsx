'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function CustomersCRMPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [vipOnly, setVipOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');

  // 1. Query: Fetch customer directory list
  const { data: customerData, isLoading: listLoading } = useQuery({
    queryKey: ['customers-list', search, vipOnly, page],
    queryFn: async () => {
      const res = await api.get('/customers', {
        params: { search, vipOnly: vipOnly ? 'true' : '', page, limit: 10 }
      });
      return res.data;
    }
  });

  const customersList = customerData?.customers || [];
  const pagination = customerData?.pagination || { totalPages: 1, currentPage: 1, totalCustomers: 0 };

  // 2. Query: Fetch details + history for the selected customer profile
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['customer-detail', selectedCustomerId],
    queryFn: async () => {
      const res = await api.get(`/customers/${selectedCustomerId}`);
      setNotesText(res.data?.customer?.notes || '');
      return res.data;
    },
    enabled: !!selectedCustomerId
  });

  const activeCustomer = detailData?.customer;
  const activeOrderHistory = detailData?.orderHistory || [];

  // 3. Mutation: Toggle VIP status
  const vipMutation = useMutation({
    mutationFn: async ({ id, isVIP }: { id: string; isVIP: boolean }) => {
      const res = await api.put(`/customers/${id}/vip`, { isVIP });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('CRM Updated', `Customer VIP status set to ${data.customer?.isVIP}`);
        queryClient.invalidateQueries({ queryKey: ['customers-list'] });
        queryClient.invalidateQueries({ queryKey: ['customer-detail', selectedCustomerId] });
      }
    },
    onError: (error: any) => {
      toast.error('Update Error', error.response?.data?.error || 'Failed to toggle VIP status');
    }
  });

  // 4. Mutation: Update customer kitchen notes
  const notesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const res = await api.put(`/customers/${id}/notes`, { notes });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Notes Saved', 'Customer preferences successfully updated');
        queryClient.invalidateQueries({ queryKey: ['customer-detail', selectedCustomerId] });
      }
    },
    onError: (error: any) => {
      toast.error('Notes Save Error', error.response?.data?.error || 'Failed to save notes');
    }
  });

  return (
    <div style={containerStyle}>
      {/* Title */}
      <div style={headerRowStyle}>
        <div>
          <h1 style={titleStyle}>Customers CRM</h1>
          <p style={subtitleStyle}>Analyze visit frequencies, track favorite items, toggle VIP tiers, and manage kitchen notes.</p>
        </div>
      </div>

      {/* Directory stats panel */}
      <div style={statsGridStyle}>
        <div className="clay-card" style={statCardStyle}>
          <span style={{ fontSize: '1.5rem' }}>👥</span>
          <div>
            <span style={statLabelStyle}>Total Customer Profiles</span>
            <strong style={statValueStyle}>{pagination.totalCustomers}</strong>
          </div>
        </div>
        <div className="clay-card" style={statCardStyle}>
          <span style={{ fontSize: '1.5rem' }}>⭐</span>
          <div>
            <span style={statLabelStyle}>VIP Diners Count</span>
            <strong style={statValueStyle}>
              {customersList.filter((c: any) => c.isVIP).length || 'N/A'}
            </strong>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div style={filterBarRowStyle} className="clay-card">
        <input
          type="text"
          placeholder="Search by customer name or phone number..."
          className="clay-input"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ flexGrow: 1 }}
        />
        <button
          onClick={() => { setVipOnly(!vipOnly); setPage(1); }}
          className={`clay-btn ${vipOnly ? 'clay-btn-primary' : 'clay-btn-secondary'}`}
          style={{ padding: '10px 20px', fontSize: '0.85rem', width: '160px', flexShrink: 0 }}
        >
          {vipOnly ? '⭐ VIP Only' : 'Show All'}
        </button>
      </div>

      {/* Main Grid: directory list on the left, slide drawer context on the right (if selected) */}
      <div style={crmLayoutGridStyle(!!selectedCustomerId)} className="responsive-split-grid">
        
        {/* Left: Customer directory list */}
        <div className="clay-card" style={{ padding: 0, overflowX: 'auto', border: '1px solid rgba(255,255,255,0.04)' }}>
          {listLoading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div className="pulse-glow-indicator" style={{ color: 'var(--primary-color)', margin: '0 auto' }}></div>
            </div>
          ) : customersList.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <span style={{ fontSize: '3rem' }}>🔍</span>
              <h3 style={{ marginTop: '12px', fontSize: '1.1rem' }}>No Customers Registered</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Diners will appear here automatically when checkouts occur.</p>
            </div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr style={tableHeaderRowStyle}>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>Visits</th>
                  <th style={thStyle}>Lifetime Spend</th>
                  <th style={thStyle}>AOV</th>
                  <th style={thStyle}>VIP</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {customersList.map((cust: any) => (
                  <tr
                    key={cust._id}
                    style={{
                      ...tableRowStyle,
                      backgroundColor: selectedCustomerId === cust._id ? 'rgba(255,255,255,0.02)' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedCustomerId(cust._id)}
                  >
                    <td style={tdStyle}>
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block' }}>{cust.name}</strong>
                        <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{cust.phone}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>{cust.totalVisits}</td>
                    <td style={tdStyle}>₹{cust.lifetimeSpend.toFixed(0)}</td>
                    <td style={tdStyle}>₹{cust.averageOrderValue.toFixed(0)}</td>
                    <td style={tdStyle}>
                      {cust.isVIP ? (
                        <span className="clay-badge clay-badge-success" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>VIP</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>-</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedCustomerId(cust._id); }}
                        className="clay-btn clay-btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                      >
                        Profile 👤
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right: Slide Drawer containing profile detailed statistics */}
        {selectedCustomerId && (
          <div className="clay-card float-animation" style={drawerContainerStyle}>
            {detailLoading || !activeCustomer ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div className="pulse-glow-indicator" style={{ color: 'var(--primary-color)', margin: '0 auto' }}></div>
              </div>
            ) : (
              <div>
                {/* Header title close */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Diner Profile</h2>
                  <button onClick={() => setSelectedCustomerId(null)} style={closeButtonStyle}>✕</button>
                </div>

                {/* Profile Card Summary */}
                <div style={avatarCardStyle}>
                  <div style={avatarCircleStyle}>{activeCustomer.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{activeCustomer.name}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{activeCustomer.phone}</span>
                  </div>
                </div>

                {/* VIP and Notes Control fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '20px 0' }}>
                  
                  {/* VIP Status Toggle */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>VIP Diner Tier</span>
                    <button
                      onClick={() => vipMutation.mutate({ id: activeCustomer._id, isVIP: !activeCustomer.isVIP })}
                      className={`clay-btn ${activeCustomer.isVIP ? 'clay-btn-danger' : 'clay-btn-primary'}`}
                      style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                    >
                      {activeCustomer.isVIP ? 'Revoke VIP 🚫' : 'Grant VIP Badge ⭐'}
                    </button>
                  </div>

                  {/* Notes Editor */}
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      Kitchen Preferences & Allergy Notes
                    </label>
                    <textarea
                      className="clay-input"
                      rows={3}
                      value={notesText}
                      onChange={(e) => setNotesText(e.target.value)}
                      placeholder="e.g. Likes extra spicy, prefers table near window, lactose intolerant..."
                      style={{ width: '100%', resize: 'none', fontSize: '0.8rem' }}
                    />
                    <button
                      onClick={() => notesMutation.mutate({ id: activeCustomer._id, notes: notesText })}
                      disabled={notesMutation.isPending}
                      className="clay-btn clay-btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.75rem', marginTop: '8px', width: '100%' }}
                    >
                      {notesMutation.isPending ? 'Saving...' : 'Save Kitchen Notes 💾'}
                    </button>
                  </div>
                </div>

                {/* CRM stats list */}
                <div style={crmDetailsGridStyle}>
                  <div style={crmDetailCardStyle}>
                    <span style={crmDetailLabelStyle}>Visits</span>
                    <strong style={crmDetailValueStyle}>{activeCustomer.totalVisits}</strong>
                  </div>
                  <div style={crmDetailCardStyle}>
                    <span style={crmDetailLabelStyle}>Spent</span>
                    <strong style={crmDetailValueStyle}>₹{activeCustomer.lifetimeSpend.toFixed(0)}</strong>
                  </div>
                  <div style={crmDetailCardStyle}>
                    <span style={crmDetailLabelStyle}>AOV</span>
                    <strong style={crmDetailValueStyle}>₹{activeCustomer.averageOrderValue.toFixed(0)}</strong>
                  </div>
                </div>

                {/* Favorite Dishes */}
                {activeCustomer.favouriteItems && activeCustomer.favouriteItems.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Favourite Foods</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {activeCustomer.favouriteItems.map((item: any) => (
                        <span key={item._id} className="clay-badge" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
                          🍕 {item.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline of past orders */}
                <div style={{ marginTop: '24px' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    Order History Timeline
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                    {activeOrderHistory.length === 0 ? (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No past orders found.</p>
                    ) : (
                      activeOrderHistory.map((order: any) => (
                        <div key={order._id} style={timelineCardStyle}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <code style={{ fontSize: '0.75rem', color: 'var(--accent-color)' }}>{order.token}</code>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {order.items.map((i: any) => `${i.menuItemId?.name || 'Item'} (x${i.quantity})`).join(', ')}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.75rem' }}>
                            <strong>₹{order.grandTotal.toFixed(0)}</strong>
                            <span className="clay-badge" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>{order.status}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// Styling definitions
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px'
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '1.5rem',
  fontWeight: 900,
  letterSpacing: '-0.02em'
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--text-secondary)'
};

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '20px'
};

const statCardStyle: React.CSSProperties = {
  padding: '16px 20px',
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
  fontSize: '1.2rem',
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

const crmLayoutGridStyle = (hasSelection: boolean): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: hasSelection ? '1.3fr 0.7fr' : '1fr',
  gap: '24px',
  alignItems: 'start',
  transition: 'grid-template-columns 0.3s ease'
});

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
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const tableRowStyle: React.CSSProperties = {
  borderBottom: '1px solid rgba(255,255,255,0.02)',
  transition: 'background-color 0.2s ease'
};

const tdStyle: React.CSSProperties = {
  padding: '16px 24px',
  fontSize: '0.85rem',
  color: 'var(--text-secondary)'
};

const drawerContainerStyle: React.CSSProperties = {
  padding: '24px',
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '24px',
  position: 'sticky',
  top: '24px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  fontSize: '1rem',
  cursor: 'pointer',
  padding: '4px'
};

const avatarCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  padding: '12px',
  backgroundColor: 'rgba(255,255,255,0.01)',
  border: '1px solid var(--border-color)',
  borderRadius: '16px'
};

const avatarCircleStyle: React.CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  backgroundColor: 'var(--primary-color)',
  color: '#0a0a0c',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '1.2rem',
  fontWeight: 900
};

const crmDetailsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '10px',
  marginTop: '16px'
};

const crmDetailCardStyle: React.CSSProperties = {
  padding: '10px',
  backgroundColor: 'rgba(255,255,255,0.01)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  textAlign: 'center'
};

const crmDetailLabelStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  color: 'var(--text-muted)',
  display: 'block'
};

const crmDetailValueStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 800,
  display: 'block',
  marginTop: '2px'
};

const timelineCardStyle: React.CSSProperties = {
  padding: '10px 12px',
  backgroundColor: 'rgba(255,255,255,0.01)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px'
};
