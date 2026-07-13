import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; 
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import MindMapWidget from './components/MindMapWidget';

// 파이어베이스 DB 인스턴스 및 라이브러리 메서드 로드
import { db } from './firebase';
import { doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';

const iosLiquidGlassTheme = `
  body { 
    margin: 0; 
    background-color: #000000; 
    color: #ffffff; 
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    letter-spacing: -0.3px;
    width: 100vw;
    overflow-x: hidden;
  }
  .react-calendar { background: transparent !important; color: #ffffff !important; border: none !important; width: 100% !important; font-family: inherit; }
  .react-calendar abbr { text-decoration: none !important; border-bottom: none !important; cursor: default; }
  .react-calendar__navigation button { color: #ffffff !important; min-width: 30px; background: none; font-size: 13px; font-weight: 500; }
  .react-calendar__navigation button:enabled:hover { background-color: rgba(255,255,255,0.06); border-radius: 6px; }
  .react-calendar__month-view__weekdays { color: rgba(255,255,255,0.3) !important; text-transform: uppercase; font-weight: 600; font-size: 0.7rem; letter-spacing: 0.5px; padding-bottom: 8px; }
  .react-calendar__tile { color: #ffffff !important; background: none; border: none; padding: 10px 0; font-size: 0.85rem; position: relative; }
  .react-calendar__tile:enabled:hover { background-color: rgba(255,255,255,0.08) !important; border-radius: 12px; }
  .react-calendar__tile--now { background: rgba(255,255,255,0.15) !important; border-radius: 12px; font-weight: 600; }
  .react-calendar__tile--active { background: #007aff !important; color: white !important; border-radius: 12px !important; }
  
  .sat-tile { color: #30a9ff !important; }
  .sun-tile { color: #ff3b30 !important; }

  .ios-resize-trigger { position: absolute; right: 8px; bottom: 8px; width: 12px; height: 12px; cursor: se-resize; z-index: 15; }
  .ios-resize-trigger::after { content: ""; position: absolute; right: 2px; bottom: 2px; width: 4px; height: 4px; border-right: 2px solid rgba(255, 255, 255, 0.25); border-bottom: 2px solid rgba(255, 255, 255, 0.25); }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 2px; }
`;

if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.innerHTML = iosLiquidGlassTheme;
  document.head.appendChild(styleTag);
}

const iosLiquidGlassWidget = {
  background: 'linear-gradient(135deg, rgba(32, 32, 36, 0.7) 0%, rgba(16, 16, 18, 0.75) 100%)',
  backdropFilter: 'blur(40px) saturate(200%)',
  WebkitBackdropFilter: 'blur(40px) saturate(200%)',
  borderRadius: '28px', 
  padding: '20px',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.15), 0 8px 32px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2)',
  color: '#ffffff',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  overflow: 'hidden',
  position: 'relative',
  transition: 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.2s, opacity 0.2s',
  cursor: 'grab'
};

const WEATHER_API_KEY = "2cabd2173d9f6036bf418d61e79b48f8";

const getAqiStatus = (aqi) => {
  switch(aqi) {
    case 1: return { label: "좋음", color: "#34c759" }; 
    case 2: return { label: "보통", color: "#ffcc00" }; 
    case 3: return { label: "주의", color: "#ff9500" }; 
    case 4: return { label: "나쁨", color: "#ff3b30" }; 
    case 5: return { label: "위험", color: "#af52de" }; 
    default: return { label: "정보 없음", color: "#8e8e93" };
  }
};

const STAGES = [
  { id: 'plan', label: '기획' },
  { id: 'design', label: '설계' },
  { id: 'simulation', label: '해석' },
  { id: 'done', label: '완료' }
];

