import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase'; 
import { collection, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';

export default function MindMapWidget({ onSelectMap, isEditorMode, currentMap, onAddNodeClick, onEditNodeClick, onDeleteNodeClick }) {
  const [mindmaps, setMindmaps] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  
  // 국문 주석: 드래그 상태 머신 및 로컬 실시간 좌표 캐시 상태
  const [dragState, setDragState] = useState({ isDragging: false, nodeId: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const [localPositions, setLocalPositions] = useState({});
  
  const containerRef = useRef(null);
  const mindmapCollection = collection(db, 'mindmaps');

  useEffect(() => {
    if (isEditorMode) return;
    const unsubscribe = onSnapshot(mindmapCollection, (snapshot) => {
      setMindmaps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [isEditorMode]);

  // 국문 주석: 데이터 휘발 완전 차단 - 외부 Firestore 갱신 데이터 유입 시 로컬 좌표 캐시 싱크 동기화
  useEffect(() => {
    if (isEditorMode && currentMap?.nodes) {
      const posMap = {};
      currentMap.nodes.forEach(n => {
        posMap[n.id] = { x: n.x || 150, y: n.y || 300 };
      });
      setLocalPositions(posMap);
    }
  }, [currentMap?.nodes, isEditorMode]);

  const handleCreateMap = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await addDoc(mindmapCollection, { title: newTitle, createdAt: new Date().toISOString(), nodes: [{ id: 'root', text: newTitle, x: 150, y: 300 }], edges: [] });
    setNewTitle('');
  };

  // 국문 주석: 블록 내부 상하좌우 4대 고정점(Anchor Points) 좌표 산출 함수
  const getAnchorPoints = (x, y, width = 160, height = 40) => {
    return {
      top: { x: x + width / 2, y: y },
      bottom: { x: x + width / 2, y: y + height },
      left: { x: x, y: y + height / 2 },
      right: { x: x + width / 2, y: y + height / 2 } // 박스 가로축 연결 안정성을 위해 정비
    };
  };

  // 국문 주석: 두 블록 간 최단 거리에 있는 최적의 상하좌우 앵커 조합 연산 알고리즘
  const getBestAnchors = (srcNode, tgtNode) => {
    const srcX = localPositions[srcNode.id]?.x || srcNode.x || 0;
    const srcY = localPositions[srcNode.id]?.y || srcNode.y || 0;
    const tgtX = localPositions[tgtNode.id]?.x || tgtNode.x || 0;
    const tgtY = localPositions[tgtNode.id]?.y || tgtNode.y || 0;

    const srcAnchors = getAnchorPoints(srcX, srcY);
    const tgtAnchors = getAnchorPoints(tgtX, tgtY);

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

  // 국문 주석: 드래그 마우스 다운 핸들러
  const handleNodeMouseDown = (e, node) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    
    const nodeX = localPositions[node.id]?.x || node.x || 0;
    const nodeY = localPositions[node.id]?.y || node.y || 0;

    setDragState({
      isDragging: true,
      nodeId: node.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: nodeX,
      initialY: nodeY
    });
  };

  const handleContainerMouseMove = (e) => {
    if (!dragState.isDragging || !isEditorMode) return;
    
    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;

    setLocalPositions(prev => ({
      ...prev,
      [dragState.nodeId]: {
        x: dragState.initialX + deltaX,
        y: dragState.initialY + deltaY
      }
    }));
  };

  // 국문 주석: 마우스를 뗐을 때 무한 루프 차단 및 Firestore 데이터베이스 일괄 동기화 마감
  const handleNodeMouseUp = async () => {
    if (!dragState.isDragging) return;
    
    const targetId = dragState.nodeId;
    const finalPos = localPositions[targetId];
    
    setDragState({ isDragging: false, nodeId: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });

    try {
      const updatedNodes = currentMap.nodes.map(n => {
        if (n.id === targetId && finalPos) {
          return { ...n, x: finalPos.x, y: finalPos.y };
        }
        return n;
      });

      await updateDoc(doc(db, 'mindmaps', currentMap.id), { nodes: updatedNodes });
    } catch (err) { 
      console.error("데이터 저장 실패 복구:", err); 
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
      {/* 국문 주석: 고정점 최단 거리 조합 추적형 곡선 SVG 레이어 */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '4000px', height: '4000px', pointerEvents: 'none', zIndex: 0 }}>
        {currentMap.edges?.map((edge) => {
          const sourceNode = currentMap.nodes?.find(n => n.id === edge.source);
          const targetNode = currentMap.nodes?.find(n => n.id === edge.target);
          if (!sourceNode || !targetNode) return null;

          const { sourcePt, targetPt } = getBestAnchors(sourceNode, targetNode);

          // 이동 각도에 맞는 텐션 곡선 강도 보정 연산
          const cpX1 = sourcePt.x + (targetPt.x > sourcePt.x ? 40 : -40);
          const cpY1 = sourcePt.y;
          const cpX2 = targetPt.x + (targetPt.x > sourcePt.x ? -40 : 40);
          const cpY2 = targetPt.y;

          return (
            <path key={edge.id} d={`M ${sourcePt.x} ${sourcePt.y} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${targetPt.x} ${targetPt.y}`} stroke="#007aff" strokeWidth="2.5" fill="none" />
          );
        })}
      </svg>

      {currentMap.nodes?.map((node) => {
        const pos = localPositions[node.id] || { x: node.x || 150, y: node.y || 300 };
        const isSelected = dragState.nodeId === node.id;

        return (
          <div 
            key={node.id} 
            onMouseDown={(e) => handleNodeMouseDown(e, node)}
            style={{ 
              position: 'absolute', 
              left: `${pos.x}px`, 
              top: `${pos.y}px`, 
              width: '160px', 
              zIndex: isSelected ? 100 : 10, 
              background: node.id === 'root' ? 'linear-gradient(135deg, rgba(0,122,255,0.95) 0%, rgba(0,64,128,1) 100%)' : 'linear-gradient(135deg, rgba(44,44,48,0.95) 0%, rgba(28,28,30,0.98) 100%)', 
              // 국문 주석: 선택 피드백 반영 - 누르고 있을 때 푸른색 네온 글로우 테두리 스타일 실시간 투하
              border: isSelected ? '1.5px solid #007aff' : node.id === 'root' ? '1.5px solid rgba(0,122,255,0.5)' : '1px solid rgba(255,255,255,0.18)', 
              boxShadow: isSelected ? '0 0 15px rgba(0, 122, 255, 0.8), 0 8px 24px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.5)',
              borderRadius: '14px', 
              padding: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              userSelect: 'none', 
              cursor: dragState.isDragging ? 'grabbing' : 'grab',
              transition: isSelected ? 'none' : 'box-shadow 0.15s ease, border-color 0.15s ease'
            }}
          >
            <span onDoubleClick={() => onEditNodeClick(node.id, node.text)} style={{ fontSize: '0.8rem', fontWeight: '600', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '4px', cursor: 'text' }}>{node.text}</span>
            <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
              <button onClick={(e) => { e.stopPropagation(); onAddNodeClick(node.id); }} style={{ width: '18px', height: '18px', background: '#34c759', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}>+</button>
              {node.id !== 'root' && <button onClick={(e) => { e.stopPropagation(); onDeleteNodeClick(node.id); }} style={{ width: '18px', height: '18px', background: '#ff3b30', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}>-</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}