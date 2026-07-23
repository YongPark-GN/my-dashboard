import React, { useState, useEffect } from 'react';

export default function ClockWidget() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours();
  const isAm = hours < 12;
  const displayHours = (hours % 12 || 12);
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const seconds = time.getSeconds().toString().padStart(2, '0');
  const dateLabel = time.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      justifyContent: 'center', alignItems: 'center', boxSizing: 'border-box', gap: '10px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif'
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <span style={{ fontSize: '1.3rem', fontWeight: '700', color: '#4da3ff', lineHeight: '1' }}>
          {isAm ? '오전' : '오후'}
        </span>
        <span style={{
          fontSize: '4.6rem', fontWeight: '600', color: '#ffffff', lineHeight: '0.9',
          letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums',
          textShadow: '0 2px 16px rgba(0,0,0,0.4)'
        }}>
          {displayHours}:{minutes}
        </span>
        <span style={{ fontSize: '1.5rem', fontWeight: '600', color: 'rgba(255,255,255,0.45)', lineHeight: '1', fontVariantNumeric: 'tabular-nums', minWidth: '2ch' }}>
          {seconds}
        </span>
      </div>
      <span style={{ fontSize: '1rem', fontWeight: '500', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.3px' }}>
        {dateLabel}
      </span>
    </div>
  );
}
