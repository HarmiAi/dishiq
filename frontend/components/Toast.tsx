'use strict';
'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  toast: (type: ToastType, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, title: string, description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, description }]);
    
    // Automatically dismiss after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const success = useCallback((title: string, description?: string) => toast('success', title, description), [toast]);
  const error = useCallback((title: string, description?: string) => toast('error', title, description), [toast]);
  const warning = useCallback((title: string, description?: string) => toast('warning', title, description), [toast]);
  const info = useCallback((title: string, description?: string) => toast('info', title, description), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      
      {/* Toast Render Portal Container */}
      <div style={containerStyle}>
        {toasts.map((t) => (
          <div key={t.id} style={{ ...toastCardStyle, ...typeStyles[t.type] }} className="float-animation">
            <div style={toastHeaderStyle}>
              <span style={toastIconStyle}>{iconMap[t.type]}</span>
              <strong style={toastTitleStyle}>{t.title}</strong>
              <button onClick={() => removeToast(t.id)} style={closeBtnStyle}>&times;</button>
            </div>
            {t.description && <p style={toastDescStyle}>{t.description}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Styling Object for Vanilla CSS Claymorphic Toasts
const containerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '24px',
  right: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  zIndex: 9999,
  pointerEvents: 'none',
  maxWidth: '380px',
  width: '100%'
};

const toastCardStyle: React.CSSProperties = {
  background: '#1F2937',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '16px',
  padding: '16px',
  color: '#F9FAFB',
  boxShadow: '10px 10px 24px rgba(0, 0, 0, 0.55), inset -3px -3px 8px rgba(0, 0, 0, 0.3), inset 3px 3px 8px rgba(255, 255, 255, 0.05)',
  pointerEvents: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  animation: 'slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
};

const toastHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  width: '100%'
};

const toastIconStyle: React.CSSProperties = {
  fontSize: '1.25rem',
  display: 'flex',
  alignItems: 'center'
};

const toastTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '0.95rem',
  fontWeight: 600,
  flexGrow: 1
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  fontSize: '1.4rem',
  cursor: 'pointer',
  padding: '0 4px',
  display: 'flex',
  alignItems: 'center'
};

const toastDescStyle: React.CSSProperties = {
  fontSize: '0.825rem',
  color: 'var(--text-secondary)',
  paddingLeft: '30px'
};

const iconMap = {
  success: '🟢',
  error: '🔴',
  warning: '🟠',
  info: '🔵'
};

const typeStyles: Record<ToastType, React.CSSProperties> = {
  success: {
    borderLeft: '4px solid var(--color-success)',
    boxShadow: '10px 10px 24px rgba(0, 0, 0, 0.55), inset -3px -3px 8px rgba(0, 0, 0, 0.3), inset 3px 3px 8px var(--color-success-glow)'
  },
  error: {
    borderLeft: '4px solid var(--color-danger)',
    boxShadow: '10px 10px 24px rgba(0, 0, 0, 0.55), inset -3px -3px 8px rgba(0, 0, 0, 0.3), inset 3px 3px 8px var(--color-danger-glow)'
  },
  warning: {
    borderLeft: '4px solid var(--color-warning)',
    boxShadow: '10px 10px 24px rgba(0, 0, 0, 0.55), inset -3px -3px 8px rgba(0, 0, 0, 0.3), inset 3px 3px 8px var(--color-warning-glow)'
  },
  info: {
    borderLeft: '4px solid var(--accent-color)',
    boxShadow: '10px 10px 24px rgba(0, 0, 0, 0.55), inset -3px -3px 8px rgba(0, 0, 0, 0.3), inset 3px 3px 8px var(--accent-glow)'
  }
};
