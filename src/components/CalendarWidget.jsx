import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Maximize2, X, ChevronLeft, ChevronRight, Plus, Trash2, Check } from 'lucide-react';
import { toast } from './Toast';
import ConfirmDialog from './ConfirmDialog';

// ─────────────────────────────────────────────────────────────
// 캘린더 위젯.
//  · 위젯 상태 : 작은 달력 + 선택일 아젠다 (일정 점 표시 + 전체화면 버튼)
//  · 전체화면  : 구글 캘린더 수준의 월 그리드 + Google Tasks 사이드바
// 색은 CSS 토큰만 사용 (라이트/다크 동시 대응).
// ─────────────────────────────────────────────────────────────

const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1';
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 구글 캘린더 이벤트 colorId → 색. 기본(colorId 없음)은 accent 토큰.
const GCAL_COLORS = {
  1: '#7986cb', 2: '#33b679', 3: '#8e24aa', 4: '#e67c73', 5: '#f6bf26', 6: '#f4511e',
  7: '#039be5', 8: '#616161', 9: '#3f51b5', 10: '#0b8043', 11: '#d50000',
};
const eventColor = (colorId) => GCAL_COLORS[colorId] || 'var(--accent)';

// 로컬 기준 YYYY-MM-DD 키
const dateKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const sameDay = (a, b) => dateKey(a) === dateKey(b);

// 해당 월을 감싸는 6주(42칸) 그리드. 일요일 시작.
const buildGrid = (monthDate) => {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
};

// 자정 기준 두 날짜의 일수 차 (a - b)
const dayDiff = (a, b) => Math.round(
  (new Date(a.getFullYear(), a.getMonth(), a.getDate()) - new Date(b.getFullYear(), b.getMonth(), b.getDate())) / 86400000
);

const MAX_LANES = 4; // 한 셀에 보이는 최대 줄 수 (초과분은 "+N")

// 한 주(7일)의 항목들을 레인(가로 줄)에 배치.
//  · allDay 이벤트: 시작~종료를 가로로 잇는 막대 (주 경계에서 잘림)
//  · timed 이벤트 / 마감 할 일: 해당 날짜 한 칸짜리 항목
// 반환: { segments:[{kind,item,startCol,endCol,lane,continuesLeft,continuesRight}], overflow:number[7] }
const computeWeekLayout = (weekDays, monthEvents, timedByDate, tasksByDate, maxLanes = MAX_LANES) => {
  const w0 = weekDays[0];
  const w6 = weekDays[6];
  const segs = [];

  // 1) allDay(여러 날 포함) 막대 — 이 주와 겹치는 것만
  monthEvents.forEach((ev) => {
    if (!ev.allDay) return;
    const lastDay = new Date(ev.end.getTime() - 86400000); // 배타적 end → 마지막 실제 날짜
    if (ev.start > w6 || lastDay < w0) return;
    const startCol = Math.max(0, dayDiff(ev.start, w0));
    const endCol = Math.min(6, dayDiff(lastDay, w0));
    segs.push({
      kind: 'event', item: ev, startCol, endCol,
      continuesLeft: ev.start < w0,
      continuesRight: lastDay > w6,
      order: [0, startCol, -(endCol - startCol)], // allDay 우선, 시작 빠른 순, 긴 것 먼저
    });
  });

  // 2) timed 이벤트 — 한 칸
  weekDays.forEach((d, col) => {
    (timedByDate[dateKey(d)] || []).forEach((ev) => {
      segs.push({ kind: 'timed', item: ev, startCol: col, endCol: col, order: [1, col, ev.start.getHours() * 60 + ev.start.getMinutes()] });
    });
  });

  // 3) 마감 할 일 — 한 칸
  weekDays.forEach((d, col) => {
    (tasksByDate[dateKey(d)] || []).forEach((t) => {
      segs.push({ kind: 'task', item: t, startCol: col, endCol: col, order: [2, col, 0] });
    });
  });

  // 정렬 후 레인 배정 (겹치지 않는 첫 레인)
  segs.sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2]);
  const laneEnds = []; // laneEnds[lane] = 마지막으로 찬 endCol
  segs.forEach((s) => {
    let lane = 0;
    while (lane < laneEnds.length && laneEnds[lane] >= s.startCol) lane++;
    s.lane = lane;
    laneEnds[lane] = s.endCol;
  });

  // 넘치는 레인 → 날짜별 +N 집계
  const overflow = [0, 0, 0, 0, 0, 0, 0];
  const visible = [];
  let laneCount = 0;
  segs.forEach((s) => {
    if (s.lane < maxLanes) { visible.push(s); laneCount = Math.max(laneCount, s.lane + 1); return; }
    for (let c = s.startCol; c <= s.endCol; c++) overflow[c]++;
  });

  return { segments: visible, overflow, laneCount };
};

