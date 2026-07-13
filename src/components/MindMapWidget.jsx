import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase'; 
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function MindMapWidget({ onSelectMap, isEditorMode, currentMap, onAddNodeClick, onEditNodeClick, onDeleteNodeClick }) {
  const [mindmaps, setMindmaps] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  
  // 드래그 상태 관리
  const [dragState, setDragState] = useState({ isDragging: false, nodeId: null, startX: 0, startY: 0, initialNodeX: 0, initialNodeY: 0 });
  const containerRef = useRef(null);

  const mindmapCollection = collection(db, 'mindmaps');

  useEffect(() => {
    if (isEditorMode) return;
    const unsubscribe = onSnapshot(mindmapCollection, (snapshot) => {
      const maps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMindmaps(maps);
    });
    return () => unsubscribe();
  }, [isEditorMode]);

  // 한글 주석: 자식 노드 간격 분산 자동 정렬 알고리즘
  const calculateAutoLayout = (nodes = [], edges = []) => {
    if (nodes.length === 0) return [];
    
    const nodeMap = new Map(nodes.map(n => [n.id, { ...n, children: [] }]));
    let rootNode = null;

    edges.forEach(edge => {
      const parent = nodeMap.get(edge.source);
      const child = nodeMap.get(edge.target);
      if (parent && child) parent.children.push(child);
    });

    nodes.forEach(n => {
      if (n.id === 'root') rootNode = nodeMap.get(n.id);
    });

    if (!rootNode) rootNode = nodeMap.get(nodes[0].id);

    const startX = 150;
    const startY = 300;
    
    rootNode.x = startX;
    rootNode.y = startY;

    const levelWidth = 240; 
    const nodeHeight = 70;  

    const assignPositions = (node, currentX, depth) => {
      if (!node.children || node.children.length === 0) return;

      const totalHeight = node.children.length * nodeHeight;
      let currentY = node.y - (totalHeight / 2) + (nodeHeight / 2);

      node.children.forEach(child => {
        child.x = currentX + levelWidth;
        child.y = currentY;
        currentY += nodeHeight;
        assignPositions(child, child.x, depth + 1);
      });
    };

    assignPositions(rootNode, startX, 1);
    return Array.from(nodeMap.values());
  };

  const autoLayoutNodes = (isEditorMode && currentMap) ? calculateAutoLayout(currentMap.nodes, currentMap.edges) : [];

  const handleCreateMap = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newMap = {
      title: newTitle,
      createdAt: new Date().toISOString(),
      nodes: [{ id: 'root', text: newTitle, x: 150, y: 300 }],
      edges: []
    };

    await addDoc(mindmapCollection, newMap);
    setNewTitle('');
  };

  const handleDeleteMap = async (mapId, e) => {
    e.stopPropagation();
    if (confirm('마인드맵 전체를 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'mindmaps', mapId));
    }
  };

  // 드래그 제어 핸들러
  const handleNodeMouseDown = (e, node) => {
    e.stopPropagation();
    const targetNode = autoLayoutNodes.find(n => n.id === node.id) || node;
    setDragState({
      isDragging: true,
      nodeId: node.id,
      startX: e.clientX,
      startY: e.clientY,
      initialNodeX: targetNode.x,
      initialNodeY: targetNode.y
    });
  };

  const handleContainerMouseMove = (e) => {
    if (!dragState.isDragging || !isEditorMode) return;
    
    const deltaX = e.clientX - startPos.x;
    const deltaY = e.clientY - startPos.y;

    const updatedNodes = currentMap.nodes.map(n => {
      if (n.id === dragState.nodeId) {
        return { ...n, x: dragState.initialNodeX + deltaX, y: dragState.initialNodeY + deltaY };
      }
      return n;
    });

    currentMap.nodes = updatedNodes;
  };

  const handleNodeMouseUp = async () => {
    if (!dragState.isDragging) return;
    const docRef = doc(db, 'mindmaps', currentMap.id);
    await updateDoc(docRef, { nodes: currentMap.nodes });
    setDragState({ isDragging: false, nodeId: null, startX: 0, startY: 0, initialNodeX: 0, initialNodeY: 0 });
  };

  if (!isEditorMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '10px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#ff2d55' }}>CREATIVE</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#ffffff', marginTop: '2px' }}>🧠 마인드맵 위젯</div>
        </div>
        
        <form onSubmit={handleCreateMap} style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexShrink: 0 }}>
          <input 
            type="text" 
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="새 마인드맵 제목"
            style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '4px 8px', fontSize: '0.75rem', color: '#fff', outline: 'none' }}
          />
          <button type="submit" style={{ background: '#007aff', color: '#fff', border: 'none', borderRadius: '8px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}>생성</button>
        </form>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {mindmaps.map((map) => (
            <div 
              key={map.id}
              onClick={() => onSelectMap(map)}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '8px 12px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <span style={{ color: '#ffffff', fontWeight: '500' }}>{map.title}</span>
              <button onClick={(e) => handleDeleteMap(map.id, e)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
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
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'auto', cursor: dragState.isDragging ? 'grabbing' : 'default' }}
    >
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '2000px', height: '2000px', pointerEvents: 'none', zIndex: 0 }}>
        {currentMap.edges?.map((edge) => {
          const sourceNode = autoLayoutNodes.find(n => n.id === edge.source);
          const targetNode = autoLayoutNodes.find(n => n.id === edge.target);
          if (!sourceNode || !targetNode) return null;

          const sX = sourceNode.x + 120;
          const sY = sourceNode.y + 20;
          const tX = targetNode.x;
          const tY = targetNode.y + 20;
          const cpX1 = sX + 60;
          const cpY1 = sY;
          const cpX2 = tX - 60;
          const cpY2 = tY;

          return (
            <path 
              key={edge.id} 
              d={`M ${sX} ${sY} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${tX} ${tY}`} 
              stroke="rgba(0, 122, 255, 0.5)" 
              strokeWidth="2" 
              fill="none" 
            />
          );
        })}
      </svg>

      {autoLayoutNodes.map((node) => (
        <div 
          key={node.id}
          onMouseDown={(e) => handleNodeMouseDown(e, node)}
          style={{ position: 'absolute', left: `${node.x}px`, top: `${node.y}px`, width: '160px', zIndex: 10, background: node.id === 'root' ? 'linear-gradient(135deg, rgba(0,122,255,0.85) 0%, rgba(0,64,128,0.9) 100%)' : 'linear-gradient(135deg, rgba(44,44,48,0.95) 0%, rgba(28,28,30,0.98) 100%)', border: node.id === 'root' ? '1px solid #007aff' : '1px solid rgba(255,255,255,0.15)', borderRadius: '14px', padding: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transform: dragState.nodeId === node.id ? 'scale(1.03)' : 'scale(1)', transition: dragState.nodeId === node.id ? 'none' : 'transform 0.1s ease', userSelect: 'none' }}
        >
          <span 
            onDoubleClick={() => onEditNodeClick(node.id, node.text)}
            style={{ fontSize: '0.8rem', fontWeight: '600', color: '#ffffff', cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '4px' }}
          >
            {node.text}
          </span>
          
          <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
            <button 
              onClick={(e) => { e.stopPropagation(); onAddNodeClick(node.id); }} 
              style={{ width: '18px', height: '18px', background: '#34c759', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              +
            </button>
            {node.id !== 'root' && (
              <button 
                // 핵심 수정: 부모로부터 상속받은 프로퍼티명인 onDeleteNodeClick으로 매핑을 정확히 일치시켜 에러 폭파
                onClick={(e) => { e.stopPropagation(); onDeleteNodeClick(node.id); }} 
                style={{ width: '18px', height: '18px', background: '#ff3b30', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                -
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}