// components/DashboardContent.jsx
import React, { useState } from 'react';

import ClockWidget from './ClockWidget';
import WeatherWidget from './WeatherWidget';
import QuoteWidget from './QuoteWidget';
import CalendarWidget from './CalendarWidget';
import MindMapWidget from './MindMapWidget';
import MemoWidget from './MemoWidget';
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

  return (
    <div style={{
      minHeight: '100vh',
      background: bgBase,
      padding: '32px', boxSizing: 'border-box', width: '100vw',
      position: 'absolute', top: 0, left: 0,
      transition: 'background 0.5s ease', overflow: 'hidden'
    }}>
      <Toaster />

      {/* 배경 오로라 블롭 */}
      <div className="lg-blob" style={{ width: '460px', height: '460px', top: '-120px', left: '-80px', background: blobs[0] }} />
      <div className="lg-blob" style={{ width: '520px', height: '520px', bottom: '-160px', right: '-100px', background: blobs[1] }} />
      <div className="lg-blob" style={{ width: '380px', height: '380px', top: '40%', left: '45%', background: blobs[2], opacity: 0.4 }} />

      {/* 💡 위젯 그리드 (배경 위 레이어) */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', gap: '28px', width: '100%', paddingBottom: '120px' }}>
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
                     width: `${responsiveSize.width}px`,
                     height: `${responsiveSize.height}px`,
                     opacity: layout.draggingId === id ? 0.4 : 1,
                     cursor: layout.isLocked ? 'default' : 'grab'
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
      />

      {isMindMapOpen && selectedMapId && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 999999, backgroundColor: '#000000', padding: '40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          <button onClick={() => { setIsMindMapOpen(false); setSelectedMapId(null); }} style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: '12px', cursor: 'pointer', marginBottom: '24px' }}>종료 및 닫기</button>
          <div style={{ flex: 1, backgroundColor: '#0c0c0e', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', overflow: 'hidden' }}>
            <MindMapWidget userId={userId} isEditorMode={true} selectedMapId={selectedMapId} openModal={(config) => setInputModal({ isOpen: true, ...config })} />
          </div>
        </div>
      )}

      {inputModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999999, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleFormSubmit} style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px', width: '360px', color: '#fff' }}>
            <h4 style={{ margin: '0 0 20px 0' }}>{inputModal.mode === 'add' ? '새 블록 내용 입력' : '블록 내용 수정'}</h4>
            <textarea value={inputModal.text} onChange={(e) => setInputModal({ ...inputModal, text: e.target.value })} autoFocus style={{ width: '100%', height: '100px', marginBottom: '24px' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => setInputModal({ isOpen: false, nodeId: null, text: '', mode: 'add', onSubmit: null })} style={{ flex: 1 }}>취소</button>
              <button type="submit" style={{ flex: 1 }}>확인</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}