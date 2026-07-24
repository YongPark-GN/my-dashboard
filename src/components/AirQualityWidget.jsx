// components/AirQualityWidget.jsx — 미세먼지·오존·자외선. Open-Meteo Air Quality (키 불필요).
// 날씨 위젯에도 PM2.5 한 줄이 있지만, 이 위젯은 항목별 수치와 등급을 자세히 본다.
import { useState, useEffect } from 'react';
import { widgetRoot, panel } from '../styles/widgetUI';
import { WidgetHeader, Empty } from './widgetKit';
import { getPlace } from '../utils/geo';

// 환경부 기준 등급 구간 (좋음 / 보통 / 나쁨 / 매우 나쁨)
const GRADES = [
  { text: '좋음', color: '#34c759' },
  { text: '보통', color: '#ffcc00' },
  { text: '나쁨', color: '#ff9500' },
  { text: '매우 나쁨', color: '#ff3b30' }
];
const grade = (value, cuts) => {
  if (value == null) return { text: '—', color: 'var(--txt-dim)' };
  const i = cuts.findIndex(c => value <= c);
  return GRADES[i === -1 ? GRADES.length - 1 : i];
};

const METRICS = [
  { key: 'pm2_5', label: '초미세먼지', short: 'PM2.5', unit: '㎍/㎥', cuts: [15, 35, 75] },
  { key: 'pm10', label: '미세먼지', short: 'PM10', unit: '㎍/㎥', cuts: [30, 80, 150] },
  { key: 'ozone', label: '오존', short: 'O₃', unit: '㎍/㎥', cuts: [60, 120, 200] },
  { key: 'nitrogen_dioxide', label: '이산화질소', short: 'NO₂', unit: '㎍/㎥', cuts: [40, 80, 200] }
];

const uvGrade = (uv) => {
  if (uv == null) return { text: '—', color: 'var(--txt-dim)' };
  if (uv < 3) return { text: '낮음', color: '#34c759' };
  if (uv < 6) return { text: '보통', color: '#ffcc00' };
  if (uv < 8) return { text: '높음', color: '#ff9500' };
  if (uv < 11) return { text: '매우 높음', color: '#ff3b30' };
  return { text: '위험', color: '#af52de' };
};

export default function AirQualityWidget() {
  const [air, setAir] = useState(null);
  const [place, setPlace] = useState('위치 확인 중...');
  const [status, setStatus] = useState('loading'); // loading | ok | error

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loc = await getPlace();
      if (cancelled) return;
      setPlace(loc.label);
      try {
        const fields = [...METRICS.map(m => m.key), 'uv_index'].join(',');
        const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${loc.lat}&longitude=${loc.lon}&current=${fields}`);
        if (!res.ok) throw new Error('air fetch failed');
        const json = await res.json();
        if (cancelled) return;
        setAir(json.current || {});
        setStatus('ok');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 가장 나쁜 항목이 그 시점의 종합 등급이다
  const worst = air ? METRICS.reduce((acc, m) => {
    const g = grade(air[m.key], m.cuts);
    const rank = GRADES.findIndex(x => x.text === g.text);
    return rank > acc.rank ? { rank, g, m } : acc;
  }, { rank: -1, g: GRADES[0], m: null }) : null;

  const uv = uvGrade(air?.uv_index);

  return (
    <div style={widgetRoot}>
      <WidgetHeader title="대기질" sub={`📍 ${place}`} />

      {status === 'loading' && <Empty>대기질 불러오는 중...</Empty>}
      {status === 'error' && <Empty>대기질 정보를 불러올 수 없습니다.</Empty>}

      {status === 'ok' && air && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '2px 0 12px' }}>
            <span style={{ fontSize: '2.1rem', fontWeight: '600', color: worst.g.color, lineHeight: 1 }}>{worst.g.text}</span>
            {worst.m && <span style={{ fontSize: '0.76rem', color: 'var(--txt-faint)' }}>{worst.m.label} 기준</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {METRICS.map(m => {
              const g = grade(air[m.key], m.cuts);
              const v = air[m.key];
              return (
                <div key={m.key} style={panel}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--txt-faint)' }}>{m.label} <span style={{ opacity: 0.7 }}>{m.short}</span></div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '3px' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
                      {v == null ? '—' : Math.round(v)}
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: '600', color: g.color }}>{g.text}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ ...panel, marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--txt-faint)' }}>자외선 지수</span>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: uv.color }}>
              {air.uv_index == null ? '—' : air.uv_index.toFixed(1)} · {uv.text}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
