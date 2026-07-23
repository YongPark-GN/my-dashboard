// App.jsx
import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import DashboardContent from './components/DashboardContent';
import { iosLiquidGlassTheme, iosDockTheme } from './styles/theme';

// 💡 핵심: 터치 환경용 드래그 앤 드롭 라이브러리 추가
import { polyfill } from "mobile-drag-drop";
import "mobile-drag-drop/default.css";

// 폴리필 실행 (모바일/태블릿 터치 드래그 활성화)
polyfill({
  dragImageCenterOnTouch: true
});

if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.innerHTML = iosLiquidGlassTheme + iosDockTheme; // 기존 테마와 Dock 테마 합치기
  document.head.appendChild(styleTag);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [devUser, setDevUser] = useState(null); // dev 전용 로그인 우회 (프로덕션에서는 사용 안 함)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const activeUser = user || devUser;

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>로딩 중...</div>;

  if (!activeUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <button onClick={() => signInWithPopup(auth, googleProvider)} style={{ padding: '16px 32px', fontSize: '1.1rem', fontWeight: '700', borderRadius: '20px', background: '#007aff', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0, 122, 255, 0.4)' }}>
          Google 계정으로 로그인 (DB 접근)
        </button>
        {import.meta.env.DEV && (
          <button onClick={() => setDevUser({ uid: 'dev-preview' })} style={{ padding: '10px 20px', fontSize: '0.85rem', fontWeight: '600', borderRadius: '14px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}>
            로그인 없이 미리보기 (dev 전용)
          </button>
        )}
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID}>
      <DashboardContent userId={activeUser.uid} onLogout={() => { if (user) signOut(auth); setDevUser(null); }} />
    </GoogleOAuthProvider>
  );
}