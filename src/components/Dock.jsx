// components/Dock.jsx
import React, { useState } from 'react';
import { Layers2, Grid2x2, Lock, LockOpen, Maximize2, Sun, Moon, Power, RotateCcw } from 'lucide-react';
import PagePopup from './PagePopup';
import ConfirmDialog from './ConfirmDialog';

// 위젯 라이브러리 목록. 위젯을 추가하면 여기와 useWidgetLayout 의 DEFAULT_ORDER/DEFAULT_SIZES 를 함께 갱신한다.
const WIDGET_GROUPS = [
  {
    label: '기본',
    items: { clock: '시계', weather: '날씨', air: '대기질', sunmoon: '해와 달', quote: '잠언', search: '검색' }
  },
  {
    label: '일정 · 기록',
    items: { calendar: '캘린더', todo: '할 일', dday: 'D-Day', memo: '메모', mindmap: '마인드맵', habit: '습관' }
  },
  {
    label: '업무',
    items: { pomodoro: '포모도로', worldclock: '세계 시계', bookmark: '바로가기', snippet: '스니펫', currency: '환율' }
  },
  {
    label: '생활',
    items: { budget: '가계부', shopping: '장보기', music: '유튜브 뮤직', gallery: '사진', system: '시스템' }
  }
];

// 독 버튼 하나. 라벨 없이 아이콘만 — 뜻은 툴팁으로 전한다.
function DockItem({ icon: Icon, label, active, danger, onClick }) {
  return (
    <button
      className={`ios-dock-item ${active ? 'active' : ''} ${danger ? 'danger' : ''}`}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active ? true : undefined}
    >
      <Icon size={19} strokeWidth={1.25} />
    </button>
  );
}

export default function Dock({ layout, onLogout, toggleTheme, isDarkMode }) {
  // 독 팝업은 한 번에 하나만 (null | 'widgets' | 'pages')
  const [openPanel, setOpenPanel] = useState(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const showLibrary = openPanel === 'widgets';
  const togglePanel = (panel) => setOpenPanel(prev => (prev === panel ? null : panel));

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <>
      {openPanel === 'pages' && <PagePopup layout={layout} />}

      {showLibrary && (
        <div className="ios-dock-popup">
          <div style={{ maxHeight: '46vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {WIDGET_GROUPS.map(group => (
              <div key={group.label}>
                <div style={{ fontSize: '0.68rem', color: 'var(--txt-faint)', fontWeight: '600', marginBottom: '7px', paddingLeft: '2px' }}>
                  {group.label}
                </div>
                <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                  {Object.entries(group.items).map(([id, name]) => {
                    const on = layout.visibleWidgets.includes(id);
                    return (
                      <div key={id} onClick={() => layout.toggleWidgetVisibility(id)}
                           style={{
                             padding: '7px 14px', borderRadius: '12px', cursor: 'pointer',
                             background: on ? 'var(--accent)' : 'var(--chip-bg)',
                             color: on ? '#fff' : 'var(--txt-dim)',
                             fontSize: '0.8rem', fontWeight: on ? '600' : '500', transition: '0.15s',
                             border: `1px solid ${on ? 'transparent' : 'var(--field-border)'}`
                           }}>
                        {name}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => setConfirmingReset(true)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--txt-faint)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', padding: '4px', borderTop: '1px solid var(--divider)', paddingTop: '12px' }}>
            <RotateCcw size={12} strokeWidth={1.6} /> 이 페이지 배치 초기화
          </button>
        </div>
      )}

      <div className="ios-dock-container">
        <DockItem icon={Layers2} label={`페이지 — ${layout.activePage?.name || ''}`} active={openPanel === 'pages'} onClick={() => togglePanel('pages')} />
        <DockItem icon={Grid2x2} label="위젯 라이브러리" active={showLibrary} onClick={() => togglePanel('widgets')} />
        <DockItem icon={layout.isLocked ? Lock : LockOpen} label={layout.isLocked ? '배치 잠금 해제' : '배치 잠그기'} active={layout.isLocked} onClick={() => layout.setIsLocked(!layout.isLocked)} />
        <DockItem icon={Maximize2} label="전체화면" onClick={toggleFullScreen} />
        <DockItem icon={isDarkMode ? Sun : Moon} label={isDarkMode ? '라이트 모드' : '다크 모드'} onClick={toggleTheme} />

        <div className="ios-dock-divider" />

        <DockItem icon={Power} label="로그아웃" danger onClick={onLogout} />
      </div>

      <ConfirmDialog
        isOpen={confirmingReset}
        message={'현재 페이지의 위젯 배치와 크기를\n기본값으로 되돌릴까요?'}
        confirmLabel="초기화"
        onConfirm={() => { layout.resetLayout(); setConfirmingReset(false); }}
        onCancel={() => setConfirmingReset(false)}
      />
    </>
  );
}