// 주간 뷰용: 하루 안에서 겹치는 조각을 열로 분할 (구글 주간 뷰 방식).
// 입력 조각은 { startMin, endMin, ... } 을 가지며, col/cols 를 채워 반환.
const packDaySegments = (segs) => {
  const sorted = [...segs].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const result = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const colEnds = []; // colEnds[c] = 열 c 의 마지막 종료(분)
    cluster.forEach((item) => {
      let c = 0;
      while (c < colEnds.length && colEnds[c] > item.startMin) c++;
      item.col = c; colEnds[c] = item.endMin;
    });
    const cols = colEnds.length;
    cluster.forEach((item) => { item.cols = cols; result.push(item); });
    cluster = [];
  };
  sorted.forEach((s) => {
    if (cluster.length && s.startMin >= clusterEnd) { flush(); clusterEnd = -1; }
    cluster.push(s);
    clusterEnd = Math.max(clusterEnd, s.endMin);
  });
  if (cluster.length) flush();
  return result;
};

// 일요일 00:00 기준 주 시작
const weekStartOf = (date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
};
const HOUR_H = 48; // 주간 뷰 1시간 높이(px)
const WEEK_GUTTER = 52; // 시간 라벨 열 너비(px)
const HOURS = Array.from({ length: 24 }, (_, h) => h);

