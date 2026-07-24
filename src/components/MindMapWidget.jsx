import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom'; // 핵심 로직: 모달 창 렌더링 컨텍스트 분리 및 오버플로우 회피용 리액트 코어 유틸
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { toast } from './Toast';

export default function MindMapWidget({ userId, onSelectMap, isEditorMode, selectedMapId, openModal }) {
  const [mindmaps, setMindmaps] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  
  const [dragState, setDragState] = useState({ isDragging: false, nodeId: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const [editorNodes, setEditorNodes] = useState([]);
  const [editorEdges, setEditorEdges] = useState([]);
  
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);

  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null });

  useEffect(() => {
    if (isEditorMode || !userId) return;
    const unsubscribe = onSnapshot(collection(db, 'users', userId, 'mindmaps'), (snapshot) => {
      setMindmaps(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    }, () => {});
    return () => unsubscribe();
  }, [isEditorMode, userId]);

  useEffect(() => {
    if (!isEditorMode || !selectedMapId || !userId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 에디터 진입 시 줌 초기화(의도된 동기 리셋)
    setZoom(1);
    const unsubscribe = onSnapshot(doc(db, 'users', userId, 'mindmaps', selectedMapId), (docSnap) => {
      if (docSnap.exists() && !dragState.isDragging) {
        const rawData = docSnap.data();
        setEditorNodes(rawData.nodes || [{ id: 'root', text: rawData.title || "중심 노드", x: 1920, y: 1980 }]);
        setEditorEdges(rawData.edges || []);
      }
    }, () => {});
    return () => unsubscribe();
  }, [selectedMapId, isEditorMode, dragState.isDragging, userId]);

  useEffect(() => {
    if (isEditorMode && selectedMapId) {
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollLeft = 2000 - containerRef.current.clientWidth / 2;
          containerRef.current.scrollTop = 2000 - containerRef.current.clientHeight / 2;
        }
      }, 80); 
    }
  }, [isEditorMode, selectedMapId]);

  const handleCreateMap = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !userId) return;
    try {
      await addDoc(collection(db, 'users', userId, 'mindmaps'), {
        title: newTitle, createdAt: new Date().toISOString(),
        nodes: [{ id: 'root', text: newTitle, x: 1920, y: 1980 }], edges: []
      });
      setNewTitle('');
    } catch { toast('마인드맵 생성에 실패했습니다.'); }
  };

  const handleDeleteMap = (mapId) => {
    if (!userId) return;
    setConfirmDialog({
      isOpen: true,
      message: "이 마인드맵을 정말로 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.",
      onConfirm: async () => {
        try { await deleteDoc(doc(db, 'users', userId, 'mindmaps', mapId)); }
        catch { toast('마인드맵 삭제에 실패했습니다.'); }
      }
    });
  };

  const nodeBox = (node) => {
    const el = document.getElementById(`mm-node-${node.id}`);
    const w = el ? el.offsetWidth : 180;
    const h = el ? el.offsetHeight : 52;
    const x = node.x || 0, y = node.y || 0;
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  };

  // 부드러운 수평 흐름 베지어 곡선. 대상이 오른쪽이면 소스 우측→대상 좌측, 왼쪽이면 반대.
  const edgePath = (srcNode, tgtNode) => {
    const s = nodeBox(srcNode), t = nodeBox(tgtNode);
    const rightward = t.cx >= s.cx;
    const sx = rightward ? s.x + s.w : s.x;
    const tx = rightward ? t.x : t.x + t.w;
    const sy = s.cy, ty = t.cy;
    const c = Math.max(50, Math.abs(tx - sx) * 0.5);
    const c1x = rightward ? sx + c : sx - c;
    const c2x = rightward ? tx - c : tx + c;
    return `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}`;
  };

  const handleInteractionStart = (e, node) => {
    if (e.target.tagName === 'BUTTON') return; 
    e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragState({ isDragging: true, nodeId: node.id, startX: clientX, startY: clientY, initialX: node.x || 0, initialY: node.y || 0 });
  };

  const handleInteractionMove = (e) => {
    if (!dragState.isDragging || !isEditorMode) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaX = (clientX - dragState.startX) / zoom;
    const deltaY = (clientY - dragState.startY) / zoom;
    setEditorNodes(prev => prev.map(n => n.id === dragState.nodeId ? { ...n, x: dragState.initialX + deltaX, y: dragState.initialY + deltaY } : n));
  };

  const handleInteractionEnd = async () => {
    if (!dragState.isDragging || !userId) return;
    const currentNodesSnapshot = [...editorNodes];
    setDragState({ isDragging: false, nodeId: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });
    try { await updateDoc(doc(db, 'users', userId, 'mindmaps', selectedMapId), { nodes: currentNodesSnapshot }); }
    catch { toast('노드 위치 저장에 실패했습니다.'); }
  };

  const internalAddNode = (parentId) => {
    if (!userId) return;
    openModal({ mode: 'add', text: '', nodeId: parentId, onSubmit: async (text) => {
      const parentNode = editorNodes.find(n => n.id === parentId);
      let targetX = (parentNode?.x || 1920) + 280;
      let targetY = parentNode?.y || 1980;
      
      let isOverlapping = true;
      let iterations = 0;
      while (isOverlapping && iterations < 30) {
        const overlap = editorNodes.find(n => Math.abs(n.x - targetX) < 180 && Math.abs(n.y - targetY) < 70);
        if (overlap) targetY += 90; 
        else isOverlapping = false;
        iterations++;
      }

      const newId = `node_${Date.now()}`;
      const newNode = { id: newId, text: text, x: targetX, y: targetY };
      const newEdge = { id: `e_${parentId}_${newId}`, source: parentId, target: newId };
      try {
        await updateDoc(doc(db, 'users', userId, 'mindmaps', selectedMapId), { nodes: [...editorNodes, newNode], edges: [...editorEdges, newEdge] });
      } catch { toast('블록 추가에 실패했습니다.'); }
    }});
  };

  const internalEditNode = (nodeId, oldText) => {
    if (!userId) return;
    openModal({ mode: 'edit', text: oldText, nodeId: nodeId, onSubmit: async (text) => {
      const updated = editorNodes.map(n => n.id === nodeId ? { ...n, text } : n);
      try {
        await updateDoc(doc(db, 'users', userId, 'mindmaps', selectedMapId), { nodes: updated });
      } catch { toast('블록 수정에 실패했습니다.'); }
    }});
  };

  const internalDeleteNode = (nodeId) => {
    if (nodeId === 'root') {
      setConfirmDialog({ isOpen: true, message: "중심 블록은 삭제할 수 없습니다.", onConfirm: () => {} });
      return;
    }
    if (!userId) return;
    
    setConfirmDialog({
      isOpen: true,
      message: "해당 블록을 삭제하시겠습니까?",
      onConfirm: async () => {
        const updatedNodes = editorNodes.filter(n => n.id !== nodeId);
        const updatedEdges = editorEdges.filter(e => e.source !== nodeId && e.target !== nodeId);
        try {
          await updateDoc(doc(db, 'users', userId, 'mindmaps', selectedMapId), { nodes: updatedNodes, edges: updatedEdges });
        } catch { toast('블록 삭제에 실패했습니다.'); }
      }
    });
  };

  // 핵심 로직: 포탈을 이용해 body 계층으로 모달을 분리 추출
  const renderConfirmDialog = () => {
    if (!confirmDialog.isOpen) return null;
    return createPortal(
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999999, backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'var(--editor-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '32px', width: '320px', color: 'var(--txt)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', textAlign: 'center' }}>
          <p style={{ margin: '0 0 24px 0', fontSize: '1rem', color: 'var(--txt)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{confirmDialog.message}</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null })} style={{ flex: 1, background: 'var(--chip-strong)', border: 'none', color: 'var(--txt)', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600' }}>취소</button>
            <button onClick={() => { if(confirmDialog.onConfirm) confirmDialog.onConfirm(); setConfirmDialog({ isOpen: false, message: '', onConfirm: null }); }} style={{ flex: 1, background: 'var(--danger)', border: 'none', color: '#fff', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '700' }}>확인</button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  if (!isEditorMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', width: '100%' }}>
        <form onSubmit={handleCreateMap} style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="새 마인드맵 제목" style={{ flex: 1, background: 'var(--field-bg)', border: '1px solid var(--field-border)', borderRadius: '12px', padding: '10px 14px', fontSize: '0.9rem', color: 'var(--txt)', outline: 'none' }} />
          <button type="submit" style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '12px', padding: '0 20px', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer' }}>생성</button>
        </form>
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mindmaps.map((map) => (
            <div key={map.id} style={{ background: 'var(--chip-bg)', border: '1px solid var(--field-border)', borderRadius: '16px', padding: '16px 20px', fontSize: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span onClick={() => onSelectMap(map)} style={{ color: 'var(--txt)', flex: 1, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500' }}>{map.title}</span>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteMap(map.id); }} style={{ background: 'rgba(255,59,48,0.15)', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', padding: '8px 14px', borderRadius: '10px', marginLeft: '16px', transition: 'background 0.2s' }}>삭제</button>
            </div>
          ))}
        </div>
        {renderConfirmDialog()}
      </div>
    );
  }

  return (
    <div ref={containerRef} onMouseMove={handleInteractionMove} onTouchMove={handleInteractionMove} onMouseUp={handleInteractionEnd} onTouchEnd={handleInteractionEnd} onMouseLeave={handleInteractionEnd} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'auto', background: 'var(--editor-bg)' }}>

      <div style={{ position: 'fixed', bottom: '40px', right: '40px', zIndex: 10000, background: 'var(--glass-bg)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', padding: '12px 20px', borderRadius: '20px', border: '1px solid var(--glass-border)', boxShadow: '0 12px 32px var(--glass-shadow), inset 0 1px 1px var(--glass-highlight)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--accent-text)', letterSpacing: '0.5px' }}>ZOOM</span>
        <input type="range" min="0.1" max="2.0" step="0.05" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} style={{ width: '220px', height: '4px', cursor: 'pointer', accentColor: 'var(--accent)' }} />
      </div>

      <div style={{ transform: `scale(${zoom})`, transformOrigin: '2000px 2000px', width: '4000px', height: '4000px', position: 'relative' }}>
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '4000px', height: '4000px', pointerEvents: 'none', zIndex: 0, overflow: 'visible' }}>
          {editorEdges?.map((edge) => {
            const sourceNode = editorNodes.find(n => n.id === edge.source); const targetNode = editorNodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;
            return <path key={edge.id} d={edgePath(sourceNode, targetNode)} stroke="var(--accent)" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.8" />;
          })}
        </svg>

        {editorNodes.map((node) => {
          const isSelected = dragState.nodeId === node.id;
          const isRoot = node.id === 'root';
          return (
            <div key={node.id} id={`mm-node-${node.id}`} onMouseDown={(e) => handleInteractionStart(e, node)} onTouchStart={(e) => handleInteractionStart(e, node)} style={{ position: 'absolute', left: `${node.x || 0}px`, top: `${node.y || 0}px`, minWidth: '160px', maxWidth: '320px', zIndex: isSelected ? 100 : 10, background: isRoot ? 'linear-gradient(135deg, #0a84ff 0%, #0060df 100%)' : 'var(--node-bg)', border: isSelected ? '2px solid var(--accent)' : isRoot ? '1.5px solid rgba(255,255,255,0.35)' : '1px solid var(--glass-border)', boxShadow: isSelected ? '0 0 0 4px rgba(0,122,255,0.25), 0 12px 30px rgba(0,0,0,0.35)' : '0 8px 22px rgba(0,0,0,0.22)', borderRadius: '16px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', userSelect: 'none', cursor: dragState.isDragging ? 'grabbing' : 'grab' }}>
              <span onDoubleClick={() => internalEditNode(node.id, node.text)} style={{ fontSize: '0.9rem', fontWeight: '600', color: isRoot ? '#ffffff' : 'var(--txt)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1, cursor: 'text', lineHeight: '1.4' }}>{node.text}</span>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                <button onClick={() => internalAddNode(node.id)} onTouchEnd={(e) => { e.stopPropagation(); internalAddNode(node.id); }} style={{ width: '24px', height: '24px', background: 'rgba(52, 199, 89, 0.2)', border: '1px solid rgba(52, 199, 89, 0.5)', borderRadius: '7px', color: '#34c759', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                {!isRoot && <button onClick={() => internalDeleteNode(node.id)} onTouchEnd={(e) => { e.stopPropagation(); internalDeleteNode(node.id); }} style={{ width: '24px', height: '24px', background: 'rgba(255, 59, 48, 0.2)', border: '1px solid rgba(255, 59, 48, 0.5)', borderRadius: '7px', color: '#ff453a', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>}
              </div>
            </div>
          );
        })}
      </div>
      {renderConfirmDialog()}
    </div>
  );
}