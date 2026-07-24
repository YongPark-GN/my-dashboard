// hooks/useWidgetDoc.js
// 위젯 하나가 자기 Firestore 문서(users/{uid}/dashboard/{docId})를 읽고 쓰는 공통 훅.
// 메모 위젯이 쓰던 패턴(스냅샷 구독 + 로컬 편집 보호 + 디바운스 저장)을 일반화한 것이다.
import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from '../components/Toast';

export function useWidgetDoc(userId, docId, defaults, label = '데이터') {
  const [data, setData] = useState(defaults);
  const dataRef = useRef(defaults);
  const lastLocalEdit = useRef(0);
  const saveTimer = useRef(null);
  const defaultsRef = useRef(defaults);

  useEffect(() => {
    if (!db || !userId) return;
    const ref = doc(db, 'users', userId, 'dashboard', docId);
    const unsub = onSnapshot(ref, (snap) => {
      // 방금 내가 고친 값이 원격 스냅샷으로 되돌아와 덮어쓰는 것을 막는다
      if (Date.now() - lastLocalEdit.current < 2000) return;
      if (!snap.exists()) return;
      const next = { ...defaultsRef.current, ...snap.data() };
      dataRef.current = next;
      setData(next);
    });
    return () => unsub();
  }, [userId, docId]);

  const save = async (next) => {
    if (!userId) return;
    try {
      await setDoc(doc(db, 'users', userId, 'dashboard', docId), { ...next, updatedAt: new Date().toISOString() }, { merge: true });
    } catch {
      toast(`${label} 저장에 실패했습니다.`);
    }
  };

  // patch 는 함수도 받는다 — 렌더 사이에 연달아 호출돼도 최신 값 기준으로 계산되도록.
  const update = (patch, { debounce = false } = {}) => {
    lastLocalEdit.current = Date.now();
    const next = { ...dataRef.current, ...(typeof patch === 'function' ? patch(dataRef.current) : patch) };
    dataRef.current = next;
    setData(next);
    clearTimeout(saveTimer.current);
    if (debounce) saveTimer.current = setTimeout(() => save(next), 700);
    else save(next);
    return next;
  };

  return [data, update];
}

export const newId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
