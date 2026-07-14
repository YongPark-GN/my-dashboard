import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; 
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

import ClockWidget from './components/ClockWidget';
import WeatherWidget from './components/WeatherWidget';
import WorkflowWidget from './components/WorkflowWidget';
import SchedulerWidget from './components/SchedulerWidget';
import MindMapWidget from './components/MindMapWidget';
import MemoWidget from './components/MemoWidget';

import { db, auth, googleProvider } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';

const iosLiquidGlassTheme = `
  * { margin: 0 !important; box-sizing: border-box !important; }
  body, html, #root { 
    margin: 0 !important; padding: 0 !important; background-color: #000000; color: #ffffff; 
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    width: 100vw !important; max-width: 100vw !important; overflow-x: hidden;
  }
  .react-calendar { background: transparent !important; color: #ffffff !important; border: none !important; width: 100% !important; }
  .react-calendar abbr { text-decoration: none !important; border-bottom: none !important; }
  .react-calendar__navigation button { color: #ffffff !important; background: none; }
  .react-calendar__tile { color: #ffffff !important; background: none; border: none; padding: 12px 0; position: relative; font-size: 0.9rem; }
  .react-calendar__tile--now { background: rgba(255,255,255,0.1) !important; border-radius: 12px; }
  .react-calendar__tile--active { background: #007aff !important; color: white !important; border-radius: 12px !important; font-weight: bold; }
  .sat-tile { color: #30a9ff !important; }
  .sun-tile { color: #ff3b30 !important; }
  .ios-resize-trigger { position: absolute; right: 10px; bottom: 10px; width: 14px; height: 14px; cursor: se-resize; z-index: 15; opacity: 0.5; }
`;

if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.innerHTML = iosLiquidGlassTheme;
  document.head.appendChild(styleTag);
}

const iosLiquidGlassWidget = {
  background: 'linear-gradient(135deg, rgba(32, 32, 36, 0.7) 0%, rgba(16, 16, 18, 0.75) 100%)',
  backdropFilter: 'blur(40px) saturate(200%)',
  borderRadius: '32px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)', color: '#ffffff', display: 'flex', flexDirection: 'column',
  boxSizing: 'border-box', overflow: 'hidden', position: 'relative'
};

