'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { getSocket } from '@/lib/socket';
import Link from 'next/link';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export default function KitchenPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { restaurant } = useAuth();

  const [now, setNow] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 1. Audio synthesiser order alert chime (double chime)
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
      console.warn('Kitchen synth audio failed:', e);
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
        'New Ticket Received 🍳',
        `Ticket ${newOrder.token} for Table ${newOrder.tableId?.tableNumber || 'N/A'}`
      );
      playOrderChime();
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
    });

    socket.on('order_updated', () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
    });

    return () => {
      socket.off('new_order');
      socket.off('order_updated');
      socket.disconnect();
    };
  }, [restaurant, queryClient, toast]);

  // 3. Update the live timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 4. Fetch orders for kitchen view (fetch recent 50 orders without page restrictions)
  const { data, isLoading } = useQuery({
    queryKey: ['kitchen-orders'],
    queryFn: async () => {
      const res = await api.get('/orders', {
        params: { limit: 50 }
      });
      return res.data;
    }
  });

  // 5. Status Mutation
  const statusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const res = await api.put(`/orders/${orderId}/status`, { status });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
      }
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || 'Failed to update order status';
      toast.error('Update Failed', msg);
    }
  });

  // Fullscreen helper toggler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const rawOrders = data?.orders || [];

  // Filter for only active orders (Pending, Confirmed, Preparing, Ready)
  const activeOrders = rawOrders.filter(
    (o: any) => o.status === 'pending' || o.status === 'confirmed' || o.status === 'preparing' || o.status === 'ready'
  );

  // Dynamic queue prioritization sorting
  const getWeight = (order: any) => {
    const elapsedMins = Math.floor((now - new Date(order.createdAt).getTime()) / 60000);
    if (elapsedMins >= 20) return 4; // Delayed (highest priority)
    if (order.priority === 'rush') return 3;
    if (order.priority === 'vip') return 2;
    return 1; // Normal
  };

  const getEffectivePriorityName = (order: any) => {
    const elapsedMins = Math.floor((now - new Date(order.createdAt).getTime()) / 60000);
    if (elapsedMins >= 20) return 'delayed';
    return order.priority;
  };

  const sortedOrders = [...activeOrders].sort((a: any, b: any) => {
    const weightA = getWeight(a);
    const weightB = getWeight(b);

    if (weightA !== weightB) {
      return weightB - weightA;
    }

    // Secondary: oldest first
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const getPriorityLabel = (p: string) => {
    switch (p) {
      case 'delayed':
        return <span style={{ color: '#ef4444', fontWeight: 800 }}>🔴 OVERDUE</span>;
      case 'rush':
        return <span style={{ color: '#f97316', fontWeight: 800 }}>🟠 RUSH</span>;
      case 'vip':
        return <span style={{ color: '#eab308', fontWeight: 800 }}>🟡 VIP</span>;
      default:
        return <span style={{ color: '#22c55e', fontWeight: 700 }}>🟢 NORMAL</span>;
    }
  };

  const getActionButton = (order: any) => {
    const status = order.status;
    const orderId = order._id;

    switch (status) {
      case 'pending':
        return (
          <button
            onClick={() => statusMutation.mutate({ orderId, status: 'confirmed' })}
            style={confirmBtnStyle}
          >
            Confirm Ticket 👍
          </button>
        );
      case 'confirmed':
        return (
          <button
            onClick={() => statusMutation.mutate({ orderId, status: 'preparing' })}
            style={prepareBtnStyle}
          >
            Start Cooking 🍳
          </button>
        );
      case 'preparing':
        return (
          <button
            onClick={() => statusMutation.mutate({ orderId, status: 'ready' })}
            style={readyBtnStyle}
          >
            Food Ready 🔔
          </button>
        );
      case 'ready':
        return (
          <button
            onClick={() => statusMutation.mutate({ orderId, status: 'completed' })}
            style={completeBtnStyle}
          >
            Serve & Close 🏁
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div style={isFullscreen ? fullscreenWrapperStyle : wrapperStyle}>
      {/* Header bar */}
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Kitchen Operations Display</h1>
          <p style={subtitleStyle}>Active Tickets: {activeOrders.length} orders live</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={toggleFullscreen} style={controlBtnStyle}>
            {isFullscreen ? 'Exit TV Mode 📴' : 'TV Monitor Mode 🖥️'}
          </button>
          <Link href="/dashboard/orders" style={controlBtnStyle}>
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Grid displaying active KDS cards */}
      {isLoading ? (
        <div style={gridStyle}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="clay-card pulse-glow-indicator" style={skeletonCardStyle}></div>
          ))}
        </div>
      ) : sortedOrders.length === 0 ? (
        <div className="clay-card" style={emptyStateStyle}>
          <span style={{ fontSize: '4rem' }}>🍳</span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '16px' }}>Kitchen is Clear</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            No pending or active orders to cook. Good job!
          </p>
        </div>
      ) : (
        <div style={gridStyle}>
          {sortedOrders.map((order: any) => {
            const elapsedMins = Math.floor((now - new Date(order.createdAt).getTime()) / 60000);
            const elapsedSecs = Math.floor((now - new Date(order.createdAt).getTime()) / 1000) % 60;
            const timeFormatted = `${elapsedMins.toString().padStart(2, '0')}:${elapsedSecs.toString().padStart(2, '0')}`;

            let cardBorder = '1px solid var(--border-color)';
            let cardBg = 'rgba(20, 20, 22, 0.9)';
            let isOverdue = false;

            if (elapsedMins >= 20) {
              cardBorder = '2px solid rgba(239, 68, 68, 0.6)';
              cardBg = 'rgba(239, 68, 68, 0.04)';
              isOverdue = true;
            } else if (elapsedMins >= 10) {
              cardBorder = '1.5px solid rgba(234, 179, 8, 0.4)';
              cardBg = 'rgba(234, 179, 8, 0.02)';
            }

            const effPriority = getEffectivePriorityName(order);

            return (
              <div
                key={order._id}
                className="clay-card"
                style={{
                  ...cardStyle,
                  border: cardBorder,
                  backgroundColor: cardBg,
                  animation: isOverdue ? 'pulse 2.5s infinite' : 'none'
                }}
              >
                {/* Header */}
                <div style={cardHeaderStyle}>
                  <div>
                    <h2 style={tokenStyle}>{order.token}</h2>
                    <span style={tableStyleText}>Table {order.tableId?.tableNumber || 'N/A'}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem' }}>{getPriorityLabel(effPriority)}</div>
                    <strong style={{ fontSize: '1.25rem', color: isOverdue ? '#ef4444' : 'var(--text-primary)', display: 'block', marginTop: '4px' }}>
                      ⏱️ {timeFormatted}
                    </strong>
                  </div>
                </div>

                {/* Body details */}
                <div style={cardBodyStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {order.items.map((item: any, idx: number) => (
                      <div key={idx} style={itemRowStyle}>
                        <div style={quantityBulletStyle}>{item.quantity}x</div>
                        <span style={itemNameStyle}>{item.menuItemId?.name || 'Item'}</span>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <div style={notesStyle}>
                      🗣️ <strong>Notes:</strong> {order.notes}
                    </div>
                  )}
                </div>

                {/* Footer buttons */}
                <div style={cardFooterStyle}>
                  {getActionButton(order)}
                  <button
                    onClick={() => statusMutation.mutate({ orderId: order._id, status: 'cancelled' })}
                    style={rejectBtnStyle}
                  >
                    Cancel ❌
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Styling definitions
const wrapperStyle: React.CSSProperties = {
  padding: '24px 32px 80px',
  backgroundColor: 'var(--bg-color)',
  minHeight: '100vh',
  color: 'var(--text-primary)'
};

const fullscreenWrapperStyle: React.CSSProperties = {
  padding: '32px',
  backgroundColor: '#0a0a0c',
  minHeight: '100vh',
  color: '#ffffff',
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 99999,
  overflowY: 'auto'
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: '20px',
  marginBottom: '32px'
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '1.75rem',
  fontWeight: 900,
  letterSpacing: '-0.03em'
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: 'var(--text-secondary)',
  marginTop: '4px'
};

const controlBtnStyle: React.CSSProperties = {
  padding: '12px 20px',
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 700,
  transition: 'all 0.2s ease',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center'
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '24px',
  alignItems: 'start'
};

const skeletonCardStyle: React.CSSProperties = {
  height: '240px',
  borderRadius: '20px',
  backgroundColor: 'var(--card-bg)'
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '100px 32px',
  maxWidth: '400px',
  margin: '0 auto'
};

const cardStyle: React.CSSProperties = {
  borderRadius: '20px',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: 'var(--clay-card-shadow)',
  overflow: 'hidden',
  minHeight: '260px'
};

const cardHeaderStyle: React.CSSProperties = {
  padding: '20px 24px',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  backgroundColor: 'rgba(0, 0, 0, 0.15)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start'
};

const tokenStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '1.8rem',
  fontWeight: 900,
  letterSpacing: '-0.02em',
  color: 'var(--accent-color)',
  lineHeight: 1
};

const tableStyleText: React.CSSProperties = {
  fontSize: '0.9rem',
  color: 'var(--text-secondary)',
  display: 'block',
  marginTop: '4px',
  fontWeight: 600
};

const cardBodyStyle: React.CSSProperties = {
  padding: '24px',
  flexGrow: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '16px'
};

const itemRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px'
};

const quantityBulletStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: '8px',
  backgroundColor: 'rgba(99, 102, 241, 0.15)',
  color: 'var(--primary-color)',
  fontWeight: 800,
  fontSize: '0.9rem'
};

const itemNameStyle: React.CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 700,
  color: 'var(--text-primary)'
};

const notesStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '10px',
  backgroundColor: 'rgba(234, 179, 8, 0.05)',
  border: '1px solid rgba(234, 179, 8, 0.15)',
  fontSize: '0.825rem',
  color: 'rgba(234, 179, 8, 0.9)',
  lineHeight: 1.4
};

const cardFooterStyle: React.CSSProperties = {
  padding: '16px 24px',
  borderTop: '1px solid rgba(255,255,255,0.04)',
  display: 'flex',
  gap: '10px'
};

const confirmBtnStyle: React.CSSProperties = {
  flexGrow: 1,
  padding: '12px',
  borderRadius: '12px',
  border: 'none',
  backgroundColor: '#3b82f6',
  color: '#ffffff',
  fontSize: '0.85rem',
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: '0 4px 10px rgba(59, 130, 246, 0.25)'
};

const prepareBtnStyle: React.CSSProperties = {
  ...confirmBtnStyle,
  backgroundColor: '#a855f7',
  boxShadow: '0 4px 10px rgba(168, 85, 247, 0.25)'
};

const readyBtnStyle: React.CSSProperties = {
  ...confirmBtnStyle,
  backgroundColor: '#eab308',
  boxShadow: '0 4px 10px rgba(234, 179, 8, 0.25)'
};

const completeBtnStyle: React.CSSProperties = {
  ...confirmBtnStyle,
  backgroundColor: '#22c55e',
  boxShadow: '0 4px 10px rgba(34, 197, 94, 0.25)'
};

const rejectBtnStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid rgba(239, 68, 68, 0.2)',
  backgroundColor: 'rgba(239, 68, 68, 0.05)',
  color: '#ef4444',
  fontSize: '0.85rem',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};
