'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { useToast } from '@/hooks/useToast';

const settingsSchema = z.object({
  name: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').or(z.literal('')),
  cuisineInput: z.string().optional(), // Temporary field to parse as string[]
  gstNumber: z.string().optional(),
  socialLinks: z.object({
    instagram: z.string().optional(),
    facebook: z.string().optional(),
    twitter: z.string().optional()
  }),
  openingHours: z.array(
    z.object({
      day: z.string(),
      open: z.string(),
      close: z.string(),
      isClosed: z.boolean()
    })
  ),
  orderSettings: z.object({
    qrOrderingEnabled: z.boolean(),
    whatsappOrderingEnabled: z.boolean()
  }),
  whatsappSettings: z.object({
    whatsappNumber: z.string().optional(),
    businessName: z.string().optional(),
    orderPrefix: z.string().optional(),
    notificationsEnabled: z.boolean(),
    autoSend: z.boolean(),
    timezone: z.string().optional()
  })
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

type TabType = 'profile' | 'hours' | 'orders';

export default function SettingsPage() {
  const { restaurant, refetchAuth } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [logoUrl, setLogoUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register: registerField,
    handleSubmit,
    control,
    reset,
    formState: { errors }
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: '',
      address: '',
      phone: '',
      email: '',
      cuisineInput: '',
      gstNumber: '',
      socialLinks: { instagram: '', facebook: '', twitter: '' },
      openingHours: [],
      orderSettings: { qrOrderingEnabled: true, whatsappOrderingEnabled: false },
      whatsappSettings: {
        whatsappNumber: '',
        businessName: '',
        orderPrefix: '#DIS',
        notificationsEnabled: true,
        autoSend: true,
        timezone: 'Asia/Kolkata'
      }
    }
  });

  const { fields } = useFieldArray({
    control,
    name: 'openingHours'
  });

  // Populate form with current restaurant data
  useEffect(() => {
    if (restaurant) {
      setLogoUrl(restaurant.logoUrl || '');
      reset({
        name: restaurant.name || '',
        address: restaurant.address || '',
        phone: restaurant.phone || '',
        email: restaurant.email || '',
        cuisineInput: restaurant.cuisine ? restaurant.cuisine.join(', ') : '',
        gstNumber: restaurant.gstNumber || '',
        socialLinks: {
          instagram: restaurant.socialLinks?.instagram || '',
          facebook: restaurant.socialLinks?.facebook || '',
          twitter: restaurant.socialLinks?.twitter || ''
        },
        openingHours: restaurant.openingHours || [],
        orderSettings: {
          qrOrderingEnabled: restaurant.orderSettings?.qrOrderingEnabled ?? true,
          whatsappOrderingEnabled: restaurant.orderSettings?.whatsappOrderingEnabled ?? false
        },
        whatsappSettings: {
          whatsappNumber: restaurant.whatsappSettings?.whatsappNumber || '',
          businessName: restaurant.whatsappSettings?.businessName || '',
          orderPrefix: restaurant.whatsappSettings?.orderPrefix || '#DIS',
          notificationsEnabled: restaurant.whatsappSettings?.notificationsEnabled ?? true,
          autoSend: restaurant.whatsappSettings?.autoSend ?? true,
          timezone: restaurant.whatsappSettings?.timezone || 'Asia/Kolkata'
        }
      });
    }
  }, [restaurant, reset]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large', 'Maximum size is 5MB.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && res.data.success) {
        setLogoUrl(res.data.url);
        toast.success('Logo uploaded!', 'Your new restaurant logo has been applied.');
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Failed to upload image. Please try again.';
      toast.error('Upload failed', msg);
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (values: SettingsFormValues) => {
    setIsSaving(true);
    // Parse cuisines comma separated into array
    const cuisine = values.cuisineInput
      ? values.cuisineInput.split(',').map((c) => c.trim()).filter(Boolean)
      : [];

    const payload = {
      ...values,
      cuisine,
      logoUrl
    };

    try {
      const res = await api.put('/restaurant', payload);
      if (res.data && res.data.success) {
        toast.success('Settings updated', 'Your restaurant profile has been saved.');
        await refetchAuth();
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Failed to save settings. Please try again.';
      toast.error('Save failed', msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={headerRowStyle}>
        <h1 style={titleStyle}>Settings</h1>
        <p style={subtitleStyle}>Configure restaurant profile, working hours, and QR ordering details.</p>
      </div>

      <div style={layoutGridStyle}>
        {/* Tab Selection */}
        <div style={tabsColumnStyle}>
          <button
            onClick={() => setActiveTab('profile')}
            style={activeTab === 'profile' ? activeTabButtonStyle : tabButtonStyle}
          >
            🏢 Profile Details
          </button>
          <button
            onClick={() => setActiveTab('hours')}
            style={activeTab === 'hours' ? activeTabButtonStyle : tabButtonStyle}
          >
            ⏰ Operating Hours
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            style={activeTab === 'orders' ? activeTabButtonStyle : tabButtonStyle}
          >
            ⚙️ Order Settings
          </button>
        </div>

        {/* Tab Content Panel */}
        <form onSubmit={handleSubmit(onSubmit)} className="clay-card" style={formPanelStyle}>
          {activeTab === 'profile' && (
            <div style={tabContentStyle}>
              <h3 style={sectionTitleStyle}>Restaurant Profile</h3>
              
              {/* Logo Upload Section */}
              <div style={logoUploadRowStyle}>
                <div style={logoPreviewWrapperStyle}>
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo" style={logoImageStyle} />
                  ) : (
                    <span style={{ fontSize: '2rem' }}>🏢</span>
                  )}
                </div>
                <div>
                  <label className="clay-btn clay-btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', fontSize: '0.85rem' }}>
                    {isUploading ? 'Uploading...' : 'Choose Logo'}
                    <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} disabled={isUploading} />
                  </label>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                    JPEG, PNG or WEBP formats. Max 5MB file.
                  </p>
                </div>
              </div>

              {/* Text Fields Grid */}
              <div style={formGridStyle}>
                <div className="form-group">
                  <label className="form-label">Restaurant Name</label>
                  <input type="text" className="clay-input" {...registerField('name')} />
                  {errors.name && <span className="form-error">{errors.name.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Cuisines (comma separated)</label>
                  <input type="text" placeholder="Italian, Pizza, Desserts" className="clay-input" {...registerField('cuisineInput')} />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input type="text" className="clay-input" {...registerField('phone')} />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input type="email" className="clay-input" {...registerField('email')} />
                  {errors.email && <span className="form-error">{errors.email.message}</span>}
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Address</label>
                  <input type="text" className="clay-input" {...registerField('address')} />
                </div>

                <div className="form-group">
                  <label className="form-label">GSTIN / Tax Number</label>
                  <input type="text" placeholder="GSTIN-22AAAAA0000A1Z" className="clay-input" {...registerField('gstNumber')} />
                </div>
              </div>

              <h3 style={{ ...sectionTitleStyle, marginTop: '24px' }}>Social Links</h3>
              <div style={formGridStyle}>
                <div className="form-group">
                  <label className="form-label">Instagram Link</label>
                  <input type="text" placeholder="instagram.com/my-cafe" className="clay-input" {...registerField('socialLinks.instagram')} />
                </div>

                <div className="form-group">
                  <label className="form-label">Facebook Link</label>
                  <input type="text" placeholder="facebook.com/my-cafe" className="clay-input" {...registerField('socialLinks.facebook')} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'hours' && (
            <div style={tabContentStyle}>
              <h3 style={sectionTitleStyle}>Operating Hours</h3>
              <p style={{ ...subtitleStyle, marginBottom: '20px' }}>Set your opening and closing times for each weekday.</p>
              
              <div style={hoursListStyle}>
                {fields.map((field, index) => (
                  <div key={field.id} style={hoursRowStyle} className="clay-card">
                    <strong style={{ width: '120px', fontFamily: 'var(--font-heading)' }}>{field.day}</strong>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id={`hours-${index}-closed`}
                        style={checkboxStyle}
                        {...registerField(`openingHours.${index}.isClosed`)}
                      />
                      <label htmlFor={`hours-${index}-closed`} style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Closed</label>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: control._formValues.openingHours?.[index]?.isClosed ? 0.3 : 1 }}>
                      <input
                        type="time"
                        className="clay-input"
                        style={{ width: '120px', padding: '6px 12px', fontSize: '0.85rem' }}
                        disabled={control._formValues.openingHours?.[index]?.isClosed}
                        {...registerField(`openingHours.${index}.open`)}
                      />
                      <span>to</span>
                      <input
                        type="time"
                        className="clay-input"
                        style={{ width: '120px', padding: '6px 12px', fontSize: '0.85rem' }}
                        disabled={control._formValues.openingHours?.[index]?.isClosed}
                        {...registerField(`openingHours.${index}.close`)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div style={tabContentStyle}>
              <h3 style={sectionTitleStyle}>QR Ordering Core Settings</h3>
              
              <div style={toggleOptionWrapperStyle} className="clay-card">
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '4px' }}>QR Table Ordering</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Allow customers to scan table QR codes and place orders directly.
                  </p>
                </div>
                <input
                  type="checkbox"
                  style={switchStyle}
                  {...registerField('orderSettings.qrOrderingEnabled')}
                />
              </div>

              <h3 style={{ ...sectionTitleStyle, marginTop: '20px' }}>WhatsApp Notifications Settings</h3>

              <div style={toggleOptionWrapperStyle} className="clay-card">
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '4px' }}>Enable WhatsApp Notifications</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Receive a WhatsApp ping instantly whenever a guest places a new table order.
                  </p>
                </div>
                <input
                  type="checkbox"
                  style={switchStyle}
                  {...registerField('whatsappSettings.notificationsEnabled')}
                />
              </div>

              <div style={toggleOptionWrapperStyle} className="clay-card">
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '4px' }}>Auto-Send Alerts</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Trigger the notification automatically at guest checkout. If disabled, alerts can be sent manually from the dashboard.
                  </p>
                </div>
                <input
                  type="checkbox"
                  style={switchStyle}
                  {...registerField('whatsappSettings.autoSend')}
                />
              </div>

              <div className="form-group">
                <label className="form-label">WhatsApp Notification Number</label>
                <input
                  type="text"
                  placeholder="e.g. +919876543210 (include country code)"
                  className="clay-input"
                  {...registerField('whatsappSettings.whatsappNumber')}
                />
              </div>

              <div style={formGridStyle}>
                <div className="form-group">
                  <label className="form-label">Business Display Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Dishiq Cafe"
                    className="clay-input"
                    {...registerField('whatsappSettings.businessName')}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Order Prefix</label>
                  <input
                    type="text"
                    placeholder="e.g. #DIS"
                    className="clay-input"
                    {...registerField('whatsappSettings.orderPrefix')}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notification Timezone</label>
                <input
                  type="text"
                  placeholder="e.g. Asia/Kolkata"
                  className="clay-input"
                  {...registerField('whatsappSettings.timezone')}
                />
              </div>
            </div>
          )}

          {/* Form Save Button */}
          <div style={formFooterStyle}>
            <button
              type="submit"
              disabled={isSaving}
              className="clay-btn clay-btn-primary"
              style={{ padding: '12px 32px' }}
            >
              {isSaving ? 'Saving Changes...' : 'Save Settings 💾'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Styling definitions
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
  animation: 'fadeIn 0.4s ease'
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
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

const layoutGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '240px 1fr',
  gap: '32px',
  alignItems: 'start'
};

const tabsColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px'
};

const tabButtonStyle: React.CSSProperties = {
  backgroundColor: 'transparent',
  border: 'none',
  padding: '14px 20px',
  borderRadius: '16px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'var(--font-heading)',
  fontWeight: 600,
  fontSize: '0.925rem',
  transition: 'var(--transition-clay)'
};

const activeTabButtonStyle: React.CSSProperties = {
  ...tabButtonStyle,
  backgroundColor: 'var(--surface-bg)',
  boxShadow: 'var(--clay-input-shadow)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-primary)'
};

const formPanelStyle: React.CSSProperties = {
  padding: '32px',
  border: '1px solid rgba(255, 255, 255, 0.04)'
};

const tabContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px'
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 700,
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: '12px',
  marginBottom: '8px'
};

const logoUploadRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '24px'
};

const logoPreviewWrapperStyle: React.CSSProperties = {
  width: '80px',
  height: '80px',
  borderRadius: '20px',
  backgroundColor: 'rgba(10, 10, 11, 0.6)',
  border: '1px solid var(--border-color)',
  boxShadow: 'var(--clay-input-shadow)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden'
};

const logoImageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover'
};

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '20px'
};

const formFooterStyle: React.CSSProperties = {
  borderTop: '1px solid var(--border-color)',
  paddingTop: '24px',
  marginTop: '32px',
  display: 'flex',
  justifyContent: 'flex-end'
};

const hoursListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px'
};

const hoursRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 24px',
  backgroundColor: 'rgba(10, 10, 11, 0.2)',
  border: '1px solid var(--border-color)',
  borderRadius: '16px',
  boxShadow: 'var(--clay-card-shadow)'
};

const checkboxStyle: React.CSSProperties = {
  width: '18px',
  height: '18px',
  cursor: 'pointer',
  borderRadius: '4px'
};

const toggleOptionWrapperStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '20px 24px',
  border: '1px solid var(--border-color)',
  borderRadius: '20px',
  backgroundColor: 'rgba(10, 10, 11, 0.2)'
};

const switchStyle: React.CSSProperties = {
  width: '44px',
  height: '24px',
  cursor: 'pointer'
};
