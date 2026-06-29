'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login, isAuthenticated, isLoading, isLoggingIn } = useAuth();
  const router = useRouter();

  const {
    register: registerField,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema)
  });

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const onSubmit = (data: LoginFormValues) => {
    login(data);
  };

  if (isLoading || (isAuthenticated && !isLoading)) {
    return (
      <div style={pageContainerStyle}>
        <div className="pulse-glow-indicator" style={{ color: 'var(--primary-color)', width: 40, height: 40 }}></div>
      </div>
    );
  }

  return (
    <div style={pageContainerStyle}>
      <div className="clay-card" style={cardOverrideStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Dishiq</h1>
          <p style={subtitleStyle}>Log in to manage your restaurant</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
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

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="password">Password</label>
              <Link href="/forgot-password" style={forgotLinkStyle}>
                Forgot?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              className="clay-input"
              {...registerField('password')}
            />
            {errors.password && <span className="form-error">{errors.password.message}</span>}
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="clay-btn clay-btn-primary"
            style={btnOverrideStyle}
          >
            {isLoggingIn ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        <div style={footerStyle}>
          <span>Don&apos;t have an account? </span>
          <Link href="/register" style={toggleLinkStyle}>
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}

// Inline Styles for structural Layouts (since we aren't using Tailwind)
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

const forgotLinkStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--accent-color)',
  textDecoration: 'none',
  fontFamily: 'var(--font-heading)',
  fontWeight: 500
};

const btnOverrideStyle: React.CSSProperties = {
  width: '100%',
  marginTop: '24px',
  height: '48px'
};

const footerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginTop: '24px',
  fontSize: '0.875rem',
  color: 'var(--text-muted)'
};

const toggleLinkStyle: React.CSSProperties = {
  color: 'var(--primary-color)',
  textDecoration: 'none',
  fontWeight: 600
};
