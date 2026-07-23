// hooks/useWidgetLayout.js
import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from '../components/Toast';

const DEFAULT_ORDER = ['clock', 'weather', 'quote', 'calendar', 'memo', 'mindmap'];
const DEFAULT_SIZES = {
  clock: { width: 380, height: 240 }, weather: { width: 320, height: 260 },
  quote: { width: 360, height: 240 }, calendar: { width: 720, height: 380 },
  memo: { width: 360, height: 320 }, mindmap: { width: 360, height: 260 }
};

// 제거된 위젯 + 통합 마이그레이션. 저장된 예전 레이아웃을 현재 위젯 세트에 맞게 정리한다.
const REMOVED = ['workflow', 'scheduler'];
const reconcileLayout = (order, visible, sizes) => {
  const safeOrder = Array.isArray(order) ? order : DEFAULT_ORDER;
  const safeVisible = Array.isArray(visible) ? visible : DEFAULT_ORDER;
  const wasPreUpgrade = safeOrder.some(id => REMOVED.includes(id));

  const knownOrder = safeOrder.filter(id => DEFAULT_ORDER.includes(id));
  const newIds = DEFAULT_ORDER.filter(id => !safeOrder.includes(id)); // 새로 추가된 위젯
  const nextOrder = [...knownOrder, ...newIds];

  const knownVisible = safeVisible.filter(id => DEFAULT_ORDER.includes(id));
  const nextVisible = [...knownVisible, ...newIds]; // 새 위젯은 기본 표시

  let nextSizes = { ...DEFAULT_SIZES, ...(sizes || {}) };
  // 캘린더가 스케줄러와 통합되어 더 넓은 공간이 필요 → 예전 레이아웃이면 크기 재설정
  if (wasPreUpgrade) nextSizes = { ...nextSizes, calendar: DEFAULT_SIZES.calendar };

  const changed = wasPreUpgrade || newIds.length > 0 || nextOrder.length !== safeOrder.length || nextVisible.length !== safeVisible.length;
  return { nextOrder, nextVisible, nextSizes, changed };
};

