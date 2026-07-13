import React, { useState, useEffect } from 'react';

export default function ClockWidget() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => { setTime(new Date()); }, 1000);
    return () => clearInterval(timer);
  }, []);

  const clockFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });
  const clockParts = clockFormatter.formatToParts(time);
  const hours = clockParts.find(p => p.type === 'hour').value;
  const minutes = clockParts.find(p => p.type === 'minute').value;
  const seconds = clockParts.find(p => p.type === 'second').value;
  const ampm = clockParts.find(p => p.type === 'dayPeriod').value;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <div style={{ fontSize: '3.8rem', fontWeight: '700', fontFamily: 'monospace' }}>
        {hours}:{minutes}<span style={{ fontSize: '2.5rem', color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>{seconds}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '14px', fontSize: '0.9rem', fontWeight: '700' }}>
        <span style={{ color: ampm === 'AM' ? '#ffffff' : 'rgba(255,255,255,0.15)' }}>AM</span>
        <span style={{ color: ampm === 'PM' ? '#ffffff' : 'rgba(255,255,255,0.15)' }}>PM</span>
      </div>
    </div>
  );
}