// hooks/useWidgetLayout.js
import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const useWidgetLayout = (userId) => {
  // 💡 핵심 요약: 로컬스토리지에서 초기값을 가져오고, Firebase와 동기화합니다.
  const [widgetOrder, setWidgetOrder] = useState(() => {
    const saved = localStorage.getItem(`order_${userId}`);
    return saved ? JSON.parse(saved) : ['clock', 'weather', 'workflow', 'calendar', 'scheduler', 'memo', 'mindmap'];
  });

  const [widgetSizes, setWidgetSizes] = useState(() => {
    const saved = localStorage.getItem(`sizes_${userId}`);
    return saved ? JSON.parse(saved) : {
      clock: { width: 360, height: 260 }, weather: { width: 320, height: 260 },
      workflow: { width: 664, height: 340 }, calendar: { width: 360, height: 260 },
      scheduler: { width: 320, height: 260 }, memo: { width: 320, height: 260 }, 
      mindmap: { width: 360, height: 260 }
    };
  });

  const [draggingId, setDraggingId] = useState(null);
  const [resizeTarget, setResizeTarget] = useState(null);
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  // 💡 핵심 요약: Firebase에서 레이아웃 변경사항을 실시간으로 수신합니다.
  useEffect(() => {
    if (!db || !userId) return;
    const layoutConfigRef = doc(db, "users", userId, "dashboard", "layoutConfig");
    const unsubscribe = onSnapshot(layoutConfigRef, (docSnap) => {
      if (docSnap.exists()) {
        const remoteData = docSnap.data();
        if (remoteData?.widgetOrder) setWidgetOrder(remoteData.widgetOrder);
        if (remoteData?.widgetSizes) setWidgetSizes(remoteData.widgetSizes);
      }
    });
    return () => unsubscribe();
  }, [userId]);

  const saveLayoutToFirestore = async (newOrder, newSizes) => {
    if (!userId) return;
    localStorage.setItem(`order_${userId}`, JSON.stringify(newOrder));
    localStorage.setItem(`sizes_${userId}`, JSON.stringify(newSizes));
    try { 
      await setDoc(doc(db, "users", userId, "dashboard", "layoutConfig"), { widgetOrder: newOrder, widgetSizes: newSizes }, { merge: true }); 
    } catch (err) { console.error(err); }
  };

  // 드래그 앤 드롭 로직
  const handleDragStart = (id) => { if (!resizeTarget) setDraggingId(id); };
  const handleDragOver = (e) => e.preventDefault();
  const handleDragEnd = () => setDraggingId(null);
  const handleDrop = (targetId) => {
    if (!draggingId || draggingId === targetId) return;
    const currentOrder = [...widgetOrder];
    const dragIdx = currentOrder.indexOf(draggingId);
    const targetIdx = currentOrder.indexOf(targetId);
    
    // 위치 교환
    currentOrder[dragIdx] = targetId; 
    currentOrder[targetIdx] = draggingId;
    
    setWidgetOrder(currentOrder); 
    setDraggingId(null);
    saveLayoutToFirestore(currentOrder, widgetSizes); 
  };

  // 리사이즈(크기 조절) 로직
  const initResize = (e, id) => {
    e.preventDefault(); e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setResizeTarget(id);
    setStartSize({ width: widgetSizes[id].width, height: widgetSizes[id].height });
    setStartPos({ x: clientX, y: clientY });
  };

  useEffect(() => {
    const doResize = (e) => {
      if (!resizeTarget) return;
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
      if (resizeTarget) saveLayoutToFirestore(widgetOrder, widgetSizes); 
      setResizeTarget(null); 
    };
    
    if (resizeTarget) {
      window.addEventListener('mousemove', doResize); window.addEventListener('mouseup', stopResize);
      window.addEventListener('touchmove', doResize); window.addEventListener('touchend', stopResize);
    }
    return () => {
      window.removeEventListener('mousemove', doResize); window.removeEventListener('mouseup', stopResize);
      window.removeEventListener('touchmove', doResize); window.removeEventListener('touchend', stopResize);
    };
  }, [resizeTarget, startPos, startSize, widgetOrder, widgetSizes]);

  return {
    widgetOrder, widgetSizes, draggingId, resizeTarget,
    handleDragStart, handleDragOver, handleDragEnd, handleDrop, initResize
  };
};