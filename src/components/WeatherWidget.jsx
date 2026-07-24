import React, { useState, useEffect } from 'react';
import { toast } from './Toast';
import { getPlace } from '../utils/geo';

// WMO weather interpretation codes → 한글 상태 + 아이콘
const WMO = {
  0: { label: '맑음', icon: '☀️' },
  1: { label: '대체로 맑음', icon: '🌤️' },
  2: { label: '구름 조금', icon: '⛅' },
  3: { label: '흐림', icon: '☁️' },
  45: { label: '안개', icon: '🌫️' }, 48: { label: '짙은 안개', icon: '🌫️' },
  51: { label: '약한 이슬비', icon: '🌦️' }, 53: { label: '이슬비', icon: '🌦️' }, 55: { label: '강한 이슬비', icon: '🌦️' },
  56: { label: '어는 이슬비', icon: '🌧️' }, 57: { label: '강한 어는 이슬비', icon: '🌧️' },
  61: { label: '약한 비', icon: '🌧️' }, 63: { label: '비', icon: '🌧️' }, 65: { label: '강한 비', icon: '🌧️' },
  66: { label: '어는 비', icon: '🌧️' }, 67: { label: '강한 어는 비', icon: '🌧️' },
  71: { label: '약한 눈', icon: '🌨️' }, 73: { label: '눈', icon: '🌨️' }, 75: { label: '강한 눈', icon: '❄️' },
  77: { label: '싸락눈', icon: '🌨️' },
  80: { label: '소나기', icon: '🌦️' }, 81: { label: '소나기', icon: '🌧️' }, 82: { label: '강한 소나기', icon: '⛈️' },
  85: { label: '약한 눈소나기', icon: '🌨️' }, 86: { label: '강한 눈소나기', icon: '❄️' },
  95: { label: '뇌우', icon: '⛈️' }, 96: { label: '우박 동반 뇌우', icon: '⛈️' }, 99: { label: '강한 우박 뇌우', icon: '⛈️' },
};

const describeCode = (code) => WMO[code] ?? { label: '정보 없음', icon: '🌡️' };

const airQualityLabel = (pm25) => {
  if (pm25 == null) return { text: '—', color: 'var(--txt-dim)' };
  if (pm25 <= 15) return { text: '좋음', color: '#34c759' };
  if (pm25 <= 35) return { text: '보통', color: '#ffcc00' };
  if (pm25 <= 75) return { text: '나쁨', color: '#ff9500' };
  return { text: '매우 나쁨', color: '#ff3b30' };
};

async function fetchWeather(lat, lon) {
  const fUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`;
  const aUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5`;

  const [fRes, aRes] = await Promise.all([fetch(fUrl), fetch(aUrl).catch(() => null)]);
  if (!fRes.ok) throw new Error('forecast fetch failed');
  const f = await fRes.json();
  const cur = f.current;

  let pm25 = null;
  if (aRes && aRes.ok) {
    const a = await aRes.json();
    pm25 = a.current?.pm2_5 ?? null;
  }

  return {
    temp: Math.round(cur.temperature_2m),
    humidity: Math.round(cur.relative_humidity_2m),
    wind: Number(cur.wind_speed_10m).toFixed(1),
    code: cur.weather_code,
    pm25,
  };
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  const [location, setLocation] = useState('위치 확인 중...');
  const [status, setStatus] = useState('loading'); // loading | ok | error

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const loc = await getPlace();
      if (cancelled) return;
      setLocation(loc.label);
      try {
        const data = await fetchWeather(loc.lat, loc.lon);
        if (cancelled) return;
        setWeather(data);
        setStatus('ok');
      } catch {
        if (cancelled) return;
        setStatus('error');
        toast('날씨 정보를 불러오지 못했습니다.');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const detailWeatherUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(location.replace(/\s*\(.*\)/, '') + ' 날씨')}`;
  const cond = weather ? describeCode(weather.code) : null;
  const air = airQualityLabel(weather?.pm25);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', width: '100%', color: 'var(--txt)', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {location}</span>
        <a
          href={detailWeatherUrl} target="_blank" rel="noopener noreferrer"
          style={{ flexShrink: 0, fontSize: '0.8rem', color: 'var(--txt-dim)', textDecoration: 'none', background: 'var(--chip-bg)', padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--field-border)' }}
        >
          상세보기 ↗
        </a>
      </div>

      {status === 'loading' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt-faint)', fontSize: '0.9rem' }}>
          날씨 불러오는 중...
        </div>
      )}

      {status === 'error' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt-faint)', fontSize: '0.9rem' }}>
          날씨 정보를 불러올 수 없습니다.
        </div>
      )}

      {status === 'ok' && weather && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <h1 style={{ fontSize: '3.5rem', fontWeight: '300', margin: 0, padding: 0, lineHeight: '1', color: 'var(--txt)' }}>
                {weather.temp}°
              </h1>
              <span style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--txt-dim)', marginTop: '8px' }}>
                {cond.label}
              </span>
            </div>
            <div style={{ fontSize: '3.2rem', lineHeight: '1' }}>
              {cond.icon}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: 'var(--chip-bg)', padding: '12px 16px', borderRadius: '16px', border: '1px solid var(--field-border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--txt-faint)' }}>대기질</span>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: air.color, marginTop: '4px' }}>{air.text}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--txt-faint)' }}>습도</span>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--txt)', marginTop: '4px' }}>{weather.humidity}%</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--txt-faint)' }}>풍속</span>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--txt)', marginTop: '4px' }}>{weather.wind} m/s</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
