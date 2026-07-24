// hooks/useGoogleCalendarAuth.js
import { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from '../components/Toast';

export const useGoogleCalendarAuth = (userId, onLogout) => {
  const [accessToken, setAccessToken] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const login = useGoogleLogin({
    onSuccess: async (res) => { 
      setIsLoggedIn(true); 
      setAccessToken(res.access_token); 
      const expiryTime = Date.now() + (res.expires_in || 3600) * 1000; 
      
      // 💡 핵심 요약: 로컬 브라우저가 아닌 유저님의 Firebase DB에 세션 데이터를 안전하게 보존합니다.
      try {
        await setDoc(doc(db, "users", userId, "dashboard", "googleCalendar"), {
          accessToken: res.access_token,
          expiryTime: expiryTime,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch { toast('캘린더 로그인 정보 저장에 실패했습니다.'); }
    },
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks'
  });

  useEffect(() => {
    if (!db || !userId) return;

    // 💡 핵심 요약: Firebase DB의 calendar 저장 위치를 실시간 모니터링하여 자동 로그인을 처리합니다.
    const calRef = doc(db, "users", userId, "dashboard", "googleCalendar");
    const unsubscribeCal = onSnapshot(calRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.accessToken && data.expiryTime && Date.now() < data.expiryTime) {
          setAccessToken(data.accessToken);
          setIsLoggedIn(true);
        } else {
          setAccessToken('');
          setIsLoggedIn(false);
        }
      }
    });

    return () => unsubscribeCal();
  }, [userId]);

  const handleFullLogout = () => {
    localStorage.removeItem(`cal_token_${userId}`); 
    localStorage.removeItem(`cal_expiry_${userId}`);
    onLogout();
  };

  return { login, isLoggedIn, accessToken, handleFullLogout };
};