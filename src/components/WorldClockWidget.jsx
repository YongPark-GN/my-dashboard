// components/WorldClockWidget.jsx — 여러 타임존의 현재 시각. 해외 미팅 시간 확인용.
import { useState, useEffect } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { useWidgetDoc, newId } from '../hooks/useWidgetDoc';
import { widgetRoot, scrollArea, iconBtn, iconBtnActive, field } from '../styles/widgetUI';
import { WidgetHeader, Empty, Row } from './widgetKit';

const PRESETS = [
  { label: '서울', tz: 'Asia/Seoul' }, { label: '도쿄', tz: 'Asia/Tokyo' },
  { label: '베이징', tz: 'Asia/Shanghai' }, { label: '싱가포르', tz: 'Asia/Singapore' },
  { label: '방갈로르', tz: 'Asia/Kolkata' }, { label: '두바이', tz: 'Asia/Dubai' },
  { label: '런던', tz: 'Europe/London' }, { label: '파리', tz: 'Europe/Paris' },
  { label: '베를린', tz: 'Europe/Berlin' }, { label: '뉴욕', tz: 'America/New_York' },
  { label: '시카고', tz: 'America/Chicago' }, { label: '샌프란시스코', tz: 'America/Los_Angeles' },
  { label: '시드니', tz: 'Australia/Sydney' }, { label: 'UTC', tz: 'UTC' }
];

const DEFAULTS = {
  zones: [
    { id: 'z_seoul', label: '서울', tz: 'Asia/Seoul' },
    { id: 'z_ny', label: '뉴욕', tz: 'America/New_York' },
    { id: 'z_london', label: '런던', tz: 'Europe/London' }
  ]
};

// 로컬 자정 기준으로 며칠 차이인지 (어제/내일 뱃지용)
const dayOffset = (now, tz) => {
  const there = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const here = new Date(now.toLocaleString('en-US'));
  return Math.round((new Date(there.getFullYear(), there.getMonth(), there.getDate()) - new Date(here.getFullYear(), here.getMonth(), here.getDate())) / 86400000);
};

export default function WorldClockWidget({ userId }) {
  const [data, update] = useWidgetDoc(userId, 'worldClockWidget', DEFAULTS, '세계 시계');
  const [now, setNow] = useState(new Date());
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState(PRESETS[0].tz);
  const [label, setLabel] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const zones = Array.isArray(data.zones) ? data.zones : [];

  const add = () => {
    const preset = PRESETS.find(p => p.tz === pick);
    update(d => ({ zones: [...(d.zones || []), { id: newId(), label: label.trim() || preset.label, tz: pick }] }));
    setAdding(false); setLabel('');
  };
  const remove = (id) => update(d => ({ zones: d.zones.filter(z => z.id !== id) }));

  return (
    <div style={widgetRoot}>
      <WidgetHeader
        title="세계 시계"
        sub={now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) + ' 내 시간'}
        right={<button onClick={() => setAdding(!adding)} title="지역 추가" style={adding ? iconBtnActive : iconBtn}><Plus size={16} strokeWidth={2.2} /></button>}
      />

      {adding && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ ...field, flex: 1 }}>
            {PRESETS.map(p => <option key={p.tz} value={p.tz} style={{ background: 'var(--editor-bg)' }}>{p.label}</option>)}
          </select>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="표시 이름(선택)" style={{ ...field, width: '110px' }} />
          <button onClick={add} style={iconBtn} title="저장"><Check size={16} strokeWidth={2.2} /></button>
        </div>
      )}

      <div style={scrollArea}>
        {zones.length === 0 ? (
          <Empty>지역이 없습니다.<br />+ 버튼으로 추가하세요.</Empty>
        ) : zones.map(z => {
          const off = dayOffset(now, z.tz);
          return (
            <Row key={z.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {z.label}
                  {off !== 0 && <span style={{ marginLeft: '6px', fontSize: '0.68rem', color: 'var(--txt-faint)' }}>{off > 0 ? '내일' : '어제'}</span>}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--txt-faint)' }}>
                  {now.toLocaleDateString('ko-KR', { timeZone: z.tz, month: 'short', day: 'numeric', weekday: 'short' })}
                </div>
              </div>
              <span style={{ fontSize: '1.15rem', fontWeight: '500', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px', flexShrink: 0 }}>
                {now.toLocaleTimeString('ko-KR', { timeZone: z.tz, hour: '2-digit', minute: '2-digit' })}
              </span>
              <button onClick={() => remove(z.id)} title="삭제"
                      style={{ background: 'none', border: 'none', color: 'var(--txt-faint)', cursor: 'pointer', display: 'flex', padding: '2px' }}>
                <X size={13} strokeWidth={2.2} />
              </button>
            </Row>
          );
        })}
      </div>
    </div>
  );
}
