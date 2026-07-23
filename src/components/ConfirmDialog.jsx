// components/ConfirmDialog.jsx
import React from 'react';
import { createPortal } from 'react-dom';

// 앱 전역에서 재사용하는 확인 모달. 브라우저 기본 confirm() 대신 iOS 글래스 톤을 유지한다.
export default function ConfirmDialog({ isOpen, message, confirmLabel = '확인', onConfirm, onCancel }) {
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999999, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px', width: '320px', color: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', textAlign: 'center' }}>
        <p style={{ margin: '0 0 24px 0', fontSize: '1rem', color: '#ffffff', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{message}</p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onCancel} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600' }}>취소</button>
          <button onClick={onConfirm} style={{ flex: 1, background: '#ff3b30', border: 'none', color: '#fff', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '700' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
