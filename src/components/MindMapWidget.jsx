import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase'; 
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore'; 

export default function MindMapWidget({ userId, onSelectMap, isEditorMode, selectedMapId, openModal }) {
  const [mindmaps, setMindmaps] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  
  const [dragState, setDragState] = useState({ isDragging: false, nodeId: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const [editorNodes, setEditorNodes] = useState([]);
  const [editorEdges, setEditorEdges] = useState([]);
  
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    if (isEditorMode || !userId) return;
    
    const mindmapCollection = collection(db, 'users', userId, 'mindmaps');
    const unsubscribe = onSnapshot(mindmapCollection, (snapshot) => {
      setMindmaps(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    }, (err) => {
      console.warn("마인드맵 리스트 스냅샷 대기 유예:", err.message);
    });
    return () => unsubscribe();
  }, [isEditorMode, userId]);

  useEffect(() => {
    if (!isEditorMode || !selectedMapId || !userId) return;
    
    setZoom(1);

    const docRef = doc(db, 'users', userId, 'mindmaps', selectedMapId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists() && !dragState.isDragging) {
        const rawData = docSnap.data();
        // 핵심 주석: 기존 데이터가 없거나 첫 로드 시 4,000px 캔버스의 정중앙(1920, 1980)에서 시작되도록 분기
        setEditorNodes(rawData.nodes || [{ id: 'root', text: rawData.title || "중심 노드", x: 1920, y: 1980 }]);
        setEditorEdges(rawData.edges || []);
      }
    }, (err) => {
      console.warn("마인드맵 에디터 세션 유예:", err.message);
    });
    return () => unsubscribe();
  }, [selectedMapId, isEditorMode, dragState.isDragging, userId]);

  // 핵심 주석: 마인드맵 에디터 페이지가 열릴 때 스크롤바 위치를 4,000px 화폭의 정중앙으로 자동 스냅하는 로직
  useEffect(() => {
    if (isEditorMode && selectedMapId) {
      setTimeout(() => {
        if (containerRef.current) {
          const container = containerRef.current;
          // 4,000px 화폭 중심(2000px)에서 현재 브라우저 창의 절반 크기를 빼서 완벽한 뷰포트 중앙 배정
          container.scrollLeft = 2000 - container.clientWidth / 2;
          container.scrollTop = 2000 - container.clientHeight / 2;
        }
      }, 80); // DOM이 완벽히 렌더링된 후 계산을 유도하기 위한 마이크로 유예 타임아웃
    }
  }, [isEditorMode, selectedMapId]);

  const handleCreateMap = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !userId) return;
    
    const mindmapCollection = collection(db, 'users', userId, 'mindmaps');
    // 핵심 주석: 새 마인드맵 개설 시 최초 시작 중심 노드 위치를 4,000px 화폭의 정중앙인 (x:1920, y:1980)으로 배정
    await addDoc(mindmapCollection, { 
      title: newTitle, 
      createdAt: new Date().toISOString(), 
      nodes: [{ id: 'root', text: newTitle, x: 1920, y: 1980 }], 
      edges: [] 
    });
    setNewTitle('');
  };

  const handleDeleteMap = async (mapId) => {
    if (!userId) return;
    
    const confirmDelete = confirm("이 마인드맵을 정말로 삭제하시겠습니까?\n[취소]를 누르면 삭제가 철회되고 보존됩니다.");
    if (!confirmDelete) return; 
    
    try {
      await deleteDoc(doc(db, 'users', userId, 'mindmaps', mapId));
    } catch (err) {
      console.error("마인드맵 삭제 실패:", err);
    }
  };

  const getAnchorPoints = (nodeId) => {
    const el = document.getElementById(`mm-node-${nodeId}`);
    const width = el ? el.offsetWidth : 160;
    const height = el ? el.offsetHeight : 40;
    const node = editorNodes.find(n => n.id === nodeId);
    const x = node ? node.x || 0 : 0;
    const y = node ? node.y || 0 : 0;
    return {
      top: { x: x + width / 2, y: y }, bottom: { x: x + width / 2, y: y + height },
      left: { x: x, y: y + height / 2 }, right: { x: x + width, y: y + height / 2 }
    };
  };

  const getBestAnchors = (srcNode, tgtNode) => {
    const srcAnchors = getAnchorPoints(srcNode.id);
    const tgtAnchors = getAnchorPoints(tgtNode.id);
    let minDistance = Infinity; let bestSrc = srcAnchors.right; let bestTgt = tgtAnchors.left;

    Object.keys(srcAnchors).forEach(sKey => {
      Object.keys(tgtAnchors).forEach(tKey => {
        const sP = srcAnchors[sKey]; const tP = tgtAnchors[tKey];
        const dist = Math.pow(sP.x - tP.x, 2) + Math.pow(sP.y - tP.y, 2);
        if (dist < minDistance) { minDistance = dist; bestSrc = sP; bestTgt = tP; }
      });
    });
    return { sourcePt: bestSrc, targetPt: bestTgt };
  };

  const handleNodeMouseDown = (e) => {
    if (e.target.tagName === 'BUTTON') return; 
    e.stopPropagation();
    const nodeEl = e.currentTarget;
    const nodeId = nodeEl.id.replace('mm-node-', '');
    const node = editorNodes.find(n => n.id === nodeId);
    if (!node) return;

    setDragState({ isDragging: true, nodeId: node.id, startX: e.clientX, startY: e.clientY, initialX: node.x || 0, initialY: node.y || 0 });
  };

  const handleContainerMouseMove = (e) => {
    if (!dragState.isDragging || !isEditorMode) return;
    const deltaX = (e.clientX - dragState.startX) / zoom;
    const deltaY = (e.clientY - dragState.startY) / zoom;
    
    setEditorNodes(prevNodes => prevNodes.map(n => n.id === dragState.nodeId ? { ...n, x: dragState.initialX + deltaX, y: dragState.initialY + deltaY } : n));
  };

  const handleNodeMouseUp = async () => {
    if (!dragState.isDragging || !userId) return;
    const currentNodesSnapshot = [...editorNodes];
    setDragState({ isDragging: false, nodeId: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });
    try { 
      await updateDoc(doc(db, 'users', userId, 'mindmaps', selectedMapId), { nodes: currentNodesSnapshot }); 
    } catch (err) { console.error(err); }
  };

  const internalAddNode = (parentId) => {
    if (!userId) return;
    openModal({ mode: 'add', text: '', nodeId: parentId, onSubmit: async (text) => {
      const parentNode = editorNodes.find(n => n.id === parentId);
      const newId = `node_${Date.now()}`;
      const childCount = editorEdges.filter(edge => edge.source === parentId).length;
      const offsetMultiplier = childCount % 2 === 0 ? 1 : -1;
      const newNode = { id: newId, text: text, x: (parentNode?.x || 1920) + 240, y: (parentNode?.y || 1980) + (Math.ceil(childCount / 2) * 85 * offsetMultiplier) };
      const newEdge = { id: `e_${parentId}_${newId}`, source: parentId, target: newId };
      await updateDoc(doc(db, 'users', userId, 'mindmaps', selectedMapId), { nodes: [...editorNodes, newNode], edges: [...editorEdges, newEdge] });
    }});
  };

  const internalEditNode = (nodeId, oldText) => {
    if (!userId) return;
    openModal({ mode: 'edit', text: oldText, nodeId: nodeId, onSubmit: async (text) => {
      const updated = editorNodes.map(n => n.id === nodeId ? { ...n, text } : n);
      await updateDoc(doc(db, 'users', userId, 'mindmaps', selectedMapId), { nodes: updated });
    }});
  };

  const internalDeleteNode = async (nodeId) => {
    if (nodeId === 'root') return alert('중심 블록 금지');
    if (!confirm('삭제?') || !userId) return;
    await updateDoc(doc(db, 'users', userId, 'mindmaps', selectedMapId), { nodes: editorNodes.filter(n => n.id !== nodeId), edges: editorEdges.filter(e => e.source !== nodeId && e.target !== nodeId) });
  };

  if (!isEditorMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '10px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#ff2d55' }}>CREATIVE</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#ffffff', marginTop: '2px' }}>🧠 마인드맵 위젯</div>
        </div>
        <form onSubmit={handleCreateMap} style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="새 마인드맵 제목" style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '4px 8px', fontSize: '0.75rem', color: '#fff', outline: 'none' }} />
          <button type="submit" style={{ background: '#007aff', color: '#fff', border: 'none', borderRadius: '8px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>생성</button>
        </form>
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {mindmaps.map((map) => (
            <div key={map.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '8px 12px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span onClick={() => onSelectMap(map)} style={{ color: '#ffffff', flex: 1, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{map.title}</span>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteMap(map.id); }} style={{ background: 'transparent', border: 'none', color: '#ff3b30', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', padding: '2px 4px', borderRadius: '4px', marginLeft: '8px' }}>삭제</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} onMouseMove={handleContainerMouseMove} onMouseUp={handleNodeMouseUp} onMouseLeave={handleNodeMouseUp} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'auto', background: '#111115' }}>
      
      {/* 핵심 주석: 우측 아래 배치된 전용 줌 제어용 슬라이더 컨트롤러 바 (배율 수치 안내 텍스트 완전 제외) */}
      <div style={{ position: 'fixed', bottom: '40px', right: '40px', zIndex: 10000, background: 'linear-gradient(135deg, rgba(30,30,35,0.85) 0%, rgba(15,15,18,0.9) 100%)', backdropFilter: 'blur(20px)', padding: '10px 18px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#007aff', letterSpacing: '-0.3px' }}>ZOOM</span>
        <input 
          type="range" 
          min="0.3" 
          max="2.0" 
          step="0.05" 
          value={zoom} 
          onChange={(e) => setZoom(parseFloat(e.target.value))} 
          style={{ width: '110px', height: '4px', cursor: 'pointer', accentColor: '#007aff' }}
        />
      </div>

      <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: '4000px', height: '4000px', position: 'relative' }}>
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '4000px', height: '4000px', pointerEvents: 'none', zIndex: 0 }}>
          {editorEdges?.map((edge) => {
            const sourceNode = editorNodes.find(n => n.id === edge.source); const targetNode = editorNodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;
            const { sourcePt, targetPt } = getBestAnchors(sourceNode, targetNode);
            const cpX1 = sourcePt.x + (targetPt.x > sourcePt.x ? 60 : -60); const cpY1 = sourcePt.y;
            const cpX2 = targetPt.x + (targetPt.x > sourcePt.x ? -60 : 60); const cpY2 = targetPt.y;
            return <path key={edge.id} d={`M ${sourcePt.x} ${sourcePt.y} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${targetPt.x} ${targetPt.y}`} stroke="#007aff" strokeWidth="2.5" fill="none" />;
          })}
        </svg>

        {editorNodes.map((node) => {
          const isSelected = dragState.nodeId === node.id;
          return (
            <div key={node.id} id={`mm-node-${node.id}`} onMouseDown={handleNodeMouseDown} style={{ position: 'absolute', left: `${node.x || 0}px`, top: `${node.y || 0}px`, minWidth: '160px', maxWidth: '300px', width: 'auto', height: 'auto', zIndex: isSelected ? 100 : 10, background: node.id === 'root' ? 'linear-gradient(135deg, rgba(0,122,255,0.95) 0%, rgba(0,64,128,1) 100%)' : 'linear-gradient(135deg, rgba(44,44,48,0.95) 0%, rgba(28,28,30,0.98) 100%)', border: isSelected ? '1.5px solid #007aff' : node.id === 'root' ? '1.5px solid rgba(0,122,255,0.5)' : '1px solid rgba(255,255,255,0.18)', boxShadow: isSelected ? '0 0 15px rgba(0, 122, 255, 0.8), 0 8px 24px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.5)', borderRadius: '14px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', userSelect: 'none', cursor: dragState.isDragging ? 'grabbing' : 'grab' }}>
              <span onDoubleClick={() => internalEditNode(node.id, node.text)} style={{ fontSize: '0.8rem', fontWeight: '600', color: '#ffffff', whiteSpace: 'pre-wrap', wordBreak: 'break-all', flex: 1, cursor: 'text' }}>{node.text}</span>
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
                <button onClick={() => internalAddNode(node.id)} style={{ width: '18px', height: '18px', background: '#34c759', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}>+</button>
                {node.id !== 'root' && <button onClick={() => internalDeleteNode(node.id)} style={{ width: '18px', height: '18px', background: '#ff3b30', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}>-</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}