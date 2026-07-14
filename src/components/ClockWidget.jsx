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
    <div style={{ 
      display: 'flex', 
      height: '100%', 
      justifyContent: 'center', 
      alignItems: 'center', 
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif' 
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
        <span style={{ fontSize: '4.8rem', fontWeight: '200', color: '#ffffff', lineHeight: '1', letterSpacing: '-1.5px' }}>
          {displayHours}:{minutes}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: '600', color: '#ff2d55', lineHeight: '1', marginBottom: '4px' }}>
            {seconds}
          </span>
          <span style={{ fontSize: '1.2rem', fontWeight: '600', color: 'rgba(255,255,255,0.5)', lineHeight: '1' }}>
            {isAm ? 'AM' : 'PM'}
          </span>
        </div>
      </div>
    </div>
  );
}