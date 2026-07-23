// components/DashboardContent.jsx
import React, { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; 

import ClockWidget from './ClockWidget';
import WeatherWidget from './WeatherWidget';
import WorkflowWidget from './WorkflowWidget';
import SchedulerWidget from './SchedulerWidget';
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

  const [selectedDate, setSelectedDate] = useState(new Date());
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
      case 'workflow': return <WorkflowWidget userId={userId} />;
      case 'calendar': return <Calendar onChange={setSelectedDate} value={selectedDate} calendarType="gregory" tileClassName={({ date, view }) => view === 'month' ? (date.getDay() === 6 ? 'sat-tile' : date.getDay() === 0 ? 'sun-tile' : null) : null} formatDay={(locale, d) => d.getDate().toString()} />;
      case 'scheduler': return <SchedulerWidget isLoggedIn={auth.isLoggedIn} login={auth.login} accessToken={auth.accessToken} selectedDate={selectedDate} />;
      case 'memo': return <MemoWidget userId={userId} />;
      case 'mindmap': return <MindMapWidget userId={userId} onSelectMap={(map) => { setSelectedMapId(map.id); setIsMindMapOpen(true); }} />;
      default: return null;
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: isDarkMode ? '#000000' : '#f0f0f5', 
      padding: '32px', boxSizing: 'border-box', width: '100vw', 
      position: 'absolute', top: 0, left: 0,
      transition: 'background-color 0.5s ease'
    }}>
      <Toaster />

      {/* 💡 위젯을 감싸는 그리드 영역. 플렉스 박스가 자동 줄바꿈(wrap) 처리 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', width: '100%', paddingBottom: '120px' }}>
        {layout.widgetOrder
          .filter(id => layout.visibleWidgets.includes(id)) 
          .map((id) => {
            // 💡 핵심 로직: 기존의 고정 사이즈(widgetSizes) 대신 반응형 함수 호출
            const responsiveSize = layout.getResponsiveSize(id);

            return (
              <div key={id} 
                   draggable={!layout.resizeTarget && !layout.isLocked} 
                   onDragStart={() => layout.handleDragStart(id)} 
                   onDragOver={layout.handleDragOver} 
                   onDrop={() => layout.handleDrop(id)} 
                   onDragEnd={layout.handleDragEnd} 
                   style={{ 
                     ...iosLiquidGlassWidget, 
                     width: `${responsiveSize.width}px`,   // 👈 모바일/태블릿 맞춤형 너비 적용
                     height: `${responsiveSize.height}px`, // 👈 모바일/태블릿 맞춤형 높이 적용
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