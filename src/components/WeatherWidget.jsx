import React, { useState, useEffect } from 'react';

export default function WeatherWidget() {
  // 핵심 로직: 기존 연동 데이터 구조를 방어하기 위한 가상/실제 날씨 데이터 상태 선언
  const [weather, setWeather] = useState({
    temp: 28,
    condition: '맑음',
    location: 'Seryui-dong',
    airQuality: '보통',
    humidity: 54,
    wind: 2.1
  });

  // 핵심 로직: 유저가 위치한 지역을 기준으로 네이버 날씨 상세 페이지 자동 매핑 URL 생성
  const detailWeatherUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(weather.location + ' 날씨')}`;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      height: '100%',
      width: '100%',
      color: '#ffffff',
      boxSizing: 'border-box'
    }}>
      {/* 상단 영역: 위치 정보 및 스마트폰 앱 스타일의 아웃링크 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#007aff', letterSpacing: '0.5px' }}>WEATHER</span>
          <span style={{ fontSize: '1rem', fontWeight: '600', color: '#ffffff' }}>{weather.location}</span>
        </div>
        {/* 외부 상세 날씨 페이지 이동 링크 */}
        <a 
          href={detailWeatherUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{
            fontSize: '0.75rem',
            color: 'rgba(255, 255, 255, 0.5)',
            textDecoration: 'none',
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '4px 10px',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
        >
          상세보기 ↗
        </a>
      </div>

      {/* 중간 영역: 대형 온도 정보 및 날씨 이모지 배치 (라인 높이 및 마진 조절로 겹침 현상 원천 차단) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '12px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          {/* 상숫값 폰트 크기 및 높이를 균등 배정하여 오버랩 격리 */}
          <h1 style={{ fontSize: '3rem', fontWeight: '300', margin: 0, padding: 0, lineHeight: '1' }}>
            {weather.temp}°
          </h1>
          <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'rgba(255, 255, 255, 0.8)', marginTop: '4px' }}>
            {weather.condition}
          </span>
        </div>
        <div style={{ fontSize: '2.8rem', lineHeight: '1' }}>
          {weather.condition === '맑음' ? '☀️' : '☁️'}
        </div>
      </div>

      {/* 하단 영역: 스마트폰 위젯 규격의 격자형 서브 데이터 요약판 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '8px', 
        background: 'rgba(255, 255, 255, 0.04)', 
        padding: '10px 12px', 
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignTracks: 'center' }}>
          <span style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.4)' }}>대기질</span>
          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#ffcc00', marginTop: '2px' }}>{weather.airQuality}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.4)' }}>습도</span>
          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#ffffff', marginTop: '2px' }}>{weather.humidity}%</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.4)' }}>풍속</span>
          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#ffffff', marginTop: '2px' }}>{weather.wind} m/s</span>
        </div>
      </div>
    </div>
  );
}