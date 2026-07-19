// components/MemoWidget.jsx
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom'; 
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const hideScrollbarStyle = `
  .hide-scrollbar::-webkit-scrollbar { display: none; }
  .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = hideScrollbarStyle;
  document.head.appendChild(style);
}

const COLORS = [
  'rgba(255, 255, 255, 0.05)', 'rgba(255, 235, 59, 0.15)', 
  'rgba(76, 175, 80, 0.15)', 'rgba(33, 150, 243, 0.15)', 'rgba(244, 67, 54, 0.15)'
];
const PICKER_COLORS = ['#8e8e93', '#ffcc00', '#34c759', '#007aff', '#ff3b30'];

const DEFAULT_MEMO = {
  id: 'default', title: '새 메모', color: COLORS[1],
  text: '마크다운을 몰라도 버튼을 눌러 쉽게 작성하세요!\n\n- [ ] 체크리스트 1\n- [ ] 체크리스트 2',
};

export default function MemoWidget({ userId }) {
  const [memos, setMemos] = useState([DEFAULT_MEMO]);
  const [activeTabId, setActiveTabId] = useState('default');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const tabsRef = useRef(null);

  useEffect(() => {
    if (!db || !userId) return;
    const memoRef = doc(db, "users", userId, "dashboard", "memoWidget");
    const unsubscribe = onSnapshot(memoRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.memos && data.memos.length > 0) {
          setMemos(data.memos);
          if (!data.memos.find(m => m.id === activeTabId)) setActiveTabId(data.memos[0].id);
        }
      }
    });
    return () => unsubscribe();
  }, [userId, activeTabId]);

  const saveToFirebase = async (updatedMemos) => {
    if (!userId) return;
    try {
      await setDoc(doc(db, "users", userId, "dashboard", "memoWidget"), { memos: updatedMemos, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {}
  };

  const activeMemo = memos.find(m => m.id === activeTabId) || memos[0];

  const updateActiveMemo = (updates) => {
    const updatedMemos = memos.map(m => m.id === activeTabId ? { ...m, ...updates } : m);
    setMemos(updatedMemos);
  };

  const addNewTab = () => {
    const newMemo = { id: Date.now().toString(), title: '새 메모', text: '', color: COLORS[0] };
    const updatedMemos = [...memos, newMemo];
    setMemos(updatedMemos);
    setActiveTabId(newMemo.id);
    setIsModalOpen(true);
    saveToFirebase(updatedMemos);
  };

  const deleteTab = (e, id) => {
    e.stopPropagation();
    if (memos.length === 1) return;
    const updatedMemos = memos.filter(m => m.id !== id);
    setMemos(updatedMemos);
    saveToFirebase(updatedMemos);
  };

  const insertMarkdown = (prefix, suffix = '') => {
    const textarea = document.getElementById('memo-modal-textarea');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = activeMemo.text || '';
    
    const before = currentText.substring(0, start);
    const selected = currentText.substring(start, end) || '텍스트';
    const after = currentText.substring(end);
    
    updateActiveMemo({ text: before + prefix + selected + suffix + after });
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    saveToFirebase(memos);
  };

  useEffect(() => {
    const tabsElement = tabsRef.current;
    if (!tabsElement) return;

    const handleWheelHorizontal = (e) => {
      e.preventDefault(); 
      tabsElement.scrollLeft += e.deltaY;
    };

    tabsElement.addEventListener('wheel', handleWheelHorizontal, { passive: false });
    return () => {
      tabsElement.removeEventListener('wheel', handleWheelHorizontal);
    };
  }, []);

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      // 💡 핵심: 터치 환경을 위해 바탕을 클릭(탭)하면 메뉴가 켜지거나 꺼지도록 토글 기능 추가
      onClick={(e) => {
        // 버튼이나 입력창 등을 터치했을 때는 메뉴가 사라지지 않도록 방어
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea')) return;
        setIsHovered(!isHovered);
      }}
      style={{ 
        position: 'relative', 
        overflow: 'hidden',   
        display: 'flex', flexDirection: 'column', width: '100%', height: '100%', 
        backgroundColor: activeMemo.color, transition: 'background-color 0.3s ease', 
        borderRadius: '24px', margin: '-24px', padding: '24px', boxSizing: 'content-box',
        cursor: 'pointer' // 탭할 수 있다는 시각적 피드백 제공
      }}
    >
      
      {/* 1. 상단 플로팅 컨트롤 */}
      <div style={{ 
        position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 10,
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px',
        opacity: isHovered ? 1 : 0, pointerEvents: isHovered ? 'auto' : 'none', transition: 'opacity 0.3s ease'
      }}>
        <button onClick={addNewTab} 
                style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', padding: '4px 14px', borderRadius: '12px', transition: '0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          +
        </button>
        <button onClick={() => setIsModalOpen(true)} 
                style={{ background: 'rgba(0,122,255,0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '8px 16px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          Edit
        </button>
      </div>

      {/* 2. 중앙 위젯 뷰어 영역 */}
      <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', textAlign: 'left', wordBreak: 'break-word', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.4rem', fontWeight: '800', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '12px' }}>
          {activeMemo.title}
        </h3>
        <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'rgba(255,255,255,0.95)' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {(activeMemo.text || '*내용이 없습니다.*').replace(/\n/g, '  \n')}
          </ReactMarkdown>
        </div>
      </div>

      {/* 3. 하단 플로팅 탭 네비게이션 */}
      <div className="hide-scrollbar" ref={tabsRef}
           // 하단 탭을 스크롤할 때도 메뉴가 사라지는 것 방지
           onClick={(e) => e.stopPropagation()}
           style={{ 
             position: 'absolute', bottom: '16px', left: '16px', right: '16px', zIndex: 10,
             display: 'flex', gap: '10px', overflowX: 'auto', padding: '10px',
             background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', borderRadius: '20px', 
             opacity: isHovered ? 1 : 0, pointerEvents: isHovered ? 'auto' : 'none', transition: 'opacity 0.3s ease', boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
           }}>
        {memos.map(memo => (
          <div key={memo.id} onClick={() => setActiveTabId(memo.id)}
               style={{
                 padding: '6px 16px', borderRadius: '12px', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: activeTabId === memo.id ? 'bold' : 'normal',
                 backgroundColor: activeTabId === memo.id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                 border: `1px solid ${activeTabId === memo.id ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.1)'}`,
                 display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', color: '#fff'
               }}>
            {memo.title}
            {memos.length > 1 && <span onClick={(e) => deleteTab(e, memo.id)} style={{ color: '#ff6b6b', fontSize: '1.2rem', lineHeight: '1', display: 'inline-block', transform: 'translateY(-1px)' }}>×</span>}
          </div>
        ))}
      </div>

      {/* 4. 팝업 에디터 영역 (포털 적용 - 변경 없음) */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)', zIndex: 9999999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', boxSizing: 'border-box'
        }}>
          <div style={{
            width: '100%', maxWidth: '800px', height: '80vh', backgroundColor: activeMemo.color || '#1c1c1e',
            borderRadius: '32px', padding: '32px', display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <input 
                type="text" value={activeMemo.title} onChange={(e) => updateActiveMemo({ title: e.target.value })}
                placeholder="메모 제목을 입력하세요"
                style={{ background: 'transparent', border: 'none', borderBottom: '2px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: '1.5rem', fontWeight: 'bold', outline: 'none', flex: 1, marginRight: '24px', paddingBottom: '8px' }}
              />
              <button onClick={handleCloseModal} style={{ background: '#007aff', border: 'none', color: '#fff', padding: '12px 24px', borderRadius: '16px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>
                저장 및 닫기
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => insertMarkdown('- [ ] ')} style={helperBtnStyle}>☑️ 할일</button>
                <button type="button" onClick={() => insertMarkdown('**', '**')} style={helperBtnStyle}>𝗕 굵게</button>
                <button type="button" onClick={() => insertMarkdown('\n---\n')} style={helperBtnStyle}>➖ 줄긋기</button>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                {COLORS.map((color, index) => (
                  <div key={color} onClick={() => updateActiveMemo({ color })}
                       style={{ 
                         width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer', transition: '0.2s',
                         backgroundColor: PICKER_COLORS[index],
                         border: activeMemo.color === color ? '3px solid #fff' : '2px solid transparent',
                         boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                       }} />
                ))}
              </div>
            </div>

            <textarea
              id="memo-modal-textarea"
              value={activeMemo.text || ''}
              onChange={(e) => updateActiveMemo({ text: e.target.value })}
              placeholder="자유롭게 아이디어를 작성하세요 (마크다운 지원)"
              style={{ flex: 1, width: '100%', background: 'rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '20px', color: '#fff', fontSize: '1.1rem', outline: 'none', resize: 'none', lineHeight: '1.8' }}
            />
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

const helperBtnStyle = {
  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
  padding: '6px 12px', borderRadius: '10px', fontSize: '0.9rem', cursor: 'pointer'
};