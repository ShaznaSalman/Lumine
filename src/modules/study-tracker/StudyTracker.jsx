import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';

const types = ['School', 'Self-study', 'Language', 'Certification', 'Other'];
const difficulties = ['Easy', 'Medium', 'Hard'];
const colors = ['#FEF3C7', '#FDE68A', '#FEE2B3', '#FDE68A', '#FBCBFF'];
const starCount = 5;
const tabs = ['dashboard', 'subjects', 'timer', 'deadlines'];

const formatDateKey = (date) => date.toISOString().split('T')[0];
const friendlyDate = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const daysBetween = (date) => Math.max(0, Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24)));
const startOfWeek = (date) => {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const StudyTracker = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [subjectModal, setSubjectModal] = useState(false);
  const [deadlineModal, setDeadlineModal] = useState(false);
  const [sessionModal, setSessionModal] = useState(null);
  const [pomodoroSubject, setPomodoroSubject] = useState(null);
  const [pomodoroSeconds, setPomodoroSeconds] = useState(25 * 60);
  const [isBreak, setIsBreak] = useState(false);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [newSubject, setNewSubject] = useState({ name: '', emoji: '📘', color: '#FEF3C7', type: 'School', weeklyGoalHours: 3 });
  const [newSession, setNewSession] = useState({ subjectId: '', date: formatDateKey(new Date()), duration: '', notes: '', difficulty: 'Medium', focusRating: 3 });
  const [newDeadline, setNewDeadline] = useState({ subjectId: '', title: '', dueDate: formatDateKey(new Date()), isCompleted: false });

  useEffect(() => {
    if (!currentUser?.uid) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const subjectsRef = collection(db, 'users', currentUser.uid, 'study-tracker', 'subjects');
        const subjectsSnap = await getDocs(query(subjectsRef, orderBy('createdAt', 'desc')));
        setSubjects(subjectsSnap.docs.map((docSnap, index) => ({ id: docSnap.id, color: docSnap.data().color || colors[index % colors.length], ...docSnap.data() })));

        const sessionsRef = collection(db, 'users', currentUser.uid, 'study-tracker', 'sessions');
        const sessionsSnap = await getDocs(query(sessionsRef, orderBy('date', 'desc')));
        setSessions(sessionsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));

        const deadlinesRef = collection(db, 'users', currentUser.uid, 'study-tracker', 'deadlines');
        const deadlinesSnap = await getDocs(query(deadlinesRef, orderBy('dueDate', 'asc')));
        setDeadlines(deadlinesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      } catch (error) {
        console.error('Study tracker load error', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentUser]);

  useEffect(() => {
    if (!pomodoroRunning) return undefined;
    const interval = window.setInterval(() => {
      setPomodoroSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setPomodoroRunning(false);
          if (!isBreak) setPomodoroCount((count) => count + 1);
          setIsBreak((prevBreak) => !prevBreak);
          setPomodoroSeconds(isBreak ? 25 * 60 : 5 * 60);
          return prev;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [pomodoroRunning, isBreak]);

  const subjectMap = useMemo(() => subjects.reduce((map, subject) => ({ ...map, [subject.id]: subject }), {}), [subjects]);

  const currentWeekKey = useMemo(() => formatDateKey(startOfWeek(new Date())), []);
  const monthKey = useMemo(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`, []);

  const stats = useMemo(() => {
    return subjects.map((subject) => {
      const subjectSessions = sessions.filter((session) => session.subjectId === subject.id);
      const weekHours = subjectSessions.reduce((sum, session) => {
        const key = formatDateKey(startOfWeek(session.date.toDate()));
        return key === currentWeekKey ? sum + (Number(session.duration) || 0) / 60 : sum;
      }, 0);
      const monthHours = subjectSessions.reduce((sum, session) => {
        const sessionMonth = `${session.date.toDate().getFullYear()}-${String(session.date.toDate().getMonth() + 1).padStart(2, '0')}`;
        return sessionMonth === monthKey ? sum + (Number(session.duration) || 0) / 60 : sum;
      }, 0);
      const longest = subjectSessions.reduce((max, session) => Math.max(max, Number(session.duration) || 0), 0);
      const daySet = [...new Set(subjectSessions.map((session) => formatDateKey(session.date.toDate())))];
      let streak = 0;
      let cursor = new Date();
      while (true) {
        const key = formatDateKey(cursor);
        if (daySet.includes(key)) {
          streak += 1;
          cursor.setDate(cursor.getDate() - 1);
        } else break;
      }
      return { subject, weekHours, monthHours, longest, streak, sessions: subjectSessions };
    });
  }, [subjects, sessions, currentWeekKey, monthKey]);

  const totalMonthHours = stats.reduce((sum, item) => sum + item.monthHours, 0);
  const todayStudy = sessions.reduce((sum, session) => (formatDateKey(session.date.toDate()) === formatDateKey(new Date()) ? sum + (Number(session.duration) || 0) : sum), 0);
  const activeSubject = sessions.length ? subjectMap[sessions[0].subjectId]?.name : 'None';

  const addSubject = async () => {
    if (!currentUser?.uid || !newSubject.name.trim()) return;
    try {
      const ref = doc(collection(db, 'users', currentUser.uid, 'study-tracker', 'subjects'));
      await setDoc(ref, { ...newSubject, createdAt: Timestamp.now() });
      setSubjects((prev) => [{ id: ref.id, ...newSubject, createdAt: Timestamp.now() }, ...prev]);
      setSubjectModal(false);
      setNewSubject({ name: '', emoji: '📘', color: '#FEF3C7', type: 'School', weeklyGoalHours: 3 });
    } catch (error) {
      console.error('Add subject error', error);
    }
  };

  const logSession = async () => {
    if (!currentUser?.uid || !newSession.subjectId || !newSession.duration) return;
    try {
      const ref = doc(collection(db, 'users', currentUser.uid, 'study-tracker', 'sessions'));
      const payload = {
        ...newSession,
        duration: Number(newSession.duration),
        date: Timestamp.fromDate(new Date(`${newSession.date}T12:00:00`)),
        pomodoros: pomodoroCount
      };
      await setDoc(ref, payload);
      setSessions((prev) => [{ id: ref.id, ...payload }, ...prev]);
      setSessionModal(null);
      setNewSession({ subjectId: '', date: formatDateKey(new Date()), duration: '', notes: '', difficulty: 'Medium', focusRating: 3 });
      setPomodoroCount(0);
    } catch (error) {
      console.error('Log session error', error);
    }
  };

  const addDeadline = async () => {
    if (!currentUser?.uid || !newDeadline.subjectId || !newDeadline.title.trim()) return;
    try {
      const ref = doc(collection(db, 'users', currentUser.uid, 'study-tracker', 'deadlines'));
      const payload = {
        ...newDeadline,
        dueDate: Timestamp.fromDate(new Date(`${newDeadline.dueDate}T12:00:00`)),
        isCompleted: false
      };
      await setDoc(ref, payload);
      setDeadlines((prev) => [{ id: ref.id, ...payload }, ...prev]);
      setDeadlineModal(false);
      setNewDeadline({ subjectId: '', title: '', dueDate: formatDateKey(new Date()), isCompleted: false });
    } catch (error) {
      console.error('Add deadline error', error);
    }
  };

  const toggleDeadlineComplete = async (deadlineId) => {
    if (!currentUser?.uid) return;
    try {
      const deadlineRef = doc(db, 'users', currentUser.uid, 'study-tracker', 'deadlines', deadlineId);
      const deadline = deadlines.find((item) => item.id === deadlineId);
      if (!deadline) return;
      await setDoc(deadlineRef, { ...deadline, isCompleted: !deadline.isCompleted });
      setDeadlines((prev) => prev.map((item) => (item.id === deadlineId ? { ...item, isCompleted: !item.isCompleted } : item)));
    } catch (error) {
      console.error('Toggle deadline complete error', error);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const startPomodoro = (subjectId) => {
    setPomodoroSubject(subjectId);
    setIsBreak(false);
    setPomodoroSeconds(25 * 60);
    setPomodoroRunning(true);
  };

  const pausePomodoro = () => setPomodoroRunning(false);
  const resetPomodoro = () => {
    setPomodoroRunning(false);
    setPomodoroSeconds(25 * 60);
    setIsBreak(false);
    setPomodoroCount(0);
  };

  if (loading) {
    return <div className="min-h-screen bg-[#FFFBEB] flex items-center justify-center text-[#92400E]">Loading study tracker…</div>;
  }

  return (
    <div className="min-h-screen bg-[#FFFBEB] px-4 py-6 text-[#713F12] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[#FDE68A] bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#B45309]">Study Tracker</p>
              <h1 className="mt-3 text-4xl font-semibold text-[#78350F]">Keep your study flow warm and focused.</h1>
              <p className="mt-2 text-sm text-[#92400E]">Track subjects, pomodoros, deadlines, and study notes in a calm yellow space.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-full bg-[#FEF3C7] px-5 py-3 text-sm font-semibold text-[#92400E]">Today {Math.round(todayStudy)} min</div>
              <div className="rounded-full bg-[#FEF3C7] px-5 py-3 text-sm font-semibold text-[#92400E]">Active subject {activeSubject}</div>
            </div>
          </div>
        </section>

        <nav className="grid gap-2 sm:grid-cols-4">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${activeTab === tab ? 'bg-[#F59E0B] text-white' : 'bg-[#FEF3C7] text-[#92400E]'}`}
            >
              {tab === 'dashboard' ? 'Dashboard' : tab === 'subjects' ? 'Subjects' : tab === 'timer' ? 'Timer' : 'Deadlines'}
            </button>
          ))}
        </nav>

        {activeTab === 'dashboard' && (
          <section className="rounded-[2rem] border border-[#FDE68A] bg-white p-6 shadow-soft">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-[2rem] bg-[#FEF9C3] p-6 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#B45309]">This month</p>
                <p className="mt-4 text-4xl font-semibold text-[#78350F]">{totalMonthHours.toFixed(1)}h</p>
              </div>
              <div className="rounded-[2rem] bg-[#FEF9C3] p-6 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#B45309]">Streak</p>
                <p className="mt-4 text-4xl font-semibold text-[#78350F]">{Math.max(...stats.map((item) => item.streak), 0)}d</p>
              </div>
              <div className="rounded-[2rem] bg-[#FEF9C3] p-6 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#B45309]">Subjects</p>
                <p className="mt-4 text-4xl font-semibold text-[#78350F]">{subjects.length}</p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {stats.map((item) => {
                const progress = item.subject.weeklyGoalHours > 0 ? Math.min(100, Math.round((item.weekHours / item.subject.weeklyGoalHours) * 100)) : 0;
                return (
                  <div key={item.subject.id} className="rounded-[2rem] bg-[#FFFBEB] p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-[#78350F]">{item.subject.emoji} {item.subject.name}</p>
                        <p className="text-sm text-[#92400E]">{item.weekHours.toFixed(1)}h this week • Goal {item.subject.weeklyGoalHours}h</p>
                      </div>
                      <div className="rounded-full bg-[#FDE68A] px-4 py-2 text-sm font-semibold text-[#92400E]">{progress}%</div>
                    </div>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#FFF7CD]">
                      <div className="h-3 rounded-full bg-[#F59E0B]" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === 'subjects' && (
          <section className="rounded-[2rem] border border-[#FDE68A] bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#B45309]">Subjects</p>
                <p className="mt-2 text-sm text-[#92400E]">Add courses and review your weekly goals.</p>
              </div>
              <button
                type="button"
                onClick={() => setSubjectModal(true)}
                className="rounded-full bg-[#F59E0B] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#D97706]"
              >
                + Add subject
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {subjects.map((subject) => {
                const item = stats.find((stat) => stat.subject.id === subject.id);
                const progress = item?.subject.weeklyGoalHours ? Math.min(100, Math.round((item.weekHours / item.subject.weeklyGoalHours) * 100)) : 0;
                return (
                  <div key={subject.id} className="rounded-[2rem] border border-[#FDE68A] bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xl font-semibold text-[#78350F]">{subject.emoji} {subject.name}</p>
                        <p className="mt-1 text-sm text-[#92400E]">{subject.type}</p>
                      </div>
                      <div className="rounded-full bg-[#FEF3C7] px-3 py-2 text-sm font-semibold text-[#92400E]">{subject.skillLevel}</div>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm text-[#92400E]">Weekly progress</p>
                      <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#FFF7CD]">
                        <div className="h-3 rounded-full bg-[#F59E0B]" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm text-[#92400E]">
                        <span>{item?.weekHours.toFixed(1) || 0}h</span>
                        <span>{progress}%</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSessionModal(subject)}
                      className="mt-4 w-full rounded-full bg-[#F59E0B] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#D97706]"
                    >
                      Log session
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === 'timer' && (
          <section className="rounded-[2rem] border border-[#FDE68A] bg-white p-6 shadow-soft">
            <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-[2rem] bg-[#FEF3C7] p-6 text-center shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#B45309]">Pomodoro timer</p>
                <div className="mx-auto mt-6 flex h-72 w-72 items-center justify-center rounded-full bg-[#FFF7CD] shadow-inner">
                  <div className="h-56 w-56 rounded-full bg-[#F59E0B]/20 p-8">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white shadow-lg">
                      <p className="text-5xl font-semibold text-[#78350F]">{formatTime(pomodoroSeconds)}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => startPomodoro(pomodoroSubject || (subjects[0] && subjects[0].id))}
                    className="rounded-full bg-[#F59E0B] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#D97706]"
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    onClick={pausePomodoro}
                    className="rounded-full bg-[#FDE68A] px-5 py-3 text-sm font-semibold text-[#92400E]"
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    onClick={resetPomodoro}
                    className="rounded-full bg-[#FEF3C7] px-5 py-3 text-sm font-semibold text-[#92400E]"
                  >
                    Reset
                  </button>
                </div>
                <div className="mt-4 text-sm text-[#92400E]">Current subject: {subjectMap[pomodoroSubject]?.name || 'None selected'}</div>
              </div>
              <div className="rounded-[2rem] bg-[#FEF3C7] p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#B45309]">Pomodoro details</p>
                <div className="mt-4 space-y-3">
                  <select
                    value={pomodoroSubject || ''}
                    onChange={(e) => setPomodoroSubject(e.target.value)}
                    className="w-full rounded-[1.75rem] border border-[#FDE68A] bg-white px-4 py-3 outline-none"
                  >
                    <option value="">Select subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                  <div className="rounded-[1.75rem] bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-[#78350F]">Completed pomodoros</p>
                    <p className="mt-2 text-3xl font-semibold text-[#92400E]">{pomodoroCount}</p>
                  </div>
                  <div className="rounded-[1.75rem] bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-[#78350F]">Current mode</p>
                    <p className="mt-2 text-xl font-semibold text-[#92400E]">{isBreak ? 'Break' : 'Study'}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'deadlines' && (
          <section className="rounded-[2rem] border border-[#FDE68A] bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#B45309]">Deadlines</p>
                <p className="mt-2 text-sm text-[#92400E]">Track exams, assignments, and countdowns.</p>
              </div>
              <button
                type="button"
                onClick={() => setDeadlineModal(true)}
                className="rounded-full bg-[#F59E0B] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#D97706]"
              >
                + Add deadline
              </button>
            </div>
            <div className="mt-6 space-y-4">
              {deadlines.map((deadline) => {
                const dueDays = daysBetween(deadline.dueDate.toDate());
                return (
                  <div key={deadline.id} className="rounded-[2rem] bg-[#FEF9C7] p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-[#78350F]">{deadline.title}</p>
                        <p className="mt-1 text-sm text-[#92400E]">{subjectMap[deadline.subjectId]?.name || 'Unknown subject'}</p>
                      </div>
                      <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#92400E]">{dueDays} days</div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#92400E]">
                      <span>Due {friendlyDate(deadline.dueDate.toDate())}</span>
                      <button
                        type="button"
                        onClick={() => toggleDeadlineComplete(deadline.id)}
                        className={`rounded-full px-4 py-2 ${deadline.isCompleted ? 'bg-[#BBF7D0] text-[#166534]' : 'bg-[#FDE68A] text-[#92400E]'}`}
                      >
                        {deadline.isCompleted ? 'Completed' : 'Mark complete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {subjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#B45309]">New subject</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#78350F]">Add a study subject</h2>
              </div>
              <button type="button" onClick={() => setSubjectModal(false)} className="rounded-full bg-[#FEF3C7] px-4 py-2 text-sm text-[#92400E]">Close</button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <input
                value={newSubject.name}
                onChange={(e) => setNewSubject((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Subject name"
                className="rounded-3xl border border-[#FDE68A] bg-[#FEF9C7] px-4 py-3 outline-none"
              />
              <input
                value={newSubject.emoji}
                onChange={(e) => setNewSubject((prev) => ({ ...prev, emoji: e.target.value }))}
                placeholder="Emoji"
                className="rounded-3xl border border-[#FDE68A] bg-[#FEF9C7] px-4 py-3 outline-none"
              />
              <select
                value={newSubject.type}
                onChange={(e) => setNewSubject((prev) => ({ ...prev, type: e.target.value }))}
                className="rounded-3xl border border-[#FDE68A] bg-[#FEF9C7] px-4 py-3 outline-none"
              >
                {types.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={newSubject.weeklyGoalHours}
                onChange={(e) => setNewSubject((prev) => ({ ...prev, weeklyGoalHours: Number(e.target.value) }))}
                placeholder="Weekly goal hours"
                className="rounded-3xl border border-[#FDE68A] bg-[#FEF9C7] px-4 py-3 outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setSubjectModal(false)} className="rounded-full bg-[#FEF3C7] px-5 py-3 text-sm font-semibold text-[#92400E]">Cancel</button>
              <button type="button" onClick={addSubject} className="rounded-full bg-[#F59E0B] px-5 py-3 text-sm font-semibold text-white">Create subject</button>
            </div>
          </div>
        </div>
      )}

      {sessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#B45309]">Study session</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#78350F]">{sessionModal.name}</h2>
              </div>
              <button type="button" onClick={() => setSessionModal(null)} className="rounded-full bg-[#FEF3C7] px-4 py-2 text-sm text-[#92400E]">Close</button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <input
                type="date"
                value={newSession.date}
                onChange={(e) => setNewSession((prev) => ({ ...prev, date: e.target.value }))}
                className="rounded-3xl border border-[#FDE68A] bg-[#FEF9C7] px-4 py-3 outline-none"
              />
              <input
                type="number"
                min="1"
                value={newSession.duration}
                onChange={(e) => setNewSession((prev) => ({ ...prev, duration: e.target.value }))}
                placeholder="Duration (minutes)"
                className="rounded-3xl border border-[#FDE68A] bg-[#FEF9C7] px-4 py-3 outline-none"
              />
              <select
                value={newSession.difficulty}
                onChange={(e) => setNewSession((prev) => ({ ...prev, difficulty: e.target.value }))}
                className="rounded-3xl border border-[#FDE68A] bg-[#FEF9C7] px-4 py-3 outline-none"
              >
                {difficulties.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <select
                value={newSession.focusRating}
                onChange={(e) => setNewSession((prev) => ({ ...prev, focusRating: Number(e.target.value) }))}
                className="rounded-3xl border border-[#FDE68A] bg-[#FEF9C7] px-4 py-3 outline-none"
              >
                {Array.from({ length: starCount }, (_, index) => index + 1).map((rating) => (
                  <option key={rating} value={rating}>{rating} stars</option>
                ))}
              </select>
              <textarea
                value={newSession.notes}
                onChange={(e) => setNewSession((prev) => ({ ...prev, notes: e.target.value }))}
                rows="3"
                placeholder="What did you cover?"
                className="col-span-2 rounded-[1.75rem] border border-[#FDE68A] bg-[#FEF9C7] px-4 py-3 outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setSessionModal(null)} className="rounded-full bg-[#FEF3C7] px-5 py-3 text-sm font-semibold text-[#92400E]">Cancel</button>
              <button type="button" onClick={logSession} className="rounded-full bg-[#F59E0B] px-5 py-3 text-sm font-semibold text-white">Save session</button>
            </div>
          </div>
        </div>
      )}

      {deadlineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#B45309]">New deadline</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#78350F]">Create deadline</h2>
              </div>
              <button type="button" onClick={() => setDeadlineModal(false)} className="rounded-full bg-[#FEF3C7] px-4 py-2 text-sm text-[#92400E]">Close</button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <select
                value={newDeadline.subjectId}
                onChange={(e) => setNewDeadline((prev) => ({ ...prev, subjectId: e.target.value }))}
                className="rounded-3xl border border-[#FDE68A] bg-[#FEF9C7] px-4 py-3 outline-none"
              >
                <option value="">Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
              <input
                value={newDeadline.title}
                onChange={(e) => setNewDeadline((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Title"
                className="rounded-3xl border border-[#FDE68A] bg-[#FEF9C7] px-4 py-3 outline-none"
              />
              <input
                type="date"
                value={newDeadline.dueDate}
                onChange={(e) => setNewDeadline((prev) => ({ ...prev, dueDate: e.target.value }))}
                className="rounded-3xl border border-[#FDE68A] bg-[#FEF9C7] px-4 py-3 outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeadlineModal(false)} className="rounded-full bg-[#FEF3C7] px-5 py-3 text-sm font-semibold text-[#92400E]">Cancel</button>
              <button type="button" onClick={addDeadline} className="rounded-full bg-[#F59E0B] px-5 py-3 text-sm font-semibold text-white">Save deadline</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyTracker;
