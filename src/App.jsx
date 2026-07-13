import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; 
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

// 각 독립 컴포넌트 호출
import ClockWidget from './components/ClockWidget';
import WeatherWidget from './components/WeatherWidget';
import WorkflowWidget from './components/WorkflowWidget';
import SchedulerWidget from './components/SchedulerWidget';
import MindMapWidget from './components/MindMapWidget';

import { db } from './firebase';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

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

function DashboardContent() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState('');

  const [isMindMapOpen, setIsMindMapOpen] = useState(false);
  const [selectedMapId, setSelectedMapId] = useState(null); // 수정 logic: 무거운 객체 대신 ID만 추적하여 충돌 차단
  const [inputModal, setInputModal] = useState({ isOpen: false, nodeId: null, text: '', mode: 'add', currentNodes: [], currentEdges: [] });

  const [widgetOrder, setWidgetOrder] = useState(() => {
    const saved = localStorage.getItem('dashboard_widget_order');
    return saved ? JSON.parse(saved) : ['clock', 'weather', 'workflow', 'calendar', 'scheduler', 'mindmap'];
  });

  const [widgetSizes, setWidgetSizes] = useState(() => {
    const saved = localStorage.getItem('dashboard_widget_sizes');
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
    try {
      if (!db) return;
      const layoutConfigRef = doc(db, "dashboard", "layoutConfig");
      const unsubscribeLayout = onSnapshot(layoutConfigRef, (docSnap) => {
        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          if (remoteData?.widgetOrder) setWidgetOrder(remoteData.widgetOrder);
          if (remoteData?.widgetSizes) setWidgetSizes(remoteData.widgetSizes);
        }
      });
      return () => unsubscribeLayout();
    } catch (e) { console.error(e); }
  }, []);

  const saveLayoutToFirestore = async (newOrder, newSizes) => {
    try {
      if (!db) return;
      await setDoc(doc(db, "dashboard", "layoutConfig"), { widgetOrder: newOrder, widgetSizes: newSizes }, { merge: true });
    } catch (err) { console.error(err); }
  };

  const handleDragStart = (id) => { if (!resizeTarget) setDraggingId(id); };
  const handleDragOver = (e) => { e.preventDefault(); };
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

  const login = useGoogleLogin({
    onSuccess: (res) => { setIsLoggedIn(true); setAccessToken(res.access_token); },
    scope: 'https://www.googleapis.com/auth/calendar.readonly'
  });

  // 코드 핵심 logic: 자식(MindMapWidget)이 던져준 순수 노드 배열을 기반으로 새 블록 계산 및 스키마 유실 자동 방어
  const submitNodeData = async (e) => {
    if (e) e.preventDefault();
    if (!inputModal.text.trim() || !selectedMapId) return;

    try {
      const docRef = doc(db, 'mindmaps', selectedMapId);
      const safeNodes = inputModal.currentNodes.length > 0 ? inputModal.currentNodes : [{ id: 'root', text: "중심 노드", x: 150, y: 300 }];
      const safeEdges = inputModal.currentEdges || [];

      if (inputModal.mode === 'add') {
        const parentNode = safeNodes.find(n => n.id === inputModal.nodeId);
        const newId = `node_${Date.now()}`;
        const childCount = safeEdges.filter(edge => edge.source === inputModal.nodeId).length;
        const offsetMultiplier = childCount % 2 === 0 ? 1 : -1;
        
        const newNode = {
          id: newId,
          text: inputModal.text,
          x: (parentNode?.x || 150) + 240,
          y: (parentNode?.y || 300) + (Math.ceil(childCount / 2) * 80 * offsetMultiplier)
        };
        const newEdge = { id: `e_${inputModal.nodeId}_${newId}`, source: inputModal.nodeId, target: newId };

        await updateDoc(docRef, {
          nodes: [...safeNodes, newNode],
          edges: [...safeEdges, newEdge]
        });
      } else if (inputModal.mode === 'edit') {
        const updated = safeNodes.map(n => n.id === inputModal.nodeId ? { ...n, text: inputModal.text } : n);
        await updateDoc(docRef, { nodes: updated });
      }
      setInputModal({ isOpen: false, nodeId: null, text: '', mode: 'add', currentNodes: [], currentEdges: [] });
    } catch (err) { console.error(err); }
  };

  const handleDeleteNode = async (nodeId, currentNodes, currentEdges) => {
    if (nodeId === 'root') return alert('중심 블록 금지');
    if (!confirm('삭제?')) return;
    await updateDoc(doc(db, 'mindmaps', selectedMapId), { 
      nodes: currentNodes.filter(n => n.id !== nodeId), 
      edges: currentEdges.filter(e => e.source !== nodeId && e.target !== nodeId) 
    });
  };

  const renderWidgetContent = (id) => {
    switch (id) {
      case 'clock': return <ClockWidget />;
      case 'weather': return <WeatherWidget />;
      case 'workflow': return <WorkflowWidget />;
      case 'calendar': return <Calendar onChange={setSelectedDate} value={selectedDate} calendarType="gregory" tileClassName={({ date, view }) => view === 'month' ? (date.getDay() === 6 ? 'sat-tile' : date.getDay() === 0 ? 'sun-tile' : null) : null} formatDay={(locale, d) => d.getDate().toString()} />;
      case 'scheduler': return <SchedulerWidget isLoggedIn={isLoggedIn} login={login} events={events} selectedDate={selectedDate} />;
      case 'mindmap': return <MindMapWidget onSelectMap={(map) => { setSelectedMapId(map.id); setIsMindMapOpen(true); }} />;
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000', padding: '24px', boxSizing: 'border-box', width: '100vw', position: 'absolute', top: 0, left: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', width: '100%', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
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
            <MindMapWidget 
              isEditorMode={true} 
              selectedMapId={selectedMapId} 
              onAddNodeClick={(parentId, currentNodes, currentEdges) => setInputModal({ isOpen: true, nodeId: parentId, text: '', mode: 'add', currentNodes, currentEdges })} 
              onEditNodeClick={(nodeId, text, currentNodes) => setInputModal({ isOpen: true, nodeId: nodeId, text: text, mode: 'edit', currentNodes, currentEdges: [] })} 
              onDeleteNodeClick={handleDeleteNode} 
            />
          </div>
        </div>
      )}

      {inputModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999999, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={submitNodeData} style={{ background: 'linear-gradient(135deg, rgba(44, 44, 48, 0.95) 0%, rgba(28, 28, 30, 0.98) 100%)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '24px', padding: '24px', width: '320px', color: '#fff' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#007aff' }}>{inputModal.mode === 'add' ? '새 블록 내용 입력' : '블록 내용 수정'}</h4>
            <input type="text" value={inputModal.text} onChange={(e) => setInputModal({ ...inputModal, text: e.target.value })} autoFocus style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px', color: '#fff', outline: 'none', marginBottom: '16px' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setInputModal({ isOpen: false, nodeId: null, text: '', mode: 'add', currentNodes: [], currentEdges: [] })} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer' }}>취소</button>
              <button type="submit" style={{ background: '#007aff', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer' }}>확인</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId="451500058668-2okdn1lli09s36opj20ch4ibts9fkjm3.apps.googleusercontent.com">
      <DashboardContent />
    </GoogleOAuthProvider>
  );
}