// components/Dock.jsx
import React, { useState } from 'react';
// 💡 핵심 로직: 세련된 벡터 아이콘들을 lucide-react에서 불러옵니다.
import { LayoutGrid, Lock, Unlock, RotateCcw, Maximize, Sun, Moon, LogOut } from 'lucide-react';

export default function Dock({ layout, onLogout, toggleTheme, isDarkMode }) {
  const [showLibrary, setShowLibrary] = useState(false);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen();
    }
  };

  const widgetNames = {
    clock: '시계', weather: '날씨', workflow: '워크플로우',
    calendar: '달력', scheduler: '스케줄러', memo: '메모', mindmap: '마인드맵'
  };

  return (
    <>
      {showLibrary && (
        <div style={{
          position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(30, 30, 35, 0.9)', backdropFilter: 'blur(20px)',
          padding: '16px', borderRadius: '24px', display: 'flex', gap: '12px', zIndex: 999,
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          {Object.keys(widgetNames).map(id => (
            <div key={id} 
                 onClick={() => layout.toggleWidgetVisibility(id)}
                 style={{
                   padding: '8px 16px', borderRadius: '12px', cursor: 'pointer',
                   background: layout.visibleWidgets.includes(id) ? '#007aff' : 'rgba(255,255,255,0.1)',
                   color: '#fff', fontSize: '0.85rem', fontWeight: 'bold', transition: '0.2s'
                 }}>
              {widgetNames[id]}
            </div>
          ))}
        </div>
      )}

      <div className="ios-dock-container">
        {/* 💡 핵심 로직: 각 버튼에 얇고 모던한 두께(strokeWidth={1.5})의 SVG 아이콘 적용 */}
        <button className={`ios-dock-item ${showLibrary ? 'active' : ''}`} onClick={() => setShowLibrary(!showLibrary)} title="위젯 라이브러리">
          <LayoutGrid size={22} strokeWidth={1.5} />
          <span>위젯</span>
        </button>
        
        <button className={`ios-dock-item ${layout.isLocked ? 'active' : ''}`} onClick={() => layout.setIsLocked(!layout.isLocked)} title="레이아웃 잠금">
          {layout.isLocked ? <Lock size={22} strokeWidth={1.5} /> : <Unlock size={22} strokeWidth={1.5} />}
          <span>잠금</span>
        </button>
        
        <button className="ios-dock-item" onClick={layout.resetLayout} title="배치 초기화">
          <RotateCcw size={22} strokeWidth={1.5} />
          <span>초기화</span>
        </button>
        
        <button className="ios-dock-item" onClick={toggleFullScreen} title="전체화면">
          <Maximize size={22} strokeWidth={1.5} />
          <span>화면</span>
        </button>
        
        <button className="ios-dock-item" onClick={toggleTheme} title="테마 변경">
          {isDarkMode ? <Sun size={22} strokeWidth={1.5} /> : <Moon size={22} strokeWidth={1.5} />}
          <span>테마</span>
        </button>
        
        <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 8px' }} />
        
        <button className="ios-dock-item" onClick={onLogout} style={{ color: '#ff3b30' }} title="로그아웃">
          <LogOut size={22} strokeWidth={1.5} color="#ff3b30" />
          <span style={{ color: '#ff3b30' }}>종료</span>
        </button>
      </div>
    </>
  );
}