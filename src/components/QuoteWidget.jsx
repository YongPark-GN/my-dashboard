import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

// 잠언(Proverbs) 랜덤 구절을 bolls.life 에서 실시간으로 가져온다.
// KRV = 개역한글 (개역개정은 무료 API가 없어 개역한글로 대체). 구절 단위 런타임 fetch.
const PROVERBS_BOOK = 20;          // bolls.life 성경 책 번호(잠언)
const PROVERBS_CHAPTERS = 31;      // 잠언 장 수
const TEXT_URL = (ch) => `https://bolls.life/get-text/KRV/${PROVERBS_BOOK}/${ch}/`;

// bolls.life 본문에 간혹 섞이는 태그/각주 마커 제거
const clean = (s) => (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

export default function QuoteWidget() {
  const [verse, setVerse] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ok | error
  const [spin, setSpin] = useState(false);

  const load = useCallback(async () => {
    setSpin(true);
    try {
      const chapter = 1 + Math.floor(Math.random() * PROVERBS_CHAPTERS);
      const res = await fetch(TEXT_URL(chapter));
      if (!res.ok) throw new Error('fetch failed');
      const verses = await res.json();
      if (!Array.isArray(verses) || verses.length === 0) throw new Error('empty');
      const pick = verses[Math.floor(Math.random() * verses.length)];
      setVerse({ text: clean(pick.text), ref: `잠언 ${chapter}:${pick.verse}` });
      setStatus('ok');
    } catch (err) {
      setStatus((s) => (s === 'ok' ? 'ok' : 'error'));
    } finally {
      setTimeout(() => setSpin(false), 400);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', color: 'var(--txt)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '1.5px', color: 'var(--txt-dim)' }}>
          오늘의 잠언
        </span>
        <button onClick={load} title="새 구절" style={{ background: 'var(--chip-strong)', border: '1px solid var(--field-border)', borderRadius: '10px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt)', cursor: 'pointer' }}>
          <RefreshCw size={15} strokeWidth={2} style={{ transition: 'transform 0.4s ease', transform: spin ? 'rotate(360deg)' : 'none' }} />
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px' }}>
        {status === 'loading' && (
          <span style={{ color: 'var(--txt-faint)', fontSize: '0.9rem', textAlign: 'center' }}>구절 불러오는 중...</span>
        )}
        {status === 'error' && (
          <span style={{ color: 'var(--txt-faint)', fontSize: '0.9rem', textAlign: 'center' }}>구절을 불러오지 못했습니다.</span>
        )}
        {status === 'ok' && verse && (
          <>
            <p style={{ margin: 0, fontSize: '1.1rem', lineHeight: '1.7', fontWeight: '500', color: 'var(--txt)' }}>
              “{verse.text}”
            </p>
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--accent-text)', letterSpacing: '0.3px' }}>
              — {verse.ref}
            </span>
          </>
        )}
      </div>

      <span style={{ fontSize: '0.62rem', color: 'var(--txt-faint)', marginTop: '10px' }}>
        개역한글 · 대한성서공회
      </span>
    </div>
  );
}
