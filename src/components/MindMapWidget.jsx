import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; // 핵심 로직: 이전 턴에서 셋업한 Firestore 인스턴스 바인딩
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function MindMapWidget() {
  const [mindmaps, setMindmaps] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [currentMap, setCurrentMap] = useState(null);
  const [newTitle, setNewTitle] = useState('');

  const mindmapCollection = collection(db, 'mindmaps');

  // 한글 주석: 데이터베이스에 등록된 마인드맵 목록을 실시간 리스닝하여 동기화
  useEffect(() => {
    const unsubscribe = onSnapshot(mindmapCollection, (snapshot) => {
      const maps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMindmaps(maps);
      
      // 팝업이 열려있는 경우 갱신된 실시간 데이터를 현재 맵에 재매핑
      if (currentMap) {
        const updated = maps.find(m => m.id === currentMap.id);
        if (updated) setCurrentMap(updated);
      }
    });
    return () => unsubscribe();
  }, [currentMap?.id]);

  // 한글 주석: 새로운 마인드맵 목록을 추가하고 최초 중심 블록을 함께 생성하는 로직
  const handleCreateMap = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newMap = {
      title: newTitle,
      createdAt: new Date().toISOString(),
      nodes: [
        { id: 'root', text: newTitle, x: 350, y: 200 } // 스케치 디자인 기반: 최초 중심 블록 좌표 설정
      ],
      edges: []
    };

    await addDoc(mindmapCollection, newMap);
    setNewTitle('');
  };

  // 한글 주석: 손그림 아이디어의 [+] 버튼 클릭 시 새로운 서브 블록(자식 노드)을 생성 및 연결하는 로직
  const handleAddNode = async (parentNode) => {
    const newId = `node_${Date.now()}`;
    // 부모 블록 위치 기준으로 간격을 두고 우측 또는 아래쪽에 배치 생성
    const newNode = {
      id: newId,
      text: '새 블록',
      x: parentNode.x + 180,
      y: parentNode.y + (Math.random() * 100 - 50)
    };
    
    const newEdge = {
      id: `e_${parentNode.id}_${newId}`,
      source: parentNode.id,
      target: newId
    };

    const updatedNodes = [...currentMap.nodes, newNode];
    const updatedEdges = [...currentMap.edges, newEdge];

    await updateDoc(doc(db, 'mindmaps', currentMap.id), {
      nodes: updatedNodes,
      edges: updatedEdges
    });
  };

  // 한글 주석: 특정 블록의 내용을 사용자가 수정하거나 더블클릭할 때 업데이트하는 로직
  const handleUpdateNodeText = async (nodeId, currentText) => {
    const promptText = prompt('블록 내용을 입력하세요:', currentText);
    if (promptText === null) return;

    const updatedNodes = currentMap.nodes.map(node => 
      node.id === nodeId ? { ...node, text: promptText } : node
    );

    await updateDoc(doc(db, 'mindmaps', currentMap.id), { nodes: updatedNodes });
  };

  // 한글 주석: 선택한 서브 블록 및 연결선을 마인드맵에서 안전하게 삭제하는 로직
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

  // 마인드맵 전체 삭제
  const handleDeleteMap = async (mapId, e) => {
    e.stopPropagation();
    if (confirm('마인드맵 전체를 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'mindmaps', mapId));
      setIsOpen(false);
      setCurrentMap(null);
    }
  };

  return (
    <div className="p-4 bg-slate-800 rounded-xl text-white max-w-md shadow-lg">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">🧠 마인드맵 위젯</h3>
      
      {/* 마인드맵 추가 폼 */}
      <form onSubmit={handleCreateMap} className="flex gap-2 mb-4">
        <input 
          type="text" 
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="새 마인드맵 제목 입력"
          className="flex-1 px-3 py-1.5 bg-slate-700 rounded-lg text-sm border border-slate-600 focus:outline-none focus:border-indigo-500"
        />
        <button type="submit" className="px-3 py-1.5 bg-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-500">생성</button>
      </form>

      {/* 스케치 반영 - 위젯 상태: 등록된 제목 격자 배열 뷰 */}
      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
        {mindmaps.map((map) => (
          <div 
            key={map.id}
            onClick={() => { setCurrentMap(map); setIsOpen(true); }}
            className="p-3 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition flex justify-between items-center text-sm font-medium"
          >
            <span className="truncate">{map.title}</span>
            <button onClick={(e) => handleDeleteMap(map.id, e)} className="text-slate-400 hover:text-red-400 text-xs">✕</button>
          </div>
        ))}
      </div>

      {/* 스케치 반영 - 제목 클릭 시 전체창으로 팝업 (모달 인터페이스) */}
      {isOpen && currentMap && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full h-full bg-slate-900 rounded-2xl p-6 flex flex-col">
            
            {/* 상단 바 */}
            <div className="flex justify-between items-center border-b border-slate-700 pb-4 mb-4">
              <h2 className="text-xl font-bold text-indigo-400">{currentMap.title} (편집기)</h2>
              <button onClick={() => setIsOpen(false)} className="px-4 py-1.5 bg-slate-700 rounded-lg text-sm hover:bg-slate-600">전체창 닫기</button>
            </div>

            {/* 마인드맵 시각화 캔버스 (HTML 절대 좌표 매핑) */}
            <div className="flex-1 bg-slate-950 rounded-xl relative overflow-auto border border-slate-800">
              
              {/* 노드(블록) 렌더링 */}
              {currentMap.nodes?.map((node) => (
                <div 
                  key={node.id}
                  style={{ left: `${node.x}px`, top: `${node.y}px` }}
                  className="absolute p-3 bg-slate-800 border-2 border-indigo-500 rounded-lg shadow-xl flex items-center gap-2 whitespace-nowrap group select-none"
                >
                  <span 
                    onDoubleClick={() => handleUpdateNodeText(node.id, node.text)}
                    className="cursor-pointer text-sm font-semibold"
                    title="더블클릭하여 내용 수정"
                  >
                    {node.text}
                  </span>
                  
                  {/* 기능 작동 버튼 컨트롤 셋 */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <button 
                      onClick={() => handleAddNode(node)} 
                      className="w-5 h-5 bg-green-600 rounded flex items-center justify-center text-xs font-bold hover:bg-green-500"
                      title="새로운 블록 생성 및 연결"
                    >
                      +
                    </button>
                    {node.id !== 'root' && (
                      <button 
                        onClick={() => handleDeleteNode(node.id)} 
                        className="w-5 h-5 bg-red-600 rounded flex items-center justify-center text-xs hover:bg-red-500"
                        title="블록 삭제"
                      >
                        -
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* 임시 안내 레이블 */}
              <div className="absolute bottom-4 left-4 text-xs text-slate-500 pointer-events-none">
                💡 각 블록을 [더블클릭]하여 수정할 수 있으며, [+] 버튼으로 서브 단계를 생성합니다.
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}