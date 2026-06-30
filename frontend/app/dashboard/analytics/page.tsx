'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AnalyticsDashboardPage() {
  const toast = useToast();
  const [timeRange, setTimeRange] = useState('30days');

  // Query: Fetch detailed restaurant stats
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-detailed-analytics', timeRange],
    queryFn: async () => {
      const res = await api.get('/analytics');
      return res.data?.analytics;
    }
  });

  if (isLoading) {
    return (
      <div style={loaderContainerStyle}>
        <div className="pulse-glow-indicator" style={{ color: 'var(--primary-color)', width: 40, height: 40 }}></div>
        <p style={{ marginTop: '16px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Loading analytics pipelines...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <span style={{ fontSize: '3rem' }}>⚠️</span>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '16px' }}>Failed to Load Analytics</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>Please check your connections and refresh the page.</p>
      </div>
    );
  }

  const { summary, dailySales = [], hourlyTraffic = [], popularItems = [], categorySales = [], insights = [] } = data;

  // Custom SVG Plotter: Area Chart for 30-day sales
  const renderAreaChart = () => {
    if (dailySales.length === 0) {
      return (
        <div style={{ height: '200px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
          No sales data recorded for the selected timeline.
        </div>
      );
    }

    const width = 600;
    const height = 200;
    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Find min/max values
    const revenues = dailySales.map((d: any) => d.revenue);
    const maxRevenue = Math.max(...revenues, 500); // minimum scale limit
    const minRevenue = 0;

    // Map coordinates
    const points = dailySales.map((d: any, index: number) => {
      const x = paddingLeft + (index / (dailySales.length - 1)) * chartWidth;
      const y = paddingTop + chartHeight - ((d.revenue - minRevenue) / (maxRevenue - minRevenue)) * chartHeight;
      return { x, y, date: d._id, val: d.revenue };
    });

    // Construct SVG path string
    let pathD = '';
    let areaD = '';

    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p: any) => `L ${p.x} ${p.y}`).join(' ');
      // Close the area path for gradient filling
      areaD = pathD + ` L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
    }

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <defs>
          <linearGradient id="area-glow-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary-color)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--primary-color)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Y Axis Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = paddingTop + chartHeight * ratio;
          const val = Math.round(maxRevenue * (1 - ratio));
          return (
            <g key={i}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              <text x={paddingLeft - 10} y={y + 4} fill="var(--text-muted)" fontSize="8" textAnchor="end">₹{val}</text>
            </g>
          );
        })}

        {/* Area fill */}
        {areaD && <path d={areaD} fill="url(#area-glow-grad)" />}

        {/* Line stroke */}
        {pathD && <path d={pathD} fill="none" stroke="var(--primary-color)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}

        {/* Interaction data points */}
        {points.map((p: any, i: number) => {
          const isEndpoint = i === 0 || i === points.length - 1;
          if (isEndpoint) return null;
          // Render only a few points to prevent clutter
          if (points.length > 10 && i % Math.floor(points.length / 6) !== 0) return null;

          return (
            <g key={i} className="chart-dot-group" style={{ cursor: 'pointer' }}>
              <circle cx={p.x} cy={p.y} r="5" fill="var(--accent-color)" stroke="var(--card-bg)" strokeWidth="2" />
              <text x={p.x} y={p.y - 10} fill="var(--text-primary)" fontSize="7" fontWeight="bold" textAnchor="middle">
                ₹{Math.round(p.val)}
              </text>
            </g>
          );
        })}

        {/* X Axis Labels */}
        {points.map((p: any, i: number) => {
          if (points.length > 7 && i % Math.floor(points.length / 4) !== 0) return null;
          const date = new Date(p.date);
          const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return (
            <text key={i} x={p.x} y={height - 8} fill="var(--text-muted)" fontSize="8" textAnchor="middle">
              {label}
            </text>
          );
        })}
      </svg>
    );
  };

  // Custom SVG Plotter: Bar Chart for peak hours
  const renderBarChart = () => {
    if (hourlyTraffic.length === 0) {
      return (
        <div style={{ height: '200px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
          No hourly traffic statistics recorded.
        </div>
      );
    }

    const width = 600;
    const height = 200;
    const paddingLeft = 35;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const ordersCounts = hourlyTraffic.map((h: any) => h.orders);
    const maxOrders = Math.max(...ordersCounts, 5);

    // Group hours into buckets to prevent 24 bar columns crowding (e.g. 4-hour spans)
    const spans = [
      { label: 'Morning (6A-11A)', orders: 0 },
      { label: 'Lunch (11A-3P)', orders: 0 },
      { label: 'Afternoon (3P-6P)', orders: 0 },
      { label: 'Dinner (6P-10P)', orders: 0 },
      { label: 'Late Night (10P-2A)', orders: 0 }
    ];

    hourlyTraffic.forEach((h: any) => {
      const hour = parseInt(h.hour.split(':')[0], 10);
      if (hour >= 6 && hour < 11) spans[0].orders += h.orders;
      else if (hour >= 11 && hour < 15) spans[1].orders += h.orders;
      else if (hour >= 15 && hour < 18) spans[2].orders += h.orders;
      else if (hour >= 18 && hour < 22) spans[3].orders += h.orders;
      else spans[4].orders += h.orders;
    });

    const maxSpanOrders = Math.max(...spans.map(s => s.orders), 5);
    const barWidth = 45;
    const gap = (chartWidth - barWidth * spans.length) / (spans.length - 1);

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        {/* Y Axis Grid lines */}
        {[0, 0.5, 1].map((ratio, i) => {
          const y = paddingTop + chartHeight * ratio;
          const val = Math.round(maxSpanOrders * (1 - ratio));
          return (
            <g key={i}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              <text x={paddingLeft - 10} y={y + 3} fill="var(--text-muted)" fontSize="8" textAnchor="end">{val}</text>
            </g>
          );
        })}

        {/* Draw bars */}
        {spans.map((span, index) => {
          const x = paddingLeft + index * (barWidth + gap);
          const barHeight = (span.orders / maxSpanOrders) * chartHeight;
          const y = paddingTop + chartHeight - barHeight;

          return (
            <g key={index} style={{ cursor: 'pointer' }}>
              {/* Tooltip number */}
              <text x={x + barWidth / 2} y={y - 8} fill="var(--accent-color)" fontSize="8" fontWeight="bold" textAnchor="middle">
                {span.orders}
              </text>
              {/* Rounded 3D bar rect */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="6"
                ry="6"
                fill="var(--primary-color)"
                opacity="0.85"
                style={{ transition: 'all 0.2s ease' }}
              />
              {/* Label */}
              <text x={x + barWidth / 2} y={height - 10} fill="var(--text-muted)" fontSize="7.5" textAnchor="middle">
                {span.label.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div style={containerStyle}>
      {/* Title section */}
      <div style={headerRowStyle}>
        <div>
          <h1 style={titleStyle}>Smart Analytics</h1>
          <p style={subtitleStyle}>Aggregate metrics, customer return rates, sales trends, and business insights.</p>
        </div>
      </div>

      {/* Grid of key metric counters */}
      <div style={metricsGridStyle}>
        
        <div className="clay-card float-animation" style={metricCardStyle}>
          <div>
            <span style={metricLabelStyle}>Today's Revenue</span>
            <strong style={metricValueStyle}>₹{summary.todayRevenue.toFixed(0)}</strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{summary.todayOrders} Orders today</span>
          </div>
          <span style={metricIconStyle}>💰</span>
        </div>

        <div className="clay-card float-animation" style={{ ...metricCardStyle, animationDelay: '0.05s' }}>
          <div>
            <span style={metricLabelStyle}>Weekly Sales</span>
            <strong style={metricValueStyle}>₹{summary.weekRevenue.toFixed(0)}</strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Current week cycle</span>
          </div>
          <span style={metricIconStyle}>📅</span>
        </div>

        <div className="clay-card float-animation" style={{ ...metricCardStyle, animationDelay: '0.1s' }}>
          <div>
            <span style={metricLabelStyle}>Average Order Value</span>
            <strong style={metricValueStyle}>₹{summary.averageOrderValue.toFixed(0)}</strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ticket average ticket</span>
          </div>
          <span style={metricIconStyle}>📊</span>
        </div>

        <div className="clay-card float-animation" style={{ ...metricCardStyle, animationDelay: '0.15s' }}>
          <div>
            <span style={metricLabelStyle}>Returning Diners</span>
            <strong style={metricValueStyle}>{summary.returningPercentage}%</strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Repeat customer ratio</span>
          </div>
          <span style={metricIconStyle}>🪑</span>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={gridStyle} className="responsive-split-grid">
        
        {/* Left Column: Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Sales chart */}
          <div className="clay-card" style={chartContainerCardStyle}>
            <h3 style={chartTitleStyle}>Daily Revenue Trend (30 Days)</h3>
            <div style={{ marginTop: '16px' }}>{renderAreaChart()}</div>
          </div>

          {/* Peak hour traffic */}
          <div className="clay-card" style={chartContainerCardStyle}>
            <h3 style={chartTitleStyle}>Hourly Seating Cycles (Traffic)</h3>
            <div style={{ marginTop: '16px' }}>{renderBarChart()}</div>
          </div>
        </div>

        {/* Right Column: Insights & Ranks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Smart insights widget */}
          <div className="clay-card" style={widgetCardStyle}>
            <h3 style={chartTitleStyle}>💡 Operations Insights</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              {insights.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Collecting data to generate platform insights...</p>
              ) : (
                insights.map((insight: any, i: number) => (
                  <div key={i} style={insightRowStyle}>
                    <strong style={{ fontSize: '0.85rem', display: 'block', color: 'var(--accent-color)' }}>
                      {insight.title}
                    </strong>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
                      {insight.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Popular items ranking */}
          <div className="clay-card" style={widgetCardStyle}>
            <h3 style={chartTitleStyle}>🏆 Most Ordered Items</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
              {popularItems.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No items sold yet.</p>
              ) : (
                popularItems.map((item: any, i: number) => (
                  <div key={item._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexGrow: 1 }}>
                      <div style={rankingBadgeStyle(i)}>{i + 1}</div>
                      <div>
                        <strong style={{ fontSize: '0.9rem', display: 'block' }}>{item.name}</strong>
                        <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                          {item.quantitySold} units sold
                        </span>
                      </div>
                    </div>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      ₹{item.revenue.toFixed(0)}
                    </strong>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Category breakdown segmented bar */}
          <div className="clay-card" style={widgetCardStyle}>
            <h3 style={chartTitleStyle}>🍕 Category Sales Percent</h3>
            <div style={{ marginTop: '16px' }}>
              {categorySales.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No category sales tracked.</p>
              ) : (
                <div>
                  {/* Stacked percentage bar */}
                  <div style={stackedPercentageBarStyle}>
                    {(() => {
                      const totalRev = categorySales.reduce((sum: number, c: any) => sum + c.revenue, 0);
                      const colors = ['#6366f1', '#eab308', '#22c55e', '#ef4444', '#a855f7'];
                      return (
                        <>
                          {categorySales.map((cat: any, i: number) => {
                            const pct = totalRev > 0 ? (cat.revenue / totalRev) * 100 : 0;
                            return (
                              <div
                                key={cat._id}
                                style={{
                                  width: `${pct}%`,
                                  height: '100%',
                                  backgroundColor: colors[i % colors.length],
                                  transition: 'width 0.3s ease'
                                }}
                                title={`${cat._id}: ${pct.toFixed(0)}%`}
                              />
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                  
                  {/* Labels and legends */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                    {(() => {
                      const totalRev = categorySales.reduce((sum: number, c: any) => sum + c.revenue, 0);
                      const colors = ['#6366f1', '#eab308', '#22c55e', '#ef4444', '#a855f7'];
                      return categorySales.map((cat: any, i: number) => {
                        const pct = totalRev > 0 ? (cat.revenue / totalRev) * 100 : 0;
                        return (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: colors[i % colors.length] }} />
                              <span>{cat._id}</span>
                            </div>
                            <strong style={{ color: 'var(--text-secondary)' }}>{pct.toFixed(0)}%</strong>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// Styling definitions
const loaderContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '60vh'
};

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

const metricsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '20px'
};

const metricCardStyle: React.CSSProperties = {
  padding: '24px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '20px'
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  fontWeight: 600,
  display: 'block'
};

const metricValueStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 900,
  fontFamily: 'var(--font-heading)',
  margin: '4px 0',
  display: 'block'
};

const metricIconStyle: React.CSSProperties = {
  fontSize: '2rem'
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.8fr 1.2fr',
  gap: '24px',
  alignItems: 'start'
};

const chartContainerCardStyle: React.CSSProperties = {
  padding: '28px',
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '24px'
};

const chartTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '1.05rem',
  fontWeight: 700
};

const widgetCardStyle: React.CSSProperties = {
  padding: '24px',
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '24px'
};

const insightRowStyle: React.CSSProperties = {
  padding: '12px 16px',
  backgroundColor: 'rgba(255,255,255,0.01)',
  border: '1px solid var(--border-color)',
  borderRadius: '14px'
};

const rankingBadgeStyle = (idx: number): React.CSSProperties => {
  const colors = ['#eab308', '#94a3b8', '#b45309']; // Gold, Silver, Bronze
  const bg = idx < 3 ? colors[idx] : 'rgba(255,255,255,0.04)';
  const color = idx < 3 ? '#0a0a0c' : 'var(--text-secondary)';
  return {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '0.8rem',
    fontWeight: 800,
    backgroundColor: bg,
    color
  };
};

const stackedPercentageBarStyle: React.CSSProperties = {
  height: '14px',
  borderRadius: '6px',
  overflow: 'hidden',
  display: 'flex',
  backgroundColor: 'rgba(255,255,255,0.02)',
  border: '1px solid var(--border-color)'
};
