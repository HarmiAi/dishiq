'use client';

import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <div style={heroContainerStyle}>
      <header style={headerStyle} className="hero-header">
        <div style={logoStyle}>Dishiq</div>
        <div style={navLinksStyle}>
          <Link href="/login" className="clay-btn clay-btn-secondary" style={navBtnStyle}>
            Sign In
          </Link>
          <Link href="/register" className="clay-btn clay-btn-primary" style={navBtnStyle}>
            Register Restaurant
          </Link>
        </div>
      </header>

      <main style={mainContentStyle} className="hero-main-grid">
        <div style={taglineWrapperStyle} className="tagline-wrapper float-animation">
          <span className="clay-badge clay-badge-info" style={{ marginBottom: '16px' }}>
            Phase 1 Foundation MVP
          </span>
          <h1 style={heroTitleStyle} className="hero-title">
            The 3D Restaurant <br />
            <span style={gradientTextStyle}>SaaS Engine</span>
          </h1>
          <p style={heroSubStyle}>
            Dishiq powers digital menus, live table tracking, and contactless ordering for modern eateries. 
            Scale from a single table to multi-restaurant chains with robust, claymorphic SaaS tools.
          </p>
          <div style={ctaGroupStyle} className="cta-group">
            <Link href="/register" className="clay-btn clay-btn-primary" style={largeBtnStyle}>
              Create Your Menu 🚀
            </Link>
            <Link href="/login" className="clay-btn clay-btn-secondary" style={largeBtnStyle}>
              Manage Dashboard
            </Link>
          </div>
        </div>

        {/* 3D Visual Accents */}
        <div style={visualContainerStyle} className="visual-container">
          <div style={clayTabletStyle}>
            <div style={tabletHeaderStyle}>
              <div style={dotStyle}></div>
              <div style={dotStyle}></div>
              <div style={dotStyle}></div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '12px' }}>
                dishiq.com/r/my-cafe
              </span>
            </div>
            <div style={tabletBodyStyle}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={clayMenuPillActiveStyle}>🍕 Pizzas</div>
                <div style={clayMenuPillStyle}>🍔 Burgers</div>
                <div style={clayMenuPillStyle}>🍹 Drinks</div>
              </div>
              <div style={clayFoodCardStyle}>
                <div style={foodImagePlaceholderStyle}>
                  <span style={{ fontSize: '2.5rem' }}>🍕</span>
                </div>
                <div style={{ flexGrow: 1 }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>Margherita Deluxe</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Fresh mozzarella, basil leaves, extra virgin olive oil.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent-color)' }}>$12.99</span>
                    <button className="clay-btn clay-btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px' }}>
                      Add +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Styles
const heroContainerStyle: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: 'var(--bg-color)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: '0 24px',
  backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.15), transparent 45%), radial-gradient(circle at 15% 75%, rgba(139, 92, 246, 0.12), transparent 40%)'
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '24px 0',
  maxWidth: '1200px',
  width: '100%',
  margin: '0 auto'
};

const logoStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '1.75rem',
  fontWeight: 800,
  color: 'transparent',
  backgroundClip: 'text',
  backgroundImage: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
  letterSpacing: '-0.03em'
};

const navLinksStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px'
};

const navBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '0.85rem',
  borderRadius: '12px'
};

const mainContentStyle: React.CSSProperties = {
  maxWidth: '1200px',
  width: '100%',
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  alignItems: 'center',
  gap: '48px',
  flexGrow: 1,
  padding: '48px 0',
  flexWrap: 'wrap'
};

const taglineWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start'
};

const heroTitleStyle: React.CSSProperties = {
  fontSize: '4rem',
  fontWeight: 800,
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
  marginBottom: '24px'
};

const gradientTextStyle: React.CSSProperties = {
  color: 'transparent',
  backgroundClip: 'text',
  backgroundImage: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color), var(--accent-color))'
};

const heroSubStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  color: 'var(--text-secondary)',
  lineHeight: 1.6,
  marginBottom: '32px',
  maxWidth: '520px'
};

const ctaGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
  width: '100%',
  flexWrap: 'wrap'
};

const largeBtnStyle: React.CSSProperties = {
  padding: '16px 32px',
  fontSize: '1rem',
  borderRadius: '16px'
};

const visualContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
};

const clayTabletStyle: React.CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '28px',
  boxShadow: '15px 20px 40px rgba(0,0,0,0.65), inset -6px -6px 16px rgba(0,0,0,0.4), inset 6px 6px 16px rgba(255,255,255,0.05)',
  width: '100%',
  maxWidth: '420px',
  padding: '20px'
};

const tabletHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: '12px',
  marginBottom: '16px'
};

const dotStyle: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: 'rgba(255,255,255,0.15)',
  marginRight: '6px'
};

const tabletBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column'
};

const clayMenuPillStyle: React.CSSProperties = {
  backgroundColor: 'rgba(10, 10, 11, 0.4)',
  boxShadow: 'var(--clay-input-shadow)',
  border: '1px solid var(--border-color)',
  padding: '8px 16px',
  borderRadius: '12px',
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
  cursor: 'pointer'
};

const clayMenuPillActiveStyle: React.CSSProperties = {
  backgroundColor: 'var(--primary-color)',
  boxShadow: 'var(--clay-btn-primary-shadow)',
  padding: '8px 16px',
  borderRadius: '12px',
  fontSize: '0.85rem',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer'
};

const clayFoodCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '20px',
  boxShadow: 'var(--clay-card-shadow)',
  padding: '16px',
  display: 'flex',
  gap: '16px',
  alignItems: 'center'
};

const foodImagePlaceholderStyle: React.CSSProperties = {
  backgroundColor: 'rgba(10, 10, 11, 0.6)',
  border: '1px solid var(--border-color)',
  boxShadow: 'var(--clay-input-shadow)',
  borderRadius: '16px',
  width: '80px',
  height: '80px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
};
