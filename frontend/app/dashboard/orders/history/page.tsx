'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function OrderHistoryPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  // Query: Fetch order history (limit to 10 per page)
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-orders-history', search, statusFilter, startDate, endDate, page],
    queryFn: async () => {
      const statusParam = statusFilter === 'all' ? '' : statusFilter;
      const res = await api.get('/orders', {
        params: {
          search,
          status: statusParam,
          startDate,
          endDate,
          page,
          limit: 10
        }
      });
      return res.data;
    }
  });

  const ordersList = data?.orders || [];
  const pagination = data?.pagination || { totalOrders: 0, totalPages: 1, currentPage: 1 };

  // CSV Exporter helper
  const handleExportCSV = async () => {
    try {
      // Fetch all matching orders without pagination limits for full export
      const statusParam = statusFilter === 'all' ? '' : statusFilter;
      const res = await api.get('/orders', {
        params: {
          search,
          status: statusParam,
          startDate,
          endDate,
          page: 1,
          limit: 500 // Retrieve up to 500 records for the report
        }
      });

      const exportOrders = res.data?.orders || [];
      if (exportOrders.length === 0) {
        toast.error('Export Failed', 'There are no order records to export in the current selection.');
        return;
      }

      // Build CSV file contents
      const headers = ['Order Number', 'Token', 'Table', 'Customer Name', 'Phone', 'Items Ordered', 'Grand Total (₹)', 'Status', 'Date', 'Time'];
      const rows = exportOrders.map((order: any) => {
        const dateObj = new Date(order.createdAt);
        const dateStr = dateObj.toLocaleDateString('en-US');
        const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const itemsStr = order.items.map((i: any) => `${i.menuItemId?.name || 'Item'} (x${i.quantity})`).join('; ');
        
        return [
          order.orderNumber,
          order.token,
          order.tableId?.tableNumber || 'N/A',
          order.customerName,
          order.customerPhone,
          `"${itemsStr}"`,
          order.grandTotal.toFixed(2),
          order.status.toUpperCase(),
          dateStr,
          timeStr
        ];
      });

      const csvContent = 'data:text/csv;charset=utf-8,' 
        + [headers.join(',')].concat(rows.map((e: any) => e.join(','))).join('\n');
      
      const encodedUri = encodeURI(csvContent);
      const downloadLink = document.createElement('a');
      downloadLink.setAttribute('href', encodedUri);
      downloadLink.setAttribute('download', `dishiq_orders_report_${Date.now()}.csv`);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      toast.success('Report Exported', `${exportOrders.length} order logs written to CSV file.`);
    } catch (e) {
      toast.error('Export Error', 'An error occurred while compiling the report data.');
    }
  };

  return (
    <div style={containerStyle}>
      {/* Title Header */}
      <div style={headerRowStyle}>
        <div>
          <h1 style={titleStyle}>Order History</h1>
          <p style={subtitleStyle}>Query completed archives, compile accounting parameters, and export spreadsheets.</p>
        </div>
        <button onClick={handleExportCSV} className="clay-btn clay-btn-primary" style={{ padding: '10px 20px', fontSize: '0.85rem' }}>
          Export CSV 📥
        </button>
      </div>

      {/* Advanced Filters Card */}
      <div style={filterCardStyle} className="clay-card">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', width: '100%' }}>
          <input
            type="text"
            placeholder="Search by customer name, phone, or token..."
            className="clay-input"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />

          <select
            className="clay-input"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">⏳ Pending</option>
            <option value="confirmed">✅ Confirmed</option>
            <option value="preparing">🍳 Preparing</option>
            <option value="ready">🔔 Ready</option>
            <option value="completed">🏁 Completed</option>
            <option value="cancelled">❌ Cancelled</option>
          </select>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <input
              type="date"
              className="clay-input"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              style={{ fontSize: '0.8rem', padding: '8px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <input
              type="date"
              className="clay-input"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              style={{ fontSize: '0.8rem', padding: '8px' }}
            />
          </div>
        </div>
      </div>

      {/* Orders History Table */}
      <div className="clay-card" style={{ padding: 0, overflowX: 'auto', border: '1px solid rgba(255,255,255,0.04)' }}>
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div className="pulse-glow-indicator" style={{ color: 'var(--primary-color)', margin: '0 auto' }}></div>
          </div>
        ) : ordersList.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <span style={{ fontSize: '3rem' }}>📁</span>
            <h3 style={{ marginTop: '12px', fontSize: '1.1rem' }}>No Orders Found</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No historical logs match the active parameters.</p>
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr style={tableHeaderRowStyle}>
                <th style={thStyle}>Order No / Token</th>
                <th style={thStyle}>Table</th>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Items</th>
                <th style={thStyle}>Total Spent</th>
                <th style={thStyle}>Date & Time</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {ordersList.map((order: any) => {
                const dateObj = new Date(order.createdAt);
                const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                return (
                  <tr key={order._id} style={tableRowStyle}>
                    <td style={tdStyle}>
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block' }}>
                          {order.orderNumber}
                        </strong>
                        <code style={{ fontSize: '0.75rem', color: 'var(--accent-color)' }}>{order.token}</code>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span className="clay-badge" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                        Table {order.tableId?.tableNumber || 'N/A'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.85rem' }}>{order.customerName}</strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{order.customerPhone}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {order.items.map((i: any) => `${i.menuItemId?.name || 'Item'} (x${i.quantity})`).join(', ')}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <strong style={{ color: 'var(--text-primary)' }}>₹{order.grandTotal.toFixed(2)}</strong>
                    </td>
                    <td style={tdStyle}>
                      <div>
                        <span style={{ display: 'block' }}>{dateStr}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{timeStr}</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <span className={`clay-badge ${
                        order.status === 'completed' ? 'clay-badge-success' :
                        order.status === 'cancelled' ? 'clay-badge-danger' : 'clay-badge-info'
                      }`}>
                        {order.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination control row */}
      {pagination.totalPages > 1 && (
        <div style={paginationRowStyle}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Showing <strong>{ordersList.length}</strong> of <strong>{pagination.totalOrders}</strong> records
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

const filterCardStyle: React.CSSProperties = {
  padding: '16px 20px',
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '20px'
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

const paginationRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '8px'
};

const loaderContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '60vh'
};
