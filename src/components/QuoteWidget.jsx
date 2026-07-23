import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

// 잠언(Proverbs) 랜덤 구절을 bible-api.com 에서 실시간으로 가져온다.
// WEB(World English Bible) — Public Domain.
const ENDPOINT = 'https://bible-api.com/data/web/random/PRO';

export default function QuoteWidget() {
  const [verse, setVerse] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ok | error
  const [spin, setSpin] = useState(false);

  const load = useCallback(async () => {
    setSpin(true);
    setStatus((s) => (s === 'ok' ? s : 'loading'));
    try {
      const res = await fetch(ENDPOINT);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      const v = data.random_verse;
      setVerse({
        text: (v.text || '').replace(/\n/g, ' ').trim(),
        ref: `${v.book} ${v.chapter}:${v.verse}`,
      });
      setStatus('ok');
    } catch (err) {
      setStatus('error');
    } finally {
      setTimeout(() => setSpin(false), 400);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>
          오늘의 잠언
        </span>
        <button onClick={load} title="새 구절" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
          <RefreshCw size={15} strokeWidth={2} style={{ transition: 'transform 0.4s ease', transform: spin ? 'rotate(360deg)' : 'none' }} />
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px' }}>
        {status === 'loading' && (
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', textAlign: 'center' }}>구절 불러오는 중...</span>
        )}
        {status === 'error' && (
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', textAlign: 'center' }}>
            구절을 불러오지 못했습니다.
          </span>
        )}
        {status === 'ok' && verse && (
          <>
            <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: '1.6', fontWeight: '500', color: '#fff', fontStyle: 'italic' }}>
              “{verse.text}”
            </p>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#ffd60a', letterSpacing: '0.3px' }}>
              — {verse.ref}
            </span>
          </>
        )}
      </div>

      <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: '10px' }}>
        World English Bible · Public Domain
      </span>
    </div>
  );
}
