// components/DashboardContent.jsx
import { useState, useEffect } from 'react';

import ClockWidget from './ClockWidget';
import WeatherWidget from './WeatherWidget';
import QuoteWidget from './QuoteWidget';
import CalendarWidget from './CalendarWidget';
import MindMapWidget from './MindMapWidget';
import MemoWidget from './MemoWidget';
import TodoWidget from './TodoWidget';
import PomodoroWidget from './PomodoroWidget';
import WorldClockWidget from './WorldClockWidget';
import DdayWidget from './DdayWidget';
import BookmarkWidget from './BookmarkWidget';
import SnippetWidget from './SnippetWidget';
import CurrencyWidget from './CurrencyWidget';
import HabitWidget from './HabitWidget';
import BudgetWidget from './BudgetWidget';
import AirQualityWidget from './AirQualityWidget';
import ChecklistWidget from './ChecklistWidget';
import SunMoonWidget from './SunMoonWidget';
import MusicWidget from './MusicWidget';
import GalleryWidget from './GalleryWidget';
import SearchWidget from './SearchWidget';
import SystemWidget from './SystemWidget';
import Dock from './Dock';
import { Toaster } from './Toast';

import { iosLiquidGlassWidget } from '../styles/theme';
import { useWidgetLayout } from '../hooks/useWidgetLayout';
import { useGoogleCalendarAuth } from '../hooks/useGoogleCalendarAuth';

