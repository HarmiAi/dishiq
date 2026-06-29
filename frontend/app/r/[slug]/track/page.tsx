'use client';

import React, { useState, useEffect, use } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string }>;
}

export default function CustomerTrackPage({ params, searchParams }: PageProps) {
  const resolvedParams = use(params);
  const resolvedSearchParams = use(searchParams);
  const slug = resolvedParams.slug;
  const orderId = resolvedSearchParams.id;

  const toast = useToast();
  const [liveOrder, setLiveOrder] = useState<any>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // 1. Fetch initial order details
  const { data: orderData, isLoading, isError } = useQuery({
    queryKey: ['public-order-track', orderId],
    queryFn: async () => {
      const res = await api.get(`/public/order/${orderId}`);
      return res.data?.order;
    },
    enabled: !!orderId
  });

  // Sync initial order details to live state
  useEffect(() => {
    if (orderData) {
      setLiveOrder(orderData);
    }
  }, [orderData]);

  // 2. Connect Socket.IO and listen for real-time status transitions
  useEffect(() => {
    if (!orderId) return;

    const socket = getSocket();
    socket.connect();

    socket.on('connect', () => {
      setIsSocketConnected(true);
      socket.emit('join_order_room', orderId);
    });

    socket.on('disconnect', () => {
      setIsSocketConnected(false);
    });

    // Real-time update receiver
    socket.on('order_updated', (updatedOrder: any) => {
      if (updatedOrder._id === orderId) {
        setLiveOrder(updatedOrder);
        toast.success(
          'Order Update!',
          `Your order status is now: ${updatedOrder.status.toUpperCase()}`
        );
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('order_updated');
      socket.disconnect();
    };
  }, [orderId, toast]);

  // 3. Simple second-based tick to calculate elapsed waiting time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading) {
    return (
      <div style={loaderContainerStyle}>
        <div className="pulse-glow-indicator" style={{ color: 'var(--primary-color)', width: 40, height: 40 }}></div>
        <p style={{ marginTop: '16px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Loading tracking board...</p>
      </div>
    );
  }

  if (isError || !orderId || !liveOrder) {
    return (
      <div style={errorContainerStyle}>
        <div className="clay-card" style={{ padding: '32px', textAlign: 'center', maxWidth: '400px' }}>
          <span style={{ fontSize: '3rem' }}>🔍</span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '16px 0 8px' }}>Order Not Found</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            We couldn't retrieve tracking information for this order. Make sure the link is valid.
          </p>
          <Link href={`/r/${slug}`} className="clay-btn clay-btn-primary" style={{ display: 'inline-block', width: '100%' }}>
            Return to Menu 🍽️
          </Link>
        </div>
      </div>
    );
  }

  const restaurant = liveOrder.restaurantId;
  const status = liveOrder.status;

  // Wait time calculations
  // Get maximum preparation time from items, defaulting to 15 minutes if missing
  const maxPrepTime = Math.max(
    ...liveOrder.items.map((item: any) => item.menuItemId?.preparationTime || 15),
    15
  );

  const createdAtTime = new Date(liveOrder.createdAt).getTime();
  const elapsedSeconds = Math.floor((currentTime - createdAtTime) / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  // Time remaining count
  const remainingMinutes = Math.max(maxPrepTime - elapsedMinutes, 0);
  const remainingSeconds = 60 - (elapsedSeconds % 60);
  const formattedSeconds = remainingSeconds === 60 ? '00' : remainingSeconds < 10 ? `0${remainingSeconds}` : remainingSeconds;

  // Active status workflow steps configuration
  const steps = [
    { label: 'Sent', key: 'pending', icon: '📩', desc: 'Order received by restaurant' },
    { label: 'Confirmed', key: 'confirmed', icon: '👍', desc: 'Accepted by kitchen staff' },
    { label: 'Cooking', key: 'preparing', icon: '🍳', desc: 'Your meal is being prepared' },
    { label: 'Ready', key: 'ready', icon: '🔔', desc: 'Fresh & ready to serve' },
    { label: 'Served', key: 'completed', icon: '🏁', desc: 'Enjoy your meal!' }
  ];

  const getStepIndex = (st: string) => {
    return steps.findIndex((step) => step.key === st);
  };

  const currentStepIdx = getStepIndex(status);

  return (
    <div style={pageWrapperStyle}>
      {/* Offline Alert Bar */}
      {!isSocketConnected && (
        <div style={offlineBannerStyle}>
          ⚠️ Network connection lost. Reconnecting to live server...
        </div>
      )}

      {/* Hero Header */}
      <div style={headerCardStyle} className="clay-card">
        {restaurant?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={restaurant.logoUrl} alt={restaurant.name} style={logoStyle} />
        ) : (
          <span style={{ fontSize: '2rem' }}>🏢</span>
        )}
        <h1 style={restaurantNameStyle}>{restaurant?.name || 'Dishiq Restaurant'}</h1>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Table: {liveOrder.tableId?.tableNumber || 'N/A'}</span>
      </div>

      {/* Main Grid Content */}
      <div style={gridStyle}>
        
        {/* Left Column: Waiting Clock & Status Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Waiting Timer Card */}
          {status !== 'completed' && status !== 'cancelled' ? (
            <div className="clay-card float-animation" style={timerCardStyle}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Estimated Preparation Time
              </span>
              <strong style={clockStyle}>
                {remainingMinutes}:{formattedSeconds}
              </strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {status === 'ready' ? '🔔 Food is ready! Waiter is arriving at your table.' : '⏳ Freshly cooking your items.'}
              </p>
            </div>
          ) : (
            <div className="clay-card" style={timerCardStyle}>
              <span style={{ fontSize: '3rem' }}>{status === 'completed' ? '🎉' : '❌'}</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '8px' }}>
                Order {status === 'completed' ? 'Completed' : 'Cancelled'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {status === 'completed' ? 'We hope you enjoy your meal! Thank you.' : 'This order has been cancelled by the restaurant.'}
              </p>
            </div>
          )}

          {/* Timeline Card */}
          <div className="clay-card" style={timelineCardStyle}>
            <h3 style={sectionTitleStyle}>Live Timeline</h3>
            
            {status === 'cancelled' ? (
              <div className="clay-card" style={cancelledAlertStyle}>
                <strong>❌ Order Cancelled</strong>
                <p style={{ fontSize: '0.75rem', marginTop: '4px', lineHeight: 1.4 }}>
                  This order was cancelled by the kitchen staff. Please contact server or table desk for questions.
                </p>
              </div>
            ) : (
              <div style={timelineWrapperStyle}>
                {steps.map((step, index) => {
                  const isDone = index <= currentStepIdx;
                  const isCurrent = index === currentStepIdx;

                  return (
                    <div key={step.key} style={timelineRowStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={getStepCircleStyle(isDone, isCurrent)}>
                          <span style={{ fontSize: '1.1rem' }}>{step.icon}</span>
                        </div>
                        {index < steps.length - 1 && (
                          <div style={getStepLineStyle(index < currentStepIdx)}></div>
                        )}
                      </div>
                      
                      <div style={{ paddingBottom: '24px' }}>
                        <strong style={getStepLabelStyle(isDone, isCurrent)}>{step.label}</strong>
                        <p style={{ fontSize: '0.75rem', color: isCurrent ? 'var(--text-secondary)' : 'var(--text-muted)', marginTop: '2px' }}>
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Receipt Info Card */}
          <div className="clay-card" style={receiptCardStyle}>
            <div style={receiptHeaderStyle}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Receipt</span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                  {liveOrder.orderNumber}
                </h3>
              </div>
              <div className="clay-card" style={{ padding: '6px 12px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-color)' }}>{liveOrder.token}</span>
              </div>
            </div>

            <div style={receiptBodyStyle}>
              {liveOrder.items.map((item: any, idx: number) => (
                <div key={idx} style={itemRowStyle}>
                  <span style={{ fontSize: '0.85rem' }}>
                    {item.menuItemId?.name || 'Menu Item'} 
                    <strong style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>x{item.quantity}</strong>
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>₹{item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {liveOrder.notes && (
              <div style={receiptNotesStyle}>
                💬 <strong>Notes:</strong> {liveOrder.notes}
              </div>
            )}

            <div style={receiptFooterStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Grand Total</span>
                <strong style={{ fontSize: '1.2rem', color: 'var(--accent-color)' }}>
                  ₹{liveOrder.grandTotal.toFixed(2)}
                </strong>
              </div>
            </div>
          </div>

          {/* Quick Menu Button */}
          <Link href={`/r/${slug}`} className="clay-btn clay-btn-secondary" style={{ width: '100%', padding: '14px', textAlign: 'center', borderRadius: '16px' }}>
            ← Back to Food Menu
          </Link>
        </div>

      </div>
    </div>
  );
}

// Styling definitions
const pageWrapperStyle: React.CSSProperties = {
  maxWidth: '800px',
  width: '100%',
  margin: '0 auto',
  padding: '24px 20px 80px',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
  minHeight: '100vh',
  backgroundColor: 'var(--bg-color)',
  color: 'var(--text-primary)'
};

const loaderContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: 'var(--bg-color)'
};

const errorContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: 'var(--bg-color)',
  padding: '20px'
};

const offlineBannerStyle: React.CSSProperties = {
  padding: '10px 20px',
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  border: '1px solid rgba(239, 68, 68, 0.2)',
  borderRadius: '12px',
  color: 'rgb(248, 113, 113)',
  fontSize: '0.8rem',
  textAlign: 'center',
  animation: 'pulse 2s infinite'
};

const headerCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  padding: '24px',
  border: '1px solid var(--border-color)',
  gap: '10px',
  backgroundColor: 'var(--card-bg)'
};

const logoStyle: React.CSSProperties = {
  width: '60px',
  height: '60px',
  borderRadius: '16px',
  border: '1px solid var(--border-color)',
  objectFit: 'cover',
  boxShadow: 'var(--clay-input-shadow)'
};

const restaurantNameStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '1.25rem',
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '24px',
  alignItems: 'start'
};

const timerCardStyle: React.CSSProperties = {
  padding: '28px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--card-bg)',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px'
};

const clockStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '3.5rem',
  fontWeight: 800,
  color: 'var(--accent-color)',
  letterSpacing: '-0.03em',
  lineHeight: 1
};

const timelineCardStyle: React.CSSProperties = {
  padding: '24px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--card-bg)'
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '1.05rem',
  fontWeight: 700,
  marginBottom: '20px',
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: '10px'
};

const cancelledAlertStyle: React.CSSProperties = {
  padding: '16px',
  borderRadius: '16px',
  backgroundColor: 'rgba(239, 68, 68, 0.05)',
  border: '1px solid rgba(239, 68, 68, 0.15)',
  color: '#ef4444'
};

const timelineWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  paddingLeft: '6px'
};

const timelineRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '40px 1fr',
  gap: '16px'
};

const getStepCircleStyle = (done: boolean, current: boolean): React.CSSProperties => {
  let bgColor = 'rgba(255, 255, 255, 0.02)';
  let border = '1px solid var(--border-color)';
  let shadow = 'none';

  if (current) {
    bgColor = 'rgba(99, 102, 241, 0.15)';
    border = '1px solid var(--primary-color)';
    shadow = 'var(--clay-btn-primary-shadow)';
  } else if (done) {
    bgColor = 'rgba(34, 197, 94, 0.1)';
    border = '1px solid rgba(34, 197, 94, 0.3)';
  }

  return {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: bgColor,
    border,
    boxShadow: shadow,
    transition: 'all 0.3s ease',
    transform: current ? 'scale(1.1)' : 'scale(1)'
  };
};

const getStepLineStyle = (active: boolean): React.CSSProperties => {
  return {
    width: '2px',
    height: '32px',
    backgroundColor: active ? '#22c55e' : 'var(--border-color)',
    margin: '4px 0'
  };
};

const getStepLabelStyle = (done: boolean, current: boolean): React.CSSProperties => {
  let color = 'var(--text-muted)';
  if (current) {
    color = 'var(--text-primary)';
  } else if (done) {
    color = 'var(--text-secondary)';
  }

  return {
    fontSize: '0.875rem',
    fontWeight: current || done ? 700 : 500,
    color
  };
};

const receiptCardStyle: React.CSSProperties = {
  padding: '24px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--card-bg)',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px'
};

const receiptHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: '14px'
};

const receiptBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px'
};

const itemRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const receiptNotesStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '10px',
  backgroundColor: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid var(--border-color)',
  fontSize: '0.8rem',
  color: 'var(--text-secondary)'
};

const receiptFooterStyle: React.CSSProperties = {
  borderTop: '1px solid var(--border-color)',
  paddingTop: '14px',
  marginTop: '4px'
};
