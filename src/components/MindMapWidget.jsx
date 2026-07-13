import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; 
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function MindMapWidget() {
  const [mindmaps, setMindmaps] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [currentMap, setCurrentMap] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [inputModal, setInputModal] = useState({ isOpen: false, nodeId: null, text: '', mode: 'add' });

  const mindmapCollection = collection(db, 'mindmaps');

  useEffect(() => {
    const unsubscribe = onSnapshot(mindmapCollection, (snapshot) => {
      const maps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMindmaps(maps);
      
      if (currentMap) {
        const found = maps.find(m => m.id === currentMap.id);
        if (found) setCurrentMap(found);
      }
    });
    return () => unsubscribe();
  }, [isOpen, currentMap?.id]);

  const handleCreateMap = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newMap = {
      title: newTitle,
      createdAt: new Date().toISOString(),
      nodes: [{ id: 'root', text: newTitle, x: 250, y: 150 }],
      edges: []
    };

    await addDoc(mindmapCollection, newMap);
    setNewTitle('');
  };

  const submitNodeData = async (e) => {
    if (e) e.preventDefault();
    if (!inputModal.text.trim() || !currentMap || !currentMap.id) return;

    try {
      const docRef = doc(db, 'mindmaps', currentMap.id);

      if (inputModal.mode === 'add') {
        const parentNode = currentMap.nodes.find(n => n.id === inputModal.nodeId);
        const newId = `node_${Date.now()}`;
        const newNode = {
          id: newId,
          text: inputModal.text,
          x: (parentNode?.x || 250) + 200,
          y: (parentNode?.y || 150) + (Math.random() * 80 - 40)
        };
        const newEdge = { id: `e_${inputModal.nodeId}_${newId}`, source: inputModal.nodeId, target: newId };

        const nextNodes = currentMap.nodes ? [...currentMap.nodes, newNode] : [newNode];
        const nextEdges = currentMap.edges ? [...currentMap.edges, newEdge] : [newEdge];

        await updateDoc(docRef, { nodes: nextNodes, edges: nextEdges });
      } else if (inputModal.mode === 'edit') {
        const updatedNodes = currentMap.nodes.map(node => 
          node.id === inputModal.nodeId ? { ...node, text: inputModal.text } : node
        );
        await updateDoc(docRef, { nodes: updatedNodes });
      }

      setInputModal({ isOpen: false, nodeId: null, text: '', mode: 'add' });
    } catch (error) {
      console.error("Firestore DB 반영 에러:", error);
    }
  };

  const handleDeleteNode = async (nodeId) => {
    if (nodeId === 'root') return alert('중심 블록은 삭제할 수 없습니다.');
    if (!confirm('이 블록을 삭제하시겠습니까?')) return;

    const updatedNodes = currentMap.nodes.filter(node => node.id !== nodeId);
    const updatedEdges = currentMap.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId);

    await updateDoc(doc(db, 'mindmaps', currentMap.id), {
      nodes: updatedNodes,
      edges: updatedEdges
    });
  };

  const handleDeleteMap = async (mapId, e) => {
    e.stopPropagation();
    if (confirm('마인드맵 전체를 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'mindmaps', mapId));
      setIsOpen(false);
      setCurrentMap(null);
    }
  };

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
            onClick={() => { setCurrentMap(map); setIsOpen(true); }}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '8px 12px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          >
            <span style={{ color: '#ffffff', fontWeight: '500' }}>{map.title}</span>
            <button onClick={(e) => handleDeleteMap(map.id, e)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
          </div>
        ))}
      </div>

      {/* 핵심 구현: 전체화면 모달 독립 구동 영역 */}
      {isOpen && currentMap && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 999999, backgroundColor: '#000000', padding: '40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '16px', marginBottom: '20px', flexShrink: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '600', color: '#007aff' }}>{currentMap.title} (마인드맵 편집기)</h2>
            <button onClick={() => setIsOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 16px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>전체창 닫기</button>
          </div>

          <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', position: 'relative', overflow: 'auto' }}>
            {currentMap.nodes?.map((node) => (
              <div 
                key={node.id}
                style={{ position: 'absolute', left: `${node.x}px`, top: `${node.y}px`, background: 'linear-gradient(135deg, rgba(40,40,44,0.9) 0%, rgba(28,28,30,0.95) 100%)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '12px', padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
              >
                <span 
                  onDoubleClick={() => setInputModal({ isOpen: true, nodeId: node.id, text: node.text, mode: 'edit' })}
                  style={{ fontSize: '0.85rem', fontWeight: '600', color: '#ffffff', cursor: 'pointer' }}
                >
                  {node.text}
                </span>
                
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button 
                    onClick={() => setInputModal({ isOpen: true, nodeId: node.id, text: '', mode: 'add' })} 
                    style={{ width: '18px', height: '18px', background: '#34c759', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    +
                  </button>
                  {node.id !== 'root' && (
                    <button 
                      onClick={() => handleDeleteNode(node.id)} 
                      style={{ width: '18px', height: '18px', background: '#ff3b30', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      -
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {inputModal.isOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999999, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <form onSubmit={submitNodeData} style={{ background: 'linear-gradient(135deg, rgba(44, 44, 48, 0.95) 0%, rgba(28, 28, 30, 0.98) 100%)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '24px', padding: '24px', width: '320px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', color: '#fff' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: '600', color: '#007aff' }}>
                  {inputModal.mode === 'add' ? '새 블록 내용 입력' : '블록 내용 수정'}
                </h4>
                <input 
                  type="text" 
                  value={inputModal.text} 
                  onChange={(e) => setInputModal({ ...inputModal, text: e.target.value })}
                  placeholder="텍스트를 입력하세요"
                  autoFocus
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px', fontSize: '0.85rem', color: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setInputModal({ isOpen: false, nodeId: null, text: '', mode: 'add' })} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>취소</button>
                  <button type="submit" style={{ background: '#007aff', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>확인</button>
                </div>
              </form>
            </div>
          )}

        </div>
      )}
    </div>
  );
}