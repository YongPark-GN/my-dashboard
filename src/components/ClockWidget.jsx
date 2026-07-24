import { useState, useEffect } from 'react';

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
        <span style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--accent-text)', lineHeight: '1' }}>
          {isAm ? '오전' : '오후'}
        </span>
        <span style={{
          fontSize: '4.6rem', fontWeight: '600', color: 'var(--txt)', lineHeight: '0.9',
          letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums'
        }}>
          {displayHours}:{minutes}
        </span>
        <span style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--txt-faint)', lineHeight: '1', fontVariantNumeric: 'tabular-nums', minWidth: '2ch' }}>
          {seconds}
        </span>
      </div>
      <span style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--txt-dim)', letterSpacing: '0.3px' }}>
        {dateLabel}
      </span>
    </div>
  );
}
