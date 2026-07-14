import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom'; // 핵심 로직: 모달 창 렌더링 컨텍스트 분리 및 오버플로우 회피용 리액트 코어 유틸
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
    await addDoc(collection(db, 'users', userId, 'mindmaps'), { 
      title: newTitle, createdAt: new Date().toISOString(), 
      nodes: [{ id: 'root', text: newTitle, x: 1920, y: 1980 }], edges: [] 
    });
    setNewTitle('');
  };

  const handleDeleteMap = (mapId) => {
    if (!userId) return;
    setConfirmDialog({
      isOpen: true,
      message: "이 마인드맵을 정말로 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.",
      onConfirm: async () => {
        try { await deleteDoc(doc(db, 'users', userId, 'mindmaps', mapId)); } catch (err) {}
      }
    });
  };

  const getAnchorPoints = (nodeId) => {
    const el = document.getElementById(`mm-node-${nodeId}`);
    const width = el ? el.offsetWidth : 160;
    const height = el ? el.offsetHeight : 40;
    const node = editorNodes.find(n => n.id === nodeId);
    const x = node ? node.x || 0 : 0;
    const y = node ? node.y || 0 : 0;
    return { top: { x: x + width / 2, y: y }, bottom: { x: x + width / 2, y: y + height }, left: { x: x, y: y + height / 2 }, right: { x: x + width, y: y + height / 2 } };
  };

  const getBestAnchors = (srcNode, tgtNode) => {
    const srcAnchors = getAnchorPoints(srcNode.id);
    const tgtAnchors = getAnchorPoints(tgtNode.id);
    let minDistance = Infinity; let bestSrc = srcAnchors.right; let bestTgt = tgtAnchors.left;
    Object.keys(srcAnchors).forEach(sKey => {
      Object.keys(tgtAnchors).forEach(tKey => {
        const dist = Math.pow(srcAnchors[sKey].x - tgtAnchors[tKey].x, 2) + Math.pow(srcAnchors[sKey].y - tgtAnchors[tKey].y, 2);
        if (dist < minDistance) { minDistance = dist; bestSrc = srcAnchors[sKey]; bestTgt = tgtAnchors[tKey]; }
      });
    });
    return { sourcePt: bestSrc, targetPt: bestTgt };
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
    try { await updateDoc(doc(db, 'users', userId, 'mindmaps', selectedMapId), { nodes: currentNodesSnapshot }); } catch (err) {}
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
        await updateDoc(doc(db, 'users', userId, 'mindmaps', selectedMapId), { nodes: updatedNodes, edges: updatedEdges });
      }
    });
  };

  // 핵심 로직: 포탈을 이용해 body 계층으로 모달을 분리 추출
  const renderConfirmDialog = () => {
    if (!confirmDialog.isOpen) return null;
    return createPortal(
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999999, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px', width: '320px', color: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', textAlign: 'center' }}>
          <p style={{ margin: '0 0 24px 0', fontSize: '1rem', color: '#ffffff', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{confirmDialog.message}</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null })} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600' }}>취소</button>
            <button onClick={() => { if(confirmDialog.onConfirm) confirmDialog.onConfirm(); setConfirmDialog({ isOpen: false, message: '', onConfirm: null }); }} style={{ flex: 1, background: '#ff3b30', border: 'none', color: '#fff', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '700' }}>확인</button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  if (!isEditorMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
        <form onSubmit={handleCreateMap} style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="새 마인드맵 제목" style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '10px 14px', fontSize: '0.9rem', color: '#fff', outline: 'none' }} />
          <button type="submit" style={{ background: '#007aff', color: '#fff', border: 'none', borderRadius: '12px', padding: '0 20px', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer' }}>생성</button>
        </form>
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mindmaps.map((map) => (
            <div key={map.id} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px 20px', fontSize: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span onClick={() => onSelectMap(map)} style={{ color: '#ffffff', flex: 1, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500' }}>{map.title}</span>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteMap(map.id); }} style={{ background: 'rgba(255,59,48,0.15)', border: 'none', color: '#ff3b30', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', padding: '8px 14px', borderRadius: '10px', marginLeft: '16px', transition: 'background 0.2s' }}>삭제</button>
            </div>
          ))}
        </div>
        {renderConfirmDialog()}
      </div>
    );
  }

  return (
    <div ref={containerRef} onMouseMove={handleInteractionMove} onTouchMove={handleInteractionMove} onMouseUp={handleInteractionEnd} onTouchEnd={handleInteractionEnd} onMouseLeave={handleInteractionEnd} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'auto', background: '#111115' }}>
      
      <div style={{ position: 'fixed', bottom: '40px', right: '40px', zIndex: 10000, background: 'linear-gradient(135deg, rgba(30,30,35,0.85) 0%, rgba(15,15,18,0.9) 100%)', backdropFilter: 'blur(20px)', padding: '12px 20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#007aff', letterSpacing: '0.5px' }}>ZOOM</span>
        <input type="range" min="0.1" max="2.0" step="0.05" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} style={{ width: '220px', height: '4px', cursor: 'pointer', accentColor: '#007aff' }} />
      </div>

      <div style={{ transform: `scale(${zoom})`, transformOrigin: '2000px 2000px', width: '4000px', height: '4000px', position: 'relative' }}>
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '4000px', height: '4000px', pointerEvents: 'none', zIndex: 0 }}>
          {editorEdges?.map((edge) => {
            const sourceNode = editorNodes.find(n => n.id === edge.source); const targetNode = editorNodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;
            const { sourcePt, targetPt } = getBestAnchors(sourceNode, targetNode);
            const midX = (sourcePt.x + targetPt.x) / 2;
            const orthogonalPath = `M ${sourcePt.x} ${sourcePt.y} L ${midX} ${sourcePt.y} L ${midX} ${targetPt.y} L ${targetPt.x} ${targetPt.y}`;
            return <path key={edge.id} d={orthogonalPath} stroke="rgba(0,122,255,0.7)" strokeWidth="3" fill="none" strokeLinejoin="round" />;
          })}
        </svg>

        {editorNodes.map((node) => {
          const isSelected = dragState.nodeId === node.id;
          return (
            <div key={node.id} id={`mm-node-${node.id}`} onMouseDown={(e) => handleInteractionStart(e, node)} onTouchStart={(e) => handleInteractionStart(e, node)} style={{ position: 'absolute', left: `${node.x || 0}px`, top: `${node.y || 0}px`, minWidth: '180px', maxWidth: '320px', zIndex: isSelected ? 100 : 10, background: node.id === 'root' ? 'linear-gradient(135deg, rgba(0,122,255,0.95) 0%, rgba(0,64,128,1) 100%)' : 'linear-gradient(135deg, rgba(44,44,48,0.95) 0%, rgba(28,28,30,0.98) 100%)', border: isSelected ? '1.5px solid #007aff' : node.id === 'root' ? '1.5px solid rgba(0,122,255,0.5)' : '1px solid rgba(255,255,255,0.18)', boxShadow: isSelected ? '0 0 20px rgba(0, 122, 255, 0.6), 0 10px 30px rgba(0,0,0,0.6)' : '0 10px 24px rgba(0,0,0,0.4)', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', userSelect: 'none', cursor: dragState.isDragging ? 'grabbing' : 'grab' }}>
              <span onDoubleClick={() => internalEditNode(node.id, node.text)} style={{ fontSize: '0.9rem', fontWeight: '600', color: '#ffffff', whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1, cursor: 'text', lineHeight: '1.4' }}>{node.text}</span>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                <button onClick={() => internalAddNode(node.id)} onTouchEnd={(e) => { e.stopPropagation(); internalAddNode(node.id); }} style={{ width: '24px', height: '24px', background: 'rgba(52, 199, 89, 0.2)', border: '1px solid rgba(52, 199, 89, 0.5)', borderRadius: '6px', color: '#34c759', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                {node.id !== 'root' && <button onClick={() => internalDeleteNode(node.id)} onTouchEnd={(e) => { e.stopPropagation(); internalDeleteNode(node.id); }} style={{ width: '24px', height: '24px', background: 'rgba(255, 59, 48, 0.2)', border: '1px solid rgba(255, 59, 48, 0.5)', borderRadius: '6px', color: '#ff3b30', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>}
              </div>
            </div>
          );
        })}
      </div>
      {renderConfirmDialog()}
    </div>
  );
}