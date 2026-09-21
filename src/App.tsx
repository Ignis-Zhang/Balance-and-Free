import { useEffect, useState, type FormEvent } from "react";
import "./App.css";
import { apiFetch, clearToken, getCurrentUser, getToken, login, register, type ApiUser } from "./api";

type Todo = {
  id: number;
  title: string;
  meta: string;
  done: boolean;
  tone: "coral" | "blue" | "yellow";
};

type ScheduleItem = {
  id: number;
  year: number;
  month: number;
  day: number;
  time: string;
  title: string;
  detail: string;
  tone: "coral" | "blue" | "yellow";
};

const navItems = [
  { label: "工作台", icon: "⌂" },
  { label: "会议总结", icon: "◉" },
  { label: "日程安排", icon: "□" },
  { label: "To do list", icon: "✓" },
];

const initialTodos: Todo[] = [
  {
    id: 1,
    title: "整理上周用户访谈记录",
    meta: "今天 · 17:00 前",
    done: false,
    tone: "coral",
  },
  {
    id: 2,
    title: "给设计团队同步会议纪要",
    meta: "今天 · 18:30 前",
    done: false,
    tone: "blue",
  },
  {
    id: 3,
    title: "确认下周发布排期",
    meta: "明天 · 09:30 前",
    done: true,
    tone: "yellow",
  },
];

const initialSchedule: ScheduleItem[] = [
  { id: 1, year: 2026, month: 9, day: 21,
    time: "10:00",
    title: "产品周会",
    detail: "产品、设计团队 · 1小时",
    tone: "coral",
  },
  { id: 2, year: 2026, month: 9, day: 21,
    time: "14:00",
    title: "深度工作时间",
    detail: "产品方案 · 2小时",
    tone: "coral",
  },
  { id: 3, year: 2026, month: 9, day: 21,
    time: "16:30",
    title: "与陈默 1:1",
    detail: "线上会议 · 30分钟",
    tone: "blue",
  },
  { id: 4, year: 2026, month: 9, day: 21,
    time: "19:00",
    title: "晚间跑步",
    detail: "个人生活 · 45分钟",
    tone: "yellow",
  },
  { id: 5, year: 2026, month: 9, day: 22,
    time: "09:30",
    title: "整理项目资料",
    detail: "工作事务 · 1小时",
    tone: "blue",
  },
  { id: 6, year: 2026, month: 9, day: 22,
    time: "15:00",
    title: "个人阅读",
    detail: "个人生活 · 45分钟",
    tone: "yellow",
  },
];

const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];
const getWeekday = (year: number, month: number, day: number) =>
  weekdayLabels[new Date(year, month - 1, day).getDay()];
const getScheduleStatus = (item: ScheduleItem) => {
  const now = new Date();
  const start = new Date(`${item.year}-${String(item.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}T${item.time}:00`);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  if (now >= end) return "ended" as const;
  if (now >= start) return "ongoing" as const;
  return "upcoming" as const;
};
const scheduleStatusLabels = { ended: "已结束", ongoing: "进行中", upcoming: "未开始" };
const getCalendarCells = (year: number, month: number) => {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const previousDays = new Date(year, month - 1, 0).getDate();
  return Array.from({ length: 42 }, (_, index) => {
    const offset = index - firstDay + 1;
    if (offset < 1) return { day: previousDays + offset, monthOffset: -1 };
    if (offset > daysInMonth) return { day: offset - daysInMonth, monthOffset: 1 };
    return { day: offset, monthOffset: 0 };
  });
};
const calendarWeeks = Array.from({ length: 5 }, (_, week) =>
  getCalendarCells(2026, 9).slice(week * 7, week * 7 + 7).map((cell) => cell.day),
);

