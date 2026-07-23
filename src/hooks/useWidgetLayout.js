// hooks/useWidgetLayout.js
import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from '../components/Toast';

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

  const [visibleWidgets, setVisibleWidgets] = useState(() => {
    const saved = localStorage.getItem(`visible_${userId}`);
    return saved ? JSON.parse(saved) : DEFAULT_ORDER;
  });

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