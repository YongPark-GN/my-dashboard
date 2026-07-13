import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; 
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import MindMapWidget from './components/MindMapWidget';
import { db } from './firebase';
import { doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';

const iosLiquidGlassTheme = `
  * {
    margin: 0 !important;
    box-sizing: border-box !important;
  }
  body, html, #root { 
    margin: 0 !important; 
    padding: 0 !important;
    background-color: #000000; 
    color: #ffffff; 
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    width: 100vw !important;
    max-width: 100vw !important;
    overflow-x: hidden;
  }
  .react-calendar { background: transparent !important; color: #ffffff !important; border: none !important; width: 100% !important; font-family: inherit; }
  .react-calendar abbr { text-decoration: none !important; border-bottom: none !important; cursor: default; }
  .react-calendar__navigation button { color: #ffffff !important; min-width: 30px; background: none; font-size: 13px; font-weight: 500; }
  .react-calendar__navigation button:enabled:hover { background-color: rgba(255,255,255,0.06); border-radius: 6px; }
  .react-calendar__month-view__weekdays { color: rgba(255,255,255,0.3) !important; text-transform: uppercase; font-weight: 600; font-size: 0.7rem; letter-spacing: 0.5px; padding-bottom: 8px; }
  .react-calendar__tile { color: #ffffff !important; background: none; border: none; padding: 10px 0; font-size: 0.85rem; position: relative; }
  .react-calendar__tile:enabled:hover { background-color: rgba(255,255,255,0.08) !important; border-radius: 12px; }
  .react-calendar__tile--now { background: rgba(255,255,255,0.15) !important; border-radius: 12px; font-weight: 600; }
  .react-calendar__tile--active { background: #007aff !important; color: white !important; border-radius: 12px !important; }
  .sat-tile { color: #30a9ff !important; }
  .sun-tile { color: #ff3b30 !important; }
  .ios-resize-trigger { position: absolute; right: 8px; bottom: 8px; width: 12px; height: 12px; cursor: se-resize; z-index: 15; }
  .ios-resize-trigger::after { content: ""; position: absolute; right: 2px; bottom: 2px; width: 4px; height: 4px; border-right: 2px solid rgba(255, 255, 255, 0.25); border-bottom: 2px solid rgba(255, 255, 255, 0.25); }
`;

if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.innerHTML = iosLiquidGlassTheme;
  document.head.appendChild(styleTag);
}

const iosLiquidGlassWidget = {
  background: 'linear-gradient(135deg, rgba(32, 32, 36, 0.7) 0%, rgba(16, 16, 18, 0.75) 100%)',
  backdropFilter: 'blur(40px) saturate(200%)',
  WebkitBackdropFilter: 'blur(40px) saturate(200%)',
  borderRadius: '28px', 
  padding: '20px',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.15), 0 8px 32px rgba(0, 0, 0, 0.4)',
  color: '#ffffff',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  overflow: 'hidden',
  position: 'relative'
};

