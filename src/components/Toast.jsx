// components/Toast.jsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

// 훅·컴포넌트 어디서든 호출 가능한 전역 토스트. React 컨텍스트를 쓰지 않는
// 가벼운 pub/sub 방식이라 일반 함수(hooks의 catch 블록 등)에서도 알림을 띄울 수 있다.
let listeners = [];
let counter = 0;

export function toast(message, type = 'error') {
  const id = ++counter;
  listeners.forEach((fn) => fn({ id, message, type }));
}

export function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const push = (item) => {
      setItems((prev) => [...prev, item]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== item.id));
      }, 4000);
    };
    listeners.push(push);
    return () => {
      listeners = listeners.filter((fn) => fn !== push);
    };
  }, []);

  if (typeof document === 'undefined') return null;

  const colors = {
    error: { bg: 'rgba(255, 59, 48, 0.92)', icon: '⚠️' },
    success: { bg: 'rgba(52, 199, 89, 0.92)', icon: '✓' },
    info: { bg: 'rgba(0, 122, 255, 0.92)', icon: 'ℹ️' },
  };

  return createPortal(
    <div style={{
      position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 99999999, display: 'flex', flexDirection: 'column', gap: '10px',
      alignItems: 'center', pointerEvents: 'none', width: 'max-content', maxWidth: '90vw'
    }}>
      {items.map((t) => {
        const c = colors[t.type] || colors.error;
        return (
          <div key={t.id} style={{
            background: c.bg, backdropFilter: 'blur(20px)', color: '#fff',
            padding: '14px 22px', borderRadius: '16px', fontSize: '0.9rem', fontWeight: '600',
            boxShadow: '0 12px 32px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', gap: '10px', animation: 'toastIn 0.3s ease'
          }}>
            <span style={{ fontSize: '1rem' }}>{c.icon}</span>
            <span>{t.message}</span>
          </div>
        );
      })}
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>,
    document.body
  );
}