function DashboardContent() {
  const [time, setTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [weatherData, setWeatherData] = useState({ weather: null, pollution: null });
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState(null);

  // 한글 주석: 마인드맵 팝업 격리 해제용 최상위 호이스팅 공용 상태 설정
  const [isMindMapOpen, setIsMindMapOpen] = useState(false);
  const [currentMindMap, setCurrentMindMap] = useState(null);
  const [inputModal, setInputModal] = useState({ isOpen: false, nodeId: null, text: '', mode: 'add' });

  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('dashboard_tasks');
    return saved ? JSON.parse(saved) : [
      { id: 't1', title: '527mm Enclosure 구조해석 및 압력 검토', stage: 'simulation', progress: 75 },
      { id: 't2', title: '10-BAY GIS 가스 계통도 CAD 도면 설계', stage: 'design', progress: 40 },
      { id: 't3', title: 'M30 앵커 볼트 전단 강도 스펙 수립', stage: 'plan', progress: 10 }
    ];
  });
  
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const [widgetOrder, setWidgetOrder] = useState(() => {
    const saved = localStorage.getItem('dashboard_widget_order');
    return saved ? JSON.parse(saved) : ['clock', 'weather', 'workflow', 'calendar', 'scheduler', 'mindmap'];
  });

  const [widgetSizes, setWidgetSizes] = useState(() => {
    const saved = localStorage.getItem('dashboard_widget_sizes');
    return saved ? JSON.parse(saved) : {
      clock: { width: 360, height: 260 }, 
      weather: { width: 320, height: 260 },
      workflow: { width: 664, height: 340 },
      calendar: { width: 360, height: 260 },
      scheduler: { width: 320, height: 260 },
      mindmap: { width: 360, height: 260 } 
    };
  });

  const [draggingId, setDraggingId] = useState(null);
  const [resizeTarget, setResizeTarget] = useState(null);
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    try {
      if (!db) return;

      const layoutConfigRef = doc(db, "dashboard", "layoutConfig");
      const unsubscribeLayout = onSnapshot(layoutConfigRef, (docSnap) => {
        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          if (remoteData?.widgetOrder) {
            setWidgetOrder(remoteData.widgetOrder);
            localStorage.setItem('dashboard_widget_order', JSON.stringify(remoteData.widgetOrder));
          }
          if (remoteData?.widgetSizes) {
            setWidgetSizes(remoteData.widgetSizes);
            localStorage.setItem('dashboard_widget_sizes', JSON.stringify(remoteData.widgetSizes));
          }
        }
      }, (error) => {
        console.warn("Firestore 레이아웃 접근 제한 우회:", error.message);
      });

      const tasksRef = doc(db, "dashboard", "taskData");
      const unsubscribeTasks = onSnapshot(tasksRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data()?.list) {
          setTasks(docSnap.data().list);
          localStorage.setItem('dashboard_tasks', JSON.stringify(docSnap.data().list));
        }
      }, (error) => {
        console.warn("Firestore 태스크 접근 제한 우회:", error.message);
      });

      return () => {
        unsubscribeLayout();
        unsubscribeTasks();
      };
    } catch (e) {
      console.error("Firebase 로드 에러 우회:", e);
    }
  }, []);

  // 한글 주석: 팝업창 내부 실시간 Firestore 리스너 연동 회로 수립
  useEffect(() => {
    if (!isMindMapOpen || !currentMindMap?.id) return;
    const unsubscribe = onSnapshot(doc(db, 'mindmaps', currentMindMap.id), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentMindMap({ id: docSnap.id, ...docSnap.data() });
      }
    });
    return () => unsubscribe();
  }, [isMindMapOpen]);

  const saveLayoutToFirestore = async (newOrder, newSizes) => {
    localStorage.setItem('dashboard_widget_order', JSON.stringify(newOrder));
    localStorage.setItem('dashboard_widget_sizes', JSON.stringify(newSizes));
    try {
      if (!db) return;
      await setDoc(doc(db, "dashboard", "layoutConfig"), {
        widgetOrder: newOrder,
        widgetSizes: newSizes
      }, { merge: true });
    } catch (err) {
      console.error("Firestore 레이아웃 백업 실패:", err);
    }
  };

  const saveTasksToFirestore = async (newTaskList) => {
    localStorage.setItem('dashboard_tasks', JSON.stringify(newTaskList));
    try {
      if (!db) return;
      await setDoc(doc(db, "dashboard", "taskData"), { list: newTaskList });
    } catch (err) {
      console.error("Firestore 태스크 백업 실패:", err);
    }
  };

  const handleDragStart = (id) => {
    if (resizeTarget) return;
    setDraggingId(id);
  };

  const handleDragOver = (e) => { e.preventDefault(); };

  const handleDrop = (targetId) => {
    if (!draggingId || draggingId === targetId) return;
    const currentOrder = [...widgetOrder];
    const dragIdx = currentOrder.indexOf(draggingId);
    const targetIdx = currentOrder.indexOf(targetId);

    currentOrder[dragIdx] = targetId;
    currentOrder[targetIdx] = draggingId;

    setWidgetOrder(currentOrder);
    setDraggingId(null);
    saveLayoutToFirestore(currentOrder, widgetSizes); 
  };

  const handleDragEnd = () => { setDraggingId(null); };

  const initResize = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setResizeTarget(id);
    setStartSize({ width: widgetSizes[id].width, height: widgetSizes[id].height });
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const doResize = (e) => {
      if (!resizeTarget) return;
      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;
      
      const updatedSizes = {
        ...widgetSizes,
        [resizeTarget]: {
          width: Math.max(260, startSize.width + deltaX),
          height: Math.max(220, startSize.height + deltaY)
        }
      };
      setWidgetSizes(updatedSizes);
    };

    const stopResize = () => {
      if (resizeTarget) {
        saveLayoutToFirestore(widgetOrder, widgetSizes); 
      }
      setResizeTarget(null);
    };

    if (resizeTarget) {
      window.addEventListener('mousemove', doResize);
      window.addEventListener('mouseup', stopResize);
    }
    return () => {
      window.removeEventListener('mousemove', doResize);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [resizeTarget, startPos, startSize, widgetOrder, widgetSizes]);

  useEffect(() => {
    const timer = setInterval(() => { setTime(new Date()); }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setWeatherError("위치 접근 불가");
      setWeatherLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const [weatherRes, pollutionRes] = await Promise.all([
            fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${WEATHER_API_KEY}&units=metric&lang=kr`),
            fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${latitude}&lon=${longitude}&appid=${WEATHER_API_KEY}`)
          ]);
          setWeatherData({ weather: await weatherRes.json(), pollution: await pollutionRes.json() });
        } catch (err) { setWeatherError(err.message); } finally { setWeatherLoading(false); }
      },
      () => { setWeatherError("권한 거부됨"); setWeatherLoading(false); }
    );
  }, []);

  const clockFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, 
  });
  const clockParts = clockFormatter.formatToParts(time);
  const hours = clockParts.find(p => p.type === 'hour').value;
  const minutes = clockParts.find(p => p.type === 'minute').value;
  const seconds = clockParts.find(p => p.type === 'second').value;
  const ampm = clockParts.find(p => p.type === 'dayPeriod').value;

  const fetchCalendarEvents = async (token, date) => {
    try {
      const startOfDay = new Date(date.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(date.setHours(23, 59, 59, 999)).toISOString();
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startOfDay}&timeMax=${endOfDay}&orderBy=startTime&singleEvents=true`, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.items) {
        const formattedEvents = data.items.map((item, index) => {
          let eventTime = '종일';
          if (item.start.dateTime) {
            eventTime = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(new Date(item.start.dateTime));
          }
          return { id: index, title: item.summary, time: eventTime };
        });
        setEvents(formattedEvents);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      setIsLoggedIn(true);
      fetchCalendarEvents(tokenResponse.access_token, selectedDate);
    },
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
  });

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    if (isLoggedIn && accessToken) {
      fetchCalendarEvents(accessToken, newDate);
    }
  };

  const moveTaskStage = (taskId, currentStage) => {
    const stageOrder = ['plan', 'design', 'simulation', 'done'];
    const nextIdx = stageOrder.indexOf(currentStage) + 1;
    if (nextIdx >= stageOrder.length) return;

    const updated = tasks.map(t => t.id === taskId ? { 
      ...t, 
      stage: stageOrder[nextIdx],
      progress: nextIdx === 3 ? 100 : Math.min(90, t.progress + 25)
    } : t);
    setTasks(updated);
    saveTasksToFirestore(updated); 
  };

  const addTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const updated = [...tasks, { id: 't_' + Date.now(), title: newTaskTitle, stage: 'plan', progress: 0 }];
    setTasks(updated);
    saveTasksToFirestore(updated); 
    setNewTaskTitle('');
  };

  const todayText = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(selectedDate);

  const tileClassNameGetter = ({ date, view }) => {
    if (view === 'month') {
      const day = date.getDay();
      if (day === 6) return 'sat-tile';
      if (day === 0) return 'sun-tile';
    }
    return null;
  };

  // 한글 주석: 확인 버튼 오작동 수정을 위한 파이어베이스 업로드 파이프라인 연계 함수
  const submitNodeData = async (e) => {
    if (e) e.preventDefault();
    if (!inputModal.text.trim() || !currentMindMap || !currentMindMap.id) return;

    try {
      const docRef = doc(db, 'mindmaps', currentMindMap.id);

      if (inputModal.mode === 'add') {
        const parentNode = currentMindMap.nodes.find(n => n.id === inputModal.nodeId);
        const newId = `node_${Date.now()}`;
        const newNode = {
          id: newId,
          text: inputModal.text,
          x: (parentNode?.x || 250) + 200,
          y: (parentNode?.y || 150) + (Math.random() * 80 - 40)
        };
        const newEdge = { id: `e_${inputModal.nodeId}_${newId}`, source: inputModal.nodeId, target: newId };

        const nextNodes = currentMindMap.nodes ? [...currentMindMap.nodes, newNode] : [newNode];
        const nextEdges = currentMindMap.edges ? [...currentMindMap.edges, newEdge] : [newEdge];

        await updateDoc(docRef, { nodes: nextNodes, edges: nextEdges });
      } else if (inputModal.mode === 'edit') {
        const updatedNodes = currentMindMap.nodes.map(node => 
          node.id === inputModal.nodeId ? { ...node, text: inputModal.text } : node
        );
        await updateDoc(docRef, { nodes: updatedNodes });
      }

      setInputModal({ isOpen: false, nodeId: null, text: '', mode: 'add' });
    } catch (error) {
      console.error("Firestore 저장 실패:", error);
    }
  };

  const handleDeleteNode = async (nodeId) => {
    if (nodeId === 'root') return alert('중심 블록은 삭제할 수 없습니다.');
    if (!confirm('이 블록을 삭제하시겠습니까?')) return;

    const updatedNodes = currentMindMap.nodes.filter(node => node.id !== nodeId);
    const updatedEdges = currentMindMap.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId);

    await updateDoc(doc(db, 'mindmaps', currentMindMap.id), {
      nodes: updatedNodes,
      edges: updatedEdges
    });
  };

  const renderWidgetContent = (id) => {
    switch (id) {
      case 'clock':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <div style={{ fontSize: '3.8rem', fontWeight: '700', fontFamily: 'monospace', letterSpacing: '0.5px', lineHeight: '1', color: '#ffffff' }}>
              {hours}:{minutes}<span style={{ fontSize: '2.5rem', color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>{seconds}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginLeft: '14px', fontSize: '0.9rem', fontWeight: '700' }}>
              <span style={{ color: ampm === 'AM' ? '#ffffff' : 'rgba(255,255,255,0.15)', marginBottom: '2px' }}>AM</span>
              <span style={{ color: ampm === 'PM' ? '#ffffff' : 'rgba(255,255,255,0.15)' }}>PM</span>
            </div>
          </div>
        );
      case 'weather':
        return weatherLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>날씨 동기화 중...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '2.8rem', fontWeight: '200', color: '#ffffff', lineHeight: '1' }}>{Math.round(weatherData.weather.main.temp)}°</div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginTop: '6px' }}>{weatherData.weather.weather[0].description}</div>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '10px' }}>
                {weatherData.weather.name}
              </span>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px', marginTop: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>대기질</span>
                <span style={{ fontWeight: '600', color: getAqiStatus(weatherData.pollution.list[0].main.aqi).color }}>{getAqiStatus(weatherData.pollution.list[0].main.aqi).label}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                <div>PM10 <span>{Math.round(weatherData.pollution.list[0].components.pm10)}</span></div>
                <div>PM2.5 <span>{Math.round(weatherData.pollution.list[0].components.pm2_5)}</span></div>
              </div>
            </div>
          </div>
        );
      case 'workflow':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'rgba(255,255,255,0.4)' }}>공정 파이프라인</span>
              <form onSubmit={addTask} style={{ display: 'flex', gap: '6px' }}>
                <input type="text" placeholder="새 과제" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '3px 8px', fontSize: '0.75rem', color: '#fff', outline: 'none' }} />
                <button type="submit" style={{ background: '#007aff', color: '#fff', border: 'none', borderRadius: '6px', padding: '3px 8px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}>+ 추가</button>
              </form>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', flex: 1, overflowY: 'auto' }}>
              {STAGES.map(stage => (
                <div key={stage.id} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '14px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '3px' }}>{stage.label} <span>{tasks.filter(t => t.stage === stage.id).length}</span></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1 }}>
                    {tasks.filter(t => t.stage === stage.id).map(task => (
                      <div key={task.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '8px', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontWeight: '500', color: '#ffffff', lineHeight: '1.25' }}>{task.title}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#34c759', fontWeight: '500' }}>{task.progress}%</span>
                          {stage.id !== 'done' && <button onClick={() => moveTaskStage(task.id, task.stage)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', color: '#fff', padding: '1px 5px', cursor: 'pointer' }}>➔</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'calendar':
        return (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', width: '100%' }}>
            <Calendar 
              onChange={handleDateChange} 
              value={selectedDate} 
              calendarType="gregory" 
              tileClassName={tileClassNameGetter}
              formatDay={(locale, date) => date.getDate().toString()}
              formatShortWeekday={(locale, date) => ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]} 
            />
          </div>
        );
      case 'scheduler':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', width: '100%' }}>
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '10px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#ff3b30' }}>TODAY</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#ffffff', marginTop: '2px' }}>{todayText}</div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {!isLoggedIn ? (
                <button onClick={() => login()} style={{ padding: '10px', background: '#ffffff', color: '#000000', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', width: '100%' }}>
                  구글 계정 연결
                </button>
              ) : events.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', padding: '15px 0' }}>예정된 스케줄 없음</div>
              ) : (
                events.map(event => (
                  <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.8rem', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ color: '#e5e5ea', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '8px' }}>{event.title}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', flexShrink: 0 }}>{event.time}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      case 'mindmap':
        // 한글 주석: 위젯 내부에는 목록만 출력되도록 공용 컨트롤 트리거 핸들러 바인딩
        return <MindMapWidget onSelectMap={(map) => { setCurrentMindMap(map); setIsMindMapOpen(true); }} />;
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000', padding: '24px', boxSizing: 'border-box', width: '100vw' }}>
      
      {/* 문제점 1 해결: 위젯 목록 컨테이너 박스 (margin 0 및 왼쪽 정렬 강제 고정으로 여백 소멸) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', width: '100%', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
        {widgetOrder.map((id) => (
          <div key={id} draggable={!resizeTarget} onDragStart={() => handleDragStart(id)} onDragOver={handleDragOver} onDrop={() => handleDrop(id)} onDragEnd={handleDragEnd} style={{ ...iosLiquidGlassWidget, width: `${widgetSizes[id]?.width || 320}px`, height: `${widgetSizes[id]?.height || 260}px`, opacity: draggingId === id ? 0.3 : 1, transform: draggingId && draggingId !== id ? 'scale(0.97)' : 'scale(1)' }}>
            {renderWidgetContent(id)}
            <div className="ios-resize-trigger" onMouseDown={(e) => initResize(e, id)} />
          </div>
        ))}
      </div>

      {/* 문제점 1 & 2 영구 해결: 부모 위젯 카드의 transform 격리벽을 완전히 뚫고 나온 완전 독립 계층 배치 */}
      {isMindMapOpen && currentMindMap && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 999999, backgroundColor: '#000000', padding: '40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '16px', marginBottom: '20px', flexShrink: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '600', color: '#007aff' }}>{currentMindMap.title} (마인드맵 편집기)</h2>
            <button onClick={() => setIsMindMapOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 16px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>전체창 닫기</button>
          </div>

          {/* 마인드맵 노드 드로잉 보드 */}
          <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', position: 'relative', overflow: 'auto' }}>
            {currentMindMap.nodes?.map((node) => (
              <div 
                key={node.id}
                style={{ position: 'absolute', left: `${node.x}px`, top: `${node.y}px`, background: 'linear-gradient(135deg, rgba(40,40,44,0.9) 0%, rgba(28,28,30,0.95) 100%)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '12px', padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
              >
                <span 
                  onDoubleClick={() => setInputModal({ isOpen: true, nodeId: node.id, text: node.text, mode: 'edit' })}
                  style={{ fontSize: '0.85rem', fontWeight: '600', color: '#ffffff', cursor: 'pointer' }}
                >
                  {node.text}
                </span>
                
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button 
                    onClick={() => setInputModal({ isOpen: true, nodeId: node.id, text: '', mode: 'add' })} 
                    style={{ width: '18px', height: '18px', background: '#34c759', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    +
                  </button>
                  {node.id !== 'root' && (
                    <button 
                      onClick={() => handleDeleteNode(node.id)} 
                      style={{ width: '18px', height: '18px', background: '#ff3b30', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      -
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 블록 추가 및 수정 확인용 입력 모달창 */}
          {inputModal.isOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999999, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <form onSubmit={submitNodeData} style={{ background: 'linear-gradient(135deg, rgba(44, 44, 48, 0.95) 0%, rgba(28, 28, 30, 0.98) 100%)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '24px', padding: '24px', width: '320px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', color: '#fff' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: '600', color: '#007aff' }}>
                  {inputModal.mode === 'add' ? '새 블록 내용 입력' : '블록 내용 수정'}
                </h4>
                <input 
                  type="text" 
                  value={inputModal.text} 
                  onChange={(e) => setInputModal({ ...inputModal, text: e.target.value })}
                  placeholder="텍스트를 입력하세요"
                  autoFocus
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px', fontSize: '0.85rem', color: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setInputModal({ isOpen: false, nodeId: null, text: '', mode: 'add' })} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>취소</button>
                  <button type="submit" style={{ background: '#007aff', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>확인</button>
                </div>
              </form>
            </div>
          )}

        </div>
      )}

    </div>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId="451500058668-2okdn1lli09s36opj20ch4ibts9fkjm3.apps.googleusercontent.com">
      <DashboardContent />
    </GoogleOAuthProvider>
  );
}