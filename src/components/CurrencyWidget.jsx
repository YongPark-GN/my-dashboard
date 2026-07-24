// components/CurrencyWidget.jsx — 원화 기준 환율. frankfurter.dev (ECB 고시환율, 키 불필요).
// 주의: ECB 환율은 영업일 하루 한 번만 갱신된다. 실시간 시세가 아니다.
//
// 두 가지 함정이 있어 지금 형태가 됐다:
//  1. 예전 호스트 api.frankfurter.app 는 .dev 로 301 리다이렉트되는데, 브라우저는
//     리다이렉트된 응답의 CORS 헤더를 못 읽어 요청이 통째로 실패한다 → .dev 를 직접 부른다.
//  2. base=KRW 로 물으면 환율이 0.0006 처럼 소수 4자리로 잘려 되돌릴 때 오차가 커진다.
//     ECB 원본 기준인 EUR 로 받아서 교차환율로 계산한다.
import { useState, useEffect } from 'react';
import { widgetRoot, scrollArea } from '../styles/widgetUI';
import { WidgetHeader, Empty, Row } from './widgetKit';

// 표시 단위 — 엔화는 100엔 기준이 익숙하다
const TARGETS = [
  { code: 'USD', label: '미국 달러', unit: 1, flag: '🇺🇸' },
  { code: 'EUR', label: '유로', unit: 1, flag: '🇪🇺' },
  { code: 'JPY', label: '일본 엔', unit: 100, flag: '🇯🇵' },
  { code: 'CNY', label: '중국 위안', unit: 1, flag: '🇨🇳' }
];

const won = (n) => n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });

export default function CurrencyWidget() {
  const [rows, setRows] = useState(null);
  const [asOf, setAsOf] = useState('');
  const [status, setStatus] = useState('loading'); // loading | ok | error

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // 최근 2주치를 한 번에 받아 마지막 두 영업일로 등락을 계산한다
        const start = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
        const symbols = ['KRW', ...TARGETS.map(t => t.code).filter(c => c !== 'EUR')].join(',');
        const res = await fetch(`https://api.frankfurter.dev/v1/${start}..?base=EUR&symbols=${symbols}`);
        if (!res.ok) throw new Error('rate fetch failed');
        const json = await res.json();
        const dates = Object.keys(json.rates || {}).sort();
        if (dates.length === 0) throw new Error('empty rates');

        // 하루치에서 "t.unit 단위 = ? 원" 을 뽑는다 (둘 다 EUR 기준이라 나누면 교차환율)
        const krwPer = (day, t) => {
          if (!day?.KRW) return null;
          const perEur = t.code === 'EUR' ? 1 : day[t.code];
          return perEur ? (day.KRW / perEur) * t.unit : null;
        };

        const last = json.rates[dates[dates.length - 1]];
        const prev = dates.length > 1 ? json.rates[dates[dates.length - 2]] : null;

        const next = TARGETS.map(t => {
          const now = krwPer(last, t);
          const before = prev ? krwPer(prev, t) : null;
          return { ...t, value: now, change: now != null && before != null ? now - before : null };
        }).filter(r => r.value != null);

        if (cancelled) return;
        setRows(next);
        setAsOf(dates[dates.length - 1]);
        setStatus('ok');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };
    load();
    const t = setInterval(load, 60 * 60 * 1000); // 한 시간마다 갱신이면 충분
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return (
    <div style={widgetRoot}>
      <WidgetHeader title="환율" sub={asOf ? `${asOf} ECB 고시 기준` : '원화 기준'} />

      {status === 'loading' && <Empty>환율 불러오는 중...</Empty>}
      {status === 'error' && <Empty>환율 정보를 불러올 수 없습니다.</Empty>}

      {status === 'ok' && rows && (
        <div style={scrollArea}>
          {rows.map(r => (
            <Row key={r.code}>
              <span style={{ fontSize: '1.15rem', flexShrink: 0 }}>{r.flag}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{r.unit > 1 ? `${r.unit} ` : ''}{r.code}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--txt-faint)' }}>{r.label}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '1rem', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>{won(r.value)}원</div>
                {r.change != null && (
                  <div style={{ fontSize: '0.68rem', fontVariantNumeric: 'tabular-nums', color: r.change > 0 ? '#ff453a' : r.change < 0 ? '#30a9ff' : 'var(--txt-faint)' }}>
                    {r.change > 0 ? '▲' : r.change < 0 ? '▼' : '−'} {won(Math.abs(r.change))}
                  </div>
                )}
              </div>
            </Row>
          ))}
        </div>
      )}
    </div>
  );
}
