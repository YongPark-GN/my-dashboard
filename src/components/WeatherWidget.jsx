import React, { useState } from 'react';

export default function WeatherWidget() {
  const [weather] = useState({
    temp: 28,
    condition: '맑음',
    location: 'Seryui-dong',
    airQuality: '보통',
    humidity: 54,
    wind: 2.1
  });

  const detailWeatherUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(weather.location + ' 날씨')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', width: '100%', color: '#ffffff', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#ffffff' }}>{weather.location}</span>
        <a 
          href={detailWeatherUrl} target="_blank" rel="noopener noreferrer" 
          style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', background: 'rgba(255, 255, 255, 0.08)', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.15)', transition: 'all 0.2s' }}
        >
          상세보기 ↗
        </a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <h1 style={{ fontSize: '3.5rem', fontWeight: '300', margin: 0, padding: 0, lineHeight: '1', color: '#ffffff' }}>
            {weather.temp}°
          </h1>
          <span style={{ fontSize: '1rem', fontWeight: '500', color: 'rgba(255, 255, 255, 0.8)', marginTop: '8px' }}>
            {weather.condition}
          </span>
        </div>
        <div style={{ fontSize: '3.2rem', lineHeight: '1' }}>
          {weather.condition === '맑음' ? '☀️' : '☁️'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: 'rgba(255, 255, 255, 0.06)', padding: '12px 16px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>대기질</span>
          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#ffcc00', marginTop: '4px' }}>{weather.airQuality}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>습도</span>
          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#ffffff', marginTop: '4px' }}>{weather.humidity}%</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>풍속</span>
          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#ffffff', marginTop: '4px' }}>{weather.wind} m/s</span>
        </div>
      </div>
    </div>
  );
}