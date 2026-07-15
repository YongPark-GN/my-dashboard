// hooks/useWidgetLayout.js
import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// 기본 설정값 분리 (초기화 기능에 사용)
const DEFAULT_ORDER = ['clock', 'weather', 'workflow', 'calendar', 'scheduler', 'memo', 'mindmap'];
const DEFAULT_SIZES = {
  clock: { width: 360, height: 260 }, weather: { width: 320, height: 260 },
  workflow: { width: 664, height: 340 }, calendar: { width: 360, height: 260 },
  scheduler: { width: 320, height: 260 }, memo: { width: 320, height: 260 }, 
  mindmap: { width: 360, height: 260 }
};

export const useWidgetLayout = (userId) => {
  const [widgetOrder, setWidgetOrder] = useState(() => {
    const saved = localStorage.getItem(`order_${userId}`);
    return saved ? JSON.parse(saved) : DEFAULT_ORDER;
  });

  const [widgetSizes, setWidgetSizes] = useState(() => {
    const saved = localStorage.getItem(`sizes_${userId}`);
    return saved ? JSON.parse(saved) : DEFAULT_SIZES;
  });

  // 👈 핵심 로직: 화면에 보여줄 위젯의 목록 (기본값은 전체 표시)
  const [visibleWidgets, setVisibleWidgets] = useState(() => {
    const saved = localStorage.getItem(`visible_${userId}`);
    return saved ? JSON.parse(saved) : DEFAULT_ORDER;
  });

  // 👈 핵심 로직: 레이아웃 잠금 상태 관리
  const [isLocked, setIsLocked] = useState(false);

  const [draggingId, setDraggingId] = useState(null);
  const [resizeTarget, setResizeTarget] = useState(null);
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!db || !userId) return;
    const layoutConfigRef = doc(db, "users", userId, "dashboard", "layoutConfig");
    const unsubscribe = onSnapshot(layoutConfigRef, (docSnap) => {
      if (docSnap.exists()) {
        const remoteData = docSnap.data();
        if (remoteData?.widgetOrder) setWidgetOrder(remoteData.widgetOrder);
        if (remoteData?.widgetSizes) setWidgetSizes(remoteData.widgetSizes);
        if (remoteData?.visibleWidgets) setVisibleWidgets(remoteData.visibleWidgets);
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
    } catch (err) { console.error(err); }
  };

  // 👈 핵심 기능: 특정 위젯 끄고 켜기
  const toggleWidgetVisibility = (id) => {
    const newVisible = visibleWidgets.includes(id) 
      ? visibleWidgets.filter(wId => wId !== id) 
      : [...visibleWidgets, id];
    setVisibleWidgets(newVisible);
    saveLayoutToFirestore(widgetOrder, widgetSizes, newVisible);
  };

  // 👈 핵심 기능: 레이아웃 기본값으로 완전 초기화
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
    if (isLocked) return; // 잠금 시 리사이즈 무시
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
      setWidgetSizes(prev => ({
        ...prev,
        [resizeTarget]: { 
          width: Math.max(260, startSize.width + (clientX - startPos.x)), 
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
  }, [resizeTarget, startPos, startSize, widgetOrder, widgetSizes, visibleWidgets, isLocked]);

  return {
    widgetOrder, widgetSizes, visibleWidgets, draggingId, resizeTarget, isLocked,
    setIsLocked, toggleWidgetVisibility, resetLayout,
    handleDragStart, handleDragOver, handleDragEnd, handleDrop, initResize
  };
};