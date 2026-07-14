// App.jsx
import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import DashboardContent from './components/DashboardContent';
import { iosLiquidGlassTheme } from './styles/theme';

// 글로벌 스타일 동적 주입
if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.innerHTML = iosLiquidGlassTheme;
  document.head.appendChild(styleTag);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 💡 핵심 요약: Firebase의 로그인 상태를 추적합니다.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => { 
      setUser(currentUser); 
      setLoading(false); 
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>로딩 중...</div>;
  
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <button onClick={() => signInWithPopup(auth, googleProvider)} style={{ padding: '16px 32px', fontSize: '1.1rem', fontWeight: '700', borderRadius: '20px', background: '#007aff', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0, 122, 255, 0.4)' }}>
          Google 계정으로 로그인 (DB 접근)
        </button>
      </div>
    );
  }

  // 로그인 성공 시 대시보드를 렌더링합니다.
  return (
    <GoogleOAuthProvider clientId="451500058668-2okdn1lli09s36opj20ch4ibts9fkjm3.apps.googleusercontent.com">
      <DashboardContent userId={user.uid} onLogout={() => signOut(auth)} />
    </GoogleOAuthProvider>
  );
}