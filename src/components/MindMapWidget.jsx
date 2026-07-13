import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase'; 
import { collection, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';

export default function MindMapWidget({ onSelectMap, isEditorMode, currentMap, onAddNodeClick, onEditNodeClick, onDeleteNodeClick }) {
  const [mindmaps, setMindmaps] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  
  // 국문 주석: 드래그 상태 머신 (불안정한 localPositions 상태를 폐기하고 단일 출처 관리)
  const [dragState, setDragState] = useState({ isDragging: false, nodeId: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const [editorNodes, setEditorNodes] = useState([]);
  
  const containerRef = useRef(null);
  const mindmapCollection = collection(db, 'mindmaps');

  useEffect(() => {
    if (isEditorMode) return;
    const unsubscribe = onSnapshot(mindmapCollection, (snapshot) => {
      setMindmaps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [isEditorMode]);

  // 국문 주석: 3중 검토 반영 - 파이어베이스 원격 스냅샷 데이터를 로컬 상태와 안전하게 동기화 (휘발 방지 핵심)
  useEffect(() => {
    if (isEditorMode && currentMap?.nodes) {
      if (!dragState.isDragging) {
        setEditorNodes(currentMap.nodes);
      }
    }
  }, [currentMap?.nodes, isEditorMode, dragState.isDragging]);

  const handleCreateMap = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await addDoc(mindmapCollection, { title: newTitle, createdAt: new Date().toISOString(), nodes: [{ id: 'root', text: newTitle, x: 150, y: 300 }], edges: [] });
    setNewTitle('');
  };

  // 국문 주석: 상하좌우 4대 고정점 좌표 계산
  const getAnchorPoints = (x, y, width = 160, height = 40) => {
    return {
      top: { x: x + width / 2, y: y },
      bottom: { x: x + width / 2, y: y + height },
      left: { x: x, y: y + height / 2 },
      right: { x: x + width, y: y + height / 2 }
    };
  };

  // 국문 주석: 모자 블록 간 최단 거리 고정점 매핑 알고리즘
  const getBestAnchors = (srcNode, tgtNode) => {
    const sNode = editorNodes.find(n => n.id === srcNode.id) || srcNode;
    const tNode = editorNodes.find(n => n.id === tgtNode.id) || tgtNode;

    const srcAnchors = getAnchorPoints(sNode.x || 0, sNode.y || 0);
    const tgtAnchors = getAnchorPoints(tNode.x || 0, tNode.y || 0);

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
    e.stopPropagation();
    if (!containerRef.current) return;

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

  // 국문 주석: 마우스를 뗐을 때 최종 결정된 상태 배열을 딱 1회 파이어베이스에 동기화 저장
  const handleNodeMouseUp = async () => {
    if (!dragState.isDragging) return;
    
    const targetId = dragState.nodeId;
    setDragState({ isDragging: false, nodeId: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });

    try {
      const docRef = doc(db, 'mindmaps', currentMap.id);
      await updateDoc(docRef, { nodes: editorNodes });
    } catch (err) { 
      console.error("원격 DB 동기화 오류 복구:", err); 
    }
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
        {currentMap.edges?.map((edge) => {
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
            onMouseDown={(e) => handleNodeMouseDown(e, node)}
            style={{ 
              position: 'absolute', 
              left: `${node.x || 0}px`, 
              top: `${node.y || 0}px`, 
              width: '160px', 
              zIndex: isSelected ? 100 : 10, 
              background: node.id === 'root' ? 'linear-gradient(135deg, rgba(0,122,255,0.95) 0%, rgba(0,64,128,1) 100%)' : 'linear-gradient(135deg, rgba(44,44,48,0.95) 0%, rgba(28,28,30,0.98) 100%)', 
              border: isSelected ? '1.5px solid #007aff' : node.id === 'root' ? '1.5px solid rgba(0,122,255,0.5)' : '1px solid rgba(255,255,255,0.18)', 
              boxShadow: isSelected ? '0 0 15px rgba(0, 122, 255, 0.8), 0 8px 24px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.5)',
              borderRadius: '14px', 
              padding: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              userSelect: 'none', 
              cursor: dragState.isDragging ? 'grabbing' : 'grab'
            }}
          >
            <span onDoubleClick={() => onEditNodeClick(node.id, node.text)} style={{ fontSize: '0.8rem', fontWeight: '600', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '4px', cursor: 'text' }}>{node.text}</span>
            <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
              {/* 국문 주석: 핵심 해결 1 - 버튼 영역 클릭 시 onMouseDown 버블링을 완벽하게 끊어내 드래그 간섭 완전 차단 */}
              <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onAddNodeClick(node.id); }} style={{ width: '18px', height: '18px', background: '#34c759', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}>+</button>
              {node.id !== 'root' && <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDeleteNodeClick(node.id); }} style={{ width: '18px', height: '18px', background: '#ff3b30', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}>-</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}