export const useWidgetLayout = (userId) => {
  const initial = (() => {
    const order = JSON.parse(localStorage.getItem(`order_${userId}`) || 'null');
    const visible = JSON.parse(localStorage.getItem(`visible_${userId}`) || 'null');
    const sizes = JSON.parse(localStorage.getItem(`sizes_${userId}`) || 'null');
    return reconcileLayout(order, visible, sizes);
  })();

  const [widgetOrder, setWidgetOrder] = useState(initial.nextOrder);
  const [widgetSizes, setWidgetSizes] = useState(initial.nextSizes);
  const [visibleWidgets, setVisibleWidgets] = useState(initial.nextVisible);

  const [isLocked, setIsLocked] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [resizeTarget, setResizeTarget] = useState(null);
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  // 💡 핵심 로직: 현재 화면의 해상도(너비)를 실시간으로 추적합니다.
  const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 💡 핵심 로직: 기기 화면(PC, 태블릿, 모바일)에 맞춰 위젯 크기를 자동 최적화하는 함수
  const getResponsiveSize = (id) => {
    const originalSize = widgetSizes[id] || DEFAULT_SIZES[id];
    const padding = 64; // 화면 양옆 여백(32px * 2)
    const maxWidth = screenWidth - padding;

    if (screenWidth < 768) {
      // 스마트폰 환경: 가로 공간이 좁으므로 모든 위젯을 100% 꽉 차게 배열
      return { width: maxWidth, height: originalSize.height };
    }

    // 갤럭시 탭 & PC 환경: 원래 크기를 유지하되, 화면 바깥으로 넘치지 않도록 방어(Math.min)
    return {
      width: Math.min(originalSize.width, maxWidth),
      height: originalSize.height
    };
  };

  useEffect(() => {
    if (!db || !userId) return;
    const layoutConfigRef = doc(db, "users", userId, "dashboard", "layoutConfig");
    const unsubscribe = onSnapshot(layoutConfigRef, (docSnap) => {
      if (docSnap.exists()) {
        const remoteData = docSnap.data();
        const { nextOrder, nextVisible, nextSizes, changed } = reconcileLayout(
          remoteData?.widgetOrder, remoteData?.visibleWidgets, remoteData?.widgetSizes
        );
        setWidgetOrder(nextOrder);
        setVisibleWidgets(nextVisible);
        setWidgetSizes(nextSizes);
        // 예전/불완전한 레이아웃이면 정리된 버전을 다시 저장
        if (changed) saveLayoutToFirestore(nextOrder, nextSizes, nextVisible);
      }
    });
    return () => unsubscribe();
  }, [userId]);

  const saveLayoutToFirestore = async (newOrder, newSizes, newVisible) => {
    if (!userId) return;
    localStorage.setItem(`order_${userId}`, JSON.stringify(newOrder));
    localStorage.setItem(`sizes_${userId}`, JSON.stringify(newSizes));
    localStorage.setItem(`visible_${userId}`, JSON.stringify(newVisible));
    try {
      await setDoc(doc(db, "users", userId, "dashboard", "layoutConfig"), {
        widgetOrder: newOrder, widgetSizes: newSizes, visibleWidgets: newVisible
      }, { merge: true });
    } catch (err) {
      toast('레이아웃 저장에 실패했습니다. 인터넷 연결을 확인해 주세요.');
    }
  };

  const toggleWidgetVisibility = (id) => {
    const newVisible = visibleWidgets.includes(id) 
      ? visibleWidgets.filter(wId => wId !== id) 
      : [...visibleWidgets, id];
    setVisibleWidgets(newVisible);
    saveLayoutToFirestore(widgetOrder, widgetSizes, newVisible);
  };

  const resetLayout = () => {
    setWidgetOrder(DEFAULT_ORDER);
    setWidgetSizes(DEFAULT_SIZES);
    setVisibleWidgets(DEFAULT_ORDER);
    saveLayoutToFirestore(DEFAULT_ORDER, DEFAULT_SIZES, DEFAULT_ORDER);
  };

  const handleDragStart = (id) => { if (!resizeTarget && !isLocked) setDraggingId(id); };
  const handleDragOver = (e) => e.preventDefault();
  const handleDragEnd = () => setDraggingId(null);
  const handleDrop = (targetId) => {
    if (isLocked || !draggingId || draggingId === targetId) return;
    const currentOrder = [...widgetOrder];
    const dragIdx = currentOrder.indexOf(draggingId);
    const targetIdx = currentOrder.indexOf(targetId);
    
    currentOrder[dragIdx] = targetId; 
    currentOrder[targetIdx] = draggingId;
    
    setWidgetOrder(currentOrder); 
    setDraggingId(null);
    saveLayoutToFirestore(currentOrder, widgetSizes, visibleWidgets); 
  };

  const initResize = (e, id) => {
    if (isLocked) return;
    e.preventDefault(); e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setResizeTarget(id);
    setStartSize({ width: widgetSizes[id].width, height: widgetSizes[id].height });
    setStartPos({ x: clientX, y: clientY });
  };

  useEffect(() => {
    const doResize = (e) => {
      if (!resizeTarget || isLocked) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const maxWidth = screenWidth - 64; // 최대치 제한 보정
      
      setWidgetSizes(prev => ({
        ...prev,
        [resizeTarget]: { 
          width: Math.min(maxWidth, Math.max(260, startSize.width + (clientX - startPos.x))), 
          height: Math.max(220, startSize.height + (clientY - startPos.y)) 
        }
      }));
    };

    const stopResize = () => { 
      if (resizeTarget) saveLayoutToFirestore(widgetOrder, widgetSizes, visibleWidgets); 
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
  }, [resizeTarget, startPos, startSize, widgetOrder, widgetSizes, visibleWidgets, isLocked, screenWidth]);

  return {
    widgetOrder, widgetSizes, visibleWidgets, draggingId, resizeTarget, isLocked,
    setIsLocked, toggleWidgetVisibility, resetLayout, getResponsiveSize,
    handleDragStart, handleDragOver, handleDragEnd, handleDrop, initResize
  };
};