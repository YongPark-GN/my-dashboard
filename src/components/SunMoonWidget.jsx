// components/SunMoonWidget.jsx — 일출·일몰과 달의 위상. 잔잔한 정보 카드.
import { useState, useEffect } from 'react';
import { widgetRoot, panel } from '../styles/widgetUI';
import { WidgetHeader, Empty } from './widgetKit';
import { getPlace } from '../utils/geo';

// 달 위상 — 삭(new moon) 기준점에서 삭망월로 나눈 근사값. 천문 정밀도는 필요 없다.
const SYNODIC = 29.530588853;
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14);
const PHASES = [
  { name: '삭', icon: '🌑' }, { name: '초승달', icon: '🌒' }, { name: '상현달', icon: '🌓' },
  { name: '차는 달', icon: '🌔' }, { name: '보름달', icon: '🌕' }, { name: '기우는 달', icon: '🌖' },
  { name: '하현달', icon: '🌗' }, { name: '그믐달', icon: '🌘' }
];
const moonPhase = (date = new Date()) => {
  const days = (date.getTime() - NEW_MOON_EPOCH) / 86400000;
  const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
  const ratio = age / SYNODIC;
  const phase = PHASES[Math.floor(ratio * 8 + 0.5) % 8];
  // 조명률: 삭 0% → 보름 100% → 삭 0%
  const illumination = Math.round((1 - Math.cos(ratio * 2 * Math.PI)) / 2 * 100);
  return { ...phase, age: age.toFixed(1), illumination };
};

const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '—');
const hoursMin = (seconds) => {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}시간 ${m}분`;
};

export default function SunMoonWidget() {
  const [sun, setSun] = useState(null);
  const [place, setPlace] = useState('위치 확인 중...');
  const [status, setStatus] = useState('loading');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loc = await getPlace();
      if (cancelled) return;
      setPlace(loc.label);
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=sunrise,sunset,daylight_duration&timezone=auto&forecast_days=1`);
        if (!res.ok) throw new Error('sun fetch failed');
        const json = await res.json();
        if (cancelled) return;
        setSun({
          sunrise: json.daily?.sunrise?.[0],
          sunset: json.daily?.sunset?.[0],
          daylight: json.daily?.daylight_duration?.[0]
        });
        setStatus('ok');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const moon = moonPhase(now);

  // 일출~일몰 구간에서 해가 어디쯤 왔는지 (0~1)
  let sunProgress = null;
  if (sun?.sunrise && sun?.sunset) {
    const a = new Date(sun.sunrise).getTime(), b = new Date(sun.sunset).getTime();
    sunProgress = Math.min(1, Math.max(0, (now.getTime() - a) / (b - a)));
  }

  return (
    <div style={widgetRoot}>
      <WidgetHeader title="해와 달" sub={`📍 ${place}`} />

      {status === 'loading' && <Empty>불러오는 중...</Empty>}
      {status === 'error' && <Empty>일출·일몰 정보를 불러올 수 없습니다.</Empty>}

      {status === 'ok' && sun && (
        <>
          {/* 낮 시간대 진행 막대 */}
          <div style={{ position: 'relative', height: '6px', borderRadius: '4px', background: 'var(--chip-bg)', margin: '4px 0 8px' }}>
            <div style={{ position: 'absolute', inset: 0, width: `${(sunProgress ?? 0) * 100}%`, background: 'linear-gradient(90deg, #ff9500, #ffcc00)', borderRadius: '4px' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--txt-faint)' }}>🌅 일출</div>
              <div style={{ fontSize: '1.05rem', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>{hhmm(sun.sunrise)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--txt-faint)' }}>낮 길이</div>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', marginTop: '3px' }}>{hoursMin(sun.daylight)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--txt-faint)' }}>🌇 일몰</div>
              <div style={{ fontSize: '1.05rem', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>{hhmm(sun.sunset)}</div>
            </div>
          </div>

          <div style={{ ...panel, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '2rem', lineHeight: 1 }}>{moon.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{moon.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--txt-faint)' }}>월령 {moon.age}일 · 조명률 {moon.illumination}%</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