export default function DashboardContent({ userId, onLogout }) {
  const layout = useWidgetLayout(userId);
  const auth = useGoogleCalendarAuth(userId, onLogout);

  const [isMindMapOpen, setIsMindMapOpen] = useState(false);
  const [selectedMapId, setSelectedMapId] = useState(null);
  const [inputModal, setInputModal] = useState({ isOpen: false, nodeId: null, text: '', mode: 'add', onSubmit: null });
  const [isDarkMode, setIsDarkMode] = useState(true);

  // 테마 토큰을 문서 루트에 적용 (포털 모달·독까지 전역 반영)
  useEffect(() => {
    document.documentElement.dataset.theme = isDarkMode ? 'dark' : 'light';
  }, [isDarkMode]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!inputModal.text.trim()) return;
    if (inputModal.onSubmit) inputModal.onSubmit(inputModal.text);
    setInputModal({ isOpen: false, nodeId: null, text: '', mode: 'add', onSubmit: null });
  };

  const renderWidgetContent = (id) => {
    switch (id) {
      case 'clock': return <ClockWidget />;
      case 'weather': return <WeatherWidget />;
      case 'quote': return <QuoteWidget />;
      case 'calendar': return <CalendarWidget isLoggedIn={auth.isLoggedIn} login={auth.login} accessToken={auth.accessToken} />;
      case 'memo': return <MemoWidget userId={userId} />;
      case 'mindmap': return <MindMapWidget userId={userId} onSelectMap={(map) => { setSelectedMapId(map.id); setIsMindMapOpen(true); }} />;
      case 'todo': return <TodoWidget userId={userId} />;
      case 'pomodoro': return <PomodoroWidget />;
      case 'worldclock': return <WorldClockWidget userId={userId} />;
      case 'dday': return <DdayWidget userId={userId} />;
      case 'bookmark': return <BookmarkWidget userId={userId} />;
      case 'snippet': return <SnippetWidget userId={userId} />;
      case 'currency': return <CurrencyWidget />;
      case 'habit': return <HabitWidget userId={userId} />;
      case 'budget': return <BudgetWidget userId={userId} />;
      case 'air': return <AirQualityWidget />;
      case 'shopping': return <ChecklistWidget userId={userId} docId="shoppingWidget" title="장보기" placeholder="살 것 추가" />;
      case 'sunmoon': return <SunMoonWidget />;
      case 'music': return <MusicWidget userId={userId} />;
      case 'gallery': return <GalleryWidget userId={userId} />;
      case 'search': return <SearchWidget />;
      case 'system': return <SystemWidget />;
      default: return null;
    }
  };

  // 유리가 굴절할 배경 오로라 (다크/라이트)
  const bgBase = isDarkMode
    ? 'linear-gradient(160deg, #0a0a12 0%, #0f0d1a 50%, #0a0e18 100%)'
    : 'linear-gradient(160deg, #eef1f8 0%, #f3eefa 50%, #eaf1f6 100%)';
  const blobs = isDarkMode
    ? ['#1e3a8a', '#6d28d9', '#0e7490']
    : ['#a5b4fc', '#c4b5fd', '#99f6e4'];

  const compact = layout.compactMode;

  return (
    <div className={compact ? 'lg-root compact' : 'lg-root'} style={{
      minHeight: '100vh',
      background: bgBase,
      padding: compact ? '16px 16px 120px' : '32px', boxSizing: 'border-box', width: '100vw',
      position: 'absolute', top: 0, left: 0,
      transition: 'background 0.5s ease', overflowX: 'hidden'
    }}>
      <Toaster />

      {/* 배경 오로라 블롭 */}
      <div className="lg-blob" style={{ width: '460px', height: '460px', top: '-120px', left: '-80px', background: blobs[0] }} />
      <div className="lg-blob" style={{ width: '520px', height: '520px', bottom: '-160px', right: '-100px', background: blobs[1] }} />
      <div className="lg-blob" style={{ width: '380px', height: '380px', top: '40%', left: '45%', background: blobs[2], opacity: 0.4 }} />

      {/* 💡 위젯 그리드 (배경 위 레이어). 컴팩트 모드는 full-width 위젯이라 자연히 1열로 쌓인다. */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', gap: compact ? '14px' : '28px', width: '100%', paddingBottom: compact ? '0' : '120px', justifyContent: compact ? 'center' : 'flex-start' }}>
        {layout.widgetOrder
          .filter(id => layout.visibleWidgets.includes(id))
          .map((id) => {
            const responsiveSize = layout.getResponsiveSize(id);

            return (
              <div key={id} className="lg-widget"
                   draggable={!layout.resizeTarget && !layout.isLocked}
                   onDragStart={() => layout.handleDragStart(id)}
                   onDragOver={layout.handleDragOver}
                   onDrop={() => layout.handleDrop(id)}
                   onDragEnd={layout.handleDragEnd}
                   style={{
                     ...iosLiquidGlassWidget,
                     padding: compact ? '18px' : iosLiquidGlassWidget.padding,
                     borderRadius: compact ? '22px' : iosLiquidGlassWidget.borderRadius,
                     width: `${responsiveSize.width}px`,
                     maxWidth: '100%',
                     height: `${responsiveSize.height}px`,
                     opacity: layout.draggingId === id ? 0.4 : 1,
                     cursor: layout.isLocked ? 'default' : 'grab',
                     // 잠금 상태(터치 기본)에서는 세로 스크롤을 브라우저에 확실히 넘겨준다
                     touchAction: layout.isLocked ? 'pan-y' : 'none'
                   }}>
                {renderWidgetContent(id)}

                {!layout.isLocked && (
                  <div className="ios-resize-trigger" onMouseDown={(e) => layout.initResize(e, id)} onTouchStart={(e) => layout.initResize(e, id)} />
                )}
              </div>
            );
          })}
      </div>

      <Dock
        layout={layout}
        onLogout={auth.handleFullLogout}
        toggleTheme={() => setIsDarkMode(!isDarkMode)}
        isDarkMode={isDarkMode}
        compact={compact}
      />

      {isMindMapOpen && selectedMapId && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 999999, background: bgBase, padding: compact ? '16px' : '40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          <button onClick={() => { setIsMindMapOpen(false); setSelectedMapId(null); }} style={{ alignSelf: 'flex-start', background: 'var(--chip-strong)', border: '1px solid var(--glass-border)', color: 'var(--txt)', padding: '10px 24px', borderRadius: '12px', cursor: 'pointer', marginBottom: '24px', fontWeight: '600' }}>← 종료 및 닫기</button>
          <div style={{ flex: 1, background: 'var(--editor-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', overflow: 'hidden' }}>
            <MindMapWidget userId={userId} isEditorMode={true} selectedMapId={selectedMapId} openModal={(config) => setInputModal({ isOpen: true, ...config })} />
          </div>
        </div>
      )}

      {inputModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999999, backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleFormSubmit} style={{ background: 'var(--editor-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '32px', width: '360px', color: 'var(--txt)', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
            <h4 style={{ margin: '0 0 20px 0' }}>{inputModal.mode === 'add' ? '새 블록 내용 입력' : '블록 내용 수정'}</h4>
            <textarea value={inputModal.text} onChange={(e) => setInputModal({ ...inputModal, text: e.target.value })} autoFocus style={{ width: '100%', height: '100px', marginBottom: '24px', background: 'var(--field-bg)', border: '1px solid var(--field-border)', borderRadius: '12px', padding: '12px', color: 'var(--txt)', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => setInputModal({ isOpen: false, nodeId: null, text: '', mode: 'add', onSubmit: null })} style={{ flex: 1, background: 'var(--chip-strong)', border: 'none', color: 'var(--txt)', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontWeight: '600' }}>취소</button>
              <button type="submit" style={{ flex: 1, background: 'var(--accent)', border: 'none', color: '#fff', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700' }}>확인</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}