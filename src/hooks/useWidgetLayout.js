// hooks/useWidgetLayout.js
import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from '../components/Toast';

// 전체 위젯 목록(= 정렬 기준). 위젯을 추가하면 여기와 DEFAULT_SIZES, Dock 의 WIDGET_NAMES 를 함께 갱신한다.
const DEFAULT_ORDER = [
  'clock', 'weather', 'quote', 'calendar', 'memo', 'mindmap',
  'todo', 'pomodoro', 'worldclock', 'dday', 'bookmark', 'snippet', 'currency',
  'habit', 'budget', 'air', 'shopping', 'sunmoon', 'music', 'gallery', 'search', 'system'
];

// 새 사용자·새 페이지가 처음 보게 되는 위젯. 나머지는 독의 위젯 라이브러리에서 켠다.
const DEFAULT_VISIBLE = ['clock', 'weather', 'quote', 'calendar', 'memo', 'mindmap'];

const DEFAULT_SIZES = {
  clock: { width: 380, height: 240 }, weather: { width: 320, height: 260 },
  quote: { width: 360, height: 240 }, calendar: { width: 720, height: 380 },
  memo: { width: 360, height: 320 }, mindmap: { width: 360, height: 260 },
  todo: { width: 360, height: 340 }, pomodoro: { width: 340, height: 260 },
  worldclock: { width: 340, height: 300 }, dday: { width: 340, height: 300 },
  bookmark: { width: 380, height: 280 }, snippet: { width: 360, height: 300 },
  currency: { width: 340, height: 300 }, habit: { width: 380, height: 320 },
  budget: { width: 420, height: 360 }, air: { width: 360, height: 320 },
  shopping: { width: 340, height: 320 }, sunmoon: { width: 360, height: 260 },
  music: { width: 400, height: 380 }, gallery: { width: 380, height: 320 },
  search: { width: 420, height: 220 }, system: { width: 320, height: 280 }
};

// 제거된 위젯 + 통합 마이그레이션. 저장된 예전 레이아웃을 현재 위젯 세트에 맞게 정리한다.
const REMOVED = ['workflow', 'scheduler'];
const reconcileLayout = (order, visible, sizes) => {
  const safeOrder = Array.isArray(order) ? order : DEFAULT_ORDER;
  const safeVisible = Array.isArray(visible) ? visible : DEFAULT_VISIBLE;
  const wasPreUpgrade = safeOrder.some(id => REMOVED.includes(id));

  const knownOrder = safeOrder.filter(id => DEFAULT_ORDER.includes(id));
  const newIds = DEFAULT_ORDER.filter(id => !safeOrder.includes(id)); // 새로 추가된 위젯
  const nextOrder = [...knownOrder, ...newIds];

  // 새 위젯은 순서에만 끼워 넣고 켜지는 않는다 — 안 그러면 한 번에 여러 개가
  // 튀어나와 기존 배치를 망친다. 필요한 것만 독의 위젯 라이브러리에서 켜면 된다.
  const nextVisible = safeVisible.filter(id => DEFAULT_ORDER.includes(id));

  let nextSizes = { ...DEFAULT_SIZES, ...(sizes || {}) };
  // 캘린더가 스케줄러와 통합되어 더 넓은 공간이 필요 → 예전 레이아웃이면 크기 재설정
  if (wasPreUpgrade) nextSizes = { ...nextSizes, calendar: DEFAULT_SIZES.calendar };

  const changed = wasPreUpgrade || newIds.length > 0 || nextOrder.length !== safeOrder.length || nextVisible.length !== safeVisible.length;
  return { nextOrder, nextVisible, nextSizes, changed };
};

// ---- 페이지 ----
// 페이지는 "위젯 배치 한 벌"이다. 회사/집처럼 상황별로 다른 배치를 두고 전환한다.
// 위젯이 담는 내용(메모·마인드맵 등)은 사용자 단위라 페이지가 달라도 같은 데이터를 본다.
export const MAX_PAGES = 8;