function DashboardContent() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isMindMapOpen, setIsMindMapOpen] = useState(false);
  const [currentMindMap, setCurrentMindMap] = useState(null);
  const [inputModal, setInputModal] = useState({ isOpen: false, nodeId: null, text: '', mode: 'add' });

  const [widgetOrder, setWidgetOrder] = useState(['clock', 'calendar', 'mindmap']);
  const [widgetSizes, setWidgetSizes] = useState({
    clock: { width: 360, height: 260 }, 
    calendar: { width: 360, height: 260 },
    mindmap: { width: 360, height: 260 } 
  });

  const [resizeTarget, setResizeTarget] = useState(null);
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  // 한글 주석: 데이터 휘발 버그 수정 - 메인 리스너 파이프라인 연계
  useEffect(() => {
    if (!isMindMapOpen || !currentMindMap?.id) return;
    const unsubscribe = onSnapshot(doc(db, 'mindmaps', currentMindMap.id), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentMindMap({ id: docSnap.id, ...docSnap.data() });
      }
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
      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;
      setWidgetSizes(prev => ({
        ...prev,
        [resizeTarget]: { width: Math.max(260, startSize.width + deltaX), height: Math.max(220, startSize.height + deltaY) }
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

  const tileClassNameGetter = ({ date, view }) => {
    if (view === 'month') {
      const day = date.getDay();
      if (day === 6) return 'sat-tile';
      if (day === 0) return 'sun-tile';
    }
    return null;
  };

  // 한글 주석: 노드 데이터 입력 폼 제출 및 Firestore 전송
  const submitNodeData = async (e) => {
    if (e) e.preventDefault();
    if (!inputModal.text.trim() || !currentMindMap) return;

    try {
      const docRef = doc(db, 'mindmaps', currentMindMap.id);
      if (inputModal.mode === 'add') {
        const parentNode = currentMindMap.nodes.find(n => n.id === inputModal.nodeId);
        const newId = `node_${Date.now()}`;
        
        // 구조 개편: 직속 부모의 Y축 위치값을 역산하여 교차 문제 해결
        const childCount = currentMindMap.edges ? currentMindMap.edges.filter(edge => edge.source === inputModal.nodeId).length : 0;
        const offsetMultiplier = childCount % 2 === 0 ? 1 : -1;
        
        const newNode = {
          id: newId,
          text: inputModal.text,
          x: (parentNode?.x || 150) + 240,
          y: (parentNode?.y || 300) + (Math.ceil(childCount / 2) * 80 * offsetMultiplier)
        };
        const newEdge = { id: `e_${inputModal.nodeId}_${newId}`, source: inputModal.nodeId, target: newId };

        await updateDoc(docRef, {
          nodes: [...currentMindMap.nodes, newNode],
          edges: [...(currentMindMap.edges || []), newEdge]
        });
      } else if (inputModal.mode === 'edit') {
        const updated = currentMindMap.nodes.map(n => n.id === inputModal.nodeId ? { ...n, text: inputModal.text } : n);
        await updateDoc(docRef, { nodes: updated });
      }
      setInputModal({ isOpen: false, nodeId: null, text: '', mode: 'add' });
    } catch (err) { console.error(err); }
  };

  const handleDeleteNode = async (nodeId) => {
    if (nodeId === 'root') return alert('중심 블록은 삭제할 수 없습니다.');
    if (!confirm('이 블록을 삭제하시겠습니까?')) return;
    try {
      const updatedNodes = currentMindMap.nodes.filter(n => n.id !== nodeId);
      const updatedEdges = currentMindMap.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
      await updateDoc(doc(db, 'mindmaps', currentMindMap.id), { nodes: updatedNodes, edges: updatedEdges });
    } catch (err) { console.error(err); }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000', padding: '24px', boxSizing: 'border-box', width: '100vw', position: 'absolute', top: 0, left: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', width: '100%', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
        {widgetOrder.map((id) => (
          <div key={id} style={{ ...iosLiquidGlassWidget, width: `${widgetSizes[id]?.width || 320}px`, height: `${widgetSizes[id]?.height || 260}px` }}>
            {id === 'clock' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, fontSize: '3rem', fontWeight: '700' }}>
                12:07
              </div>
            )}
            {id === 'calendar' && (
              <Calendar value={selectedDate} calendarType="gregory" tileClassName={tileClassNameGetter} formatDay={(locale, date) => date.getDate().toString()} formatShortWeekday={(locale, date) => ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]} />
            )}
            {id === 'mindmap' && (
              <MindMapWidget onSelectMap={(map) => { setCurrentMindMap(map); setIsMindMapOpen(true); }} />
            )}
            <div className="ios-resize-trigger" onMouseDown={(e) => initResize(e, id)} />
          </div>
        ))}
      </div>

      {isMindMapOpen && currentMindMap && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 999999, backgroundColor: '#000000', padding: '40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '16px', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '600', color: '#007aff' }}>{currentMindMap.title} (마인드맵 편집기)</h2>
            <button onClick={() => setIsMindMapOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 16px', borderRadius: '10px', cursor: 'pointer' }}>전체창 닫기</button>
          </div>

          <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', position: 'relative', overflow: 'hidden' }}>
            <MindMapWidget 
              isEditorMode={true} 
              currentMap={currentMindMap} 
              onAddNodeClick={(parentId) => setInputModal({ isOpen: true, nodeId: parentId, text: '', mode: 'add' })}
              onEditNodeClick={(nodeId, text) => setInputModal({ isOpen: true, nodeId: nodeId, text: text, mode: 'edit' })}
              onDeleteNodeClick={handleDeleteNode}
            />
          </div>

          {inputModal.isOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999999, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <form onSubmit={submitNodeData} style={{ background: 'linear-gradient(135deg, rgba(44, 44, 48, 0.95) 0%, rgba(28, 28, 30, 0.98) 100%)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '24px', padding: '24px', width: '320px', color: '#fff' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#007aff' }}>{inputModal.mode === 'add' ? '새 블록 내용 입력' : '블록 내용 수정'}</h4>
                <input type="text" value={inputModal.text} onChange={(e) => setInputModal({ ...inputModal, text: e.target.value })} autoFocus style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px', color: '#fff', outline: 'none', marginBottom: '16px' }} />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setInputModal({ isOpen: false, nodeId: null, text: '', mode: 'add' })} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer' }}>취소</button>
                  <button type="submit" style={{ background: '#007aff', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer' }}>확인</button>
                </div>
              </form>
            </div>
          )}
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