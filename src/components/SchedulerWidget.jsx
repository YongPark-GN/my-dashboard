import React from 'react';

export default function SchedulerWidget({ isLoggedIn, login, events, selectedDate }) {
  const todayText = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(selectedDate);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '10px' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>{todayText}</div>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {!isLoggedIn ? (
          <button onClick={() => login()} style={{ padding: '10px', background: '#ffffff', color: '#000', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', width: '100%' }}>구글 계정 연결</button>
        ) : (
          events.map(event => (
            <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
              <span>{event.title}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{event.time}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}