import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; 
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

// 파이어베이스 DB 인스턴스 및 라이브러리 메서드 로드
import { db } from './firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

const iosLiquidGlassTheme = `
  body { 
    margin: 0; 
    background-color: #000000; 
    color: #ffffff; 
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    letter-spacing: -0.3px;
  }
  .react-calendar { background: transparent !important; color: #ffffff !important; border: none !important; width: 100% !important; font-family: inherit; }
  .react-calendar__navigation button { color: #ffffff !important; min-width: 30px; background: none; font-size: 13px; font-weight: 500; }
  .react-calendar__navigation button:enabled:hover { background-color: rgba(255,255,255,0.06); border-radius: 6px; }
  .react-calendar__month-view__weekdays { color: rgba(255,255,255,0.3) !important; text-transform: uppercase; font-weight: 600; font-size: 0.7rem; letter-spacing: 0.5px; }
  .react-calendar__tile { color: #ffffff !important; background: none; border: none; padding: 8px 0; font-size: 0.85rem; }
  .react-calendar__tile:enabled:hover { background-color: rgba(255,255,255,0.08) !important; border-radius: 50%; }
  .react-calendar__tile--now { background: rgba(255,255,255,0.2) !important; border-radius: 50%; font-weight: 600; }
  .react-calendar__tile--active { background: #007aff !important; color: white !important; border-radius: 50% !important; }
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

  // 기본 목데이터 구성
  const [tasks, setTasks] = useState([
    { id: 't1', title: '527mm Enclosure 구조해석 및 압력 검토', stage: 'simulation', progress: 75 },
    { id: 't2', title: '10-BAY GIS 가스 계통도 CAD 도면 설계', stage: 'design', progress: 40 },
    { id: 't3', title: 'M30 앵커 볼트 전단 강도 스펙 수립', stage: 'plan', progress: 10 }
  ]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [widgetOrder, setWidgetOrder] = useState(['clock', 'weather', 'workflow', 'calendar', 'scheduler']);
  const [widgetSizes, setWidgetSizes] = useState({
    clock: { width: 360, height: 260 }, 
    weather: { width: 320, height: 260 },
    workflow: { width: 664, height: 340 },
    calendar: { width: 360, height: 260 },
    scheduler: { width: 320, height: 260 }
  });

  const [draggingId, setDraggingId] = useState(null);
  const [resizeTarget, setResizeTarget] = useState(null);
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  // 컴포넌트 마운트 시 Firestore 실시간 리스너 연결
  useEffect(() => {
    try {
      if (!db) return;

      const layoutConfigRef = doc(db, "dashboard", "layoutConfig");
      const unsubscribeLayout = onSnapshot(layoutConfigRef, (docSnap) => {
        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          if (remoteData?.widgetOrder) setWidgetOrder(remoteData.widgetOrder);
          if (remoteData?.widgetSizes) setWidgetSizes(remoteData.widgetSizes);
        }
      }, (error) => {
        console.warn("Firestore 레이아웃 접근 제한 우회:", error.message);
      });

      const tasksRef = doc(db, "dashboard", "taskData");
      const unsubscribeTasks = onSnapshot(tasksRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data()?.list) {
          setTasks(docSnap.data().list);
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

  const saveLayoutToFirestore = async (newOrder, newSizes) => {
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
      
      setWidgetSizes((prev) => ({
        ...prev,
        [resizeTarget]: {
          width: Math.max(260, startSize.width + deltaX),
          height: Math.max(220, startSize.height + deltaY)
        }
      }));
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

  // --- [핵심 복구 로직: 구글 캘린더 단독 조회 및 동기화 함수 파이프라인] ---
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

  // --- [핵심 복구 로직: 에러 유발점이었던 날짜 스위칭 핸들러 복구 완료] ---
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
            <Calendar onChange={handleDateChange} value={selectedDate} calendarType="gregory" formatShortWeekday={(locale, date) => ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]} />
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
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000', padding: '32px 24px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {widgetOrder.map((id) => (
          <div key={id} draggable={!resizeTarget} onDragStart={() => handleDragStart(id)} onDragOver={handleDragOver} onDrop={() => handleDrop(id)} onDragEnd={handleDragEnd} style={{ ...iosLiquidGlassWidget, width: `${widgetSizes[id].width}px`, height: `${widgetSizes[id].height}px`, opacity: draggingId === id ? 0.3 : 1, transform: draggingId && draggingId !== id ? 'scale(0.97)' : 'scale(1)' }}>
            {renderWidgetContent(id)}
            <div className="ios-resize-trigger" onMouseDown={(e) => initResize(e, id)} />
          </div>
        ))}
      </div>
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