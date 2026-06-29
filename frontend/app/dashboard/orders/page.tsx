'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { getSocket } from '@/lib/socket';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { restaurant } = useAuth();

  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [resendingId, setResendingId] = useState<string>('');
  const [now, setNow] = useState(Date.now());

  // 1. Audio synthesiser order alert chime (double ping)
  const playOrderChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      gain1.gain.setValueAtTime(0.08, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.3);

      setTimeout(() => {
        if (ctx.state === 'closed') return;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, ctx.currentTime); // A5
        gain2.gain.setValueAtTime(0.08, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.4);
      }, 120);
    } catch (e) {
      console.warn('Synth alert audio failed:', e);
    }
  };

  // 2. Connect Socket.IO
  useEffect(() => {
    if (!restaurant?.id) return;
    const rId = restaurant.id;

    const socket = getSocket();
    socket.connect();
    socket.emit('join_restaurant_room', rId);

    socket.on('new_order', (newOrder: any) => {
      toast.success(
        '🛎️ New Table Order!',
        `Order ${newOrder.orderNumber} placed for Table ${newOrder.tableId?.tableNumber || 'N/A'}`
      );
      playOrderChime();
      queryClient.invalidateQueries({ queryKey: ['dashboard-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-order-analytics'] });
    });

    socket.on('order_updated', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-order-analytics'] });
    });

    return () => {
      socket.off('new_order');
      socket.off('order_updated');
      socket.disconnect();
    };
  }, [restaurant, queryClient, toast]);

  // 3. Second-based ticker for live priority queue calculations
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 4. Query: Fetch orders with pagination & status filters (polling removed, socket driven!)
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-orders', selectedStatus, page],
    queryFn: async () => {
      const statusParam = selectedStatus === 'all' ? '' : selectedStatus;
      const res = await api.get('/orders', {
        params: { status: statusParam, page, limit: 10 }
      });
      return res.data;
    }
  });

  // 5. Query: Fetch Live Order Analytics
  const { data: analytics } = useQuery({
    queryKey: ['dashboard-order-analytics'],
    queryFn: async () => {
      const res = await api.get('/orders/analytics');
      return res.data?.analytics;
    }
  });

  // 6. Mutation: Update Order Status
  const statusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const res = await api.put(`/orders/${orderId}/status`, { status });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Status Updated', `Order status set to ${data.order?.status}`);
        queryClient.invalidateQueries({ queryKey: ['dashboard-orders'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-order-analytics'] });
      }
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || 'Failed to update order status';
      toast.error('Update Failed', msg);
    }
  });

  // 7. Mutation: Update Order Priority
  const priorityMutation = useMutation({
    mutationFn: async ({ orderId, priority }: { orderId: string; priority: string }) => {
      const res = await api.put(`/orders/${orderId}/priority`, { priority });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Priority Updated', `Order set to ${data.order?.priority.toUpperCase()}`);
        queryClient.invalidateQueries({ queryKey: ['dashboard-orders'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-order-analytics'] });
      }
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || 'Failed to update priority';
      toast.error('Priority Failed', msg);
    }
  });

  // 8. Manual Notify Action (WhatsApp)
  const handleResendNotification = async (orderId: string) => {
    setResendingId(orderId);
    try {
      const res = await api.post(`/orders/${orderId}/notify`);
      if (res.data && res.data.success) {
        toast.success('Alert Dispatched', 'WhatsApp notification has been sent');
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Failed to send WhatsApp alert';
      toast.error('Alert Failed', msg);
    } finally {
      setResendingId('');
    }
  };

  const orders = data?.orders || [];
  const pagination = data?.pagination || { totalPages: 1, currentPage: 1 };

  // Status Filter configuration (including Ready)
  const statusTabs = [
    { label: 'All Orders', value: 'all', icon: '📋' },
    { label: 'Pending', value: 'pending', icon: '⏳' },
    { label: 'Confirmed', value: 'confirmed', icon: '✅' },
    { label: 'Preparing', value: 'preparing', icon: '🍳' },
    { label: 'Ready', value: 'ready', icon: '🔔' },
    { label: 'Completed', value: 'completed', icon: '🏁' },
    { label: 'Cancelled', value: 'cancelled', icon: '❌' }
  ];

  // Dynamic Priority Queue Sorting Helpers
  const getWeight = (order: any) => {
    const isCompletedOrCancelled = order.status === 'completed' || order.status === 'cancelled';
    if (isCompletedOrCancelled) return 0;

    const elapsedMins = Math.floor((now - new Date(order.createdAt).getTime()) / 60000);
    if (elapsedMins >= 20) return 4; // Delayed (highest)
    if (order.priority === 'rush') return 3;
    if (order.priority === 'vip') return 2;
    return 1; // Normal
  };

  const getEffectivePriorityName = (order: any) => {
    const elapsedMins = Math.floor((now - new Date(order.createdAt).getTime()) / 60000);
    if (order.status !== 'completed' && order.status !== 'cancelled' && elapsedMins >= 20) {
      return 'delayed';
    }
    return order.priority;
  };

  const sortedOrders = [...orders].sort((a: any, b: any) => {
    const weightA = getWeight(a);
    const weightB = getWeight(b);

    if (weightA !== weightB) {
      return weightB - weightA;
    }

    // Secondary sort: longest waiting (oldest createdAt first)
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'delayed':
        return <span className="clay-badge clay-badge-danger" style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>🔴 Delayed</span>;
      case 'rush':
        return <span className="clay-badge" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>🟠 Rush</span>;
      case 'vip':
        return <span className="clay-badge" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>🟡 VIP</span>;
      default:
        return <span className="clay-badge clay-badge-success" style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>🟢 Normal</span>;
    }
  };

  return (
    <div style={containerStyle}>
      {/* Title Header */}
      <div style={headerRowStyle}>
        <div>
          <h1 style={titleStyle}>Orders Manager</h1>
          <p style={subtitleStyle}>Real-time restaurant kitchen ticket dispatcher and priority queues.</p>
        </div>
      </div>

      {/* Real-Time Analytics Dashboard Panel */}
      {analytics && (
        <div style={statsGridStyle}>
          <div className="clay-card float-animation" style={statCardStyle}>
            <span style={{ fontSize: '1.2rem' }}>📦</span>
            <div>
              <span style={statLabelStyle}>Today's Orders</span>
              <strong style={statValueStyle}>{analytics.todayOrders}</strong>
            </div>
          </div>
          
          <div className="clay-card float-animation" style={{ ...statCardStyle, animationDelay: '0.05s' }}>
            <span style={{ fontSize: '1.2rem' }}>💰</span>
            <div>
              <span style={statLabelStyle}>Revenue Today</span>
              <strong style={statValueStyle}>₹{analytics.todayRevenue.toFixed(0)}</strong>
            </div>
          </div>

          <div className="clay-card float-animation" style={{ ...statCardStyle, animationDelay: '0.1s' }}>
            <span style={{ fontSize: '1.2rem' }}>🍳</span>
            <div>
              <span style={statLabelStyle}>Cooking</span>
              <strong style={statValueStyle}>{analytics.preparingOrders}</strong>
            </div>
          </div>

          <div className="clay-card float-animation" style={{ ...statCardStyle, animationDelay: '0.15s' }}>
            <span style={{ fontSize: '1.2rem' }}>🔔</span>
            <div>
              <span style={statLabelStyle}>Ready</span>
              <strong style={statValueStyle}>{analytics.readyOrders}</strong>
            </div>
          </div>

          <div className="clay-card float-animation" style={{ ...statCardStyle, animationDelay: '0.2s' }}>
            <span style={{ fontSize: '1.2rem' }}>🏁</span>
            <div>
              <span style={statLabelStyle}>Completed</span>
              <strong style={statValueStyle}>{analytics.completedOrders}</strong>
            </div>
          </div>

          <div className="clay-card float-animation" style={{ ...statCardStyle, animationDelay: '0.25s' }}>
            <span style={{ fontSize: '1.2rem' }}>⏱️</span>
            <div>
              <span style={statLabelStyle}>Avg Prep</span>
              <strong style={statValueStyle}>{analytics.averagePrepTime}m</strong>
            </div>
          </div>

          <div className="clay-card float-animation" style={{ ...statCardStyle, animationDelay: '0.3s' }}>
            <span style={{ fontSize: '1.2rem' }}>🚨</span>
            <div>
              <span style={statLabelStyle}>Max Wait</span>
              <strong style={{ ...statValueStyle, color: analytics.longestWaiting >= 20 ? '#ef4444' : 'var(--text-primary)' }}>
                {analytics.longestWaiting}m
              </strong>
            </div>
          </div>

          <div className="clay-card float-animation" style={{ ...statCardStyle, animationDelay: '0.35s' }}>
            <span style={{ fontSize: '1.2rem' }}>🪑</span>
            <div>
              <span style={statLabelStyle}>Active Tables</span>
              <strong style={statValueStyle}>{analytics.activeTables}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Tabs list */}
      <div style={tabsWrapperStyle} className="clay-card">
        {statusTabs.map((tab) => {
          const isActive = selectedStatus === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => {
                setSelectedStatus(tab.value);
                setPage(1);
              }}
              style={isActive ? activeTabStyle : tabStyle}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Orders grid */}
      {isLoading ? (
        <div style={ordersListStyle}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="clay-card pulse-glow-indicator" style={skeletonCardStyle}></div>
          ))}
        </div>
      ) : sortedOrders.length === 0 ? (
        <div className="clay-card" style={emptyStateCardStyle}>
          <span style={{ fontSize: '3rem' }}>🛎️</span>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '12px' }}>No Orders Found</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            There are currently no {selectedStatus !== 'all' ? selectedStatus : ''} orders recorded.
          </p>
        </div>
      ) : (
        <div style={ordersListStyle}>
          {sortedOrders.map((order: any) => {
            const timeStr = new Date(order.createdAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
            const dateStr = new Date(order.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            });

            // Live Timer Calculations
            const elapsedMins = Math.floor((now - new Date(order.createdAt).getTime()) / 60000);
            const elapsedSecs = Math.floor((now - new Date(order.createdAt).getTime()) / 1000) % 60;
            const timeFormatted = `${elapsedMins.toString().padStart(2, '0')}:${elapsedSecs.toString().padStart(2, '0')}`;
            
            let timerColor = '#22c55e'; // Green
            let isOverdue = false;
            if (elapsedMins >= 20) {
              timerColor = '#ef4444'; // Red
              isOverdue = true;
            } else if (elapsedMins >= 10) {
              timerColor = '#eab308'; // Yellow
            }

            const effectivePriority = getEffectivePriorityName(order);

            return (
              <div key={order._id} className="clay-card float-animation" style={{
                ...orderCardStyle,
                border: isOverdue && order.status !== 'completed' && order.status !== 'cancelled'
                  ? '1px solid rgba(239, 68, 68, 0.4)'
                  : '1px solid var(--border-color)',
                boxShadow: isOverdue && order.status !== 'completed' && order.status !== 'cancelled'
                  ? '0 0 15px rgba(239, 68, 68, 0.15)'
                  : undefined
              }}>
                
                {/* Card header */}
                <div style={orderHeaderStyle}>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <strong style={{ fontSize: '1.1rem', fontFamily: 'var(--font-heading)' }}>
                        {order.orderNumber}
                      </strong>
                      <span style={getTableBadgeStyle(order.tableId?.tableNumber)}>
                        Table {order.tableId?.tableNumber || 'N/A'}
                      </span>
                      {getPriorityBadge(effectivePriority)}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {dateStr} at {timeStr}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {order.status !== 'completed' && order.status !== 'cancelled' && (
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: timerColor,
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          border: `1px solid ${timerColor}22`,
                          animation: isOverdue ? 'pulse 2s infinite' : 'none'
                        }}
                      >
                        ⏱️ {timeFormatted}
                      </span>
                    )}
                    <span style={getStatusBadgeStyle(order.status)}>
                      {order.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Card Customer Details */}
                <div style={customerInfoRowStyle}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Customer</span>
                    <strong style={{ fontSize: '0.85rem' }}>{order.customerName}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Contact Phone</span>
                    <strong style={{ fontSize: '0.85rem' }}>{order.customerPhone}</strong>
                  </div>
                </div>

                {/* Items breakdown list */}
                <div style={itemsContainerStyle}>
                  <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    Items Ordered
                  </strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {order.items.map((item: any, idx: number) => (
                      <div key={idx} style={itemRowStyle}>
                        <span>
                          {item.menuItemId?.name || 'Menu Item'} 
                          <strong style={{ color: 'var(--accent-color)', marginLeft: '6px' }}>x{item.quantity}</strong>
                        </span>
                        <span>₹{item.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  
                  {order.notes && (
                    <div style={notesAlertStyle}>
                      💬 <strong>Kitchen instruction:</strong> {order.notes}
                    </div>
                  )}

                  <div style={totalRowStyle}>
                    <span>Grand Total</span>
                    <strong>₹{order.grandTotal.toFixed(2)}</strong>
                  </div>
                </div>

                {/* Actions row */}
                <div style={actionsRowStyle}>
                  <button
                    onClick={() => handleResendNotification(order._id)}
                    disabled={resendingId === order._id}
                    className="clay-btn clay-btn-secondary"
                    style={{ flexGrow: 1, padding: '8px 12px', fontSize: '0.825rem' }}
                  >
                    {resendingId === order._id ? 'Sending...' : '📲 Send WhatsApp'}
                  </button>

                  <div style={{ display: 'flex', gap: '8px', flexGrow: 2 }}>
                    {order.status === 'pending' && (
                      <button
                        onClick={() => statusMutation.mutate({ orderId: order._id, status: 'confirmed' })}
                        className="clay-btn clay-btn-primary"
                        style={{ width: '100%', padding: '8px 12px', fontSize: '0.825rem' }}
                      >
                        Confirm Order ✅
                      </button>
                    )}

                    {order.status === 'confirmed' && (
                      <button
                        onClick={() => statusMutation.mutate({ orderId: order._id, status: 'preparing' })}
                        className="clay-btn clay-btn-primary"
                        style={{ width: '100%', padding: '8px 12px', fontSize: '0.825rem', backgroundColor: '#a855f7' }}
                      >
                        Start Cooking 🍳
                      </button>
                    )}

                    {order.status === 'preparing' && (
                      <button
                        onClick={() => statusMutation.mutate({ orderId: order._id, status: 'ready' })}
                        className="clay-btn clay-btn-primary"
                        style={{ width: '100%', padding: '8px 12px', fontSize: '0.825rem', backgroundColor: '#eab308' }}
                      >
                        Mark Ready 🔔
                      </button>
                    )}

                    {order.status === 'ready' && (
                      <button
                        onClick={() => statusMutation.mutate({ orderId: order._id, status: 'completed' })}
                        className="clay-btn clay-btn-primary"
                        style={{ width: '100%', padding: '8px 12px', fontSize: '0.825rem', backgroundColor: '#22c55e' }}
                      >
                        Serve / Complete 🏁
                      </button>
                    )}

                    {order.status !== 'completed' && order.status !== 'cancelled' && (
                      <button
                        onClick={() => statusMutation.mutate({ orderId: order._id, status: 'cancelled' })}
                        className="clay-btn clay-btn-danger"
                        style={{ padding: '8px 12px', fontSize: '0.825rem' }}
                      >
                        Cancel ❌
                      </button>
                    )}
                  </div>
                </div>

                {/* Priority toggle buttons */}
                {order.status !== 'completed' && order.status !== 'cancelled' && (
                  <div style={{ display: 'flex', gap: '6px', width: '100%', borderTop: '1px dashed var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
                    <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', marginRight: '6px' }}>Queue Priority:</span>
                    <button
                      onClick={() => priorityMutation.mutate({ orderId: order._id, priority: 'normal' })}
                      className={`clay-btn ${order.priority === 'normal' ? 'clay-btn-primary' : 'clay-btn-secondary'}`}
                      style={{ padding: '4px 8px', fontSize: '0.7rem', flexGrow: 1 }}
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => priorityMutation.mutate({ orderId: order._id, priority: 'vip' })}
                      className={`clay-btn ${order.priority === 'vip' ? 'clay-btn-primary' : 'clay-btn-secondary'}`}
                      style={{ padding: '4px 8px', fontSize: '0.7rem', flexGrow: 1, color: order.priority === 'vip' ? '#eab308' : undefined }}
                    >
                      VIP 🟡
                    </button>
                    <button
                      onClick={() => priorityMutation.mutate({ orderId: order._id, priority: 'rush' })}
                      className={`clay-btn ${order.priority === 'rush' ? 'clay-btn-primary' : 'clay-btn-secondary'}`}
                      style={{ padding: '4px 8px', fontSize: '0.7rem', flexGrow: 1, color: order.priority === 'rush' ? '#f97316' : undefined }}
                    >
                      Rush 🟠
                    </button>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* Pagination controls */}
      {pagination.totalPages > 1 && (
        <div style={paginationRowStyle}>
          <button
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page === 1}
            className="clay-btn clay-btn-secondary"
            style={{ padding: '8px 16px' }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Page <strong>{pagination.currentPage}</strong> of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((prev) => Math.min(prev + 1, pagination.totalPages))}
            disabled={page === pagination.totalPages}
            className="clay-btn clay-btn-secondary"
            style={{ padding: '8px 16px' }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// Inline styling helpers
const getStatusBadgeStyle = (status: OrderStatus): React.CSSProperties => {
  let bgColor = 'rgba(234, 179, 8, 0.1)';
  let color = 'rgb(234, 179, 8)';
  let border = '1px solid rgba(234, 179, 8, 0.2)';

  if (status === 'confirmed') {
    bgColor = 'rgba(59, 130, 246, 0.1)';
    color = 'rgb(59, 130, 246)';
    border = '1px solid rgba(59, 130, 246, 0.2)';
  } else if (status === 'preparing') {
    bgColor = 'rgba(168, 85, 247, 0.1)';
    color = 'rgb(168, 85, 247)';
    border = '1px solid rgba(168, 85, 247, 0.2)';
  } else if (status === 'completed') {
    bgColor = 'rgba(34, 197, 94, 0.1)';
    color = 'rgb(34, 197, 94)';
    border = '1px solid rgba(34, 197, 94, 0.2)';
  } else if (status === 'cancelled') {
    bgColor = 'rgba(239, 68, 68, 0.1)';
    color = 'rgb(239, 68, 68)';
    border = '1px solid rgba(239, 68, 68, 0.2)';
  }

  return {
    padding: '4px 10px',
    borderRadius: '8px',
    fontSize: '0.725rem',
    fontWeight: 700,
    backgroundColor: bgColor,
    color,
    border
  };
};

const getTableBadgeStyle = (num: string): React.CSSProperties => {
  return {
    padding: '2px 8px',
    borderRadius: '6px',
    fontSize: '0.7rem',
    fontWeight: 600,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-secondary)'
  };
};

// Layout configurations
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
  width: '100%'
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '1.75rem',
  fontWeight: 800,
  letterSpacing: '-0.02em',
  color: 'var(--text-primary)'
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--text-secondary)',
  marginTop: '4px'
};

const tabsWrapperStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  padding: '8px',
  overflowX: 'auto',
  border: '1px solid var(--border-color)',
  borderRadius: '16px',
  backgroundColor: 'rgba(10, 10, 11, 0.2)'
};

const tabStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 16px',
  borderRadius: '12px',
  border: 'none',
  backgroundColor: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  transition: 'var(--transition-clay)'
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  backgroundColor: 'var(--surface-bg)',
  boxShadow: 'var(--clay-input-shadow)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-primary)'
};

const ordersListStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
  gap: '20px'
};

const skeletonCardStyle: React.CSSProperties = {
  height: '340px',
  borderRadius: '24px',
  backgroundColor: 'rgba(255, 255, 255, 0.01)',
  border: '1px solid var(--border-color)'
};

const emptyStateCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 24px',
  textAlign: 'center',
  border: '1px solid var(--border-color)',
  borderRadius: '24px'
};

const orderCardStyle: React.CSSProperties = {
  border: '1px solid var(--border-color)',
  borderRadius: '24px',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  backgroundColor: 'var(--card-bg)'
};

const orderHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: '14px'
};

const customerInfoRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
  padding: '12px 16px',
  backgroundColor: 'rgba(10, 10, 11, 0.2)',
  border: '1px solid var(--border-color)',
  borderRadius: '16px'
};

const itemsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  flexGrow: 1
};

const itemRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '0.875rem'
};

const notesAlertStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '10px',
  backgroundColor: 'rgba(234, 179, 8, 0.05)',
  border: '1px solid rgba(234, 179, 8, 0.15)',
  color: 'var(--text-secondary)',
  fontSize: '0.8rem',
  marginTop: '6px'
};

const totalRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderTop: '1px solid var(--border-color)',
  paddingTop: '14px',
  marginTop: '8px',
  fontSize: '0.95rem',
  fontWeight: 700
};

const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  marginTop: '6px',
  borderTop: '1px solid var(--border-color)',
  paddingTop: '16px'
};

const paginationRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '12px'
};

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '16px',
  width: '100%',
  marginBottom: '20px'
};

const statCardStyle: React.CSSProperties = {
  padding: '16px 20px',
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '16px'
};

const statLabelStyle: React.CSSProperties = {
  fontSize: '0.725rem',
  color: 'var(--text-muted)',
  display: 'block'
};

const statValueStyle: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 800,
  fontFamily: 'var(--font-heading)',
  marginTop: '2px',
  display: 'block'
};
