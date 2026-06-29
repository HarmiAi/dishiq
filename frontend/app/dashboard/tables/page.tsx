'use strict';
'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '@/lib/api';
import { useToast } from '@/hooks/useToast';

const tableSchema = z.object({
  tableNumber: z.string().min(1, 'Table number is required'),
  capacity: z.number().min(1, 'Capacity must be at least 1')
});

type TableFormValues = z.infer<typeof tableSchema>;

export default function TablesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any | null>(null);
  const [deletingTable, setDeletingTable] = useState<any | null>(null);
  const [selectedQrTable, setSelectedQrTable] = useState<any | null>(null);

  // Query: Fetch tables
  const { data: tables = [], isLoading, isError } = useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      const res = await api.get('/tables');
      return res.data?.tables || [];
    }
  });

  // Form setup
  const {
    register: registerField,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<TableFormValues>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      tableNumber: '',
      capacity: 2
    }
  });

  const handleAddTableClick = () => {
    setEditingTable(null);
    reset({ tableNumber: '', capacity: 2 });
    setIsFormOpen(true);
  };

  const handleEditClick = (table: any) => {
    setEditingTable(table);
    reset({
      tableNumber: table.tableNumber,
      capacity: table.capacity
    });
    setIsFormOpen(true);
  };

  // Mutate: Save table (Create / Update)
  const handleSaveTable = async (values: TableFormValues) => {
    try {
      if (editingTable) {
        await api.put(`/tables/${editingTable._id}`, values);
        toast.success('Table updated', `Table ${values.tableNumber} settings updated.`);
      } else {
        await api.post('/tables', values);
        toast.success('Table added', `Table ${values.tableNumber} has been added.`);
      }
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      setIsFormOpen(false);
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Failed to save table.';
      toast.error('Save failed', msg);
    }
  };

  // Mutate: Toggle status
  const handleToggleStatus = async (table: any) => {
    const nextStatusMap: Record<string, string> = {
      vacant: 'occupied',
      occupied: 'ordered',
      ordered: 'vacant'
    };
    const nextStatus = nextStatusMap[table.status] || 'vacant';
    
    try {
      await api.put(`/tables/${table._id}`, { status: nextStatus });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast.info(`Table status updated`, `Table ${table.tableNumber} is now ${nextStatus}.`);
    } catch (error) {
      toast.error('Update failed', 'Could not toggle table status.');
    }
  };

  // Mutate: Delete table
  const handleDeleteTable = async () => {
    if (!deletingTable) return;
    try {
      await api.delete(`/tables/${deletingTable._id}`);
      toast.success('Table deleted', `Table ${deletingTable.tableNumber} removed.`);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      setDeletingTable(null);
    } catch (error) {
      toast.error('Delete failed', 'Could not delete table.');
    }
  };

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div style={skeletonTitleStyle}></div>
        </div>
        <div style={gridStyle}>
          <div className="clay-card" style={skeletonCardStyle}></div>
          <div className="clay-card" style={skeletonCardStyle}></div>
          <div className="clay-card" style={skeletonCardStyle}></div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Tables & QR Codes</h1>
          <p style={subtitleStyle}>Manage restaurant dining tables and download QR ordering placards.</p>
        </div>
        <button onClick={handleAddTableClick} className="clay-btn clay-btn-primary">
          ➕ Add Table
        </button>
      </div>

      {isError && (
        <div className="clay-card" style={{ textAlign: 'center', padding: '40px' }}>
          <span>⚠️</span>
          <h3 style={{ marginTop: '12px' }}>Failed to Load Tables</h3>
        </div>
      )}

      {/* Tables Grid */}
      {tables.length === 0 ? (
        <div style={emptyStateStyle}>
          <span style={{ fontSize: '3rem' }}>🪑</span>
          <h3>No tables registered</h3>
          <p style={{ color: 'var(--text-secondary)', margin: '8px 0 24px', maxWidth: '360px' }}>
            Register your dining tables. Dishiq automatically generates scannable QR tags for contactless customer orders.
          </p>
          <button onClick={handleAddTableClick} className="clay-btn clay-btn-primary">
            Add First Table
          </button>
        </div>
      ) : (
        <div style={gridStyle}>
          {tables.map((table: any, index: number) => {
            const statusLabelMap = {
              vacant: { label: 'Vacant', color: 'var(--color-success)', badge: 'clay-badge-success' },
              occupied: { label: 'Occupied', color: 'var(--color-warning)', badge: 'clay-badge-warning' },
              ordered: { label: 'Ordered', color: 'var(--accent-color)', badge: 'clay-badge-info' }
            };
            const currentStatus = statusLabelMap[table.status as 'vacant' | 'occupied' | 'ordered'] || statusLabelMap.vacant;

            return (
              <div
                key={table._id}
                className="clay-card clay-card-interactive float-animation"
                style={{ ...cardStyle, animationDelay: `${index * 0.1}s` }}
              >
                {/* Card Header status */}
                <div style={cardHeaderRowStyle}>
                  <div style={{ display: 'flex', alignItems: 'center' }} onClick={() => handleToggleStatus(table)}>
                    <span
                      className="pulse-glow-indicator"
                      style={{ color: currentStatus.color, marginRight: '8px', cursor: 'pointer' }}
                    ></span>
                    <span style={statusTextStyle}>{currentStatus.label}</span>
                  </div>
                  <button onClick={() => setSelectedQrTable(table)} style={qrThumbBtnStyle} title="View Printable QR Code">
                    🖨️ QR Code
                  </button>
                </div>

                {/* Seating Layout visual */}
                <div style={tableVisualContainerStyle}>
                  <div style={tableVisualStyle}>
                    <span style={tableNumLabelStyle}>{table.tableNumber}</span>
                  </div>
                  {/* Chairs visuals */}
                  {Array.from({ length: Math.min(table.capacity, 6) }).map((_, chairIdx) => (
                    <div
                      key={chairIdx}
                      style={{
                        ...chairStyle,
                        ...getChairCoordinates(chairIdx, Math.min(table.capacity, 6))
                      }}
                    ></div>
                  ))}
                </div>

                <div style={cardBodyStyle}>
                  <strong style={{ fontSize: '1rem', display: 'block', marginBottom: '4px' }}>Table {table.tableNumber}</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Capacity: {table.capacity} Seaters</span>
                </div>

                {/* Footer action buttons */}
                <div style={cardFooterStyle}>
                  <button onClick={() => handleEditClick(table)} className="clay-btn clay-btn-secondary" style={actionBtnStyle}>
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => setDeletingTable(table)}
                    className="clay-btn clay-btn-secondary"
                    style={{ ...actionBtnStyle, color: 'var(--color-danger)' }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Add/Edit Table */}
      {isFormOpen && (
        <div style={modalBackdropStyle}>
          <div className="clay-card float-animation" style={modalContentStyle}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: '1.25rem' }}>{editingTable ? 'Edit Table' : 'Add New Table'}</h2>
              <button onClick={() => setIsFormOpen(false)} style={closeModalBtnStyle}>&times;</button>
            </div>

            <form onSubmit={handleSubmit(handleSaveTable)}>
              <div style={modalBodyStyle}>
                <div className="form-group">
                  <label className="form-label">Table Name / Number</label>
                  <input
                    type="text"
                    placeholder="e.g. Table 1, T-4, Terrace-3"
                    className="clay-input"
                    {...registerField('tableNumber')}
                  />
                  {errors.tableNumber && <span className="form-error">{errors.tableNumber.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Seating Capacity</label>
                  <input
                    type="number"
                    className="clay-input"
                    {...registerField('capacity', { valueAsNumber: true })}
                  />
                  {errors.capacity && <span className="form-error">{errors.capacity.message}</span>}
                </div>
              </div>

              <div style={modalFooterStyle}>
                <button type="button" onClick={() => setIsFormOpen(false)} className="clay-btn clay-btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="clay-btn clay-btn-primary">
                  Save Table 🪑
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: View Printable QR */}
      {selectedQrTable && (
        <div style={modalBackdropStyle}>
          <div className="clay-card float-animation" style={{ ...modalContentStyle, maxWidth: '420px', textAlign: 'center', padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.15rem' }}>Print QR Tag</h3>
              <button onClick={() => setSelectedQrTable(null)} style={closeModalBtnStyle}>&times;</button>
            </div>
            
            <div style={qrWrapperStyle} className="clay-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedQrTable.qrCodeUrl} alt="Table QR Link" style={qrImageStyle} />
              <div style={{ marginTop: '16px' }}>
                <strong style={{ fontSize: '1.25rem', display: 'block', color: 'var(--text-primary)' }}>
                  TABLE {selectedQrTable.tableNumber}
                </strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Scan to Place Orders</span>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '16px 0 24px', lineHeight: 1.4 }}>
              Place this printed code on Table {selectedQrTable.tableNumber}. Customers can instantly scan it using their phone cameras.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setSelectedQrTable(null)} className="clay-btn clay-btn-secondary" style={{ flexGrow: 1 }}>
                Close
              </button>
              <a
                href={selectedQrTable.qrCodeUrl}
                download={`table-${selectedQrTable.tableNumber}-qr.png`}
                target="_blank"
                rel="noopener noreferrer"
                className="clay-btn clay-btn-primary"
                style={{ flexGrow: 1, textDecoration: 'none' }}
              >
                Print 🖨️
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Delete Confirm */}
      {deletingTable && (
        <div style={modalBackdropStyle}>
          <div className="clay-card float-animation" style={{ ...modalContentStyle, maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
            <span style={{ fontSize: '3rem' }}>⚠️</span>
            <h2 style={{ fontSize: '1.25rem', margin: '16px 0 8px' }}>Delete Table</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>Table {deletingTable.tableNumber}</strong>? Contactless ordering at this table will stop.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setDeletingTable(null)} className="clay-btn clay-btn-secondary" style={{ flexGrow: 1 }}>
                Cancel
              </button>
              <button onClick={handleDeleteTable} className="clay-btn clay-btn-danger" style={{ flexGrow: 1 }}>
                Delete 🗑️
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Visual layout chairs calculator helper
function getChairCoordinates(index: number, total: number) {
  // Circular layout coordinates for chairs surrounding the table
  const angle = (index * (360 / total) * Math.PI) / 180;
  const radius = 54; // distance from center of table
  const x = Math.round(54 + radius * Math.cos(angle)) - 8; // offset chair size
  const y = Math.round(54 + radius * Math.sin(angle)) - 8;
  return { left: `${x}px`, top: `${y}px` };
}

// Styling definitions
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
  animation: 'fadeIn 0.4s ease'
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const titleStyle: React.CSSProperties = {
  fontSize: '2rem',
  fontWeight: 800,
  letterSpacing: '-0.03em'
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  color: 'var(--text-secondary)',
  lineHeight: 1.5
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: '24px'
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '24px',
  border: '1px solid rgba(255, 255, 255, 0.04)'
};

const cardHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const statusTextStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontFamily: 'var(--font-heading)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const qrThumbBtnStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: '8px',
  color: 'var(--accent-color)',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  padding: '4px 10px',
  boxShadow: 'var(--clay-btn-shadow)'
};

const tableVisualContainerStyle: React.CSSProperties = {
  width: '124px',
  height: '124px',
  position: 'relative',
  margin: '12px auto',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
};

const tableVisualStyle: React.CSSProperties = {
  width: '76px',
  height: '76px',
  borderRadius: '50%',
  backgroundColor: 'var(--surface-bg)',
  border: '4px solid var(--border-color)',
  boxShadow: '8px 8px 16px rgba(0, 0, 0, 0.4), inset -3px -3px 8px rgba(0,0,0,0.3), inset 3px 3px 8px rgba(255,255,255,0.05)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 10
};

const tableNumLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '1.25rem',
  fontWeight: 800,
  color: 'var(--text-primary)'
};

const chairStyle: React.CSSProperties = {
  width: '18px',
  height: '18px',
  borderRadius: '4px',
  backgroundColor: 'var(--primary-color)',
  boxShadow: 'var(--clay-btn-shadow)',
  border: '1px solid rgba(255,255,255,0.1)',
  position: 'absolute',
  zIndex: 1
};

const cardBodyStyle: React.CSSProperties = {
  textAlign: 'center'
};

const cardFooterStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  marginTop: '4px'
};

const actionBtnStyle: React.CSSProperties = {
  flexGrow: 1,
  padding: '8px 12px',
  fontSize: '0.8rem',
  borderRadius: '10px'
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '80px 40px',
  textAlign: 'center'
};

// Modal styles
const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.75)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 9999,
  padding: '20px'
};

const modalContentStyle: React.CSSProperties = {
  maxWidth: '480px',
  width: '100%',
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  boxShadow: '20px 30px 60px rgba(0,0,0,0.7)',
  padding: 0,
  borderRadius: '24px',
  overflow: 'hidden'
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '20px 24px',
  borderBottom: '1px solid var(--border-color)'
};

const closeModalBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  fontSize: '1.8rem',
  cursor: 'pointer'
};

const modalBodyStyle: React.CSSProperties = {
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px'
};

const modalFooterStyle: React.CSSProperties = {
  padding: '16px 24px',
  borderTop: '1px solid var(--border-color)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  backgroundColor: 'rgba(255,255,255,0.01)'
};

const qrWrapperStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.02)',
  padding: '24px',
  border: '1px solid var(--border-color)',
  display: 'inline-block',
  margin: '12px auto'
};

const qrImageStyle: React.CSSProperties = {
  width: '180px',
  height: '180px',
  backgroundColor: '#fff',
  padding: '8px',
  borderRadius: '12px',
  display: 'block',
  boxShadow: '8px 8px 16px rgba(0,0,0,0.3)'
};

// Skeletons
const skeletonTitleStyle: React.CSSProperties = {
  width: '200px',
  height: '32px',
  backgroundColor: 'var(--surface-bg)',
  borderRadius: '8px'
};

const skeletonCardStyle: React.CSSProperties = {
  height: '240px',
  backgroundColor: 'var(--surface-bg)',
  border: '1px solid rgba(255,255,255,0.03)'
};
