// components/PomodoroWidget.jsx — 집중 25분 / 휴식 5분 타이머.
// 오늘 완료한 세션 수만 기기별 localStorage 에 남긴다 (Firestore 까지 갈 값은 아니다).
import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { widgetRoot, iconBtn, iconBtnActive, chip, todayKey } from '../styles/widgetUI';
import { WidgetHeader } from './widgetKit';

const MODES = {
  focus: { label: '집중', minutes: 25, color: 'var(--accent)' },
  short: { label: '짧은 휴식', minutes: 5, color: '#34c759' },
  long: { label: '긴 휴식', minutes: 15, color: '#5e5ce6' }
};

const readSessions = () => {
  try {
    const raw = JSON.parse(localStorage.getItem('pomodoro_sessions') || 'null');
    return raw && raw.date === todayKey() ? raw.count : 0;
  } catch { return 0; }
};

const beep = () => {
  // 알림음 — 외부 파일 없이 짧은 사인파 하나
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.frequency.value = 880; osc.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.start(); osc.stop(ctx.currentTime + 1.2);
  } catch { /* 오디오가 막힌 환경이면 조용히 넘어간다 */ }
};

export default function PomodoroWidget() {
  const [mode, setMode] = useState('focus');
  const [left, setLeft] = useState(MODES.focus.minutes * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(readSessions);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setLeft(prev => {
        if (prev > 1) return prev - 1;
        // 끝났다 — 집중 세션이었으면 오늘 카운트 +1
        beep();
        setRunning(false);
        if (modeRef.current === 'focus') {
          setSessions(c => {
            const next = c + 1;
            localStorage.setItem('pomodoro_sessions', JSON.stringify({ date: todayKey(), count: next }));
            return next;
          });
        }
        return 0;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  const pick = (key) => { setMode(key); setLeft(MODES[key].minutes * 60); setRunning(false); };
  const reset = () => { setLeft(MODES[mode].minutes * 60); setRunning(false); };

  const total = MODES[mode].minutes * 60;
  const progress = total > 0 ? 1 - left / total : 0;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  const R = 52, C = 2 * Math.PI * R;

  return (
    <div style={widgetRoot}>
      <WidgetHeader title="포모도로" sub={`오늘 집중 ${sessions}회`} />

      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        {Object.entries(MODES).map(([key, m]) => (
          <div key={key} onClick={() => pick(key)} style={chip(mode === key)}>{m.label}</div>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, gap: '20px' }}>
        <div style={{ position: 'relative', width: '124px', height: '124px', flexShrink: 0 }}>
          <svg width="124" height="124" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="62" cy="62" r={R} fill="none" stroke="var(--chip-strong)" strokeWidth="7" />
            <circle cx="62" cy="62" r={R} fill="none" stroke={MODES[mode].color} strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ transition: 'stroke-dashoffset 0.9s linear' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.65rem', fontWeight: '600', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
            {mm}:{ss}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={() => setRunning(!running)} title={running ? '일시정지' : '시작'}
                  style={{ ...(running ? iconBtnActive : iconBtn), width: '44px', height: '44px', borderRadius: '14px' }}>
            {running ? <Pause size={18} strokeWidth={2} /> : <Play size={18} strokeWidth={2} />}
          </button>
          <button onClick={reset} title="초기화" style={{ ...iconBtn, width: '44px', height: '44px', borderRadius: '14px' }}>
            <RotateCcw size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
