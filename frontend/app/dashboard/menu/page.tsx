'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '@/lib/api';
import { useToast } from '@/hooks/useToast';

// Form validation schema for Menu Item
const menuItemSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  price: z.number().min(0.01, 'Price must be greater than 0'),
  discountPrice: z.number().optional().nullable(),
  isVeg: z.boolean(),
  isAvailable: z.boolean(),
  preparationTime: z.number().min(1, 'Prep time must be at least 1 min'),
  spiceLevel: z.enum(['low', 'medium', 'high']),
  isPopular: z.boolean(),
  isFeatured: z.boolean(),
  modelUrl: z.string().optional(),
  previewImage: z.string().optional(),
  thumbnail: z.string().optional(),
  modelScale: z.number().optional(),
  rotation: z.number().optional(),
  lightingPreset: z.string().optional(),
  shadowIntensity: z.number().optional(),
  boundingBox: z.object({
    width: z.number(),
    height: z.number(),
    depth: z.number()
  }).optional(),
  polygonCount: z.number().optional(),
  textureResolution: z.string().optional(),
  compressed: z.boolean().optional(),
  previewGenerated: z.boolean().optional()
});

type MenuItemFormValues = z.infer<typeof menuItemSchema>;

export default function MenuPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedVeg, setSelectedVeg] = useState('');
  const [selectedSort, setSelectedSort] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [deletingItem, setDeletingItem] = useState<any | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isModelUploading, setIsModelUploading] = useState(false);

  // Category Modal Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatSort, setNewCatSort] = useState(0);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // Query: Fetch categories
  const { data: catData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data?.categories || [];
    }
  });

  // Query: Fetch menu items
  const { data: menuData, isLoading } = useQuery({
    queryKey: ['menu-items', search, selectedCategory, selectedVeg, selectedSort, currentPage],
    queryFn: async () => {
      const params: any = {
        page: currentPage,
        limit: 8,
        sort: selectedSort
      };
      if (search) params.search = search;
      if (selectedCategory) params.categoryId = selectedCategory;
      if (selectedVeg) params.isVeg = selectedVeg;

      const res = await api.get('/menu-items', { params });
      return res.data;
    }
  });

  const categories = catData || [];
  const menuItems = menuData?.items || [];
  const pagination = menuData?.pagination || { totalPages: 1, currentPage: 1, totalItems: 0 };

  // Form hook
  const {
    register: registerField,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors }
  } = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      name: '',
      description: '',
      categoryId: '',
      price: 0,
      discountPrice: null,
      isVeg: true,
      isAvailable: true,
      preparationTime: 15,
      spiceLevel: 'medium',
      isPopular: false,
      isFeatured: false,
      modelUrl: '',
      previewImage: '',
      thumbnail: '',
      modelScale: 1.0,
      rotation: 0,
      lightingPreset: 'default',
      shadowIntensity: 0.5,
      boundingBox: { width: 0, height: 0, depth: 0 },
      polygonCount: 0,
      textureResolution: '',
      compressed: false,
      previewGenerated: false
    }
  });

  const watchPrice = watch('price');

  // Open Form for Adding
  const handleAddItemClick = () => {
    setEditingItem(null);
    setLogoUrl('');
    reset({
      name: '',
      description: '',
      categoryId: categories[0]?._id || '',
      price: 0,
      discountPrice: null,
      isVeg: true,
      isAvailable: true,
      preparationTime: 15,
      spiceLevel: 'medium',
      isPopular: false,
      isFeatured: false,
      modelUrl: '',
      previewImage: '',
      thumbnail: '',
      modelScale: 1.0,
      rotation: 0,
      lightingPreset: 'default',
      shadowIntensity: 0.5,
      boundingBox: { width: 0, height: 0, depth: 0 },
      polygonCount: 0,
      textureResolution: '',
      compressed: false,
      previewGenerated: false
    });
    setIsFormOpen(true);
  };

  // Open Form for Editing
  const handleEditClick = (item: any) => {
    setEditingItem(item);
    setLogoUrl(item.imageUrl || '');
    reset({
      name: item.name,
      description: item.description || '',
      categoryId: item.categoryId?._id || item.categoryId,
      price: item.price,
      discountPrice: item.discountPrice || null,
      isVeg: item.isVeg,
      isAvailable: item.isAvailable,
      preparationTime: item.preparationTime || 15,
      spiceLevel: item.spiceLevel || 'medium',
      isPopular: item.isPopular || false,
      isFeatured: item.isFeatured || false,
      modelUrl: item.modelUrl || '',
      previewImage: item.previewImage || '',
      thumbnail: item.thumbnail || '',
      modelScale: item.modelScale !== undefined ? item.modelScale : 1.0,
      rotation: item.rotation !== undefined ? item.rotation : 0,
      lightingPreset: item.lightingPreset || 'default',
      shadowIntensity: item.shadowIntensity !== undefined ? item.shadowIntensity : 0.5,
      boundingBox: item.boundingBox || { width: 0, height: 0, depth: 0 },
      polygonCount: item.polygonCount || 0,
      textureResolution: item.textureResolution || '',
      compressed: item.compressed || false,
      previewGenerated: item.previewGenerated || false
    });
    setIsFormOpen(true);
  };

  // Mutate: Upload Image
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && res.data.success) {
        setLogoUrl(res.data.url);
        toast.success('Image uploaded', 'Food cover picture uploaded successfully.');
      }
    } catch (error: any) {
      toast.error('Upload failed', 'Failed to upload menu item image.');
    } finally {
      setIsUploading(false);
    }
  };

  // Mutate: Upload GLB 3D Model
  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsModelUploading(true);
    const formData = new FormData();
    formData.append('model', file);

    try {
      const res = await api.post('/upload/model', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && res.data.success) {
        setValue('modelUrl', res.data.url);
        toast.success('3D Model uploaded', 'GLB asset uploaded successfully.');
      }
    } catch (error: any) {
      toast.error('Upload failed', error.response?.data?.error || 'Failed to upload GLB model.');
    } finally {
      setIsModelUploading(false);
    }
  };

  // Mutate: Save Menu Item
  const handleSaveItem = async (values: MenuItemFormValues) => {
    const payload = {
      ...values,
      imageUrl: logoUrl
    };

    try {
      if (editingItem) {
        await api.put(`/menu-items/${editingItem._id}`, payload);
        toast.success('Item updated', `${values.name} has been updated.`);
      } else {
        await api.post('/menu-items', payload);
        toast.success('Item added', `${values.name} has been added to your menu.`);
      }
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      setIsFormOpen(false);
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Failed to save menu item.';
      toast.error('Save failed', msg);
    }
  };

  // Mutate: Delete Menu Item
  const handleDeleteItem = async () => {
    if (!deletingItem) return;
    try {
      await api.delete(`/menu-items/${deletingItem._id}`);
      toast.success('Item deleted', `${deletingItem.name} has been removed.`);
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      setDeletingItem(null);
    } catch (error) {
      toast.error('Delete failed', 'Could not delete item.');
    }
  };

  // Mutate: Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;

    try {
      if (editingCatId) {
        await api.put(`/categories/${editingCatId}`, {
          name: newCatName,
          description: newCatDesc,
          sortOrder: newCatSort
        });
        toast.success('Category updated', 'Food category updated successfully.');
      } else {
        await api.post('/categories', {
          name: newCatName,
          description: newCatDesc,
          sortOrder: newCatSort
        });
        toast.success('Category created', 'New food category added.');
      }
      setNewCatName('');
      setNewCatDesc('');
      setNewCatSort(0);
      setEditingCatId(null);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    } catch (error) {
      toast.error('Save failed', 'Could not save category.');
    }
  };

  // Edit Category Trigger
  const handleEditCat = (cat: any) => {
    setEditingCatId(cat._id);
    setNewCatName(cat.name);
    setNewCatDesc(cat.description || '');
    setNewCatSort(cat.sortOrder || 0);
  };

  // Delete Category Trigger
  const handleDeleteCat = async (catId: string) => {
    if (confirm('Deletes category and all food items in it. Confirm?')) {
      try {
        await api.delete(`/categories/${catId}`);
        toast.success('Category deleted', 'Category and menu items cascade deleted.');
        queryClient.invalidateQueries({ queryKey: ['categories'] });
        queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      } catch (error) {
        toast.error('Delete failed', 'Could not delete category.');
      }
    }
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerRowStyle}>
        <div>
          <h1 style={titleStyle}>Menu Editor</h1>
          <p style={subtitleStyle}>Create categories and upload food items with prices and tags.</p>
        </div>
        <div style={headerActionsStyle}>
          <button onClick={() => setIsCategoryOpen(true)} className="clay-btn clay-btn-secondary">
            📂 Categories ({categories.length})
          </button>
          <button onClick={handleAddItemClick} className="clay-btn clay-btn-primary">
            ➕ Add Food Item
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="clay-card" style={filtersPanelStyle}>
        <div className="form-group" style={{ flexGrow: 1, marginBottom: 0 }}>
          <input
            type="text"
            placeholder="Search pizza, burger, cocktail..."
            className="clay-input"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <div style={dropdownsRowStyle}>
          <select
            className="clay-input"
            style={selectStyle}
            value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
          >
            <option value="">All Categories</option>
            {categories.map((c: any) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>

          <select
            className="clay-input"
            style={selectStyle}
            value={selectedVeg}
            onChange={(e) => { setSelectedVeg(e.target.value); setCurrentPage(1); }}
          >
            <option value="">All Diets</option>
            <option value="true">🟢 Veg Only</option>
            <option value="false">🔴 Non-Veg Only</option>
          </select>

          <select
            className="clay-input"
            style={selectStyle}
            value={selectedSort}
            onChange={(e) => { setSelectedSort(e.target.value); setCurrentPage(1); }}
          >
            <option value="newest">Newest First</option>
            <option value="priceAsc">Price: Low to High</option>
            <option value="priceDesc">Price: High to Low</option>
            <option value="nameAsc">Name: A to Z</option>
          </select>
        </div>
      </div>

      {/* Menu Item Table */}
      <div className="clay-card" style={{ padding: 0, overflowX: 'auto', border: '1px solid rgba(255,255,255,0.04)' }}>
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div className="pulse-glow-indicator" style={{ color: 'var(--primary-color)' }}></div>
          </div>
        ) : menuItems.length === 0 ? (
          <div style={emptyStateStyle}>
            <span style={{ fontSize: '3rem' }}>🥗</span>
            <h3>No menu items found</h3>
            <p style={{ color: 'var(--text-secondary)', margin: '8px 0 24px', maxWidth: '360px' }}>
              Create categories and add some appetizers, main courses or beverages to get started.
            </p>
            <button onClick={handleAddItemClick} className="clay-btn clay-btn-primary">
              Add First Food Item
            </button>
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr style={tableHeaderRowStyle}>
                <th style={thStyle}>Image</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Price</th>
                <th style={thStyle}>Prep Time</th>
                <th style={thStyle}>Spice</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {menuItems.map((item: any) => (
                <tr key={item._id} style={tableRowStyle}>
                  <td style={tdStyle}>
                    <div style={tableThumbnailWrapperStyle}>
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt={item.name} style={tableThumbnailStyle} />
                      ) : (
                        <span>🍽️</span>
                      )}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '0.95rem' }}>{item.name}</strong>
                        {item.isVeg ? (
                          <span style={vegDotStyle} title="Veg">🟢</span>
                        ) : (
                          <span style={nonVegDotStyle} title="Non-Veg">🔴</span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {item.description || 'No description'}
                      </span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={categoryBadgeStyle}>
                      {item.categoryId?.name || 'Uncategorized'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {item.discountPrice ? (
                      <div>
                        <span style={discountPriceStyle}>${item.discountPrice}</span>
                        <span style={originalPriceStrikethroughStyle}>${item.price}</span>
                      </div>
                    ) : (
                      <span style={{ fontWeight: 700 }}>${item.price}</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '0.85rem' }}>⏱️ {item.preparationTime || 15}m</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>
                      {item.spiceLevel === 'high' ? '🔥 High' : item.spiceLevel === 'medium' ? '🌶️ Mid' : '🍃 Low'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span className={`clay-badge ${item.isAvailable ? 'clay-badge-success' : 'clay-badge-danger'}`} style={{ fontSize: '0.65rem' }}>
                      {item.isAvailable ? 'Available' : 'Sold Out'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => handleEditClick(item)} className="clay-btn clay-btn-secondary" style={actionBtnStyle}>
                        ✏️
                      </button>
                      <button onClick={() => setDeletingItem(item)} className="clay-btn clay-btn-secondary" style={{ ...actionBtnStyle, color: 'var(--color-danger)' }}>
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination controls */}
      {menuItems.length > 0 && (
        <div style={paginationRowStyle}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Showing <strong>{menuItems.length}</strong> of <strong>{pagination.totalItems}</strong> items
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="clay-btn clay-btn-secondary"
              style={pageBtnStyle}
            >
              ◀️ Previous
            </button>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.9rem', padding: '0 8px' }}>
              Page <strong>{pagination.currentPage}</strong> of <strong>{pagination.totalPages}</strong>
            </span>
            <button
              disabled={currentPage >= pagination.totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="clay-btn clay-btn-secondary"
              style={pageBtnStyle}
            >
              Next ▶️
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: Food Item Add/Edit */}
      {isFormOpen && (
        <div style={modalBackdropStyle}>
          <div className="clay-card float-animation" style={modalContentStyle}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: '1.25rem' }}>{editingItem ? 'Edit Menu Item' : 'Add Food Item'}</h2>
              <button onClick={() => setIsFormOpen(false)} style={closeModalBtnStyle}>&times;</button>
            </div>

            <form onSubmit={handleSubmit(handleSaveItem)} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flexGrow: 1 }}>
              {/* Form Scroll Body */}
              <div style={modalBodyStyle}>
                
                {/* Upload Thumbnail Row */}
                <div style={formLogoRowStyle}>
                  <div style={formLogoPreviewStyle}>
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1.5rem' }}>📸</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="clay-btn clay-btn-secondary" style={{ cursor: 'pointer', fontSize: '0.8rem', padding: '8px 16px', alignSelf: 'flex-start' }}>
                      {isUploading ? 'Uploading...' : 'Choose Picture'}
                      <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={isUploading} />
                    </label>
                    <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Supported: PNG, JPG, JPEG (Max 5MB)</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Dish Name</label>
                  <input type="text" placeholder="Cheesy Margherita Pizza" className="clay-input" {...registerField('name')} />
                  {errors.name && <span className="form-error">{errors.name.message}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea placeholder="Crispy crust, tomato sauce, basil leaves, extra cheese..." className="clay-input" style={{ minHeight: '80px', resize: 'vertical' }} {...registerField('description')} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="clay-input" {...registerField('categoryId')}>
                      {categories.map((c: any) => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                    {errors.categoryId && <span className="form-error">{errors.categoryId.message}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Dietary Type</label>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', height: '45px' }}>
                      <div
                        onClick={() => setValue('isVeg', true)}
                        className="clay-card clay-card-interactive"
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          fontSize: '0.825rem',
                          fontWeight: 600,
                          transition: 'var(--transition-clay)',
                          backgroundColor: watch('isVeg') === true ? 'rgba(34, 197, 94, 0.12)' : 'rgba(10, 10, 11, 0.4)',
                          border: watch('isVeg') === true ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid var(--border-color)',
                          boxShadow: watch('isVeg') === true ? 'var(--clay-btn-success-shadow)' : 'none',
                          borderRadius: '12px',
                          color: watch('isVeg') === true ? '#22c55e' : 'var(--text-secondary)'
                        }}
                      >
                        🟢 Veg
                      </div>

                      <div
                        onClick={() => setValue('isVeg', false)}
                        className="clay-card clay-card-interactive"
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          fontSize: '0.825rem',
                          fontWeight: 600,
                          transition: 'var(--transition-clay)',
                          backgroundColor: watch('isVeg') === false ? 'rgba(239, 68, 68, 0.12)' : 'rgba(10, 10, 11, 0.4)',
                          border: watch('isVeg') === false ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)',
                          boxShadow: watch('isVeg') === false ? 'var(--clay-btn-danger-shadow)' : 'none',
                          borderRadius: '12px',
                          color: watch('isVeg') === false ? '#ef4444' : 'var(--text-secondary)'
                        }}
                      >
                        🔴 Non-Veg
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Price ($)</label>
                    <input type="number" step="0.01" className="clay-input" {...registerField('price', { valueAsNumber: true })} />
                    {errors.price && <span className="form-error">{errors.price.message}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Discount Price ($ - Optional)</label>
                    <input type="number" step="0.01" placeholder="e.g. 9.99" className="clay-input" {...registerField('discountPrice', { valueAsNumber: true, setValueAs: v => v === '' || isNaN(v) ? null : v })} />
                    {errors.discountPrice && <span className="form-error">{errors.discountPrice.message}</span>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Preparation Time (minutes)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '45px' }}>
                      <input type="range" min="1" max="90" style={{ flexGrow: 1 }} {...registerField('preparationTime', { valueAsNumber: true })} />
                      <strong style={{ width: '40px' }}>{watch('preparationTime')}m</strong>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Spice Level</label>
                    <select className="clay-input" {...registerField('spiceLevel')}>
                      <option value="low">🍃 Low Spice</option>
                      <option value="medium">🌶️ Medium Spice</option>
                      <option value="high">🔥 High Spice</option>
                    </select>
                  </div>
                </div>

                {/* Badges / Availability row */}
                <div style={formCheckboxesRowStyle} className="clay-card">
                  <label style={checkboxWrapperStyle}>
                    <input type="checkbox" style={checkboxInputStyle} {...registerField('isAvailable')} />
                    <div>
                      <strong>Available in menu</strong>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Instantly show or hide from QR menu</p>
                    </div>
                  </label>

                  <label style={checkboxWrapperStyle}>
                    <input type="checkbox" style={checkboxInputStyle} {...registerField('isPopular')} />
                    <div>
                      <strong>Popular badge</strong>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Displays a fire star label icon</p>
                    </div>
                  </label>

                  <label style={checkboxWrapperStyle}>
                    <input type="checkbox" style={checkboxInputStyle} {...registerField('isFeatured')} />
                    <div>
                      <strong>Featured recommendation</strong>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Shows item enlarged at the top</p>
                    </div>
                  </label>
                </div>

                {/* 3D Model Settings Section */}
                <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '12px', color: 'var(--accent-color)' }}>
                    Augmented Reality (WebXR) 3D Model
                  </h3>
                  
                  <div style={formLogoRowStyle}>
                    <div style={formLogoPreviewStyle}>
                      {watch('modelUrl') ? (
                        <span style={{ fontSize: '1.5rem' }}>📦</span>
                      ) : (
                        <span style={{ fontSize: '1.5rem' }}>🌐</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label className="clay-btn clay-btn-secondary" style={{ cursor: 'pointer', fontSize: '0.8rem', padding: '8px 16px', alignSelf: 'flex-start' }}>
                        {isModelUploading ? 'Uploading GLB...' : watch('modelUrl') ? 'Replace GLB Model' : 'Upload GLB Model'}
                        <input type="file" accept=".glb" onChange={handleModelUpload} style={{ display: 'none' }} disabled={isModelUploading} />
                      </label>
                      <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Only binary GLB files are supported (Max 20MB)</span>
                    </div>
                  </div>

                  {watch('modelUrl') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '16px' }} className="clay-card">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Model Scale Multiplier</label>
                          <input type="number" step="0.05" className="clay-input" {...registerField('modelScale', { valueAsNumber: true })} style={{ padding: '8px 12px', fontSize: '0.85rem' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Rotation Offset (Y-axis)</label>
                          <input type="number" step="0.1" className="clay-input" {...registerField('rotation', { valueAsNumber: true })} style={{ padding: '8px 12px', fontSize: '0.85rem' }} />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Lighting Preset</label>
                          <select className="clay-input" {...registerField('lightingPreset')} style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
                            <option value="default">Default Studio</option>
                            <option value="warm">Warm Bistro</option>
                            <option value="cool">Cool Lounge</option>
                            <option value="outdoor">Bright Daylight</option>
                            <option value="restaurant">Ambient Restaurant</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Contact Shadow Opacity</label>
                          <input type="number" step="0.05" min="0" max="1" className="clay-input" {...registerField('shadowIntensity', { valueAsNumber: true })} style={{ padding: '8px 12px', fontSize: '0.85rem' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Footer */}
              <div style={modalFooterStyle}>
                <button type="button" onClick={() => setIsFormOpen(false)} className="clay-btn clay-btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="clay-btn clay-btn-primary">
                  Save Dish 🍕
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Categories Editor */}
      {isCategoryOpen && (
        <div style={modalBackdropStyle}>
          <div className="clay-card float-animation" style={{ ...modalContentStyle, maxWidth: '520px' }}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: '1.25rem' }}>Manage Categories</h2>
              <button onClick={() => setIsCategoryOpen(false)} style={closeModalBtnStyle}>&times;</button>
            </div>

            <div style={modalBodyStyle}>
              {/* Category creation form */}
              <form onSubmit={handleSaveCategory} className="clay-card" style={{ marginBottom: '20px', padding: '16px' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>
                  {editingCatId ? 'Edit Category' : 'Create Category'}
                </h4>
                
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Name</label>
                  <input type="text" className="clay-input" style={{ padding: '8px 12px', fontSize: '0.85rem' }} value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="e.g. Pizzas" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Description</label>
                    <input type="text" className="clay-input" style={{ padding: '8px 12px', fontSize: '0.85rem' }} value={newCatDesc} onChange={(e) => setNewCatDesc(e.target.value)} placeholder="e.g. Thin crust woodfired pizzas" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Sort</label>
                    <input type="number" className="clay-input" style={{ padding: '8px 12px', fontSize: '0.85rem' }} value={newCatSort} onChange={(e) => setNewCatSort(parseInt(e.target.value) || 0)} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  {editingCatId && (
                    <button type="button" onClick={() => { setEditingCatId(null); setNewCatName(''); setNewCatDesc(''); setNewCatSort(0); }} className="clay-btn clay-btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="clay-btn clay-btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    {editingCatId ? 'Update' : 'Add Category'}
                  </button>
                </div>
              </form>

              {/* Categories list */}
              <h4 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Categories List</h4>
              {categories.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '16px' }}>No categories created.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {categories.map((cat: any) => (
                    <div key={cat._id} style={catRowStyle} className="clay-card">
                      <div>
                        <strong>{cat.name}</strong>
                        {cat.description && <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{cat.description}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Order: {cat.sortOrder}</span>
                        <button onClick={() => handleEditCat(cat)} style={catActionBtnStyle}>✏️</button>
                        <button onClick={() => handleDeleteCat(cat._id)} style={{ ...catActionBtnStyle, color: 'var(--color-danger)' }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Delete Confirmation */}
      {deletingItem && (
        <div style={modalBackdropStyle}>
          <div className="clay-card float-animation" style={{ ...modalContentStyle, maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
            <span style={{ fontSize: '3rem' }}>⚠️</span>
            <h2 style={{ fontSize: '1.25rem', margin: '16px 0 8px' }}>Delete Menu Item</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{deletingItem.name}</strong>? This action is permanent and cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => setDeletingItem(null)} className="clay-btn clay-btn-secondary" style={{ flexGrow: 1 }}>
                Cancel
              </button>
              <button onClick={handleDeleteItem} className="clay-btn clay-btn-danger" style={{ flexGrow: 1 }}>
                Delete 🗑️
              </button>
            </div>
          </div>
        </div>
      )}
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

const headerActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px'
};

const filtersPanelStyle: React.CSSProperties = {
  display: 'flex',
  gap: '20px',
  padding: '20px',
  border: '1px solid rgba(255, 255, 255, 0.04)',
  flexWrap: 'wrap',
  alignItems: 'center'
};

const dropdownsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap'
};

const selectStyle: React.CSSProperties = {
  width: '180px',
  padding: '10px 16px',
  fontSize: '0.85rem'
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '80px 40px',
  textAlign: 'center'
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  textAlign: 'left',
  minWidth: '700px'
};

const tableHeaderRowStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border-color)',
  backgroundColor: 'rgba(255,255,255,0.01)'
};

const thStyle: React.CSSProperties = {
  padding: '16px 24px',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const tableRowStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border-color)',
  transition: 'background-color 0.2s ease'
};

const tdStyle: React.CSSProperties = {
  padding: '16px 24px',
  fontSize: '0.875rem',
  verticalAlign: 'middle'
};

const tableThumbnailWrapperStyle: React.CSSProperties = {
  width: '44px',
  height: '44px',
  borderRadius: '10px',
  backgroundColor: 'rgba(10,10,11,0.6)',
  border: '1px solid var(--border-color)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  fontSize: '1.25rem'
};

const tableThumbnailStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover'
};

const vegDotStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  cursor: 'default'
};

const nonVegDotStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  cursor: 'default'
};

const categoryBadgeStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '8px',
  padding: '4px 10px',
  fontSize: '0.75rem',
  color: 'var(--text-secondary)'
};

const discountPriceStyle: React.CSSProperties = {
  fontWeight: 700,
  marginRight: '8px',
  color: 'var(--accent-color)'
};

const originalPriceStrikethroughStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  textDecoration: 'line-through'
};

const actionBtnStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  fontSize: '0.85rem'
};

const paginationRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '12px'
};

const pageBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '0.8rem',
  borderRadius: '10px'
};

// Modal styling
const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.7)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 9999,
  padding: '20px'
};

const modalContentStyle: React.CSSProperties = {
  maxWidth: '600px',
  width: '100%',
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  boxShadow: '20px 30px 60px rgba(0,0,0,0.7)',
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  maxHeight: 'calc(100vh - 40px)',
  overflow: 'hidden'
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '24px 32px',
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
  padding: '32px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
  flexGrow: 1
};

const modalFooterStyle: React.CSSProperties = {
  padding: '20px 32px',
  borderTop: '1px solid var(--border-color)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '16px',
  backgroundColor: 'rgba(255,255,255,0.01)'
};

const formLogoRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px'
};

const formLogoPreviewStyle: React.CSSProperties = {
  width: '64px',
  height: '64px',
  borderRadius: '12px',
  backgroundColor: 'rgba(10,10,11,0.6)',
  border: '1px solid var(--border-color)',
  boxShadow: 'var(--clay-input-shadow)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden'
};

const radioWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  cursor: 'pointer',
  fontSize: '0.9rem'
};

const radioStyle: React.CSSProperties = {
  width: '16px',
  height: '16px',
  cursor: 'pointer'
};

const formCheckboxesRowStyle: React.CSSProperties = {
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  backgroundColor: 'rgba(10, 10, 11, 0.2)',
  border: '1px solid var(--border-color)',
  borderRadius: '16px'
};

const checkboxWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  cursor: 'pointer'
};

const checkboxInputStyle: React.CSSProperties = {
  width: '18px',
  height: '18px',
  cursor: 'pointer',
  marginTop: '2px'
};

// Category items list row
const catRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  backgroundColor: 'rgba(10,10,11,0.2)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px'
};

const catActionBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.95rem',
  padding: '4px'
};