function App() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [activeNav, setActiveNav] = useState("工作台");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [todos, setTodos] = useState(initialTodos);
  const [animatingTodoIds, setAnimatingTodoIds] = useState<Set<number>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [newTodo, setNewTodo] = useState("");
  const [calendarYear, setCalendarYear] = useState(2026);
  const [calendarMonth, setCalendarMonth] = useState(9);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(9);
  const [selectedDay, setSelectedDayState] = useState(21);
  const [scheduleItems, setScheduleItems] = useState(initialSchedule);
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);
  const [modalTodoTitle, setModalTodoTitle] = useState("");
  const [modalTodoDate, setModalTodoDate] = useState("2026-09-21");
  const [modalTodoTime, setModalTodoTime] = useState("09:00");
  const [modalTodoType, setModalTodoType] =
    useState<ScheduleItem["tone"]>("coral");
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { setAuthReady(true); return; }
    Promise.all([
      apiFetch<{ schedules: ScheduleItem[] }>("/schedules"),
      apiFetch<{ todos: Array<Todo & { completed: boolean }> }>("/todos"),
    ]).then(([scheduleResult, todoResult]) => {
      setScheduleItems(scheduleResult.schedules);
      setTodos(todoResult.todos.map((todo) => ({ ...todo, done: todo.completed })));
      return getCurrentUser().then(setUser);
    }).catch(() => clearToken()).finally(() => setAuthReady(true));
  }, []);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setAuthError("");
    try {
      const nextUser = authMode === "login" ? await login(authEmail, authPassword) : await register(authEmail, authPassword, authName);
      setUser(nextUser);
      if (authMode === "register") { setScheduleItems([]); setTodos([]); }
      const scheduleResult = await apiFetch<{ schedules: ScheduleItem[] }>("/schedules");
      const todoResult = await apiFetch<{ todos: Array<Todo & { completed: boolean }> }>("/todos");
      setScheduleItems(scheduleResult.schedules);
      setTodos(todoResult.todos.map((todo) => ({ ...todo, done: todo.completed })));
    } catch (error) { setAuthError(error instanceof Error ? error.message : "操作失败"); }
  };

  const setSelectedDay = (day: number) => {
    setSelectedDayState(day);
    setSelectedYear(calendarYear);
    setSelectedMonth(calendarMonth);
    setModalTodoDate(`${calendarYear}-${String(calendarMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  };

  const changeCalendarMonth = (offset: number) => {
    const nextDate = new Date(calendarYear, calendarMonth - 1 + offset, 1);
    const nextYear = nextDate.getFullYear();
    const nextMonth = nextDate.getMonth() + 1;
    setCalendarYear(nextYear);
    setCalendarMonth(nextMonth);
    setSelectedYear(nextYear);
    setSelectedMonth(nextMonth);
    setSelectedDayState(1);
    setModalTodoDate(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`);
  };

  const completedCount = todos.filter((todo) => todo.done).length;
  const toggleTodo = (id: number) => {
    const target = todos.find((todo) => todo.id === id);
    if (!target) return;
    if (target.done) {
      setTodos((current) => current.map((todo) => (todo.id === id ? { ...todo, done: false } : todo)));
      void apiFetch(`/todos/${id}`, { method: "PATCH", body: JSON.stringify({ completed: false }) });
      return;
    }
    setTodos((current) => current.map((todo) => (todo.id === id ? { ...todo, done: true } : todo)));
    void apiFetch(`/todos/${id}`, { method: "PATCH", body: JSON.stringify({ completed: true }) });
    setAnimatingTodoIds((current) => new Set(current).add(id));
    window.setTimeout(() => {
      setTodos((current) => current.filter((todo) => todo.id !== id));
      setAnimatingTodoIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }, 420);
  };

  const addTodo = () => {
    const title = newTodo.trim();
    if (!title) return;
    setTodos((current) => [
      ...current,
      {
        id: Date.now(),
        title,
        meta: "今天 · 待安排",
        done: false,
        tone: "blue",
      },
    ]);
    void apiFetch<{ todo: Todo }>("/todos", { method: "POST", body: JSON.stringify({ title, meta: "今天 · 待安排", tone: "blue" }) });
    setNewTodo("");
  };

  const addTodayTodo = () => {
    const title = modalTodoTitle.trim();
    if (!title) return;
    const day = Number(modalTodoDate.slice(-2));
    const detail = modalTodoType === "coral" ? "工作安排" : modalTodoType === "blue" ? "会议沟通" : "个人生活";
    const payload = { year: Number(modalTodoDate.slice(0, 4)), month: Number(modalTodoDate.slice(5, 7)), day, time: modalTodoTime, title, detail, tone: modalTodoType };
    setScheduleItems((current) => editingScheduleId === null
        ? [...current, { id: Date.now(), ...payload }]
      : current.map((item) => item.id === editingScheduleId ? { ...item, ...payload } : item));
    void apiFetch(editingScheduleId === null ? "/schedules" : `/schedules/${editingScheduleId}`, { method: editingScheduleId === null ? "POST" : "PUT", body: JSON.stringify(payload) });
    setSelectedYear(Number(modalTodoDate.slice(0, 4)));
    setSelectedMonth(Number(modalTodoDate.slice(5, 7)));
    setCalendarYear(Number(modalTodoDate.slice(0, 4)));
    setCalendarMonth(Number(modalTodoDate.slice(5, 7)));
    setSelectedDayState(day);
    setModalTodoTitle("");
    setEditingScheduleId(null);
    setIsTodoModalOpen(false);
  };

  const openNewSchedule = () => {
    setEditingScheduleId(null);
    setModalTodoTitle("");
    setModalTodoDate(`${calendarYear}-${String(calendarMonth).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`);
    setModalTodoTime("09:00");
    setModalTodoType("coral");
    setIsTodoModalOpen(true);
  };

  const openEditSchedule = (item: ScheduleItem) => {
    setEditingScheduleId(item.id);
    setModalTodoTitle(item.title);
    setModalTodoDate(`${item.year}-${String(item.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}`);
    setSelectedYear(item.year);
    setSelectedMonth(item.month);
    setCalendarYear(item.year);
    setCalendarMonth(item.month);
    setSelectedDayState(item.day);
    setModalTodoTime(item.time);
    setModalTodoType(item.tone);
    setIsTodoModalOpen(true);
  };

  const deleteSchedule = (id: number) => {
    if (!window.confirm("确定要删除这条日程吗？")) return;
    setScheduleItems((current) => current.filter((item) => item.id !== id));
    void apiFetch(`/schedules/${id}`, { method: "DELETE" });
  };

  if (!authReady) return <div className="auth-loading">正在连接工作区...</div>;
  if (!user) return <main className="auth-page"><form className="auth-card" onSubmit={submitAuth}><span className="modal-symbol">◒</span><p className="eyebrow">WORK LIFE BALANCE</p><h1>{authMode === "login" ? "登录你的工作区" : "创建工作区"}</h1><p className="auth-subtitle">{authMode === "login" ? "登录后，你的日程和待办会自动保存。" : "创建账户，开始和团队一起协作。"}</p>{authMode === "register" && <input value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="你的名字" required /> }<input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="邮箱" required /><input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="密码（至少 8 位）" minLength={8} required />{authError && <p className="auth-error">{authError}</p>}<button className="primary-button auth-submit" type="submit">{authMode === "login" ? "登录" : "注册并开始使用"}</button><button className="auth-switch" type="button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}>{authMode === "login" ? "还没有账户？创建一个" : "已有账户？返回登录"}</button></form></main>;

  const renderTodoList = () => (
    <article className="todo-card full-card">
      <div className="card-header">
        <div>
          <h2>To do list</h2>
          <p>把任务拆小，逐项完成</p>
        </div>
        <span className="todo-count">
          {completedCount}/{todos.length} 已完成
        </span>
      </div>
      <div className="todo-list">
        {todos.map((todo) => (
          <label
            className={`todo-item ${todo.done ? "done" : ""} ${animatingTodoIds.has(todo.id) ? "archiving" : ""}`}
            key={todo.id}
          >
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => toggleTodo(todo.id)}
            />
            <span className={`custom-check ${todo.done ? "checked" : ""}`}>
              {todo.done ? "✓" : ""}
            </span>
            <span className="todo-copy">
              <strong>{todo.title}</strong>
              <small>
                <i className={`tone-dot ${todo.tone}`}></i>
                {todo.meta}
              </small>
            </span>
            <span className="todo-menu">···</span>
          </label>
        ))}
      </div>
      <div className="add-todo">
        <input
          value={newTodo}
          onChange={(event) => setNewTodo(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && addTodo()}
          placeholder="添加一个待办..."
        />
        <button onClick={addTodo} aria-label="添加待办">
          ＋
        </button>
      </div>
    </article>
  );

  const renderMeetingView = () => (
    <section className="tool-view">
      <div className="tool-heading">
        <div>
          <p className="eyebrow">MEETING INTELLIGENCE</p>
          <h2>会议内容总结</h2>
          <p>上传音频，或连接设备开始记录，稍后生成会议纪要。</p>
        </div>
        <span className="status-pill">● 本地演示模式</span>
      </div>
      <div className="meeting-tool-grid">
        <article className="upload-panel">
          <div className="upload-icon">◉</div>
          <h3>导入会议音频</h3>
          <p>支持 MP3、M4A、WAV 文件</p>
          <label className="upload-button">
            选择音频文件
            <input
              type="file"
              accept="audio/*"
              onChange={() => setIsRecording(true)}
            />
          </label>
          <span className="or-line">或</span>
          <button
            className={`record-button large-record ${isRecording ? "recording" : ""}`}
            onClick={() => setIsRecording(!isRecording)}
          >
            <span>{isRecording ? "■" : "●"}</span>
            {isRecording ? "正在记录会议" : "使用麦克风开始记录"}
          </button>
        </article>
        <article className="summary-panel">
          <div className="card-header">
            <div>
              <h3>会议纪要</h3>
              <p>
                {isRecording
                  ? "正在接收会议内容..."
                  : "完成录音后，AI 总结会显示在这里"}
              </p>
            </div>
            <span className="ai-badge">AI</span>
          </div>
          <div className="summary-placeholder">
            <span>✦</span>
            <strong>
              {isRecording ? "正在记录，请专注于会议" : "暂无会议内容"}
            </strong>
            <p>
              {isRecording
                ? "会议结束后即可生成摘要、决策和待办。"
                : "导入音频或开始记录，自动提取重点。"}
            </p>
          </div>
        </article>
      </div>
    </section>
  );

  const renderLegacyScheduleView = () => (
    <section className="tool-view">
      <div className="tool-heading">
        <div>
          <p className="eyebrow">YOUR DAY, IN FOCUS</p>
          <h2>日程安排</h2>
          <p>选择一个日期，查看当天详细安排。</p>
        </div>
        <button
          className="primary-button"
          onClick={() => document.getElementById("schedule-title")?.focus()}
        >
          <span>＋</span> 添加日程
        </button>
      </div>
      <div className="schedule-layout">
        <article className="agenda-card calendar-card">
          <div className="calendar-header">
            <button className="calendar-arrow" aria-label="上个月">
              ‹
            </button>
            <h3>2026年 9月</h3>
            <button className="calendar-arrow" aria-label="下个月">
              ›
            </button>
          </div>
          <div className="weekday-row">
            {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {calendarWeeks.flatMap((week, weekIndex) =>
              week.map((day, dayIndex) => {
                const isOtherMonth =
                  (weekIndex === 0 && day > 20) || (weekIndex === 4 && day < 7);
                const hasEvents = [21, 22, 24].includes(day) && !isOtherMonth;
                return (
                  <button
                    key={`${weekIndex}-${dayIndex}`}
                    className={`calendar-day ${isOtherMonth ? "other-month" : ""} ${selectedDay === day && !isOtherMonth ? "selected" : ""} ${day === 21 && !isOtherMonth ? "today" : ""}`}
                    onClick={() => !isOtherMonth && setSelectedDay(day)}
                  >
                    <span>{day}</span>
                    {hasEvents && <i></i>}
                  </button>
                );
              }),
            )}
          </div>
          <div className="calendar-legend">
            <span>
              <i className="legend-coral"></i>有安排
            </span>
            <span>
              <i className="legend-today"></i>今天
            </span>
          </div>
        </article>
        <article className="agenda-card day-card">
          <div className="card-header">
            <div>
              <h3>
                {selectedMonth}月{selectedDay}日 · 周{getWeekday(selectedYear, selectedMonth, selectedDay)}
              </h3>
              <p>{selectedDay === 21 ? "今天 · 4项安排" : "共 2 项安排"}</p>
            </div>
            <span className="status-pill">
              {selectedDay === 21 ? "今天" : "已选择"}
            </span>
          </div>
          <div className="agenda-list">
            {selectedDay === 21 ? (
              <>
                <div className="agenda-item">
                  <span className="agenda-time">10:00</span>
                  <span className="agenda-line coral-line"></span>
                  <span>
                    <strong>产品周会</strong>
                    <small>产品、设计团队 · 1小时</small>
                  </span>
                </div>
                <div className="agenda-item">
                  <span className="agenda-time">14:00</span>
                  <span className="agenda-line coral-line"></span>
                  <span>
                    <strong>深度工作时间</strong>
                    <small>产品方案 · 2小时</small>
                  </span>
                </div>
                <div className="agenda-item">
                  <span className="agenda-time">16:30</span>
                  <span className="agenda-line blue-line"></span>
                  <span>
                    <strong>与陈默 1:1</strong>
                    <small>线上会议 · 30分钟</small>
                  </span>
                </div>
                <div className="agenda-item muted-agenda">
                  <span className="agenda-time">19:00</span>
                  <span className="agenda-line yellow-line"></span>
                  <span>
                    <strong>晚间跑步</strong>
                    <small>个人生活 · 45分钟</small>
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="agenda-item">
                  <span className="agenda-time">09:30</span>
                  <span className="agenda-line blue-line"></span>
                  <span>
                    <strong>整理项目资料</strong>
                    <small>工作事务 · 1小时</small>
                  </span>
                </div>
                <div className="agenda-item">
                  <span className="agenda-time">15:00</span>
                  <span className="agenda-line yellow-line"></span>
                  <span>
                    <strong>个人阅读</strong>
                    <small>个人生活 · 45分钟</small>
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="day-actions">
            <input id="schedule-title" placeholder="添加当天事务..." />
            <button
              className="round-button"
              aria-label="添加事务"
              onClick={() => document.getElementById("schedule-title")?.focus()}
            >
              ＋
            </button>
          </div>
        </article>
      </div>
    </section>
  );

  void renderLegacyScheduleView;
  const renderScheduleView = () => {
    const calendarCells = getCalendarCells(calendarYear, calendarMonth);
    const selectedItems = scheduleItems
      .filter((item) => item.year === selectedYear && item.month === selectedMonth && item.day === selectedDay)
      .sort((first, second) => first.time.localeCompare(second.time));
    const today = new Date();
    const isSelectedToday = selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1 && selectedDay === today.getDate();
    const daysWithEvents = new Set(scheduleItems.filter((item) => item.year === calendarYear && item.month === calendarMonth).map((item) => item.day));
    return (
      <section
        className="tool-view"
        onClick={() => undefined}
      >
        <div className="tool-heading">
          <div>
            <p className="eyebrow">YOUR DAY, IN FOCUS</p>
            <h2>日程安排</h2>
            <p>选择日期，安排工作与生活的节奏。</p>
          </div>
          <button
            className="primary-button"
            onClick={openNewSchedule}
          >
            <span>＋</span> 添加日程
          </button>
        </div>
        <div className="schedule-layout">
          <article className="agenda-card calendar-card">
            <div className="calendar-header">
              <button className="calendar-arrow" aria-label="上个月" onClick={() => changeCalendarMonth(-1)}>
                ‹
              </button>
              <h3>{calendarYear}年 {calendarMonth}月</h3>
              <button className="calendar-arrow" aria-label="下个月" onClick={() => changeCalendarMonth(1)}>
                ›
              </button>
            </div>
            <div className="weekday-row">
              {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {calendarCells.map(({ day, monthOffset }, index) => {
                  const isOtherMonth = monthOffset !== 0;
                  const hasEvents = daysWithEvents.has(day) && !isOtherMonth;
                  return (
                    <button
                      key={`${calendarYear}-${calendarMonth}-${index}`}
                      className={`calendar-day ${isOtherMonth ? "other-month" : ""} ${selectedDay === day && !isOtherMonth ? "selected" : ""} ${day === 21 && !isOtherMonth ? "today" : ""}`}
                      onClick={() => !isOtherMonth && setSelectedDay(day)}
                    >
                      <span>{day}</span>
                      {hasEvents && <i></i>}
                    </button>
                  );
                })}
            </div>
            <div className="calendar-legend">
              <span>
                <i className="legend-coral"></i>有安排
              </span>
              <span>
                <i className="legend-today"></i>今天
              </span>
            </div>
          </article>
          <article className="agenda-card day-card">
            <div className="card-header">
              <div>
                <h3>
                  {selectedMonth}月{selectedDay}日 · 周{getWeekday(selectedYear, selectedMonth, selectedDay)}
                </h3>
                <p>
                  {isSelectedToday ? "今天" : "已选择"} ·{" "}
                  {selectedItems.length}项安排
                </p>
              </div>
              <span className="status-pill">
                {isSelectedToday ? "今天" : "已选择"}
              </span>
            </div>
            <div className="agenda-list">
              {selectedItems.length > 0 ? (
                selectedItems.map((item) => {
                  const status = getScheduleStatus(item);
                  return <div className={`agenda-item schedule-item schedule-${status}`} key={item.id} onClick={() => openEditSchedule(item)}>
                    <span className="agenda-time">{item.time}</span>
                    <span className={`agenda-line ${item.tone}-line`}></span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.detail} · <em className="schedule-status">{scheduleStatusLabels[status]}</em></small>
                    </span>
                    <button className="schedule-delete" aria-label={`删除${item.title}`} onClick={(event) => { event.stopPropagation(); deleteSchedule(item.id); }}>×</button>
                  </div>
                })
              ) : (
                <div className="empty-schedule">
                  <span>○</span>
                  <strong>这一天还没有安排</strong>
                  <small>在下方添加一个日程吧</small>
                </div>
              )}
            </div>
            <div className="daily-thought">
              <span>“</span>
              <p>把今天过好，便是对未来最好的回答。</p>
              <small>今日一念</small>
            </div>
          </article>
        </div>
      </section>
    );
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className="brand">
          <span className="brand-mark">◒</span>
          <span>平衡工作台</span>
        </div>
        <button className="sidebar-toggle" aria-label={isSidebarCollapsed ? "展开侧栏" : "收起侧栏"} onClick={() => setIsSidebarCollapsed((current) => !current)}>{isSidebarCollapsed ? "›" : "‹"}</button>
        <div className="workspace-switcher">
          <span className="avatar avatar-small">{user?.display_name.slice(0, 1)}</span>
          <span>
            <strong>{user?.display_name}的空间</strong>
            <small>个人工作区</small>
          </span>
          <span className="chevron">⌄</span>
        </div>
        <nav className="main-nav" aria-label="主导航">
          <p className="nav-label">导航</p>
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${activeNav === item.label ? "active" : ""}`}
              onClick={() => setActiveNav(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item muted">
            <span className="nav-icon">⚙</span>设置
          </button>
          <div className="profile">
            <span className="avatar">{user?.display_name.slice(0, 1)}</span>
            <span>
              <strong>{user?.display_name}</strong>
              <small>专注工作中</small>
            </span>
            <span className="more">···</span>
          </div>
          <button className="logout-button" onClick={() => { clearToken(); setUser(null); }}>退出登录</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <button className="breadcrumb-link" onClick={() => setActiveNav("工作台")}>工作台</button>
            <span>/</span>
            <button className="breadcrumb-link current" onClick={() => setActiveNav(activeNav)}>{activeNav}</button>
          </div>
          <div className="top-actions">
            <button className="icon-button" title="搜索">
              ⌕
            </button>
            <button className="icon-button" title="通知">
              ♧<i></i>
            </button>
            <span className="date-chip">2026年 9月 21日 · 周一</span>
          </div>
        </header>

        <div className="content-wrap">
          {activeNav === "会议总结" && renderMeetingView()}
          {activeNav === "日程安排" && renderScheduleView()}
          {activeNav === "To do list" && renderTodoList()}
          {activeNav === "工作台" && (
            <>
              <section className="welcome-row">
                <div>
                  <p className="eyebrow">MONDAY, SEPTEMBER 21</p>
                  <h1>
                    下午好，{user?.display_name} <span>✦</span>
                  </h1>
                  <p className="welcome-copy">
                    把注意力放在重要的事情上，剩下的交给我。
                  </p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setActiveNav("会议总结")}
                >
                  <span>＋</span> 新建记录
                </button>
              </section>

              <section className="stats-grid" aria-label="今日概览">
                <div className="stat-card stat-coral">
                  <span className="stat-icon">◷</span>
                  <div>
                    <strong>3</strong>
                    <span>今日会议</span>
                  </div>
                  <small>
                    +1 <em>较昨日</em>
                  </small>
                </div>
                <div className="stat-card stat-blue">
                  <span className="stat-icon">□</span>
                  <div>
                    <strong>{todos.length}</strong>
                    <span>待办事项</span>
                  </div>
                  <small>
                    {completedCount}/{todos.length} <em>已完成</em>
                  </small>
                </div>
                <div className="stat-card stat-yellow">
                  <span className="stat-icon">☼</span>
                  <div>
                    <strong>68%</strong>
                    <span>今日专注度</span>
                  </div>
                  <small>
                    +12% <em>较上周</em>
                  </small>
                </div>
              </section>

              <div className="section-heading">
                <div>
                  <h2>今天的安排</h2>
                  <p>2026年9月21日 · 周一</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => setActiveNav("日程安排")}
                >
                  查看完整日程 <span>→</span>
                </button>
              </div>

              <section className="feature-grid">
                <article className="meeting-card">
                  <div className="card-topline">
                    <span className="live-dot">
                      <i></i>会议总结
                    </span>
                    <span className="card-time">10:00 - 11:00</span>
                  </div>
                  <div className="meeting-title">
                    <span className="meeting-symbol">◉</span>
                    <div>
                      <h3>产品周会</h3>
                      <p>与产品、设计团队的每周同步</p>
                    </div>
                  </div>
                  <div className="meeting-footer">
                    <span className="attendees">
                      <span>周</span>
                      <span>陈</span>
                      <span>+3</span>
                    </span>
                    <button
                      className={`record-button ${isRecording ? "recording" : ""}`}
                      onClick={() => setIsRecording(!isRecording)}
                    >
                      <span>{isRecording ? "■" : "●"}</span>
                      {isRecording ? "正在记录" : "开始记录"}
                    </button>
                  </div>
                </article>
                <article className="agenda-card">
                  <div className="card-header">
                    <h3>日程概览</h3>
                    <button
                      className="round-button"
                      onClick={() => setActiveNav("日程安排")}
                    >
                      ＋
                    </button>
                  </div>
                  <div className="agenda-list">
                    <div className="agenda-item">
                      <span className="agenda-time">14:00</span>
                      <span className="agenda-line coral-line"></span>
                      <span>
                        <strong>深度工作时间</strong>
                        <small>产品方案 · 2小时</small>
                      </span>
                    </div>
                    <div className="agenda-item">
                      <span className="agenda-time">16:30</span>
                      <span className="agenda-line blue-line"></span>
                      <span>
                        <strong>与陈默 1:1</strong>
                        <small>线上会议 · 30分钟</small>
                      </span>
                    </div>
                    <div className="agenda-item muted-agenda">
                      <span className="agenda-time">19:00</span>
                      <span className="agenda-line yellow-line"></span>
                      <span>
                        <strong>晚间跑步</strong>
                        <small>个人生活 · 45分钟</small>
                      </span>
                    </div>
                  </div>
                </article>
              </section>

              <section className="lower-grid">
                <article className="todo-card">
                  <div className="card-header">
                    <div>
                      <h2>待办事项</h2>
                      <p>保持节奏，一次完成一件事</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setActiveNav("To do list")}
                    >
                      全部查看 <span>→</span>
                    </button>
                  </div>
                  <div className="todo-list">
                    {todos.map((todo) => (
                      <label
                        className={`todo-item ${todo.done ? "done" : ""} ${animatingTodoIds.has(todo.id) ? "archiving" : ""}`}
                        key={todo.id}
                      >
                        <input
                          type="checkbox"
                          checked={todo.done}
                          onChange={() => toggleTodo(todo.id)}
                        />
                        <span
                          className={`custom-check ${todo.done ? "checked" : ""}`}
                        >
                          {todo.done ? "✓" : ""}
                        </span>
                        <span className="todo-copy">
                          <strong>{todo.title}</strong>
                          <small>
                            <i className={`tone-dot ${todo.tone}`}></i>
                            {todo.meta}
                          </small>
                        </span>
                        <span className="todo-menu">···</span>
                      </label>
                    ))}
                  </div>
                  <div className="add-todo">
                    <input
                      value={newTodo}
                      onChange={(event) => setNewTodo(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && addTodo()}
                      placeholder="添加一个待办..."
                    />
                    <button onClick={addTodo} aria-label="添加待办">
                      ＋
                    </button>
                  </div>
                </article>
                <article className="insight-card">
                  <div className="insight-kicker">本周工作状态</div>
                  <h2>
                    留一点空间，
                    <br />
                    <span>让思考发生。</span>
                  </h2>
                  <div className="progress-ring">
                    <div>
                      <strong>72</strong>
                      <small>专注指数</small>
                    </div>
                  </div>
                  <p>
                    你本周有 <strong>2.5 小时</strong> 的空白时间，比上周多了
                    18%。
                  </p>
                  <button className="insight-link">
                    查看详细分析 <span>→</span>
                  </button>
                </article>
              </section>

              <div className="future-banner">
                <span className="sparkle">✦</span>
                <div>
                  <strong>准备好迎接更多可能</strong>
                  <p>未来这里会有更多工具，帮你把工作与生活安排得更从容。</p>
                </div>
                <button title="添加新模块">＋</button>
              </div>
            </>
          )}
          {isTodoModalOpen && (
            <div
              className="modal-backdrop"
              onClick={() => setIsTodoModalOpen(false)}
            >
              <div
                className="todo-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="todo-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  className="modal-close"
                  aria-label="关闭"
                  onClick={() => setIsTodoModalOpen(false)}
                >
                  ×
                </button>
                <span className="modal-symbol">✦</span>
                <h2 id="todo-modal-title">{editingScheduleId === null ? "添加日程" : "修改日程"}</h2>
                <p>记录一件需要安排时间的事务。</p>
                <input
                  autoFocus
                  value={modalTodoTitle}
                  onChange={(event) => setModalTodoTitle(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && addTodayTodo()}
                  placeholder="例如：完成项目方案初稿"
                />
                <div className="modal-fields">
                  <input type="date" value={modalTodoDate} onChange={(event) => setModalTodoDate(event.target.value)} />
                  <input type="time" value={modalTodoTime} onChange={(event) => setModalTodoTime(event.target.value)} />
                  <select value={modalTodoType} onChange={(event) => setModalTodoType(event.target.value as ScheduleItem["tone"])}>
                    <option value="coral">工作安排</option>
                    <option value="blue">会议沟通</option>
                    <option value="yellow">个人生活</option>
                  </select>
                </div>
                <div className="modal-actions">
                  <button
                    className="secondary-button"
                    onClick={() => setIsTodoModalOpen(false)}
                  >
                    取消
                  </button>
                  <button className="primary-button" onClick={addTodayTodo}>
                    {editingScheduleId === null ? "保存日程" : "保存修改"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
