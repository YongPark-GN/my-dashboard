import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase'; 
import { collection, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';

export default function MindMapWidget({ onSelectMap, isEditorMode, currentMap, onAddNodeClick, onEditNodeClick, onDeleteNodeClick }) {
  const [mindmaps, setMindmaps] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  
  // 드래그 제어 정밀 변수 매핑
  const [dragInfo, setDragInfo] = useState({ isDragging: false, nodeId: null, offsetX: 0, offsetY: 0 });
  const containerRef = useRef(null);
  const mindmapCollection = collection(db, 'mindmaps');

  useEffect(() => {
    if (isEditorMode) return;
    const unsubscribe = onSnapshot(mindmapCollection, (snapshot) => {
      setMindmaps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [isEditorMode]);

  const handleCreateMap = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await addDoc(mindmapCollection, { title: newTitle, createdAt: new Date().toISOString(), nodes: [{ id: 'root', text: newTitle, x: 150, y: 300 }], edges: [] });
    setNewTitle('');
  };

  // 한글 주석: 문제점 1 해결 - 컨테이너 바운더리 기준 픽셀 역산 드래그 스타트 함수
  const handleNodeMouseDown = (e, node) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // 스크롤 및 브라우저 오프셋 보정 연산 적용
    const mouseX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const mouseY = e.clientY - rect.top + containerRef.current.scrollTop;

    setDragInfo({
      isDragging: true,
      nodeId: node.id,
      offsetX: mouseX - (node.x || 0),
      offsetY: mouseY - (node.y || 0)
    });
  };

  const handleContainerMouseMove = (e) => {
    if (!dragInfo.isDragging || !isEditorMode || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const mouseY = e.clientY - rect.top + containerRef.current.scrollTop;

    const updatedNodes = currentMap.nodes.map(n => {
      if (n.id === dragInfo.nodeId) {
        return { ...n, x: mouseX - dragInfo.offsetX, y: mouseY - dragInfo.offsetY };
      }
      return n;
    });
    
    currentMap.nodes = updatedNodes;
  };

  const handleNodeMouseUp = async () => {
    if (!dragInfo.isDragging) return;
    try {
      const docRef = doc(db, 'mindmaps', currentMap.id);
      await updateDoc(docRef, { nodes: currentMap.nodes });
    } catch (err) { console.error(err); }
    setDragInfo({ isDragging: false, nodeId: null, offsetX: 0, offsetY: 0 });
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
      {/* 한글 주석: 문제점 2 해결 - 정렬 분산 연산이 주입된 SVG 라인 */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '4000px', height: '4000px', pointerEvents: 'none', zIndex: 0 }}>
        {currentMap.edges?.map((edge) => {
          const sourceNode = currentMap.nodes?.find(n => n.id === edge.source);
          const targetNode = currentMap.nodes?.find(n => n.id === edge.target);
          if (!sourceNode || !targetNode) return null;

          const sX = (sourceNode.x || 0) + 160;
          const sY = (sourceNode.y || 0) + 20;
          const tX = targetNode.x || 0;
          const tY = targetNode.y || 0 + 20;

          return (
            <path key={edge.id} d={`M ${sX} ${sY} C ${sX + 80} ${sY}, ${tX - 80} ${tY}, ${tX} ${tY}`} stroke="#007aff" strokeWidth="2.5" fill="none" />
          );
        })}
      </svg>

      {currentMap.nodes?.map((node) => (
        <div 
          key={node.id}
          onMouseDown={(e) => handleNodeMouseDown(e, node)}
          style={{ position: 'absolute', left: `${node.x || 0}px`, top: `${node.y || 0}px`, width: '160px', zIndex: 10, background: node.id === 'root' ? 'linear-gradient(135deg, rgba(0,122,255,0.95) 0%, rgba(0,64,128,1) 100%)' : 'linear-gradient(135deg, rgba(44,44,48,0.95) 0%, rgba(28,28,30,0.98) 100%)', border: node.id === 'root' ? '1.5px solid #007aff' : '1px solid rgba(255,255,255,0.18)', borderRadius: '14px', padding: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none', cursor: 'grab' }}
        >
          <span onDoubleClick={() => onEditNodeClick(node.id, node.text)} style={{ fontSize: '0.8rem', fontWeight: '600', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '4px' }}>
            {node.text}
          </span>
          <div style={{ display: 'flex', gap: '3px' }}>
            <button onClick={(e) => { e.stopPropagation(); onAddNodeClick(node.id); }} style={{ width: '18px', height: '18px', background: '#34c759', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}>+</button>
            {node.id !== 'root' && <button onClick={(e) => { e.stopPropagation(); onDeleteNodeClick(node.id); }} style={{ width: '18px', height: '18px', background: '#ff3b30', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}>-</button>}
          </div>
        </div>
      ))}
    </div>
  );
}