export default function CalendarWidget({ isLoggedIn, login, accessToken }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeMonth, setActiveMonth] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [monthEvents, setMonthEvents] = useState([]); // 정규화된 원본 이벤트(시작~종료 범위 보존)
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('12:00');
  const [pendingDelete, setPendingDelete] = useState(null); // { kind:'event'|'task', id, listId? }

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [view, setView] = useState('month'); // 'month' | 'week'
  const [weekAnchor, setWeekAnchor] = useState(() => weekStartOf(new Date())); // 주간 뷰가 보는 주의 일요일

  // Tasks 상태
  const [taskLists, setTaskLists] = useState([]);
  const [activeListId, setActiveListId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [tasksUnavailable, setTasksUnavailable] = useState(false);

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  // ── 보이는 범위의 일정 fetch (월 그리드 또는 주) ──
  const fetchRangeEvents = useCallback(async (timeMin, timeMax) => {
    if (!accessToken) return;
    try {
      const url = `${CAL_BASE}?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=2500`;
      const res = await fetch(url, { headers: authHeaders });
      const data = await res.json();
      // 정규화: allDay 는 start/end(배타적) Date 로 범위 보존, timed 는 시작 시각.
      const normalized = (data.items || []).map((i) => {
        const allDay = !i.start.dateTime;
        if (allDay) {
          const s = new Date(i.start.date + 'T00:00:00');
          const e = i.end?.date ? new Date(i.end.date + 'T00:00:00') : new Date(s.getTime() + 86400000);
          return { id: i.id, title: i.summary || '제목 없음', color: eventColor(i.colorId), allDay: true, start: s, end: e };
        }
        const s = new Date(i.start.dateTime);
        const e = i.end?.dateTime ? new Date(i.end.dateTime) : new Date(s.getTime() + 3600000);
        return { id: i.id, title: i.summary || '제목 없음', color: eventColor(i.colorId), allDay: false, start: s, end: e };
      });
      setMonthEvents(normalized);
    } catch { toast('일정을 불러오지 못했습니다.'); }
  }, [accessToken, authHeaders]);

  // 현재 뷰가 보는 날짜 범위
  const visibleRange = useMemo(() => {
    if (view === 'week') {
      const start = new Date(weekAnchor); start.setHours(0, 0, 0, 0);
      const end = new Date(weekAnchor); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999);
      return { min: start, max: end };
    }
    const grid = buildGrid(activeMonth);
    const min = new Date(grid[0]); min.setHours(0, 0, 0, 0);
    const max = new Date(grid[41]); max.setHours(23, 59, 59, 999);
    return { min, max };
  }, [view, weekAnchor, activeMonth]);

  const reloadEvents = useCallback(() => {
    fetchRangeEvents(visibleRange.min, visibleRange.max);
  }, [fetchRangeEvents, visibleRange]);

  // monthEvents → 날짜별 매핑 (위젯 점·아젠다, 전체화면의 timed/집계에 사용)
  const eventsByDate = useMemo(() => {
    const map = {};
    const push = (key, ev) => { (map[key] ||= []).push(ev); };
    monthEvents.forEach((ev) => {
      if (ev.allDay) {
        for (let d = new Date(ev.start); d < ev.end; d.setDate(d.getDate() + 1)) push(dateKey(d), ev);
      } else {
        push(dateKey(ev.start), ev);
      }
    });
    const sortVal = (ev) => (ev.allDay ? -1 : ev.start.getHours() * 60 + ev.start.getMinutes());
    Object.values(map).forEach((arr) => arr.sort((a, b) => sortVal(a) - sortVal(b)));
    return map;
  }, [monthEvents]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- 비동기 fetch: setState 는 await 이후라 동기 아님
  useEffect(() => { reloadEvents(); }, [reloadEvents]);

  // ── Tasks fetch ──
  const fetchTaskLists = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${TASKS_BASE}/users/@me/lists`, { headers: authHeaders });
      if (res.status === 401 || res.status === 403) { setTasksUnavailable(true); return; }
      const data = await res.json();
      const lists = (data.items || []).map((l) => ({ id: l.id, title: l.title }));
      setTaskLists(lists);
      setTasksUnavailable(false);
      if (lists.length && !lists.some((l) => l.id === activeListId)) setActiveListId(lists[0].id);
    } catch { /* 조용히 무시 */ }
  }, [accessToken, authHeaders, activeListId]);

  const fetchTasks = useCallback(async (listId) => {
    if (!accessToken || !listId) return;
    try {
      const res = await fetch(`${TASKS_BASE}/lists/${listId}/tasks?showCompleted=true&showHidden=false&maxResults=100`, { headers: authHeaders });
      if (res.status === 401 || res.status === 403) { setTasksUnavailable(true); return; }
      const data = await res.json();
      const items = (data.items || []).map((t) => ({
        id: t.id, title: t.title || '(제목 없음)', status: t.status,
        due: t.due ? dateKey(new Date(t.due)) : null, position: t.position || '',
      })).sort((a, b) => a.position.localeCompare(b.position));
      setTasks(items);
    } catch { /* 무시 */ }
  }, [accessToken, authHeaders]);

  // 전체화면 진입 시에만 Tasks 를 불러온다 (위젯 상태에선 불필요한 호출 방지).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 비동기 fetch
    if (isFullscreen && accessToken) fetchTaskLists();
  }, [isFullscreen, accessToken, fetchTaskLists]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 비동기 fetch
    if (isFullscreen && activeListId) fetchTasks(activeListId);
  }, [isFullscreen, activeListId, fetchTasks]);

  // 전체화면일 때 배경 스크롤 잠금
  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setIsFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [isFullscreen]);

  // ── 이벤트 CRUD ──
  const addEvent = async ({ date, time, title }) => {
    if (!title || !accessToken) return;
    const [hh, mm] = time.split(':');
    const startDt = new Date(date); startDt.setHours(+hh, +mm, 0, 0);
    const endDt = new Date(startDt.getTime() + 3600000);
    try {
      await fetch(CAL_BASE, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: title,
          start: { dateTime: startDt.toISOString(), timeZone: TZ },
          end: { dateTime: endDt.toISOString(), timeZone: TZ },
        }),
      });
      reloadEvents();
    } catch { toast('일정 추가에 실패했습니다.'); }
  };

  const deleteEvent = async (id) => {
    try {
      await fetch(`${CAL_BASE}/${id}`, { method: 'DELETE', headers: authHeaders });
      reloadEvents();
    } catch { toast('일정 삭제에 실패했습니다.'); }
  };

  // ── Task CRUD ──
  const addTask = async (title, due) => {
    if (!title || !activeListId) return;
    try {
      await fetch(`${TASKS_BASE}/lists/${activeListId}/tasks`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, ...(due ? { due: `${due}T00:00:00.000Z` } : {}) }),
      });
      fetchTasks(activeListId);
    } catch { toast('할 일 추가에 실패했습니다.'); }
  };

  const toggleTask = async (task) => {
    const completed = task.status === 'completed';
    try {
      await fetch(`${TASKS_BASE}/lists/${activeListId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(completed ? { status: 'needsAction', completed: null } : { status: 'completed' }),
      });
      fetchTasks(activeListId);
    } catch { toast('할 일 상태 변경에 실패했습니다.'); }
  };

  const deleteTask = async (listId, id) => {
    try {
      await fetch(`${TASKS_BASE}/lists/${listId}/tasks/${id}`, { method: 'DELETE', headers: authHeaders });
      fetchTasks(listId);
    } catch { toast('할 일 삭제에 실패했습니다.'); }
  };

  // 위젯 form 제출 (선택일에 추가)
  const handleWidgetAdd = (e) => {
    e.preventDefault();
    addEvent({ date: selectedDate, time: newEventTime, title: newEventTitle });
    setNewEventTitle('');
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === 'event') deleteEvent(pendingDelete.id);
    else deleteTask(pendingDelete.listId, pendingDelete.id);
    setPendingDelete(null);
  };

  const selectedKey = dateKey(selectedDate);
  const selectedEvents = eventsByDate[selectedKey] || [];
  const dateLabel = selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  // ── 위젯(컴팩트) 뷰 ──
  return (
    <div style={{ display: 'flex', gap: '20px', height: '100%', width: '100%', flexWrap: 'wrap' }}>
      {/* 좌: 달력 */}
      <div style={{ flex: '1 1 240px', minWidth: '220px', display: 'flex', alignItems: 'flex-start' }}>
        <Calendar
          onChange={setSelectedDate}
          value={selectedDate}
          calendarType="gregory"
          onActiveStartDateChange={({ activeStartDate }) => activeStartDate && setActiveMonth(new Date(activeStartDate.getFullYear(), activeStartDate.getMonth(), 1))}
          tileClassName={({ date, view }) => view === 'month' ? (date.getDay() === 6 ? 'sat-tile' : date.getDay() === 0 ? 'sun-tile' : null) : null}
          tileContent={({ date, view }) => {
            if (view !== 'month') return null;
            const evs = eventsByDate[dateKey(date)];
            if (!evs || !evs.length) return <div className="cal-dot-wrap" />;
            return (
              <div className="cal-dot-wrap">
                {evs.slice(0, 3).map((ev, i) => (
                  <span key={i} className="cal-dot" style={{ background: ev.color }} />
                ))}
              </div>
            );
          }}
          formatDay={(locale, d) => d.getDate().toString()}
        />
      </div>

      {/* 우: 선택한 날짜 일정 */}
      <div style={{ flex: '1 1 240px', minWidth: '220px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--txt)', flex: 1 }}>{dateLabel}</span>
          {isLoggedIn && (
            <button onClick={() => setIsFullscreen(true)} title="전체화면"
              style={{ background: 'var(--chip-bg)', border: '1px solid var(--glass-border)', color: 'var(--txt-dim)', borderRadius: '9px', width: '30px', height: '30px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Maximize2 size={15} />
            </button>
          )}
        </div>

        {!isLoggedIn ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <span style={{ color: 'var(--txt-dim)', fontSize: '0.85rem', textAlign: 'center' }}>구글 캘린더를 연동하면<br />일정이 여기에 표시됩니다.</span>
            <button onClick={() => login()} style={{ padding: '10px 20px', borderRadius: '14px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem' }}>캘린더 연동</button>
          </div>
        ) : (
          <>
            <form onSubmit={handleWidgetAdd} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} style={{ background: 'var(--field-bg)', border: '1px solid var(--field-border)', color: 'var(--txt)', borderRadius: '10px', padding: '8px', outline: 'none', fontSize: '0.8rem' }} />
              <input type="text" placeholder="새 일정" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} style={{ flex: 1, minWidth: 0, background: 'var(--field-bg)', border: '1px solid var(--field-border)', color: 'var(--txt)', borderRadius: '10px', padding: '8px 10px', outline: 'none', fontSize: '0.8rem' }} />
              <button type="submit" style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', padding: '0 14px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem' }}>+</button>
            </form>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedEvents.length === 0 && <div style={{ color: 'var(--txt-faint)', textAlign: 'center', marginTop: '20px', fontSize: '0.85rem' }}>일정이 없습니다.</div>}
              {selectedEvents.map(ev => (
                <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--chip-bg)', padding: '10px 12px', borderRadius: '12px', borderLeft: `3px solid ${ev.color}` }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--accent-text)', fontWeight: '600' }}>{ev.allDay ? '종일' : new Date(ev.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <button onClick={() => setPendingDelete({ kind: 'event', id: ev.id })} style={{ background: 'rgba(255,59,48,0.15)', color: 'var(--danger)', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '700', flexShrink: 0 }}>삭제</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {isFullscreen && ReactDOM.createPortal(
        <FullscreenCalendar
          view={view}
          setView={setView}
          activeMonth={activeMonth}
          setActiveMonth={setActiveMonth}
          weekAnchor={weekAnchor}
          setWeekAnchor={setWeekAnchor}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          monthEvents={monthEvents}
          onClose={() => setIsFullscreen(false)}
          onAddEvent={addEvent}
          onRequestDeleteEvent={(id) => setPendingDelete({ kind: 'event', id })}
          taskLists={taskLists}
          activeListId={activeListId}
          setActiveListId={setActiveListId}
          tasks={tasks}
          tasksUnavailable={tasksUnavailable}
          onAddTask={addTask}
          onToggleTask={toggleTask}
          onRequestDeleteTask={(id) => setPendingDelete({ kind: 'task', id, listId: activeListId })}
          onReconnect={login}
        />,
        document.body
      )}

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        message={pendingDelete?.kind === 'task' ? '이 할 일을 삭제하시겠습니까?' : '이 일정을 삭제하시겠습니까?'}
        confirmLabel="삭제"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 전체화면 캘린더 (월 그리드 + Tasks 사이드바)
// ─────────────────────────────────────────────────────────────
function FullscreenCalendar({
  view, setView, activeMonth, setActiveMonth, weekAnchor, setWeekAnchor,
  selectedDate, setSelectedDate,
  monthEvents, onClose, onAddEvent, onRequestDeleteEvent,
  taskLists, activeListId, setActiveListId, tasks, tasksUnavailable,
  onAddTask, onToggleTask, onRequestDeleteTask, onReconnect,
}) {
  const [composer, setComposer] = useState(null); // { date } — 셀/시간대 클릭 시 일정 추가
  const [cTitle, setCTitle] = useState('');
  const [cTime, setCTime] = useState('12:00');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const weekScrollRef = useRef(null);

  const grid = useMemo(() => buildGrid(activeMonth), [activeMonth]);
  const today = new Date();
  const monthNum = activeMonth.getMonth();

  // timed 이벤트 → 날짜별
  const timedByDate = useMemo(() => {
    const map = {};
    monthEvents.forEach((ev) => {
      if (ev.allDay) return;
      (map[dateKey(ev.start)] ||= []).push(ev);
    });
    Object.values(map).forEach((a) => a.sort((x, y) => x.start - y.start));
    return map;
  }, [monthEvents]);

  // 마감일 있는 할 일 → 날짜별 (그리드에 표시)
  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach((t) => { if (t.due) (map[t.due] ||= []).push(t); });
    return map;
  }, [tasks]);

  // 6주로 분할 후 각 주의 레인 레이아웃 계산
  const weeks = useMemo(() => {
    const rows = [];
    for (let w = 0; w < 6; w++) {
      const days = grid.slice(w * 7, w * 7 + 7);
      rows.push({ days, layout: computeWeekLayout(days, monthEvents, timedByDate, tasksByDate) });
    }
    return rows;
  }, [grid, monthEvents, timedByDate, tasksByDate]);

  // ── 주간 뷰 데이터 ──
  const weekDays = useMemo(() => {
    const s = new Date(weekAnchor);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d; });
  }, [weekAnchor]);
  // 종일 영역: allDay 이벤트 + 마감 할 일만 (timed 는 시간 격자로). 레인 제한 없음.
  const weekAllDay = useMemo(
    () => computeWeekLayout(weekDays, monthEvents, {}, tasksByDate, Infinity),
    [weekDays, monthEvents, tasksByDate]
  );

  // timed 이벤트를 요일 열마다 조각으로 분할 (자정을 넘기면 다음 날 열로 이어짐)
  const weekTimedByDay = useMemo(() => {
    const buckets = Array.from({ length: 7 }, () => []);
    weekDays.forEach((day, ci) => {
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
      const dayEnd = dayStart + 86400000; // 다음 날 자정(배타적)
      monthEvents.forEach((ev) => {
        if (ev.allDay) return;
        const s = ev.start.getTime();
        const e = ev.end.getTime();
        const segStart = Math.max(s, dayStart);
        const segEnd = Math.min(e, dayEnd);
        if (segEnd <= segStart) return; // 겹침 없음 (자정 정각 종료도 여기서 제외됨)
        buckets[ci].push({
          ev,
          startMin: (segStart - dayStart) / 60000,
          endMin: (segEnd - dayStart) / 60000,
          continuesUp: s < dayStart,   // 전날에서 이어짐
          continuesDown: e > dayEnd,   // 다음 날로 이어짐
        });
      });
    });
    return buckets;
  }, [weekDays, monthEvents]);

  // 주간 뷰 진입/이동 시 오전 7시로 스크롤
  useEffect(() => {
    if (view === 'week' && weekScrollRef.current) weekScrollRef.current.scrollTop = 7 * HOUR_H;
  }, [view, weekAnchor]);

  const shiftMonth = (delta) => setActiveMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() + delta, 1));
  const shiftWeek = (delta) => { const d = new Date(weekAnchor); d.setDate(d.getDate() + delta * 7); setWeekAnchor(d); };
  const goPrev = () => (view === 'week' ? shiftWeek(-1) : shiftMonth(-1));
  const goNext = () => (view === 'week' ? shiftWeek(1) : shiftMonth(1));
  const goToday = () => {
    const now = new Date();
    if (view === 'week') setWeekAnchor(weekStartOf(now));
    else setActiveMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  };
  const switchView = (v) => {
    if (v === view) return;
    if (v === 'week') setWeekAnchor(weekStartOf(selectedDate));
    else setActiveMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    setView(v);
  };

  const openComposer = (date, time = '12:00') => { setComposer({ date }); setCTitle(''); setCTime(time); };
  const submitComposer = (e) => {
    e.preventDefault();
    if (!cTitle.trim()) return;
    onAddEvent({ date: composer.date, time: cTime, title: cTitle.trim() });
    setComposer(null);
  };

  const submitTask = (e) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    onAddTask(taskTitle.trim(), taskDue || null);
    setTaskTitle(''); setTaskDue('');
  };

  // 레인 막대 하나 렌더 (월 그리드·주간 종일 영역 공용)
  const renderSegment = (s, si) => {
    const it = s.item;
    const left = `calc(${(s.startCol / 7) * 100}% + 3px)`;
    const width = `calc(${((s.endCol - s.startCol + 1) / 7) * 100}% - 6px)`;
    const top = s.lane * 21;
    const pos = { position: 'absolute', left, width, top, pointerEvents: 'auto' };
    if (s.kind === 'event') {
      return (
        <div key={si} className="calfs-bar" title={it.title}
          style={{
            ...pos, background: it.color, color: '#fff',
            borderTopLeftRadius: s.continuesLeft ? 0 : 5, borderBottomLeftRadius: s.continuesLeft ? 0 : 5,
            borderTopRightRadius: s.continuesRight ? 0 : 5, borderBottomRightRadius: s.continuesRight ? 0 : 5,
          }}
          onClick={(e) => { e.stopPropagation(); onRequestDeleteEvent(it.id); }}>
          {s.continuesLeft && <span style={{ opacity: 0.85 }}>◂ </span>}{it.title}
        </div>
      );
    }
    if (s.kind === 'timed') {
      return (
        <div key={si} className="calfs-bar calfs-bar-timed" title={it.title} style={pos}
          onClick={(e) => { e.stopPropagation(); onRequestDeleteEvent(it.id); }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: it.color, flexShrink: 0 }} />
          <span style={{ color: 'var(--txt-dim)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{it.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span style={{ color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</span>
        </div>
      );
    }
    const done = it.status === 'completed';
    return (
      <div key={si} className="calfs-bar calfs-bar-timed" title={it.title} style={pos}
        onClick={(e) => { e.stopPropagation(); onToggleTask(it); }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', border: `1.5px solid ${done ? 'var(--accent)' : 'var(--txt-faint)'}`, background: done ? 'var(--accent)' : 'transparent', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {done && <Check size={8} strokeWidth={3} />}
        </span>
        <span style={{ color: 'var(--txt-dim)', textDecoration: done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</span>
      </div>
    );
  };

  const monthTitle = `${activeMonth.getFullYear()}년 ${monthNum + 1}월`;
  const ws = weekDays[0], we = weekDays[6];
  const weekTitle = ws.getMonth() === we.getMonth()
    ? `${ws.getFullYear()}년 ${ws.getMonth() + 1}월 ${ws.getDate()} – ${we.getDate()}일`
    : `${ws.getMonth() + 1}월 ${ws.getDate()}일 – ${we.getMonth() + 1}월 ${we.getDate()}일`;
  const title = view === 'week' ? weekTitle : monthTitle;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999999, background: 'var(--editor-bg)',
      display: 'flex', flexDirection: 'column', padding: '18px 20px 20px', boxSizing: 'border-box',
    }}>
      {/* 상단 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <button className="calfs-navbtn" onClick={onClose} title="닫기 (Esc)"><X size={18} /></button>
        <button onClick={goToday} style={{ background: 'var(--chip-bg)', border: '1px solid var(--glass-border)', color: 'var(--txt)', padding: '7px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>오늘</button>
        <button className="calfs-navbtn" onClick={goPrev} title="이전"><ChevronLeft size={18} /></button>
        <button className="calfs-navbtn" onClick={goNext} title="다음"><ChevronRight size={18} /></button>
        <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--txt)', marginLeft: '4px' }}>{title}</div>
        <div style={{ flex: 1 }} />
        {/* 월/주 전환 세그먼트 */}
        <div style={{ display: 'flex', background: 'var(--chip-bg)', border: '1px solid var(--glass-border)', borderRadius: '11px', padding: '3px' }}>
          {[['month', '월'], ['week', '주']].map(([v, label]) => (
            <button key={v} onClick={() => switchView(v)}
              style={{
                border: 'none', cursor: 'pointer', padding: '6px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700',
                background: view === v ? 'var(--accent)' : 'transparent', color: view === v ? '#fff' : 'var(--txt-dim)',
              }}>{label}</button>
          ))}
        </div>
      </div>

      {/* 본문: 그리드 + 사이드바 */}
      <div style={{ flex: 1, display: 'flex', gap: '18px', minHeight: 0 }}>
        {view === 'month' ? (
        /* ── 월 그리드 ── */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, border: '1px solid var(--divider)', borderRadius: '16px', overflow: 'hidden' }}>
          {/* 요일 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--divider)' }}>
            {WEEKDAYS.map((w, i) => (
              <div key={w} style={{ textAlign: 'center', padding: '8px 0', fontSize: '0.76rem', fontWeight: '700', color: i === 0 ? '#ff3b30' : i === 6 ? '#30a9ff' : 'var(--txt-dim)' }}>{w}</div>
            ))}
          </div>
          {/* 6주 — 각 주는 배경(날짜 칸) + 레인 오버레이 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {weeks.map(({ days, layout }, wi) => (
              <div key={wi} className="calfs-week" style={{ flex: 1, position: 'relative', minHeight: 0, borderBottom: wi === 5 ? 'none' : '1px solid var(--divider)' }}>
                {/* 배경 날짜 칸 (클릭·hover·선택 표시) */}
                <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {days.map((d, ci) => {
                    const isOther = d.getMonth() !== monthNum;
                    const isSelected = sameDay(d, selectedDate);
                    return (
                      <div key={ci} className={`calfs-cell${isOther ? ' other' : ''}`}
                        style={{ borderRight: ci === 6 ? 'none' : '1px solid var(--divider)', borderBottom: 'none', boxShadow: isSelected ? 'inset 0 0 0 2px var(--accent)' : undefined }}
                        onClick={() => { setSelectedDate(new Date(d)); openComposer(new Date(d)); }} />
                    );
                  })}
                </div>

                {/* 전경: 날짜 숫자 + 레인 막대 (클릭은 배경으로 통과) */}
                <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}>
                  {/* 날짜 숫자 줄 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flexShrink: 0 }}>
                    {days.map((d, ci) => {
                      const isToday = sameDay(d, today);
                      const isOther = d.getMonth() !== monthNum;
                      const dow = d.getDay();
                      return (
                        <div key={ci} style={{ padding: '4px 5px 0', display: 'flex' }}>
                          <span className={`calfs-daynum${isToday ? ' today' : ''}${dow === 6 ? ' sat' : ''}${dow === 0 ? ' sun' : ''}`} style={{ opacity: isOther ? 0.5 : 1 }}>{d.getDate()}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 레인 막대 영역 */}
                  <div style={{ position: 'relative', flex: 1, marginTop: '2px', overflow: 'hidden' }}>
                    {layout.segments.map((s, si) => renderSegment(s, si))}
                    {/* +N 더보기 (넘친 날짜) */}
                    {layout.overflow.map((n, ci) => n > 0 ? (
                      <div key={'o' + ci} className="calfs-more"
                        style={{ position: 'absolute', left: `calc(${(ci / 7) * 100}% + 5px)`, bottom: 2 }}>+{n}개 더</div>
                    ) : null)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        ) : (
        /* ── 주간 뷰 (시간 격자) ── */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, border: '1px solid var(--divider)', borderRadius: '16px', overflow: 'hidden' }}>
          {/* 날짜 헤더 */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--divider)' }}>
            <div style={{ width: WEEK_GUTTER, flexShrink: 0 }} />
            {weekDays.map((d, ci) => {
              const isToday = sameDay(d, today);
              const dow = d.getDay();
              return (
                <div key={ci} onClick={() => setSelectedDate(new Date(d))}
                  style={{ flex: 1, textAlign: 'center', padding: '6px 0 8px', cursor: 'pointer', borderLeft: ci ? '1px solid var(--divider)' : 'none' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: dow === 0 ? '#ff3b30' : dow === 6 ? '#30a9ff' : 'var(--txt-dim)' }}>{WEEKDAYS[dow]}</div>
                  <div style={{ margin: '3px auto 0', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isToday ? 'var(--accent)' : 'transparent', color: isToday ? '#fff' : 'var(--txt)', fontWeight: 700, fontSize: '0.95rem' }}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* 종일 영역 */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--divider)' }}>
            <div style={{ width: WEEK_GUTTER, flexShrink: 0, fontSize: '0.6rem', color: 'var(--txt-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>종일</div>
            <div style={{ flex: 1, position: 'relative', height: Math.max(26, weekAllDay.laneCount * 21 + 5) }}>
              {/* 클릭 배경(종일 일정 추가) + 열 구분선 */}
              <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {weekDays.map((d, ci) => (
                  <div key={ci} className="calfs-cell" style={{ borderRight: 'none', borderBottom: 'none', borderLeft: ci ? '1px solid var(--divider)' : 'none' }}
                    onClick={() => { setSelectedDate(new Date(d)); openComposer(new Date(d)); }} />
                ))}
              </div>
              <div style={{ position: 'absolute', inset: 0, paddingTop: 3, pointerEvents: 'none' }}>
                {weekAllDay.segments.map((s, si) => renderSegment(s, si))}
              </div>
            </div>
          </div>

          {/* 시간 격자 (스크롤) */}
          <div ref={weekScrollRef} className="calfs-scroll" style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex' }}>
              {/* 시간 라벨 */}
              <div style={{ width: WEEK_GUTTER, flexShrink: 0 }}>
                {HOURS.map((h) => (
                  <div key={h} style={{ height: HOUR_H, position: 'relative' }}>
                    {h > 0 && <span style={{ position: 'absolute', top: -7, right: 6, fontSize: '0.62rem', color: 'var(--txt-faint)' }}>{`${String(h).padStart(2, '0')}:00`}</span>}
                  </div>
                ))}
              </div>
              {/* 요일 컬럼 */}
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {weekDays.map((d, ci) => {
                  const packed = packDaySegments(weekTimedByDay[ci]);
                  const isTodayCol = sameDay(d, today);
                  const nowMin = today.getHours() * 60 + today.getMinutes();
                  return (
                    <div key={ci} style={{ position: 'relative', borderLeft: ci ? '1px solid var(--divider)' : 'none' }}
                      onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const hh = Math.max(0, Math.min(23, Math.floor((e.clientY - rect.top) / HOUR_H))); setSelectedDate(new Date(d)); openComposer(new Date(d), `${String(hh).padStart(2, '0')}:00`); }}>
                      {HOURS.map((h) => (<div key={h} style={{ height: HOUR_H, borderTop: h ? '1px solid var(--divider)' : 'none', boxSizing: 'border-box' }} />))}
                      {packed.map((p, pi) => {
                        const ev = p.ev;
                        const dur = Math.max(24, p.endMin - p.startMin);
                        const w = 100 / p.cols;
                        return (
                          <div key={pi} className="calfs-wblock" title={ev.title}
                            style={{
                              top: p.startMin / 60 * HOUR_H, height: dur / 60 * HOUR_H - 2,
                              left: `calc(${p.col * w}% + 1px)`, width: `calc(${w}% - 2px)`, background: ev.color,
                              borderTopLeftRadius: p.continuesUp ? 0 : 5, borderTopRightRadius: p.continuesUp ? 0 : 5,
                              borderBottomLeftRadius: p.continuesDown ? 0 : 5, borderBottomRightRadius: p.continuesDown ? 0 : 5,
                            }}
                            onClick={(e) => { e.stopPropagation(); onRequestDeleteEvent(ev.id); }}>
                            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.continuesUp && '▲ '}{ev.title}
                            </div>
                            {!p.continuesUp && <div style={{ opacity: 0.85, fontSize: '0.64rem' }}>{ev.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                          </div>
                        );
                      })}
                      {isTodayCol && (
                        <div style={{ position: 'absolute', left: 0, right: 0, top: nowMin / 60 * HOUR_H, borderTop: '2px solid #ea4335', zIndex: 5, pointerEvents: 'none' }}>
                          <span style={{ position: 'absolute', left: -3, top: -4, width: 8, height: 8, borderRadius: '50%', background: '#ea4335' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Tasks 사이드바 */}
        <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', border: '1px solid var(--divider)', borderRadius: '16px', padding: '16px', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--txt)' }}>할 일</span>
            {taskLists.length > 0 && (
              <select value={activeListId} onChange={(e) => setActiveListId(e.target.value)}
                style={{ marginLeft: 'auto', background: 'var(--field-bg)', border: '1px solid var(--field-border)', color: 'var(--txt)', borderRadius: '9px', padding: '5px 8px', fontSize: '0.8rem', outline: 'none', maxWidth: '160px' }}>
                {taskLists.map((l) => <option key={l.id} value={l.id} style={{ color: '#000' }}>{l.title}</option>)}
              </select>
            )}
          </div>

          {tasksUnavailable ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center', padding: '12px' }}>
              <span style={{ color: 'var(--txt-dim)', fontSize: '0.85rem', lineHeight: 1.5 }}>할 일(Tasks) 권한이 없습니다.<br />다시 연동하면 할 일이 표시됩니다.</span>
              <button onClick={() => onReconnect()} style={{ padding: '9px 18px', borderRadius: '12px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.82rem' }}>다시 연동</button>
            </div>
          ) : (
            <>
              <form onSubmit={submitTask} style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '7px' }}>
                  <input type="text" placeholder="새 할 일" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)}
                    style={{ flex: 1, minWidth: 0, background: 'var(--field-bg)', border: '1px solid var(--field-border)', color: 'var(--txt)', borderRadius: '10px', padding: '9px 10px', outline: 'none', fontSize: '0.82rem' }} />
                  <button type="submit" style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', padding: '0 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><Plus size={16} /></button>
                </div>
                <input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} title="마감일 (선택)"
                  style={{ background: 'var(--field-bg)', border: '1px solid var(--field-border)', color: 'var(--txt-dim)', borderRadius: '10px', padding: '7px 10px', outline: 'none', fontSize: '0.78rem' }} />
              </form>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {tasks.length === 0 && <div style={{ color: 'var(--txt-faint)', textAlign: 'center', marginTop: '24px', fontSize: '0.85rem' }}>할 일이 없습니다.</div>}
                {tasks.map((t) => {
                  const done = t.status === 'completed';
                  return (
                    <div key={t.id} className="calfs-task-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 2px', borderBottom: '1px solid var(--divider)' }}>
                      <button onClick={() => onToggleTask(t)} title={done ? '완료 취소' : '완료'}
                        style={{ background: 'none', border: 'none', padding: '2px 0 0', cursor: 'pointer', flexShrink: 0 }}>
                        <span style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${done ? 'var(--accent)' : 'var(--txt-faint)'}`, background: done ? 'var(--accent)' : 'transparent', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {done && <Check size={12} strokeWidth={3} />}
                        </span>
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.86rem', color: done ? 'var(--txt-faint)' : 'var(--txt)', textDecoration: done ? 'line-through' : 'none', wordBreak: 'break-word' }}>{t.title}</div>
                        {t.due && <div style={{ fontSize: '0.72rem', color: 'var(--accent-text)', fontWeight: '600', marginTop: '2px' }}>{new Date(t.due + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</div>}
                      </div>
                      <button className="calfs-task-del" onClick={() => onRequestDeleteTask(t.id)} title="삭제"
                        style={{ background: 'none', border: 'none', color: 'var(--txt-faint)', cursor: 'pointer', padding: '2px', opacity: 0, transition: 'opacity 0.15s ease', flexShrink: 0 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 일정 추가 미니 모달 */}
      {composer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000000, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setComposer(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitComposer}
            style={{ background: 'var(--editor-bg)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '24px', width: '340px', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--txt-dim)', marginBottom: '6px' }}>
              {composer.date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </div>
            <input autoFocus type="text" placeholder="일정 제목" value={cTitle} onChange={(e) => setCTitle(e.target.value)}
              style={{ width: '100%', background: 'var(--field-bg)', border: '1px solid var(--field-border)', color: 'var(--txt)', borderRadius: '12px', padding: '11px 12px', outline: 'none', fontSize: '0.9rem', marginBottom: '12px' }} />
            <input type="time" value={cTime} onChange={(e) => setCTime(e.target.value)}
              style={{ width: '100%', background: 'var(--field-bg)', border: '1px solid var(--field-border)', color: 'var(--txt)', borderRadius: '12px', padding: '10px 12px', outline: 'none', fontSize: '0.85rem', marginBottom: '18px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setComposer(null)} style={{ flex: 1, background: 'var(--chip-strong)', border: 'none', color: 'var(--txt)', padding: '11px', borderRadius: '12px', cursor: 'pointer', fontWeight: '600' }}>취소</button>
              <button type="submit" style={{ flex: 1, background: 'var(--accent)', border: 'none', color: '#fff', padding: '11px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700' }}>추가</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
