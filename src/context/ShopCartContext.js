import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ShopCartContext = createContext(null);

const STORAGE_KEY = 'bykea_shop_cart_v1';

function readStoredCart() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l) => l && typeof l.id === 'string' && Number.isFinite(Number(l.qty)))
      .map((l) => ({
        id: l.id,
        name: String(l.name || ''),
        price: Number(l.price) || 0,
        shopId: l.shopId != null ? String(l.shopId) : '',
        shopName: String(l.shopName || ''),
        imageUrl: String(l.imageUrl || ''),
        qty: Math.min(999, Math.max(1, Math.floor(Number(l.qty)))),
      }))
      .filter((l) => l.qty > 0 && l.id);
  } catch {
    return [];
  }
}

function writeStoredCart(items) {
  if (typeof window === 'undefined') return;
  try {
    if (!items.length) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // quota / private mode
  }
}

export function ShopCartProvider({ children }) {
  const [items, setItems] = useState(() => readStoredCart());

  useEffect(() => {
    writeStoredCart(items);
  }, [items]);

  const addToCart = useCallback((product) => {
    if (!product || !product.inStock) return;
    setItems((prev) => {
      const i = prev.findIndex((l) => l.id === product.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = {
          ...next[i],
          qty: next[i].qty + 1,
          imageUrl: next[i].imageUrl || product.imageUrl,
        };
        return next;
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          shopId: product.shopId,
          shopName: product.shopName,
          imageUrl: product.imageUrl || '',
          qty: 1,
        },
      ];
    });
  }, []);

  const updateQty = useCallback((productId, delta) => {
    setItems((prev) => {
      const next = prev
        .map((l) => (l.id === productId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0);
      return next;
    });
  }, []);

  const removeLine = useCallback((productId) => {
    setItems((prev) => prev.filter((l) => l.id !== productId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo(() => {
    const totalCount = items.reduce((s, l) => s + l.qty, 0);
    const subtotal = items.reduce((s, l) => s + l.price * l.qty, 0);
    return { items, addToCart, updateQty, removeLine, clearCart, totalCount, subtotal };
  }, [items, addToCart, updateQty, removeLine, clearCart]);

  return <ShopCartContext.Provider value={value}>{children}</ShopCartContext.Provider>;
}

export function useShopCart() {
  const v = useContext(ShopCartContext);
  if (!v) {
    throw new Error('useShopCart must be used within ShopCartProvider');
  }
  return v;
}

/** Safe hook for optional provider (e.g. tests) */
export function useShopCartOptional() {
  return useContext(ShopCartContext);
}
