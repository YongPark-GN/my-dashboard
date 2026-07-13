import React, { useState, useEffect } from 'react';

export default function ClockWidget() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours();
  const isAm = hours < 12;
  const displayHours = (hours % 12 || 12).toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const seconds = time.getSeconds().toString().padStart(2, '0');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', boxSizing: 'border-box' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#007aff', letterSpacing: '2px', marginBottom: '16px' }}>
        LOCAL TIME
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <span style={{ fontSize: '1.6rem', fontWeight: '600', color: 'rgba(255,255,255,0.4)' }}>
          {isAm ? 'AM' : 'PM'}
        </span>
        <span style={{ fontSize: '4.5rem', fontWeight: '200', color: '#ffffff', lineHeight: '1', letterSpacing: '-2px' }}>
          {displayHours}:{minutes}
        </span>
        <span style={{ fontSize: '1.6rem', fontWeight: '400', color: '#ff2d55' }}>
          {seconds}
        </span>
      </div>
    </div>
  );
}