function DashboardContent({ userId, onLogout }) {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [accessToken, setAccessToken] = useState(() => {
    const savedToken = localStorage.getItem(`cal_token_${userId}`);
    const savedExpiry = localStorage.getItem(`cal_expiry_${userId}`);
    if (savedToken && savedExpiry && Date.now() < Number(savedExpiry)) return savedToken;
    return '';
  });

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const savedToken = localStorage.getItem(`cal_token_${userId}`);
    const savedExpiry = localStorage.getItem(`cal_expiry_${userId}`);
    return !!(savedToken && savedExpiry && Date.now() < Number(savedExpiry));
  });

  const [isMindMapOpen, setIsMindMapOpen] = useState(false);
  const [selectedMapId, setSelectedMapId] = useState(null);
  const [inputModal, setInputModal] = useState({ isOpen: false, nodeId: null, text: '', mode: 'add', onSubmit: null });

  const [widgetOrder, setWidgetOrder] = useState(() => {
    const saved = localStorage.getItem(`order_${userId}`);
    return saved ? JSON.parse(saved) : ['clock', 'weather', 'workflow', 'calendar', 'scheduler', 'memo', 'mindmap'];
  });

  const [widgetSizes, setWidgetSizes] = useState(() => {
    const saved = localStorage.getItem(`sizes_${userId}`);
    return saved ? JSON.parse(saved) : {
      clock: { width: 360, height: 260 }, weather: { width: 320, height: 260 },
      workflow: { width: 664, height: 340 }, calendar: { width: 360, height: 260 },
      scheduler: { width: 320, height: 260 }, memo: { width: 320, height: 260 }, 
      mindmap: { width: 360, height: 260 }
    };
  });

  const [draggingId, setDraggingId] = useState(null);
  const [resizeTarget, setResizeTarget] = useState(null);
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!db || !userId) return;
    const layoutConfigRef = doc(db, "users", userId, "dashboard", "layoutConfig");
    const unsubscribeLayout = onSnapshot(layoutConfigRef, (docSnap) => {
      if (docSnap.exists()) {
        const remoteData = docSnap.data();
        if (remoteData?.widgetOrder) setWidgetOrder(remoteData.widgetOrder);
        if (remoteData?.widgetSizes) setWidgetSizes(remoteData.widgetSizes);
      }
    }, (err) => console.warn(err.message));
    return () => unsubscribeLayout();
  }, [userId]);

  const saveLayoutToFirestore = async (newOrder, newSizes) => {
    if (!userId) return;
    localStorage.setItem(`order_${userId}`, JSON.stringify(newOrder));
    localStorage.setItem(`sizes_${userId}`, JSON.stringify(newSizes));
    try { if (db) await setDoc(doc(db, "users", userId, "dashboard", "layoutConfig"), { widgetOrder: newOrder, widgetSizes: newSizes }, { merge: true }); } catch (err) {}
  };

  const handleDragStart = (id) => { if (!resizeTarget) setDraggingId(id); };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDragEnd = () => { setDraggingId(null); };
  const handleDrop = (targetId) => {
    if (!draggingId || draggingId === targetId) return;
    const currentOrder = [...widgetOrder];
    const dragIdx = currentOrder.indexOf(draggingId);
    const targetIdx = currentOrder.indexOf(targetId);
    currentOrder[dragIdx] = targetId; currentOrder[targetIdx] = draggingId;
    setWidgetOrder(currentOrder); setDraggingId(null);
    saveLayoutToFirestore(currentOrder, widgetSizes); 
  };

  const initResize = (e, id) => {
    e.preventDefault(); e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setResizeTarget(id);
    setStartSize({ width: widgetSizes[id].width, height: widgetSizes[id].height });
    setStartPos({ x: clientX, y: clientY });
  };

  useEffect(() => {
    const doResize = (e) => {
      if (!resizeTarget) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setWidgetSizes(prev => ({
        ...prev,
        [resizeTarget]: { width: Math.max(260, startSize.width + (clientX - startPos.x)), height: Math.max(220, startSize.height + (clientY - startPos.y)) }
      }));
    };
    const stopResize = () => { if (resizeTarget) saveLayoutToFirestore(widgetOrder, widgetSizes); setResizeTarget(null); };
    
    if (resizeTarget) {
      window.addEventListener('mousemove', doResize); window.addEventListener('mouseup', stopResize);
      window.addEventListener('touchmove', doResize); window.addEventListener('touchend', stopResize);
    }
    return () => {
      window.removeEventListener('mousemove', doResize); window.removeEventListener('mouseup', stopResize);
      window.removeEventListener('touchmove', doResize); window.removeEventListener('touchend', stopResize);
    };
  }, [resizeTarget, startPos, startSize, widgetOrder, widgetSizes]);

  const login = useGoogleLogin({
    onSuccess: (res) => { 
      setIsLoggedIn(true); setAccessToken(res.access_token); 
      const expiryTime = Date.now() + (res.expires_in || 3600) * 1000; 
      localStorage.setItem(`cal_token_${userId}`, res.access_token);
      localStorage.setItem(`cal_expiry_${userId}`, String(expiryTime));
    },
    scope: 'https://www.googleapis.com/auth/calendar.events' // R/W 권한 확보
  });

  const handleFullLogout = () => {
    localStorage.removeItem(`cal_token_${userId}`); localStorage.removeItem(`cal_expiry_${userId}`);
    onLogout();
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!inputModal.text.trim()) return;
    if (inputModal.onSubmit) inputModal.onSubmit(inputModal.text);
    setInputModal({ isOpen: false, nodeId: null, text: '', mode: 'add', onSubmit: null });
  };

  const handleFormKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit(e);
    }
  };

  const renderWidgetContent = (id) => {
    switch (id) {
      case 'clock': return <ClockWidget />;
      case 'weather': return <WeatherWidget />;
      case 'workflow': return <WorkflowWidget userId={userId} />;
      case 'calendar': return <Calendar onChange={setSelectedDate} value={selectedDate} calendarType="gregory" tileClassName={({ date, view }) => view === 'month' ? (date.getDay() === 6 ? 'sat-tile' : date.getDay() === 0 ? 'sun-tile' : null) : null} formatDay={(locale, d) => d.getDate().toString()} />;
      case 'scheduler': return <SchedulerWidget isLoggedIn={isLoggedIn} login={login} accessToken={accessToken} selectedDate={selectedDate} />;
      case 'memo': return <MemoWidget userId={userId} />;
      case 'mindmap': return <MindMapWidget userId={userId} onSelectMap={(map) => { setSelectedMapId(map.id); setIsMindMapOpen(true); }} />;
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000', padding: '32px', boxSizing: 'border-box', width: '100vw', position: 'absolute', top: 0, left: 0 }}>
      <button onClick={handleFullLogout} style={{ position: 'absolute', top: '32px', right: '32px', zIndex: 100, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: '14px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', transition: 'background 0.2s' }}>로그아웃</button>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', width: '100%', justifyContent: 'flex-start', alignItems: 'flex-start', marginTop: '60px' }}>
        {widgetOrder.map((id) => (
          <div key={id} draggable={!resizeTarget} onDragStart={() => handleDragStart(id)} onDragOver={handleDragOver} onDrop={() => handleDrop(id)} onDragEnd={handleDragEnd} style={{ ...iosLiquidGlassWidget, width: `${widgetSizes[id]?.width || 320}px`, height: `${widgetSizes[id]?.height || 260}px`, opacity: draggingId === id ? 0.4 : 1, cursor: 'grab' }}>
            {renderWidgetContent(id)}
            <div className="ios-resize-trigger" onMouseDown={(e) => initResize(e, id)} onTouchStart={(e) => initResize(e, id)}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 0L0 12H12V0Z" fill="white"/></svg>
            </div>
          </div>
        ))}
      </div>

      {isMindMapOpen && selectedMapId && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 999999, backgroundColor: '#000000', padding: '40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '20px', marginBottom: '24px' }}>
            <button onClick={() => { setIsMindMapOpen(false); setSelectedMapId(null); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>종료 및 닫기</button>
          </div>
          <div style={{ flex: 1, backgroundColor: '#0c0c0e', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
            <MindMapWidget userId={userId} isEditorMode={true} selectedMapId={selectedMapId} openModal={(config) => setInputModal({ isOpen: true, ...config })} />
          </div>
        </div>
      )}

      {inputModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999999, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleFormSubmit} style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px', width: '360px', color: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            <h4 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', color: '#ffffff', fontWeight: '600' }}>{inputModal.mode === 'add' ? '새 블록 내용 입력' : '블록 내용 수정'}</h4>
            <textarea 
              value={inputModal.text} 
              onChange={(e) => setInputModal({ ...inputModal, text: e.target.value })} 
              onKeyDown={handleFormKeyDown}
              autoFocus 
              placeholder="내용을 입력하세요 (Shift+Enter로 줄바꿈)"
              style={{ width: '100%', height: '100px', resize: 'none', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '14px', color: '#fff', fontSize: '1rem', outline: 'none', marginBottom: '24px', fontFamily: 'inherit', boxSizing: 'border-box' }} 
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => setInputModal({ isOpen: false, nodeId: null, text: '', mode: 'add', onSubmit: null })} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600' }}>취소</button>
              <button type="submit" style={{ flex: 1, background: '#007aff', border: 'none', color: '#fff', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '700' }}>확인</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); setLoading(false); });
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

  return (
    <GoogleOAuthProvider clientId="451500058668-2okdn1lli09s36opj20ch4ibts9fkjm3.apps.googleusercontent.com">
      <DashboardContent userId={user.uid} onLogout={() => signOut(auth)} />
    </GoogleOAuthProvider>
  );
}