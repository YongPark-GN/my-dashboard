import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase'; 
import { collection, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';

export default function MindMapWidget({ onSelectMap, isEditorMode, selectedMapId, openModal }) {
  const [mindmaps, setMindmaps] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  
  const [dragState, setDragState] = useState({ isDragging: false, nodeId: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const [editorNodes, setEditorNodes] = useState([]);
  const [editorEdges, setEditorEdges] = useState([]);
  
  const containerRef = useRef(null);
  const mindmapCollection = collection(db, 'mindmaps');

  useEffect(() => {
    if (isEditorMode) return;
    const unsubscribe = onSnapshot(mindmapCollection, (snapshot) => {
      setMindmaps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [isEditorMode]);

  // 국문 주석: 에디터 켜질 때 독점적 데이터 공급 및 결크 방어막
  useEffect(() => {
    if (!isEditorMode || !selectedMapId) return;
    
    const unsubscribe = onSnapshot(doc(db, 'mindmaps', selectedMapId), (docSnap) => {
      if (docSnap.exists() && !dragState.isDragging) {
        const rawData = docSnap.data();
        setEditorNodes(rawData.nodes || [{ id: 'root', text: rawData.title || "중심 노드", x: 150, y: 300 }]);
        setEditorEdges(rawData.edges || []);
      }
    });
    return () => unsubscribe();
  }, [selectedMapId, isEditorMode, dragState.isDragging]);

  const handleCreateMap = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await addDoc(mindmapCollection, { title: newTitle, createdAt: new Date().toISOString(), nodes: [{ id: 'root', text: newTitle, x: 150, y: 300 }], edges: [] });
    setNewTitle('');
  };

  // 국문 주석: 자동 줄바꿈 및 크기 가변화에 따른 동적 중심축 앵커 계산 로직 개편
  const getAnchorPoints = (nodeId) => {
    const el = document.getElementById(`mm-node-${nodeId}`);
    const width = el ? el.offsetWidth : 160;
    const height = el ? el.offsetHeight : 40;
    
    const node = editorNodes.find(n => n.id === nodeId);
    const x = node ? node.x || 0 : 0;
    const y = node ? node.y || 0 : 0;

    return {
      top: { x: x + width / 2, y: y },
      bottom: { x: x + width / 2, y: y + height },
      left: { x: x, y: y + height / 2 },
      right: { x: x + width, y: y + height / 2 }
    };
  };

  const getBestAnchors = (srcNode, tgtNode) => {
    const srcAnchors = getAnchorPoints(srcNode.id);
    const tgtAnchors = getAnchorPoints(tgtNode.id);

    let minDistance = Infinity;
    let bestSrc = srcAnchors.right;
    let bestTgt = tgtAnchors.left;

    Object.keys(srcAnchors).forEach(sKey => {
      Object.keys(tgtAnchors).forEach(tKey => {
        const sP = srcAnchors[sKey];
        const tP = tgtAnchors[tKey];
        const dist = Math.pow(sP.x - tP.x, 2) + Math.pow(sP.y - tP.y, 2);
        if (dist < minDistance) {
          minDistance = dist;
          bestSrc = sP;
          bestTgt = tP;
        }
      });
    });

    return { sourcePt: bestSrc, targetPt: bestTgt };
  };

  const handleNodeMouseDown = (e, node) => {
    if (e.target.tagName === 'BUTTON') return; 
    e.stopPropagation();
    
    setDragState({
      isDragging: true,
      nodeId: node.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: node.x || 0,
      initialY: node.y || 0
    });
  };

  const handleContainerMouseMove = (e) => {
    if (!dragState.isDragging || !isEditorMode) return;
    
    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;

    setEditorNodes(prevNodes => 
      prevNodes.map(n => n.id === dragState.nodeId ? { ...n, x: dragState.initialX + deltaX, y: dragState.initialY + deltaY } : n)
    );
  };

  const handleNodeMouseUp = async () => {
    if (!dragState.isDragging) return;
    
    const currentNodesSnapshot = [...editorNodes];
    setDragState({ isDragging: false, nodeId: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });

    try {
      await updateDoc(doc(db, 'mindmaps', selectedMapId), { nodes: currentNodesSnapshot });
    } catch (err) { console.error("드래그 저장 실패 복구:", err); }
  };

  // 국문 주석: 모든 Write 연산을 한 곳으로 모아 데이터 휘발을 차단한 내부 비즈니스 함수군
  const internalAddNode = (parentId) => {
    openModal({
      mode: 'add',
      text: '',
      nodeId: parentId,
      onSubmit: async (text) => {
        const parentNode = editorNodes.find(n => n.id === parentId);
        const newId = `node_${Date.now()}`;
        const childCount = editorEdges.filter(edge => edge.source === parentId).length;
        const offsetMultiplier = childCount % 2 === 0 ? 1 : -1;

        const newNode = {
          id: newId,
          text: text,
          x: (parentNode?.x || 150) + 240,
          y: (parentNode?.y || 300) + (Math.ceil(childCount / 2) * 85 * offsetMultiplier)
        };
        const newEdge = { id: `e_${parentId}_${newId}`, source: parentId, target: newId };
        
        await updateDoc(doc(db, 'mindmaps', selectedMapId), {
          nodes: [...editorNodes, newNode],
          edges: [...editorEdges, newEdge]
        });
      }
    });
  };

  const internalEditNode = (nodeId, oldText) => {
    openModal({
      mode: 'edit',
      text: oldText,
      nodeId: nodeId,
      onSubmit: async (text) => {
        const updated = editorNodes.map(n => n.id === nodeId ? { ...n, text } : n);
        await updateDoc(doc(db, 'mindmaps', selectedMapId), { nodes: updated });
      }
    });
  };

  const internalDeleteNode = async (nodeId) => {
    if (nodeId === 'root') return alert('중심 블록 금지');
    if (!confirm('삭제?')) return;
    await updateDoc(doc(db, 'mindmaps', selectedMapId), { 
      nodes: editorNodes.filter(n => n.id !== nodeId), 
      edges: editorEdges.filter(e => e.source !== nodeId && e.target !== nodeId) 
    });
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
            <div key={map.id} onClick={() => onSelectMap(map)} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '8px 12px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ color: '#ffffff' }}>{map.title}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      onMouseMove={handleContainerMouseMove} 
      onMouseUp={handleNodeMouseUp} 
      onMouseLeave={handleNodeMouseUp}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'auto', background: '#111115' }}
    >
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '4000px', height: '4000px', pointerEvents: 'none', zIndex: 0 }}>
        {editorEdges?.map((edge) => {
          const sourceNode = editorNodes.find(n => n.id === edge.source);
          const targetNode = editorNodes.find(n => n.id === edge.target);
          if (!sourceNode || !targetNode) return null;

          const { sourcePt, targetPt } = getBestAnchors(sourceNode, targetNode);

          const cpX1 = sourcePt.x + (targetPt.x > sourcePt.x ? 60 : -60);
          const cpY1 = sourcePt.y;
          const cpX2 = targetPt.x + (targetPt.x > sourcePt.x ? -60 : 60);
          const cpY2 = targetPt.y;

          return (
            <path key={edge.id} d={`M ${sourcePt.x} ${sourcePt.y} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${targetPt.x} ${targetPt.y}`} stroke="#007aff" strokeWidth="2.5" fill="none" />
          );
        })}
      </svg>

      {editorNodes.map((node) => {
        const isSelected = dragState.nodeId === node.id;

        return (
          <div 
            key={node.id} 
            id={`mm-node-${node.id}`}
            onMouseDown={(e) => handleNodeMouseDown(e, node)}
            style={{ 
              position: 'absolute', 
              left: `${node.x || 0}px`, 
              top: `${node.y || 0}px`, 
              // 국문 주석: 내용 길이에 따라 유동적으로 상자가 늘어나는 자동 줄바꿈 픽셀 반응형 스타일 기틀 수립
              minWidth: '160px',
              maxWidth: '300px',
              width: 'auto',
              height: 'auto',
              zIndex: isSelected ? 100 : 10, 
              background: node.id === 'root' ? 'linear-gradient(135deg, rgba(0,122,255,0.95) 0%, rgba(0,64,128,1) 100%)' : 'linear-gradient(135deg, rgba(44,44,48,0.95) 0%, rgba(28,28,30,0.98) 100%)', 
              border: isSelected ? '1.5px solid #007aff' : node.id === 'root' ? '1.5px solid rgba(0,122,255,0.5)' : '1px solid rgba(255,255,255,0.18)', 
              boxShadow: isSelected ? '0 0 15px rgba(0, 122, 255, 0.8), 0 8px 24px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.5)',
              borderRadius: '14px', 
              padding: '12px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              gap: '8px',
              userSelect: 'none', 
              cursor: dragState.isDragging ? 'grabbing' : 'grab'
            }}
          >
            <span 
              onDoubleClick={() => internalEditNode(node.id, node.text)} 
              style={{ 
                fontSize: '0.8rem', 
                fontWeight: '600', 
                color: '#ffffff', 
                // 국문 주석: 한 줄 자름(Ellipsis) 속성을 제거하고 멀티라인 유연 단어 분산 배치 주입
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                flex: 1, 
                cursor: 'text' 
              }}
            >
              {node.text}
            </span>
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
              <button onClick={() => internalAddNode(node.id)} style={{ width: '18px', height: '18px', background: '#34c759', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}>+</button>
              {node.id !== 'root' && <button onClick={() => internalDeleteNode(node.id)} style={{ width: '18px', height: '18px', background: '#ff3b30', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}>-</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}