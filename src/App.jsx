import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; // 핵심 로직: Firestore 데이터베이스 인스턴스 바인딩
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function MindMapWidget() {
  const [mindmaps, setMindmaps] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [currentMap, setCurrentMap] = useState(null);
  const [newTitle, setNewTitle] = useState('');

  const mindmapCollection = collection(db, 'mindmaps');

  // 한글 주석: 데이터베이스에 등록된 마인드맵 리스트를 실시간 동기화하여 목록 갱신
  useEffect(() => {
    const unsubscribe = onSnapshot(mindmapCollection, (snapshot) => {
      const maps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMindmaps(maps);
      
      if (currentMap) {
        const updated = maps.find(m => m.id === currentMap.id);
        if (updated) setCurrentMap(updated);
      }
    });
    return () => unsubscribe();
  }, [currentMap?.id]);

  // 새로운 마인드맵 문서 생성
  const handleCreateMap = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newMap = {
      title: newTitle,
      createdAt: new Date().toISOString(),
      nodes: [
        { id: 'root', text: newTitle, x: 250, y: 150 }
      ],
      edges: []
    };

    await addDoc(mindmapCollection, newMap);
    setNewTitle('');
  };

  // 한글 주석: 손그림 스케치 구조대로 [+] 버튼 클릭 시 새로운 자식 노드를 확장하여 배치
  const handleAddNode = async (parentNode) => {
    const newId = `node_${Date.now()}`;
    const newNode = {
      id: newId,
      text: '새 서브 블록',
      x: parentNode.x + 180,
      y: parentNode.y + (Math.random() * 80 - 40)
    };
    
    const newEdge = {
      id: `e_${parentNode.id}_${newId}`,
      source: parentNode.id,
      target: newId
    };

    await updateDoc(doc(db, 'mindmaps', currentMap.id), {
      nodes: [...currentMap.nodes, newNode],
      edges: [...currentMap.edges, newEdge]
    });
  };

  // 블록 내용 더블클릭 수정
  const handleUpdateNodeText = async (nodeId, currentText) => {
    const promptText = prompt('블록 내용을 입력하세요:', currentText);
    if (promptText === null) return;

    const updatedNodes = currentMap.nodes.map(node => 
      node.id === nodeId ? { ...node, text: promptText } : node
    );

    await updateDoc(doc(db, 'mindmaps', currentMap.id), { nodes: updatedNodes });
  };

  // 서브 노드 삭제
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

  // 전체 마인드맵 삭제
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
      {/* 위젯 헤더 타이틀 */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '10px', flexShrink: 0 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#ff2d55' }}>CREATIVE</div>
        <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#ffffff', marginTop: '2px' }}>🧠 마인드맵 위젯</div>
      </div>
      
      {/* 등록 및 목록 인라인 폼 컨트롤 */}
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

      {/* 위젯 내부의 마인드맵 목록 영역 */}
      <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {mindmaps.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', padding: '15px 0', margin: 'auto' }}>생성된 마인드맵이 없습니다.</div>
        ) : (
          mindmaps.map((map) => (
            <div 
              key={map.id}
              onClick={() => { setCurrentMap(map); setIsOpen(true); }}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '8px 12px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <span style={{ color: '#ffffff', fontWeight: '500' }}>{map.title}</span>
              <button onClick={(e) => handleDeleteMap(map.id, e)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
            </div>
          ))
        )}
      </div>

      {/* 핵심 수정 로직: fixed 위치 조정을 통해 대시보드 위젯 상위 DOM 카드를 뚫고 나와 화면 전체를 장악하도록 조치 */}
      {isOpen && currentMap && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', padding: '40px', boxSizing: 'border-box' }}>
          
          {/* 팝업 에디터 상단부 컨트롤 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '16px', marginBottom: '20px', flexShrink: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '600', color: '#007aff' }}>{currentMap.title} (마인드맵 편집기)</h2>
            <button onClick={() => setIsOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 16px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>전체창 닫기</button>
          </div>

          {/* 마인드맵 캔버스 영역 구현부 */}
          <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', position: 'relative', overflow: 'auto' }}>
            
            {/* 데이터 모델 노드 매핑 */}
            {currentMap.nodes?.map((node) => (
              <div 
                key={node.id}
                style={{ position: 'absolute', left: `${node.x}px`, top: `${node.y}px`, background: 'linear-gradient(135deg, rgba(40,40,44,0.85) 0%, rgba(28,28,30,0.9) 100%)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '12px', padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '8px', whitespace: 'nowrap' }}
              >
                <span 
                  onDoubleClick={() => handleUpdateNodeText(node.id, node.text)}
                  style={{ fontSize: '0.85rem', fontWeight: '600', color: '#ffffff', cursor: 'pointer' }}
                >
                  {node.text}
                </span>
                
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button 
                    onClick={() => handleAddNode(node)} 
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

            <div style={{ position: 'absolute', bottom: '20px', left: '20px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
              💡 각 노드를 [더블클릭] 시 텍스트 수정이 가능합니다.
            </div>
          </div>

        </div>
      )}
    </div>
  );
}