// components/Dock.jsx
import React, { useState } from 'react';
import { LayoutGrid, Lock, Unlock, RotateCcw, Maximize, Sun, Moon, LogOut } from 'lucide-react';

const WIDGET_NAMES = {
  clock: '시계', weather: '날씨', quote: '잠언',
  calendar: '캘린더', memo: '메모', mindmap: '마인드맵'
};

export default function Dock({ layout, onLogout, toggleTheme, isDarkMode }) {
  const [showLibrary, setShowLibrary] = useState(false);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <>
      {showLibrary && (
        <div style={{
          position: 'fixed', bottom: '104px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          padding: '16px', borderRadius: '24px', zIndex: 999,
          border: '1px solid var(--glass-border)', boxShadow: '0 16px 40px var(--glass-shadow), inset 0 1px 1px var(--glass-highlight)',
          display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '90vw'
        }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {Object.keys(WIDGET_NAMES).map(id => (
              <div key={id}
                   onClick={() => layout.toggleWidgetVisibility(id)}
                   style={{
                     padding: '9px 18px', borderRadius: '14px', cursor: 'pointer',
                     background: layout.visibleWidgets.includes(id) ? 'var(--accent)' : 'var(--chip-strong)',
                     color: layout.visibleWidgets.includes(id) ? '#fff' : 'var(--txt)', fontSize: '0.85rem', fontWeight: '600', transition: '0.2s',
                     border: '1px solid var(--glass-border)'
                   }}>
                {WIDGET_NAMES[id]}
              </div>
            ))}
          </div>
          <button onClick={() => { if (confirmReset()) layout.resetLayout(); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--txt-dim)', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', padding: '4px' }}>
            <RotateCcw size={13} strokeWidth={1.8} /> 배치 초기화
          </button>
        </div>
      )}

      <div className="ios-dock-container">
        <button className={`ios-dock-item ${showLibrary ? 'active' : ''}`} onClick={() => setShowLibrary(!showLibrary)} title="위젯 라이브러리">
          <LayoutGrid size={22} strokeWidth={1.5} />
          <span>위젯</span>
        </button>

        <button className={`ios-dock-item ${layout.isLocked ? 'active' : ''}`} onClick={() => layout.setIsLocked(!layout.isLocked)} title="레이아웃 잠금">
          {layout.isLocked ? <Lock size={22} strokeWidth={1.5} /> : <Unlock size={22} strokeWidth={1.5} />}
          <span>잠금</span>
        </button>

        <button className="ios-dock-item" onClick={toggleFullScreen} title="전체화면">
          <Maximize size={22} strokeWidth={1.5} />
          <span>화면</span>
        </button>

        <button className="ios-dock-item" onClick={toggleTheme} title="테마 변경">
          {isDarkMode ? <Sun size={22} strokeWidth={1.5} /> : <Moon size={22} strokeWidth={1.5} />}
          <span>테마</span>
        </button>

        <div style={{ width: '1px', alignSelf: 'stretch', background: 'var(--divider)', margin: '6px 4px' }} />

        <button className="ios-dock-item" onClick={onLogout} title="로그아웃">
          <LogOut size={22} strokeWidth={1.5} color="#ff453a" />
          <span style={{ color: '#ff453a' }}>종료</span>
        </button>
      </div>
    </>
  );
}

function confirmReset() {
  return window.confirm('위젯 배치와 크기를 기본값으로 되돌릴까요?');
}