const newPageId = () => `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const makePage = (name) => ({
  id: newPageId(),
  name,
  widgetOrder: [...DEFAULT_ORDER],
  visibleWidgets: [...DEFAULT_VISIBLE],
  widgetSizes: { ...DEFAULT_SIZES }
});

// 저장된 문서를 항상 "페이지 배열" 형태로 정규화한다.
// 페이지 이전 버전(최상위 widgetOrder 하나만 있던 구조)은 '기본' 페이지 한 장으로 승격.
const reconcilePages = (raw) => {
  let changed = false;
  let list = Array.isArray(raw?.pages) && raw.pages.length > 0 ? raw.pages : null;

  if (!list) {
    list = [{ id: 'default', name: '기본', widgetOrder: raw?.widgetOrder, visibleWidgets: raw?.visibleWidgets, widgetSizes: raw?.widgetSizes }];
    changed = true; // 페이지 구조로 다시 저장해야 함
  }

  const pages = list.slice(0, MAX_PAGES).map((p, i) => {
    const { nextOrder, nextVisible, nextSizes, changed: layoutChanged } = reconcileLayout(p?.widgetOrder, p?.visibleWidgets, p?.widgetSizes);
    const id = typeof p?.id === 'string' && p.id ? p.id : (i === 0 ? 'default' : newPageId());
    const name = typeof p?.name === 'string' && p.name.trim() ? p.name : `페이지 ${i + 1}`;
    if (layoutChanged || id !== p?.id || name !== p?.name) changed = true;
    return { id, name, widgetOrder: nextOrder, visibleWidgets: nextVisible, widgetSizes: nextSizes };
  });

  if (list.length > MAX_PAGES) changed = true;
  return { pages, changed };
};

export const useWidgetLayout = (userId) => {
  const initial = (() => {
    const cached = JSON.parse(localStorage.getItem(`pages_${userId}`) || 'null');
    // 페이지 이전 버전의 로컬 캐시도 흡수한다
    const legacy = cached ? null : {
      widgetOrder: JSON.parse(localStorage.getItem(`order_${userId}`) || 'null'),
      visibleWidgets: JSON.parse(localStorage.getItem(`visible_${userId}`) || 'null'),
      widgetSizes: JSON.parse(localStorage.getItem(`sizes_${userId}`) || 'null')
    };
    const { pages } = reconcilePages(cached ? { pages: cached } : legacy);
    const savedActive = localStorage.getItem(`activePage_${userId}`);
    return { pages, activePageId: pages.some(p => p.id === savedActive) ? savedActive : pages[0].id };
  })();

  const [pages, setPages] = useState(initial.pages);
  // 활성 페이지는 기기별 로컬 값이다 — 회사 PC와 집 PC가 서로 다른 페이지를 열어둘 수 있게.
  const [activePageId, setActivePageId] = useState(initial.activePageId);

  // ---- 컴팩트(모바일) 모드 ----
  // 좁은 화면·터치 기기면 자동으로 켜지되, 사용자가 Dock 버튼으로 끄고 켠 값은 존중한다.
  // override: null=자동 따라감 | true/false=수동 고정. 기기별 값이라 localStorage.
  const readCompactOverride = () => {
    const v = localStorage.getItem(`compact_${userId}`);
    return v === '1' ? true : v === '0' ? false : null;
  };
  const detectCompact = () => typeof window !== 'undefined'
    && window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;

  const [compactOverride, setCompactOverride] = useState(readCompactOverride);
  const [autoCompact, setAutoCompact] = useState(detectCompact);
  const compactMode = compactOverride ?? autoCompact;

  // 터치로 스크롤하려다 위젯이 드래그로 잡히는 걸 막는다:
  // 컴팩트 모드에서는 기본을 '잠금'으로 둬서 카드가 draggable 이 되지 않게 한다.
  const [lockOverride, setLockOverride] = useState(null); // null=모드 기본값 따라감
  const isLocked = lockOverride ?? compactMode;
  const setIsLocked = (v) => setLockOverride(v);

  const [draggingId, setDraggingId] = useState(null);
  const [resizeTarget, setResizeTarget] = useState(null);
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  // 드래그 중에는 상태를 즉시 읽어야 해서 최신 pages 를 ref 로도 들고 있는다
  const pagesRef = useRef(pages);
  useEffect(() => { pagesRef.current = pages; }, [pages]);

  // 💡 핵심 로직: 현재 화면의 해상도(너비)를 실시간으로 추적합니다.
  const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => { setScreenWidth(window.innerWidth); setAutoCompact(detectCompact()); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // uid 는 로그인/로그아웃 시 DashboardContent 가 통째로 리마운트되며 바뀌므로
  // (마운트된 동안엔 고정) 초기 useState 로 읽은 값이면 충분하다.

  // 컴팩트 모드를 명시적으로 토글 → 그 기기에 고정 저장. 잠금은 모드 기본값으로 되돌린다.
  const toggleCompact = () => {
    const next = !compactMode;
    setCompactOverride(next);
    setLockOverride(null);
    if (userId) localStorage.setItem(`compact_${userId}`, next ? '1' : '0');
  };

  const activePage = pages.find(p => p.id === activePageId) || pages[0];
  const { widgetOrder, widgetSizes, visibleWidgets } = activePage;

  // 💡 핵심 로직: 기기 화면(PC, 태블릿, 모바일)에 맞춰 위젯 크기를 자동 최적화하는 함수
  const getResponsiveSize = (id) => {
    const originalSize = widgetSizes[id] || DEFAULT_SIZES[id];
    // 컴팩트 모드는 바깥 패딩이 더 좁다(양옆 16px). 일반은 32px.
    const padding = compactMode ? 32 : 64;
    const maxWidth = screenWidth - padding;

    if (compactMode) {
      // 컴팩트 모드: 화면 폭과 무관하게 한 줄에 하나씩, 폭을 꽉 채워 세로로 쌓는다.
      // 높이는 원래 값을 쓰되 너무 큰 위젯이 화면을 다 먹지 않도록 상한을 둔다.
      return { width: maxWidth, height: Math.min(originalSize.height, 420) };
    }

    // 갤럭시 탭 & PC 환경: 원래 크기를 유지하되, 화면 바깥으로 넘치지 않도록 방어(Math.min)
    return {
      width: Math.min(originalSize.width, maxWidth),
      height: originalSize.height
    };
  };

  const savePages = async (nextPages) => {
    if (!userId) return;
    localStorage.setItem(`pages_${userId}`, JSON.stringify(nextPages));
    try {
      await setDoc(doc(db, "users", userId, "dashboard", "layoutConfig"), {
        pages: nextPages,
        // 페이지 이전 구조의 최상위 필드는 승격이 끝났으므로 정리한다
        widgetOrder: deleteField(), widgetSizes: deleteField(), visibleWidgets: deleteField()
      }, { merge: true });
    } catch {
      toast('레이아웃 저장에 실패했습니다. 인터넷 연결을 확인해 주세요.');
    }
  };

  useEffect(() => {
    if (!db || !userId) return;
    const layoutConfigRef = doc(db, "users", userId, "dashboard", "layoutConfig");
    const unsubscribe = onSnapshot(layoutConfigRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const { pages: nextPages, changed } = reconcilePages(docSnap.data());
      setPages(nextPages);
      pagesRef.current = nextPages;
      // 다른 기기에서 열려 있던 페이지가 지워졌으면 첫 페이지로 되돌린다
      setActivePageId(prev => (nextPages.some(p => p.id === prev) ? prev : nextPages[0].id));
      // 예전/불완전한 레이아웃이면 정리된 버전을 다시 저장
      if (changed) savePages(nextPages);
    });
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (userId) localStorage.setItem(`activePage_${userId}`, activePageId);
  }, [userId, activePageId]);

  // 활성 페이지만 갈아끼우고 저장한다.
  // patch 는 함수도 받는다 — 렌더 사이에 연달아 호출돼도 최신 페이지(pagesRef) 기준으로 계산되도록.
  const commitActivePage = (patch, { persist = true } = {}) => {
    const next = pagesRef.current.map(p => (p.id === activePage.id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p));
    pagesRef.current = next;
    setPages(next);
    if (persist) savePages(next);
    return next;
  };

  const commitPages = (next) => {
    pagesRef.current = next;
    setPages(next);
    savePages(next);
    return next;
  };

  // ---- 페이지 조작 ----
  const switchPage = (id) => { if (pages.some(p => p.id === id)) setActivePageId(id); };

  const createPage = (name) => {
    if (pages.length >= MAX_PAGES) { toast(`페이지는 최대 ${MAX_PAGES}개까지 만들 수 있습니다.`); return; }
    const page = makePage((name || '').trim() || `페이지 ${pages.length + 1}`);
    commitPages([...pagesRef.current, page]);
    setActivePageId(page.id);
  };

  const duplicatePage = (id) => {
    if (pages.length >= MAX_PAGES) { toast(`페이지는 최대 ${MAX_PAGES}개까지 만들 수 있습니다.`); return; }
    const src = pagesRef.current.find(p => p.id === id);
    if (!src) return;
    const copy = { ...src, id: newPageId(), name: `${src.name} 복사본`, widgetOrder: [...src.widgetOrder], visibleWidgets: [...src.visibleWidgets], widgetSizes: { ...src.widgetSizes } };
    commitPages([...pagesRef.current, copy]);
    setActivePageId(copy.id);
  };

  const renamePage = (id, name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    commitPages(pagesRef.current.map(p => (p.id === id ? { ...p, name: trimmed } : p)));
  };

  const deletePage = (id) => {
    if (pagesRef.current.length <= 1) { toast('마지막 페이지는 삭제할 수 없습니다.'); return; }
    const idx = pagesRef.current.findIndex(p => p.id === id);
    const next = pagesRef.current.filter(p => p.id !== id);
    commitPages(next);
    if (id === activePageId) setActivePageId(next[Math.min(idx, next.length - 1)].id);
  };

  // ---- 위젯 조작 (활성 페이지 기준) ----
  const toggleWidgetVisibility = (id) => {
    commitActivePage(page => ({
      visibleWidgets: page.visibleWidgets.includes(id)
        ? page.visibleWidgets.filter(wId => wId !== id)
        : [...page.visibleWidgets, id]
    }));
  };

  const resetLayout = () => {
    commitActivePage({ widgetOrder: [...DEFAULT_ORDER], visibleWidgets: [...DEFAULT_VISIBLE], widgetSizes: { ...DEFAULT_SIZES } });
  };

  const handleDragStart = (id) => { if (!resizeTarget && !isLocked) setDraggingId(id); };
  const handleDragOver = (e) => e.preventDefault();
  const handleDragEnd = () => setDraggingId(null);
  const handleDrop = (targetId) => {
    if (isLocked || !draggingId || draggingId === targetId) return;
    setDraggingId(null);
    commitActivePage(page => {
      const currentOrder = [...page.widgetOrder];
      const dragIdx = currentOrder.indexOf(draggingId);
      const targetIdx = currentOrder.indexOf(targetId);
      if (dragIdx < 0 || targetIdx < 0) return {};

      currentOrder[dragIdx] = targetId;
      currentOrder[targetIdx] = draggingId;
      return { widgetOrder: currentOrder };
    });
  };

  const initResize = (e, id) => {
    if (isLocked) return;
    e.preventDefault(); e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setResizeTarget(id);
    setStartSize({ ...(widgetSizes[id] || DEFAULT_SIZES[id]) });
    setStartPos({ x: clientX, y: clientY });
  };

  useEffect(() => {
    const doResize = (e) => {
      if (!resizeTarget || isLocked) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const maxWidth = screenWidth - 64; // 최대치 제한 보정

      // 드래그 중에는 저장하지 않는다 (놓을 때 한 번만 저장)
      commitActivePage(page => ({
        widgetSizes: {
          ...page.widgetSizes,
          [resizeTarget]: {
            width: Math.min(maxWidth, Math.max(260, startSize.width + (clientX - startPos.x))),
            height: Math.max(220, startSize.height + (clientY - startPos.y))
          }
        }
      }), { persist: false });
    };

    const stopResize = () => {
      if (resizeTarget) savePages(pagesRef.current);
      setResizeTarget(null);
    };

    if (resizeTarget && !isLocked) {
      window.addEventListener('mousemove', doResize); window.addEventListener('mouseup', stopResize);
      window.addEventListener('touchmove', doResize); window.addEventListener('touchend', stopResize);
    }
    return () => {
      window.removeEventListener('mousemove', doResize); window.removeEventListener('mouseup', stopResize);
      window.removeEventListener('touchmove', doResize); window.removeEventListener('touchend', stopResize);
    };
  }, [resizeTarget, startPos, startSize, isLocked, screenWidth, activePageId]);

  return {
    // 활성 페이지의 배치
    widgetOrder, widgetSizes, visibleWidgets, draggingId, resizeTarget, isLocked,
    setIsLocked, toggleWidgetVisibility, resetLayout, getResponsiveSize,
    handleDragStart, handleDragOver, handleDragEnd, handleDrop, initResize,
    // 컴팩트(모바일) 모드
    compactMode, toggleCompact,
    // 페이지
    pages, activePageId, activePage, switchPage, createPage, duplicatePage, renamePage, deletePage
  };
};
