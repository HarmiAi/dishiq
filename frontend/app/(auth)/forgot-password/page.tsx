'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address')
});

type ForgotFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors }
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotPasswordSchema)
  });

  const onSubmit = async (data: ForgotFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await api.post('/auth/forgot-password', data);
      if (res.data && res.data.success) {
        setIsSent(true);
        toast.success('Reset link sent!', 'Please check your email inbox.');
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Failed to request reset link. Please try again.';
      toast.error('Request failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={pageContainerStyle}>
      <div className="clay-card" style={cardOverrideStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Dishiq</h1>
          <p style={subtitleStyle}>Recover your workspace password</p>
        </div>

        {isSent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={successIconStyle}>✉️</div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '12px' }}>Check Your Email</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
              We have sent instructions to reset your password if your email is registered in our system.
            </p>
            <Link href="/login" className="clay-btn clay-btn-secondary" style={{ width: '100%' }}>
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="chef@dishiq.com"
                className="clay-input"
                {...registerField('email')}
              />
              {errors.email && <span className="form-error">{errors.email.message}</span>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="clay-btn clay-btn-primary"
              style={btnOverrideStyle}
            >
              {isSubmitting ? 'Requesting link...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        {!isSent && (
          <div style={footerStyle}>
            <Link href="/login" style={toggleLinkStyle}>
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// Inline Styles for structural Layouts
const pageContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: 'var(--bg-color)',
  padding: '20px'
};

const cardOverrideStyle: React.CSSProperties = {
  maxWidth: '420px',
  width: '100%',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  padding: '40px 32px'
};

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '32px'
};

const titleStyle: React.CSSProperties = {
  fontSize: '2.5rem',
  fontWeight: 800,
  color: 'transparent',
  backgroundClip: 'text',
  backgroundImage: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
  marginBottom: '8px',
  letterSpacing: '-0.03em'
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: 'var(--text-secondary)'
};

const btnOverrideStyle: React.CSSProperties = {
  width: '100%',
  marginTop: '12px',
  height: '48px'
};

const footerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginTop: '24px',
  fontSize: '0.875rem',
  color: 'var(--text-muted)'
};

const toggleLinkStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  textDecoration: 'none',
  fontWeight: 600
};

const successIconStyle: React.CSSProperties = {
  fontSize: '3rem',
  marginBottom: '16px',
  textAlign: 'center'
};
