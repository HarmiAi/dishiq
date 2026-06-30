'use client';

import React, { useState, useEffect, use, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { resolveAssetUrl } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useRouter } from 'next/navigation';
import { ModelViewer } from '@/components/ModelViewer';
import { CameraViewer } from '@/components/CameraViewer';
import { AnimatePresence } from 'framer-motion';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string }>;
}

export default function PublicMenuPage({ params, searchParams }: PageProps) {
  const resolvedParams = use(params);
  const resolvedSearchParams = use(searchParams);
  const slug = resolvedParams.slug;
  const tableNumber = resolvedSearchParams.table;

  const queryClient = useQueryClient();
  const toast = useToast();
  const router = useRouter();

  const [sessionToken, setSessionToken] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Checkout States
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [customTableNumber, setCustomTableNumber] = useState('');
  const [orderStatusState, setOrderStatusState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [placedOrderNumber, setPlacedOrderNumber] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [selected3DItem, setSelected3DItem] = useState<any>(null);
  const [selectedARItem, setSelectedARItem] = useState<any>(null);
  const [isARSupported, setIsARSupported] = useState(false);

  useEffect(() => {
    const checkARSupport = async () => {
      if (typeof window === 'undefined') return;
      const a = document.createElement('a');
      const supportsQuickLook = !!(a.relList && a.relList.supports && a.relList.supports('ar'));
      let supportsWebXR = false;
      if (navigator.xr) {
        try {
          supportsWebXR = await navigator.xr.isSessionSupported('immersive-ar');
        } catch (e) {
          // ignore
        }
      }
      const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
      setIsARSupported(supportsQuickLook || supportsWebXR || isMobile);
    };
    checkARSupport();
  }, []);

  // References for category section scrolling
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Generate or retrieve persistent anonymous session token
  useEffect(() => {
    let token = localStorage.getItem('dishiq_customer_session');
    if (!token) {
      token = `cust_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
      localStorage.setItem('dishiq_customer_session', token);
    }
    setSessionToken(token);
  }, []);

  // Initialize table number from URL
  useEffect(() => {
    if (tableNumber) {
      setCustomTableNumber(tableNumber);
    }
  }, [tableNumber]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !customTableNumber) {
      setCheckoutError('Please fill in your name, phone, and table number.');
      return;
    }

    setOrderStatusState('loading');
    setCheckoutError('');

    try {
      const res = await api.post('/orders', {
        customerName,
        customerPhone,
        notes,
        tableNumber: customTableNumber,
        sessionToken,
        restaurantId: restaurant?._id
      });

      if (res.data && res.data.success) {
        setOrderStatusState('success');
        setPlacedOrderNumber(res.data.order?.orderNumber || 'Pending');
        toast.success('Order placed!', `Your order number is ${res.data.order?.orderNumber}`);
        // Reset states
        setCustomerName('');
        setCustomerPhone('');
        setNotes('');
        setIsCheckingOut(false);
        // Clear cart cache
        queryClient.setQueryData(['public-cart', sessionToken], { items: [] });
        
        // Redirect to live order tracking page after 1.5 seconds
        const placedOrderId = res.data.order?._id;
        if (placedOrderId) {
          setTimeout(() => {
            router.push(`/r/${slug}/track?id=${placedOrderId}`);
          }, 1500);
        }
      }
    } catch (error: any) {
      setOrderStatusState('error');
      const msg = error.response?.data?.error || 'Failed to place order. Please try again.';
      setCheckoutError(msg);
      toast.error('Checkout failed', msg);
    }
  };

  // Query: Fetch public menu items
  const { data: menuData, isLoading: isMenuLoading } = useQuery({
    queryKey: ['public-menu', slug, tableNumber],
    queryFn: async () => {
      const res = await api.get(`/public/restaurant/${slug}`, {
        params: { table: tableNumber }
      });
      return res.data;
    },
    enabled: !!slug
  });

  const restaurant = menuData?.restaurant;
  const categories = menuData?.categories || [];
  const items = menuData?.items || [];
  const tableInfo = menuData?.table;

  // Query: Fetch persistent cart from database
  const { data: cartData, isLoading: isCartLoading } = useQuery({
    queryKey: ['public-cart', sessionToken],
    queryFn: async () => {
      const res = await api.get(`/public/cart/${sessionToken}`);
      return res.data?.cart || { items: [] };
    },
    enabled: !!sessionToken
  });

  const cartItems = cartData?.items || [];

  // Mutation: Sync cart with backend
  const syncCartMutation = useMutation({
    mutationFn: async (updatedItems: any[]) => {
      const res = await api.post('/public/cart', {
        sessionToken,
        restaurantId: restaurant?._id,
        tableNumber: tableNumber || undefined,
        items: updatedItems
      });
      return res.data?.cart;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['public-cart', sessionToken], data);
    }
  });

  // Set initial active category
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]._id);
    }
  }, [categories, activeCategory]);

  const handleScrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    const element = sectionRefs.current[catId];
    if (element) {
      const offset = 80; // height of sticky bar
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const handleAddToCart = (menuItemId: string) => {
    const existingIndex = cartItems.findIndex((item: any) => {
      const id = item.menuItemId?._id || item.menuItemId;
      return id === menuItemId;
    });

    let updatedItems = [...cartItems];

    if (existingIndex > -1) {
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        quantity: updatedItems[existingIndex].quantity + 1
      };
    } else {
      updatedItems.push({
        menuItemId,
        quantity: 1,
        notes: ''
      });
    }

    // Map payload back to flat format for database update
    const flatItems = updatedItems.map(item => ({
      menuItemId: item.menuItemId?._id || item.menuItemId,
      quantity: item.quantity,
      notes: item.notes || ''
    }));

    syncCartMutation.mutate(flatItems);
    toast.success('Item added to cart', 'Your cart has been updated.');
  };

  const handleUpdateQuantity = (menuItemId: string, amount: number) => {
    const existingIndex = cartItems.findIndex((item: any) => {
      const id = item.menuItemId?._id || item.menuItemId;
      return id === menuItemId;
    });

    if (existingIndex === -1) return;

    let updatedItems = [...cartItems];
    const newQty = updatedItems[existingIndex].quantity + amount;

    if (newQty <= 0) {
      updatedItems.splice(existingIndex, 1);
    } else {
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        quantity: newQty
      };
    }

    const flatItems = updatedItems.map(item => ({
      menuItemId: item.menuItemId?._id || item.menuItemId,
      quantity: item.quantity,
      notes: item.notes || ''
    }));

    syncCartMutation.mutate(flatItems);
  };

  const handleUpdateNotes = (menuItemId: string, notes: string) => {
    const updatedItems = cartItems.map((item: any) => {
      const id = item.menuItemId?._id || item.menuItemId;
      if (id === menuItemId) {
        return { ...item, notes };
      }
      return item;
    });

    const flatItems = updatedItems.map((item: any) => ({
      menuItemId: item.menuItemId?._id || item.menuItemId,
      quantity: item.quantity,
      notes: item.notes || ''
    }));

    syncCartMutation.mutate(flatItems);
  };

  // Group items by category
  const groupedItems: Record<string, any[]> = {};
  categories.forEach((cat: any) => {
    groupedItems[cat._id] = items.filter((item: any) => {
      const itemCatId = item.categoryId?._id || item.categoryId;
      return itemCatId === cat._id;
    });
  });

  // Calculate cart aggregates
  const totalQuantity = cartItems.reduce((acc: number, item: any) => acc + item.quantity, 0);
  const totalPrice = cartItems.reduce((acc: number, item: any) => {
    const price = item.menuItemId?.discountPrice || item.menuItemId?.price || 0;
    return acc + price * item.quantity;
  }, 0);

  if (isMenuLoading) {
    return (
      <div style={loaderContainerStyle}>
        <div className="pulse-glow-indicator" style={{ color: 'var(--primary-color)', width: 40, height: 40 }}></div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div style={errorContainerStyle}>
        <div className="clay-card" style={{ textAlign: 'center', padding: '40px', maxWidth: '400px' }}>
          <span style={{ fontSize: '3rem' }}>🚫</span>
          <h2 style={{ margin: '16px 0 8px' }}>Menu Unavailable</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            This restaurant is currently offline or the URL is invalid. Please scan the QR code again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrapperStyle}>
      {/* Cover Hero Banner */}
      <div style={heroCoverStyle}>
        <div style={heroOverlayStyle}>
          <div style={heroInfoCardStyle} className="clay-card float-animation">
            <div style={heroMetaRowStyle}>
              <div style={logoWrapperStyle}>
                {restaurant.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveAssetUrl(restaurant.logoUrl)} alt={restaurant.name} style={logoStyle} />
                ) : (
                  <span style={{ fontSize: '1.5rem' }}>🍽️</span>
                )}
              </div>
              <div>
                <h1 style={restaurantNameStyle}>{restaurant.name}</h1>
                <p style={restaurantSubStyle}>{restaurant.cuisine?.join(' • ')}</p>
              </div>
            </div>

            {tableInfo && (
              <div className="clay-badge clay-badge-success" style={tableBadgeStyle}>
                🪑 Table {tableInfo.tableNumber}
              </div>
            )}

            <div style={addressRowStyle}>
              <span>📍 {restaurant.address || 'Dining Location'}</span>
              <span>📞 {restaurant.phone || 'Contact Number'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Categories Bar */}
      <div style={stickyNavBarStyle}>
        {categories.map((cat: any) => {
          const isActive = activeCategory === cat._id;
          return (
            <button
              key={cat._id}
              onClick={() => handleScrollToCategory(cat._id)}
              style={isActive ? activeCategoryTabStyle : categoryTabStyle}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Food Grids Section */}
      <div style={menuContainerStyle}>
        {categories.map((cat: any) => {
          const catItems = groupedItems[cat._id] || [];
          if (catItems.length === 0) return null;

          return (
            <section
              key={cat._id}
              ref={(el) => { sectionRefs.current[cat._id] = el; }}
              style={sectionStyle}
            >
              <h2 style={sectionHeaderStyle}>{cat.name}</h2>
              {cat.description && <p style={sectionDescStyle}>{cat.description}</p>}

              <div style={menuGridStyle}>
                {catItems.map((item: any) => {
                  const cartItem = cartItems.find((c: any) => {
                    const id = c.menuItemId?._id || c.menuItemId;
                    return id === item._id;
                  });
                  const qty = cartItem ? cartItem.quantity : 0;

                  const View3DButton = () => {
                    if (!item.modelUrl) return null;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '12px' }}>
                        <button
                          onClick={() => setSelected3DItem(item)}
                          className="clay-btn clay-btn-secondary"
                          style={{ width: '100%', padding: '8px 12px', fontSize: '0.82rem', height: '38px', borderRadius: '12px' }}
                          title="View in 3D Model Inspector"
                        >
                          👁 View in 3D
                        </button>
                        {isARSupported && (
                          <button
                            onClick={() => router.push(`/ar?slug=${slug}&items=${item._id}${tableNumber ? `&table=${tableNumber}` : ''}`)}
                            className="clay-btn clay-btn-secondary"
                            style={{ width: '100%', padding: '8px 12px', fontSize: '0.82rem', height: '38px', borderRadius: '12px' }}
                            title="View in Live AR Camera Preview"
                          >
                            📷 View in AR
                          </button>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div key={item._id} className="clay-card" style={foodCardStyle}>
                      <div style={foodImageWrapperStyle}>
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={resolveAssetUrl(item.imageUrl)} alt={item.name} style={foodImageStyle} />
                        ) : (
                          <span style={{ fontSize: '2rem' }}>🥗</span>
                        )}
                        {item.isVeg ? (
                          <span style={dietBadgeVegStyle}>VEG</span>
                        ) : (
                          <span style={dietBadgeNonVegStyle}>NON-VEG</span>
                        )}
                        {item.isPopular && (
                          <span style={popularBadgeStyle}>🔥 Popular</span>
                        )}
                      </div>

                      <div style={foodBodyStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <h3 style={foodTitleStyle}>{item.name}</h3>
                          {item.spiceLevel === 'high' && <span style={{ fontSize: '0.85rem' }}>🌶️🌶️</span>}
                          {item.spiceLevel === 'medium' && <span style={{ fontSize: '0.85rem' }}>🌶️</span>}
                        </div>
                        <p style={foodDescStyle}>{item.description}</p>
                        
                        <div style={foodFooterStyle}>
                          <div>
                            {item.discountPrice ? (
                              <div>
                                <span style={discPriceStyle}>${item.discountPrice}</span>
                                <span style={origPriceStyle}>${item.price}</span>
                              </div>
                            ) : (
                              <span style={priceStyle}>${item.price}</span>
                            )}
                          </div>

                          {/* Add / Qty buttons */}
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {qty > 0 ? (
                              <div style={qtyControlsStyle}>
                                <button onClick={() => handleUpdateQuantity(item._id, -1)} style={qtyBtnStyle}>
                                  -
                                </button>
                                <strong style={qtyCountStyle}>{qty}</strong>
                                <button onClick={() => handleUpdateQuantity(item._id, 1)} style={qtyBtnStyle}>
                                  +
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => handleAddToCart(item._id)} className="clay-btn clay-btn-primary" style={addBtnStyle}>
                                  Add +
                              </button>
                            )}
                          </div>
                        </div>

                        <View3DButton />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Floating 3D Cart Button */}
      {totalQuantity > 0 && (
        <div style={floatingCartWrapperStyle}>
          <button
            onClick={() => setIsCartOpen(true)}
            className="clay-btn clay-btn-primary float-animation"
            style={floatingCartButtonStyle}
          >
            <span>🛒 View Cart ({totalQuantity} items)</span>
            <strong>${totalPrice.toFixed(2)}</strong>
          </button>
        </div>
      )}

      {/* Cart Summary Drawer Modal */}
      {isCartOpen && (
        <div style={drawerBackdropStyle}>
          <div className="clay-card float-animation" style={drawerContentStyle}>
            
            {/* 1. ORDER PLACED SUCCESS SCREEN */}
            {orderStatusState === 'success' ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                <span style={{ fontSize: '4rem' }} className="float-animation">🎉</span>
                <h2 style={successTitleStyle}>Order Placed!</h2>
                <div className="clay-card" style={successCardStyle}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order Number</span>
                  <strong style={{ fontSize: '1.5rem', display: 'block', color: 'var(--accent-color)', fontFamily: 'var(--font-heading)', marginTop: '4px' }}>
                    {placedOrderNumber}
                  </strong>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '320px' }}>
                  Your order has been sent to the kitchen. We will start preparing your meal shortly.
                </p>
                <button
                  onClick={() => {
                    setOrderStatusState('idle');
                    setIsCartOpen(false);
                  }}
                  className="clay-btn clay-btn-primary"
                  style={{ width: '100%', marginTop: '12px' }}
                >
                  Continue Browsing 🍽️
                </button>
              </div>
            ) : isCheckingOut ? (
              /* 2. CHECKOUT FORM STEP */
              <form onSubmit={handlePlaceOrder} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <div style={drawerHeaderStyle}>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Guest Checkout</h2>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Confirm details to place order</span>
                  </div>
                  <button type="button" onClick={() => setIsCartOpen(false)} style={closeDrawerBtnStyle}>&times;</button>
                </div>

                <div style={drawerBodyStyle}>
                  {checkoutError && (
                    <div className="clay-card" style={errorAlertStyle}>
                      ⚠️ {checkoutError}
                    </div>
                  )}

                  {/* Summary recap snippet */}
                  <div className="clay-card" style={{ padding: '16px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(10,10,11,0.2)', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>Items Selected: <strong>{totalQuantity}</strong></span>
                      <span>Total: <strong style={{ color: 'var(--accent-color)' }}>${totalPrice.toFixed(2)}</strong></span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Your Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      className="clay-input"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      disabled={orderStatusState === 'loading'}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Mobile Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      className="clay-input"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      disabled={orderStatusState === 'loading'}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Table Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 5"
                      className="clay-input"
                      required
                      value={customTableNumber}
                      onChange={(e) => setCustomTableNumber(e.target.value)}
                      disabled={!!tableNumber || orderStatusState === 'loading'}
                      style={tableNumber ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                    />
                    {tableNumber && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Table locked from QR scan
                      </span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Cooking Notes (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Less spicy, extra sauce..."
                      className="clay-input"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={orderStatusState === 'loading'}
                    />
                  </div>
                </div>

                <div style={drawerFooterStyle}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setIsCheckingOut(false)}
                      disabled={orderStatusState === 'loading'}
                      className="clay-btn clay-btn-secondary"
                      style={{ flexGrow: 1 }}
                    >
                      Back to Cart
                    </button>
                    <button
                      type="submit"
                      disabled={orderStatusState === 'loading'}
                      className="clay-btn clay-btn-primary"
                      style={{ flexGrow: 2, padding: '14px', borderRadius: '16px' }}
                    >
                      {orderStatusState === 'loading' ? 'Placing Order...' : 'Confirm Order ⚡'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* 3. CART ITEMS LIST STEP */
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <div style={drawerHeaderStyle}>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Your Orders</h2>
                    {tableInfo && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Table: {tableInfo.tableNumber}</span>}
                  </div>
                  <button onClick={() => setIsCartOpen(false)} style={closeDrawerBtnStyle}>&times;</button>
                </div>

                <div style={drawerBodyStyle}>
                  {cartItems.map((item: any) => {
                    const menuItem = item.menuItemId;
                    if (!menuItem) return null;
                    const price = menuItem.discountPrice || menuItem.price || 0;
                    const itemTotal = price * item.quantity;

                    return (
                      <div key={item._id || menuItem._id} style={cartItemRowStyle} className="clay-card">
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={cartThumbStyle}>
                            {menuItem.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={resolveAssetUrl(menuItem.imageUrl)} alt={menuItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span>🥗</span>
                            )}
                          </div>
                          <div>
                            <strong style={{ fontSize: '0.9rem', display: 'block' }}>{menuItem.name}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                              ${price.toFixed(2)} each
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                          <div style={qtyControlsStyle}>
                            <button onClick={() => handleUpdateQuantity(menuItem._id, -1)} style={qtyBtnStyle}>
                              -
                            </button>
                            <strong style={qtyCountStyle}>{item.quantity}</strong>
                            <button onClick={() => handleUpdateQuantity(menuItem._id, 1)} style={qtyBtnStyle}>
                              +
                            </button>
                          </div>
                          <strong style={{ fontSize: '0.85rem' }}>${itemTotal.toFixed(2)}</strong>
                        </div>

                        {/* Special instruction notes */}
                        <div style={{ width: '100%', gridColumn: 'span 2', marginTop: '6px' }}>
                          <input
                            type="text"
                            placeholder="Add special instructions (e.g. make it extra spicy, no onions)..."
                            className="clay-input"
                            style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '8px' }}
                            value={item.notes || ''}
                            onChange={(e) => handleUpdateNotes(menuItem._id, e.target.value)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={drawerFooterStyle}>
                  <div style={priceBreakdownRowStyle}>
                    <span>Order Subtotal</span>
                    <strong>${totalPrice.toFixed(2)}</strong>
                  </div>
                  
                  <button
                    onClick={() => setIsCheckingOut(true)}
                    className="clay-btn clay-btn-primary"
                    style={{ width: '100%', padding: '14px', borderRadius: '16px' }}
                  >
                    Proceed to Checkout ⚡
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
      <AnimatePresence>
        {selected3DItem && (
          <ModelViewer
            item={selected3DItem}
            onClose={() => setSelected3DItem(null)}
            onAddToCart={() => handleAddToCart(selected3DItem._id)}
          />
        )}
        {selectedARItem && (
          <CameraViewer
            item={selectedARItem}
            onClose={() => setSelectedARItem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Styling definitions
const loaderContainerStyle: React.CSSProperties = {
  display: 'flex',
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
  padding: '24px'
};

const pageWrapperStyle: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: 'var(--bg-color)',
  display: 'flex',
  flexDirection: 'column',
  paddingBottom: '100px'
};

const heroCoverStyle: React.CSSProperties = {
  height: '280px',
  backgroundImage: 'linear-gradient(135deg, #1e1b4b, #311042)',
  position: 'relative'
};

const heroOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-end',
  padding: '0 20px'
};

const heroInfoCardStyle: React.CSSProperties = {
  maxWidth: '680px',
  width: '100%',
  transform: 'translateY(40px)',
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  padding: '24px',
  position: 'relative'
};

const heroMetaRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
  alignItems: 'center',
  marginBottom: '12px'
};

const logoWrapperStyle: React.CSSProperties = {
  width: '60px',
  height: '60px',
  borderRadius: '16px',
  backgroundColor: 'rgba(10, 10, 11, 0.6)',
  border: '1px solid var(--border-color)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden'
};

const logoStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover'
};

const restaurantNameStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '1.5rem',
  fontWeight: 800,
  color: 'var(--text-primary)',
  letterSpacing: '-0.02em'
};

const restaurantSubStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--text-secondary)'
};

const tableBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: '24px',
  right: '24px',
  fontSize: '0.7rem'
};

const addressRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  borderTop: '1px solid var(--border-color)',
  paddingTop: '12px',
  marginTop: '12px'
};

const stickyNavBarStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 100,
  backgroundColor: 'rgba(10, 10, 11, 0.8)',
  backdropFilter: 'blur(12px)',
  borderBottom: '1px solid var(--border-color)',
  display: 'flex',
  gap: '8px',
  padding: '16px 20px',
  overflowX: 'auto',
  scrollBehavior: 'smooth',
  marginTop: '56px'
};

const categoryTabStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  borderRadius: '12px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  padding: '8px 16px',
  fontFamily: 'var(--font-heading)',
  fontWeight: 600,
  fontSize: '0.85rem',
  whiteSpace: 'nowrap',
  transition: 'var(--transition-clay)'
};

const activeCategoryTabStyle: React.CSSProperties = {
  ...categoryTabStyle,
  backgroundColor: 'var(--primary-color)',
  color: '#fff',
  boxShadow: 'var(--clay-btn-primary-shadow)',
  border: '1px solid rgba(255, 255, 255, 0.1)'
};

const menuContainerStyle: React.CSSProperties = {
  maxWidth: '680px',
  width: '100%',
  margin: '0 auto',
  padding: '24px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '40px'
};

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column'
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 700,
  marginBottom: '4px',
  letterSpacing: '-0.02em'
};

const sectionDescStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--text-secondary)',
  marginBottom: '20px'
};

const menuGridStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px'
};

const foodCardStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '110px 1fr',
  gap: '16px',
  padding: '16px',
  border: '1px solid rgba(255, 255, 255, 0.04)',
  alignItems: 'center'
};

const foodImageWrapperStyle: React.CSSProperties = {
  width: '110px',
  height: '110px',
  borderRadius: '16px',
  backgroundColor: 'rgba(10,10,11,0.6)',
  border: '1px solid var(--border-color)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  overflow: 'hidden'
};

const foodImageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover'
};

const dietBadgeVegStyle: React.CSSProperties = {
  position: 'absolute',
  top: '6px',
  left: '6px',
  fontSize: '0.55rem',
  fontWeight: 700,
  backgroundColor: 'var(--color-success)',
  color: '#fff',
  padding: '2px 6px',
  borderRadius: '4px'
};

const dietBadgeNonVegStyle: React.CSSProperties = {
  position: 'absolute',
  top: '6px',
  left: '6px',
  fontSize: '0.55rem',
  fontWeight: 700,
  backgroundColor: 'var(--color-danger)',
  color: '#fff',
  padding: '2px 6px',
  borderRadius: '4px'
};

const popularBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '6px',
  right: '6px',
  fontSize: '0.55rem',
  fontWeight: 700,
  backgroundColor: 'var(--color-warning)',
  color: '#fff',
  padding: '2px 6px',
  borderRadius: '4px'
};

const foodBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px'
};

const foodTitleStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700
};

const foodDescStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--text-secondary)',
  lineHeight: 1.4,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical'
};

const foodFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '8px'
};

const priceStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '1.05rem',
  color: 'var(--accent-color)'
};

const discPriceStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '1.05rem',
  color: 'var(--accent-color)',
  marginRight: '6px'
};

const origPriceStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  textDecoration: 'line-through'
};

const addBtnStyle: React.CSSProperties = {
  padding: '6px 16px',
  fontSize: '0.8rem',
  borderRadius: '8px'
};

const qtyControlsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  backgroundColor: 'rgba(255,255,255,0.02)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  boxShadow: 'var(--clay-input-shadow)'
};

const qtyBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-primary)',
  width: '28px',
  height: '28px',
  cursor: 'pointer',
  fontSize: '1rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600
};

const qtyCountStyle: React.CSSProperties = {
  width: '24px',
  textAlign: 'center',
  fontSize: '0.85rem'
};

// Floating Cart Button
const floatingCartWrapperStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '24px',
  left: 0,
  right: 0,
  zIndex: 999,
  display: 'flex',
  justifyContent: 'center',
  padding: '0 20px'
};

const floatingCartButtonStyle: React.CSSProperties = {
  maxWidth: '520px',
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  height: '56px',
  padding: '0 24px',
  borderRadius: '18px',
  fontSize: '0.95rem'
};

// Drawer summary styles
const drawerBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.8)',
  zIndex: 1000,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-end'
};

const drawerContentStyle: React.CSSProperties = {
  maxWidth: '560px',
  width: '100%',
  backgroundColor: 'var(--card-bg)',
  borderTopLeftRadius: '24px',
  borderTopRightRadius: '24px',
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
  border: '1px solid var(--border-color)',
  boxShadow: '0px -10px 40px rgba(0,0,0,0.5)',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '85vh',
  padding: 0,
  overflow: 'hidden'
};

const drawerHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '20px 24px',
  borderBottom: '1px solid var(--border-color)'
};

const closeDrawerBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  fontSize: '1.8rem',
  cursor: 'pointer'
};

const drawerBodyStyle: React.CSSProperties = {
  padding: '24px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  flexGrow: 1
};

const cartItemRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: '12px',
  padding: '16px',
  backgroundColor: 'rgba(10,10,11,0.2)',
  border: '1px solid var(--border-color)',
  alignItems: 'center'
};

const cartThumbStyle: React.CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '8px',
  backgroundColor: 'rgba(10,10,11,0.6)',
  border: '1px solid var(--border-color)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden'
};

const drawerFooterStyle: React.CSSProperties = {
  padding: '20px 24px',
  borderTop: '1px solid var(--border-color)',
  backgroundColor: 'rgba(255,255,255,0.01)',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px'
};

const priceBreakdownRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '1rem'
};

const successTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '1.6rem',
  fontWeight: 800,
  color: 'var(--text-primary)',
  letterSpacing: '-0.02em',
  marginTop: '-8px'
};

const successCardStyle: React.CSSProperties = {
  padding: '16px 28px',
  borderRadius: '20px',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  backgroundColor: 'rgba(255, 255, 255, 0.01)',
  boxShadow: 'var(--clay-input-shadow)',
  textAlign: 'center',
  width: '100%',
  maxWidth: '240px'
};

const errorAlertStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(239, 68, 68, 0.2)',
  backgroundColor: 'rgba(239, 68, 68, 0.05)',
  color: 'rgb(248, 113, 113)',
  fontSize: '0.825rem',
  lineHeight: 1.4,
  marginBottom: '10px'
};
