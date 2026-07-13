import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; 
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

// 각 위젯 독립 컴포넌트 묶음 호출
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
  boxSizing: 'border-box', overflow: 'hidden', position: 'relative'
};

function DashboardContent() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState('');

  const [isMindMapOpen, setIsMindMapOpen] = useState(false);
  const [currentMindMap, setCurrentMindMap] = useState(null);
  const [inputModal, setInputModal] = useState({ isOpen: false, nodeId: null, text: '', mode: 'add' });

  const [widgetOrder] = useState(['clock', 'weather', 'workflow', 'calendar', 'scheduler', 'mindmap']);
  const [widgetSizes, setWidgetSizes] = useState({
    clock: { width: 360, height: 260 }, weather: { width: 320, height: 260 },
    workflow: { width: 664, height: 340 }, calendar: { width: 360, height: 260 },
    scheduler: { width: 320, height: 260 }, mindmap: { width: 360, height: 260 }
  });

  const [resizeTarget, setResizeTarget] = useState(null);
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!isMindMapOpen || !currentMindMap?.id) return;
    const unsubscribe = onSnapshot(doc(db, 'mindmaps', currentMindMap.id), (docSnap) => {
      if (docSnap.exists()) setCurrentMindMap({ id: docSnap.id, ...docSnap.data() });
    });
    return () => unsubscribe();
  }, [isMindMapOpen]);

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
    const stopResize = () => setResizeTarget(null);
    if (resizeTarget) {
      window.addEventListener('mousemove', doResize);
      window.addEventListener('mouseup', stopResize);
    }
    return () => {
      window.removeEventListener('mousemove', doResize);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [resizeTarget, startPos, startSize]);

  const login = useGoogleLogin({
    onSuccess: (res) => { setIsLoggedIn(true); setAccessToken(res.access_token); },
    scope: 'https://www.googleapis.com/auth/calendar.readonly'
  });

  const submitNodeData = async (e) => {
    if (e) e.preventDefault();
    if (!inputModal.text.trim() || !currentMindMap) return;
    try {
      const docRef = doc(db, 'mindmaps', currentMindMap.id);
      if (inputModal.mode === 'add') {
        const parentNode = currentMindMap.nodes.find(n => n.id === inputModal.nodeId);
        const newId = `node_${Date.now()}`;
        const childCount = currentMindMap.edges ? currentMindMap.edges.filter(edge => edge.source === inputModal.nodeId).length : 0;
        const offsetMultiplier = childCount % 2 === 0 ? 1 : -1;
        const newNode = { id: newId, text: inputModal.text, x: (parentNode?.x || 150) + 240, y: (parentNode?.y || 300) + (Math.ceil(childCount / 2) * 80 * offsetMultiplier) };
        await updateDoc(docRef, { nodes: [...currentMindMap.nodes, newNode], edges: [...(currentMindMap.edges || []), { id: `e_${inputModal.nodeId}_${newId}`, source: inputModal.nodeId, target: newId }] });
      } else if (inputModal.mode === 'edit') {
        await updateDoc(docRef, { nodes: currentMindMap.nodes.map(n => n.id === inputModal.nodeId ? { ...n, text: inputModal.text } : n) });
      }
      setInputModal({ isOpen: false, nodeId: null, text: '', mode: 'add' });
    } catch (err) { console.error(err); }
  };

  const handleDeleteNode = async (nodeId) => {
    if (nodeId === 'root') return alert('중심 블록 금지');
    if (!confirm('삭제?')) return;
    await updateDoc(doc(db, 'mindmaps', currentMindMap.id), { nodes: currentMindMap.nodes.filter(n => n.id !== nodeId), edges: currentMindMap.edges.filter(e => e.source !== nodeId && e.target !== nodeId) });
  };

  const renderWidgetContent = (id) => {
    switch (id) {
      case 'clock': return <ClockWidget />;
      case 'weather': return <WeatherWidget />;
      case 'workflow': return <WorkflowWidget />;
      case 'calendar': return <Calendar onChange={setSelectedDate} value={selectedDate} calendarType="gregory" tileClassName={({ date, view }) => view === 'month' ? (date.getDay() === 6 ? 'sat-tile' : date.getDay() === 0 ? 'sun-tile' : null) : null} formatDay={(l, d) => date.getDate().toString()} />;
      case 'scheduler': return <SchedulerWidget isLoggedIn={isLoggedIn} login={login} events={events} selectedDate={selectedDate} />;
      case 'mindmap': return <MindMapWidget onSelectMap={(map) => { setCurrentMindMap(map); setIsMindMapOpen(true); }} />;
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000', padding: '24px', boxSizing: 'border-box', width: '100vw', position: 'absolute', top: 0, left: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', width: '100%', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
        {widgetOrder.map((id) => (
          <div key={id} style={{ ...iosLiquidGlassWidget, width: `${widgetSizes[id]?.width || 320}px`, height: `${widgetSizes[id]?.height || 260}px` }}>
            {renderWidgetContent(id)}
            <div className="ios-resize-trigger" onMouseDown={(e) => initResize(e, id)} />
          </div>
        ))}
      </div>

      {isMindMapOpen && currentMindMap && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 999999, backgroundColor: '#000000', padding: '40px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '16px', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '600', color: '#007aff' }}>{currentMindMap.title} (마인드맵 편집기)</h2>
            <button onClick={() => setIsMindMapOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 16px', borderRadius: '10px', cursor: 'pointer' }}>닫기</button>
          </div>
          <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', position: 'relative', overflow: 'hidden' }}>
            <MindMapWidget isEditorMode={true} currentMap={currentMindMap} onAddNodeClick={(parentId) => setInputModal({ isOpen: true, nodeId: parentId, text: '', mode: 'add' })} onEditNodeClick={(nodeId, text) => setInputModal({ isOpen: true, nodeId: nodeId, text: text, mode: 'edit' })} onDeleteNodeClick={handleDeleteNode} />
          </div>
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