import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; 
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

import ClockWidget from './components/ClockWidget';
import WeatherWidget from './components/WeatherWidget';
import WorkflowWidget from './components/WorkflowWidget';
import SchedulerWidget from './components/SchedulerWidget';
import MindMapWidget from './components/MindMapWidget';

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
  .react-calendar__tile { color: #ffffff !important; background: none; border: none; padding: 10px 0; position: relative; }
  .react-calendar__tile--now { background: rgba(255,255,255,0.15) !important; border-radius: 12px; }
  .react-calendar__tile--active { background: #007aff !important; color: white !important; border-radius: 12px !important; }
  .sat-tile { color: #30a9ff !important; }
  .sun-tile { color: #ff3b30 !important; }
  .ios-resize-trigger { position: absolute; right: 8px; bottom: 8px; width: 12px; height: 12px; cursor: se-resize; z-index: 15; }
`;

if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.innerHTML = iosLiquidGlassTheme;
  document.head.appendChild(styleTag);
}

const iosLiquidGlassWidget = {
  background: 'linear-gradient(135deg, rgba(32, 32, 36, 0.7) 0%, rgba(16, 16, 18, 0.75) 100%)',
  backdropFilter: 'blur(40px) saturate(200%)',
  borderRadius: '28px', padding: '20px', border: '1px solid rgba(255, 255, 255, 0.12)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)', color: '#ffffff', display: 'flex', flexDirection: 'column',
  boxSizing: 'border-box', overflow: 'hidden', position: 'relative', cursor: 'grab'
};

function DashboardContent({ userId, onLogout }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState('');

  const [isMindMapOpen, setIsMindMapOpen] = useState(false);
  const [selectedMapId, setSelectedMapId] = useState(null);
  const [inputModal, setInputModal] = useState({ isOpen: false, nodeId: null, text: '', mode: 'add', onSubmit: null });

  const [widgetOrder, setWidgetOrder] = useState(() => {
    const saved = localStorage.getItem(`order_${userId}`);
    return saved ? JSON.parse(saved) : ['clock', 'weather', 'workflow', 'calendar', 'scheduler', 'mindmap'];
  });

  const [widgetSizes, setWidgetSizes] = useState(() => {
    const saved = localStorage.getItem(`sizes_${userId}`);
    return saved ? JSON.parse(saved) : {
      clock: { width: 360, height: 260 }, weather: { width: 320, height: 260 },
      workflow: { width: 664, height: 340 }, calendar: { width: 360, height: 260 },
      scheduler: { width: 320, height: 260 }, mindmap: { width: 360, height: 260 }
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
    }, (err) => {
      console.warn("세션 갱신 중 레이아웃 동기화 유예 복구:", err.message);
    });
    return () => unsubscribeLayout();
  }, [userId]);

  const saveLayoutToFirestore = async (newOrder, newSizes) => {
    if (!userId) return;
    localStorage.setItem(`order_${userId}`, JSON.stringify(newOrder));
    localStorage.setItem(`sizes_${userId}`, JSON.stringify(newSizes));
    try {
      if (!db) return;
      await setDoc(doc(db, "users", userId, "dashboard", "layoutConfig"), { widgetOrder: newOrder, widgetSizes: newSizes }, { merge: true });
    } catch (err) { console.error(err); }
  };

  const handleDragStart = (id) => { if (!resizeTarget) setDraggingId(id); };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDragEnd = () => { setDraggingId(null); };

  const handleDrop = (targetId) => {
    if (!draggingId || draggingId === targetId) return;
    const currentOrder = [...widgetOrder];
    const dragIdx = currentOrder.indexOf(draggingId);
    const targetIdx = currentOrder.indexOf(targetId);
    currentOrder[dragIdx] = targetId;
    currentOrder[targetIdx] = draggingId;
    setWidgetOrder(currentOrder);
    setDraggingId(null);
    saveLayoutToFirestore(currentOrder, widgetSizes); 
  };

  const initResize = (e, id) => {
    e.preventDefault(); e.stopPropagation();
    setResizeTarget(id);
    setStartSize({ width: widgetSizes[id].width, height: widgetSizes[id].height });
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const doResize = (e) => {
      if (!resizeTarget) return;
      setWidgetSizes(prev => ({
        ...prev,
        [resizeTarget]: { width: Math.max(260, startSize.width + (e.clientX - startPos.x)), height: Math.max(220, startSize.height + (e.clientY - startPos.y)) }
      }));
    };
    const stopResize = () => {
      if (resizeTarget) saveLayoutToFirestore(widgetOrder, widgetSizes);
      setResizeTarget(null);
    };
    if (resizeTarget) {
      window.addEventListener('mousemove', doResize);
      window.addEventListener('mouseup', stopResize);
    }
    return () => {
      window.removeEventListener('mousemove', doResize);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [resizeTarget, startPos, startSize, widgetOrder, widgetSizes]);

  // 핵심 로직: 브라우저 COOP 보안 차단막을 우회하기 위해 캘린더 구글 인증 모드를 리디렉션 체제로 전면 전환
  const login = useGoogleLogin({
    uxMode: 'redirect',
    onSuccess: (res) => { 
      setIsLoggedIn(true); 
      setAccessToken(res.access_token); 
    },
    onError: (err) => console.error("구글 캘린더 연동 실패 가드:", err),
    scope: 'https://www.googleapis.com/auth/calendar.readonly'
  });

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!inputModal.text.trim()) return;
    if (inputModal.onSubmit) inputModal.onSubmit(inputModal.text);
    setInputModal({ isOpen: false, nodeId: null, text: '', mode: 'add', onSubmit: null });
  };

  const renderWidgetContent = (id) => {
    switch (id) {
      case 'clock': return <ClockWidget />;
      case 'weather': return <WeatherWidget />;
      case 'workflow': return <WorkflowWidget userId={userId} />;
      case 'calendar': return <Calendar onChange={setSelectedDate} value={selectedDate} calendarType="gregory" tileClassName={({ date, view }) => view === 'month' ? (date.getDay() === 6 ? 'sat-tile' : date.getDay() === 0 ? 'sun-tile' : null) : null} formatDay={(locale, d) => d.getDate().toString()} />;
      case 'scheduler': return <SchedulerWidget isLoggedIn={isLoggedIn} login={login} events={events} selectedDate={selectedDate} />;
      case 'mindmap': return <MindMapWidget userId={userId} onSelectMap={(map) => { setSelectedMapId(map.id); setIsMindMapOpen(true); }} />;
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000', padding: '24px', boxSizing: 'border-box', width: '100vw', position: 'absolute', top: 0, left: 0 }}>
      <button onClick={onLogout} style={{ position: 'absolute', top: '24px', right: '24px', zIndex: 100, background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.8rem' }}>로그아웃</button>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', width: '100%', justifyContent: 'flex-start', alignItems: 'flex-start', marginTop: '40px' }}>
        {widgetOrder.map((id) => (
          <div key={id} draggable={!resizeTarget} onDragStart={() => handleDragStart(id)} onDragOver={handleDragOver} onDrop={() => handleDrop(id)} onDragEnd={handleDragEnd} style={{ ...iosLiquidGlassWidget, width: `${widgetSizes[id]?.width || 320}px`, height: `${widgetSizes[id]?.height || 260}px`, opacity: draggingId === id ? 0.3 : 1 }}>
            {renderWidgetContent(id)}
            <div className="ios-resize-trigger" onMouseDown={(e) => initResize(e, id)} />
          </div>
        ))}
      </div>

      {isMindMapOpen && selectedMapId && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 999999, backgroundColor: '#000000', padding: '40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '16px', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '600', color: '#007aff' }}>마인드맵 편집기</h2>
            <button onClick={() => { setIsMindMapOpen(false); setSelectedMapId(null); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 16px', borderRadius: '10px', cursor: 'pointer' }}>닫기</button>
          </div>
          <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', position: 'relative', overflow: 'hidden' }}>
            <MindMapWidget userId={userId} isEditorMode={true} selectedMapId={selectedMapId} openModal={(config) => setInputModal({ isOpen: true, ...config })} />
          </div>
        </div>
      )}

      {inputModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999999, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleFormSubmit} style={{ background: 'linear-gradient(135deg, rgba(44, 44, 48, 0.95) 0%, rgba(28, 28, 30, 0.98) 100%)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '24px', padding: '24px', width: '320px', color: '#fff' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#007aff' }}>{inputModal.mode === 'add' ? '새 블록 내용 입력' : '블록 내용 수정'}</h4>
            <input type="text" value={inputModal.text} onChange={(e) => setInputModal({ ...inputModal, text: e.target.value })} autoFocus style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px', color: '#fff', outline: 'none', marginBottom: '16px' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setInputModal({ isOpen: false, nodeId: null, text: '', mode: 'add', onSubmit: null })} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer' }}>취소</button>
              <button type="submit" style={{ background: '#007aff', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer' }}>확인</button>
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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>로딩 중...</div>;
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <button onClick={() => signInWithPopup(auth, googleProvider)} style={{ padding: '14px 24px', fontSize: '1rem', fontWeight: '600', borderRadius: '16px', background: '#007aff', color: '#fff', border: 'none', cursor: 'pointer' }}>
          Google 계정으로 로그인 (DB 접근)
        </button>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId="451500058668-2okdn1lli09s36opj20ch4ibts9fkjm3.apps.googleusercontent.com">
      <DashboardContent userId={user.uid} />
    </GoogleOAuthProvider>
  );
}