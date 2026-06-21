import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';

const durations = [5, 10, 15, 20, 30];
const sessionTypes = ['Mindfulness', 'Breathing', 'Body Scan', 'Visualisation', 'Gratitude', 'Silent', 'Dhikr-based'];
const moodOptions = ['😞', '😐', '🙂', '😊', '😌'];
const breathingExercises = [
  { id: '4-7-8', label: '4-7-8 breathing', pattern: [4, 7, 8], steps: ['Inhale', 'Hold', 'Exhale'] },
  { id: 'box', label: 'Box breathing', pattern: [4, 4, 4, 4], steps: ['Inhale', 'Hold', 'Exhale', 'Hold'] },
  { id: 'simple', label: 'Simple deep breathing', pattern: [4, 4], steps: ['Inhale', 'Exhale'] }
];

const formatDateKey = (date) => date.toISOString().split('T')[0];
const friendlyDate = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const friendlyLongDate = (date) => date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

const Meditation = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timer');
  const [sessions, setSessions] = useState([]);
  const [gratitudeEntries, setGratitudeEntries] = useState([]);
  const [selectedDuration, setSelectedDuration] = useState(10);
  const [customDuration, setCustomDuration] = useState('');
  const [sessionType, setSessionType] = useState('Mindfulness');
  const [moodBefore, setMoodBefore] = useState(null);
  const [moodAfter, setMoodAfter] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(10 * 60);
  const [timerState, setTimerState] = useState('stopped');
  const [phase, setPhase] = useState('inhale');
  const [sessionStart, setSessionStart] = useState(null);
  const [breathingMode, setBreathingMode] = useState('4-7-8');
  const [breathingStep, setBreathingStep] = useState(0);
  const [breathingTimeLeft, setBreathingTimeLeft] = useState(4);
  const [breathingRunning, setBreathingRunning] = useState(false);
  const [gratitudeDate, setGratitudeDate] = useState(formatDateKey(new Date()));
  const [gratitudeRows, setGratitudeRows] = useState(['', '', '']);
  const timerRef = useRef(null);
  const breathingRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const loadMeditationData = async () => {
      setLoading(true);
      try {
        const sessionsRef = collection(db, 'users', currentUser.uid, 'meditation', 'sessions');
        const sessionsQuery = query(sessionsRef, orderBy('date', 'desc'));
        const sessionsSnap = await getDocs(sessionsQuery);
        setSessions(sessionsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));

        const gratitudeRef = collection(db, 'users', currentUser.uid, 'meditation', 'gratitude');
        const gratitudeSnap = await getDocs(gratitudeRef);
        const gratitudeList = gratitudeSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setGratitudeEntries(gratitudeList.sort((a, b) => (a.id < b.id ? 1 : -1)));
      } catch (error) {
        console.error('Meditation load error', error);
      } finally {
        setLoading(false);
      }
    };

    loadMeditationData();
  }, [currentUser]);

  useEffect(() => {
    if (timerState !== 'running') return undefined;
    timerRef.current = window.setInterval(() => {
      setTimerSeconds((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          window.clearInterval(timerRef.current);
          playBell();
          finishSession();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timerRef.current);
  }, [timerState]);

  useEffect(() => {
    if (!breathingRunning) return undefined;
    breathingRef.current = window.setInterval(() => {
      setBreathingTimeLeft((prev) => {
        if (prev === 1) {
          const mode = breathingExercises.find((item) => item.id === breathingMode);
          const nextIndex = (breathingStep + 1) % mode.pattern.length;
          setBreathingStep(nextIndex);
          return mode.pattern[nextIndex];
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(breathingRef.current);
  }, [breathingRunning, breathingMode, breathingStep]);

  useEffect(() => {
    if (timerState !== 'running') return;
    const elapsed = selectedDuration * 60 - timerSeconds;
    const cycle = elapsed % 10;
    if (cycle < 4) setPhase('inhale');
    else if (cycle < 6) setPhase('hold');
    else setPhase('exhale');
  }, [timerSeconds, timerState, selectedDuration]);

  useEffect(() => {
    setTimerSeconds(selectedDuration * 60);
  }, [selectedDuration]);

  const playBell = () => {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 440;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 1.2);
  };

  const startSession = () => {
    setTimerState('running');
    setSessionStart(Date.now());
    if (timerSeconds <= 0) setTimerSeconds(selectedDuration * 60);
  };

  const pauseSession = () => {
    setTimerState('paused');
    window.clearInterval(timerRef.current);
  };

  const endSession = () => {
    window.clearInterval(timerRef.current);
    finishSession();
  };

  const finishSession = async () => {
    const durationSeconds = selectedDuration * 60 - timerSeconds;
    if (!currentUser?.uid || durationSeconds <= 0) {
      setTimerState('stopped');
      setActiveSession(false);
      return;
    }
    try {
      const sessionsRef = doc(collection(db, 'users', currentUser.uid, 'meditation', 'sessions'));
      const payload = {
        date: Timestamp.fromDate(new Date()),
        duration: durationSeconds,
        type: sessionType,
        moodBefore: moodBefore || '',
        moodAfter: moodAfter || ''
      };
      await setDoc(sessionsRef, payload);
      setSessions((prev) => [{ id: sessionsRef.id, ...payload }, ...prev]);
    } catch (error) {
      console.error('Finish session save error', error);
    } finally {
      setTimerState('stopped');
      setActiveSession(false);
      setTimerSeconds(selectedDuration * 60);
      setMoodBefore(null);
      setMoodAfter(null);
    }
  };

  const saveGratitude = async () => {
    if (!currentUser?.uid) return;
    const entries = gratitudeRows.map((entry) => entry.trim()).filter(Boolean).slice(0, 3);
    if (entries.length === 0) return;
    try {
      const gratitudeRef = doc(db, 'users', currentUser.uid, 'meditation', 'gratitude', gratitudeDate);
      await setDoc(gratitudeRef, { entries });
      setGratitudeEntries((prev) => [{ id: gratitudeDate, entries }, ...prev.filter((item) => item.id !== gratitudeDate)]);
    } catch (error) {
      console.error('Save gratitude error', error);
    }
  };

  const completeSessionCount = sessions.filter((session) => session.duration > 0).length;

  const sessionStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const streakDates = [...new Set(sessions.map((session) => formatDateKey(session.date.toDate())))]
      .sort((a, b) => (a < b ? 1 : -1));
    let streak = 0;
    let cursor = new Date();
    while (true) {
      const key = formatDateKey(cursor);
      if (streakDates.includes(key)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    const totalMinutesMonth = sessions.reduce((sum, session) => {
      const sessionDate = session.date.toDate();
      if (sessionDate >= monthStart) return sum + Math.round((session.duration || 0) / 60);
      return sum;
    }, 0);
    const longestSession = sessions.reduce((max, session) => Math.max(max, session.duration || 0), 0);
    return { streak, totalMinutesMonth, longestSession };
  }, [sessions]);

  const breathingGuide = breathingExercises.find((item) => item.id === breathingMode);
  const breathingLabel = breathingGuide?.steps?.[breathingStep] || '';
  const breathingScale = ((breathingTimeLeft % 4) / 4) * 0.4 + 0.8;

  const ambientColor = phase === 'inhale' ? '#A78BFA' : phase === 'hold' ? '#93C5FD' : '#C4B5FD';
  const sessionProgress = ((selectedDuration * 60 - timerSeconds) / (selectedDuration * 60)) * 100;

  if (loading) {
    return <div className="min-h-screen bg-[#F5F3FF] flex items-center justify-center text-[#4C1D95]">Loading meditation…</div>;
  }

  const activeSession = timerState === 'running' || timerState === 'paused';

  return (
    <div className="min-h-screen bg-[#F5F3FF] px-4 py-6 text-[#321d6d] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[#DDD6FE] bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#6D28D9]">Meditation</p>
              <h1 className="mt-3 text-4xl font-semibold text-[#27154D]">Find calm, breath softly, track your progress.</h1>
              <p className="mt-2 text-sm text-[#5B3E81]">A lavender sanctuary for sessions, breathing exercises, mood check-ins, and gratitude journaling.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-full bg-[#E9D5FF] px-4 py-3 text-sm font-semibold text-[#5B21B6]">Streak {sessionStats.streak} days</div>
              <div className="rounded-full bg-[#D8B4FE] px-4 py-3 text-sm font-semibold text-[#4C1D95]">{sessionStats.totalMinutesMonth} min this month</div>
            </div>
          </div>
        </section>

        <nav className="grid gap-2 sm:grid-cols-4">
          {['timer', 'breathing', 'stats', 'gratitude'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab ? 'bg-[#7C3AED] text-white' : 'bg-[#F3E8FF] text-[#6D28D9]'
              }`}
            >
              {tab === 'timer' ? 'Timer' : tab === 'breathing' ? 'Breathing' : tab === 'stats' ? 'Stats' : 'Gratitude'}
            </button>
          ))}
        </nav>

        {activeTab === 'timer' && (
          <section className="rounded-[2rem] border border-[#DDD6FE] bg-white p-6 shadow-soft">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[2rem] bg-[#F8F0FF] p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-3">
                    {durations.map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => { setSelectedDuration(minutes); setCustomDuration(''); }}
                        className={`rounded-full px-4 py-3 text-sm font-semibold transition ${selectedDuration === minutes ? 'bg-[#7C3AED] text-white' : 'bg-white text-[#5B21B6]'}`}
                      >
                        {minutes} min
                      </button>
                    ))}
                    <input
                      type="number"
                      min="1"
                      value={customDuration}
                      onChange={(e) => { setCustomDuration(e.target.value); setSelectedDuration(Number(e.target.value) || selectedDuration); }}
                      placeholder="Custom"
                      className="w-28 rounded-full border border-[#DDD6FE] bg-white px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <select
                      value={sessionType}
                      onChange={(e) => setSessionType(e.target.value)}
                      className="rounded-[1.75rem] border border-[#DDD6FE] bg-white px-4 py-3 outline-none"
                    >
                      {sessionTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <div className="rounded-[1.75rem] bg-white p-4 shadow-sm">
                      <p className="text-sm font-semibold text-[#4C1D95]">Mood before</p>
                      <div className="mt-3 flex gap-2">
                        {moodOptions.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setMoodBefore(emoji)}
                            className={`rounded-full px-3 py-2 text-lg transition ${moodBefore === emoji ? 'bg-[#7C3AED] text-white' : 'bg-[#F3E8FF] text-[#5B21B6]'}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] bg-[#F8F0FF] p-6 text-center shadow-sm">
                <div className="relative mx-auto flex h-72 w-72 items-center justify-center rounded-full border-8 border-[#DDD6FE] bg-[#F5F3FF] shadow-inner" style={{ boxShadow: `0 0 120px ${ambientColor}` }}>
                  <div className="absolute inset-0 rounded-full transition duration-1000" style={{ backgroundColor: ambientColor, opacity: 0.15 }} />
                  <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-white shadow-lg" style={{ transform: `scale(${phase === 'inhale' ? 1.15 : phase === 'hold' ? 1 : 0.85})`, transition: 'transform 1s ease-in-out' }}>
                    <div className="text-center">
                      <p className="text-sm uppercase tracking-[0.2em] text-[#6D28D9]">{phase}</p>
                      <p className="mt-2 text-5xl font-semibold text-[#321d6d]">{Math.floor(timerSeconds / 60).toString().padStart(2, '0')}:{String(timerSeconds % 60).padStart(2, '0')}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={startSession}
                    disabled={timerState === 'running'}
                    className="rounded-full bg-[#7C3AED] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5B21B6] disabled:opacity-60"
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    onClick={pauseSession}
                    disabled={timerState !== 'running'}
                    className="rounded-full bg-[#C4B5FD] px-5 py-3 text-sm font-semibold text-[#321d6d] transition hover:bg-[#A78BFA] disabled:opacity-60"
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    onClick={endSession}
                    disabled={timerState === 'stopped'}
                    className="rounded-full bg-[#E9D5FF] px-5 py-3 text-sm font-semibold text-[#5B21B6] transition hover:bg-[#DDD6FE] disabled:opacity-60"
                  >
                    End
                  </button>
                </div>
                <div className="mt-4 rounded-[1.75rem] bg-[#F3E8FF] p-4 text-left text-sm text-[#4C1D95]">
                  <p>Session type: <span className="font-semibold">{sessionType}</span></p>
                  <p className="mt-2">Progress: <span className="font-semibold">{Math.round(sessionProgress)}%</span></p>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'breathing' && (
          <section className="rounded-[2rem] border border-[#DDD6FE] bg-white p-6 shadow-soft">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[2rem] bg-[#F8F0FF] p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#6D28D9]">Breathing exercises</p>
                <div className="mt-4 space-y-4">
                  {breathingExercises.map((exercise) => (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => {
                        setBreathingMode(exercise.id);
                        setBreathingStep(0);
                        setBreathingTimeLeft(exercise.pattern[0]);
                      }}
                      className={`w-full rounded-[1.75rem] border px-4 py-4 text-left transition ${breathingMode === exercise.id ? 'border-[#7C3AED] bg-[#F3E8FF]' : 'border-[#DDD6FE] bg-white text-[#321d6d]'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{exercise.label}</span>
                        <span className="text-sm text-[#6D28D9]">{exercise.pattern.join('-')}</span>
                      </div>
                      <p className="mt-2 text-sm text-[#53447E]">Follow the guided pace to breathe with calm intention.</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] bg-[#F8F0FF] p-6 text-center shadow-sm">
                <div className="mx-auto mb-6 flex h-48 w-48 items-center justify-center rounded-full bg-[#EFE6FF]" style={{ transform: `scale(${breathingScale})`, transition: 'transform 1s ease-in-out' }}>
                  <div className="text-center">
                    <p className="text-sm uppercase tracking-[0.2em] text-[#6D28D9]">{breathingLabel}</p>
                    <p className="mt-3 text-6xl">{breathingTimeLeft}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => setBreathingRunning(true)}
                    className="rounded-full bg-[#7C3AED] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5B21B6]"
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreathingRunning(false)}
                    className="rounded-full bg-[#E9D5FF] px-5 py-3 text-sm font-semibold text-[#5B21B6] transition hover:bg-[#DDD6FE]"
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBreathingRunning(false);
                      setBreathingStep(0);
                      setBreathingTimeLeft(breathingGuide.pattern[0]);
                    }}
                    className="rounded-full bg-[#F3E8FF] px-5 py-3 text-sm font-semibold text-[#6D28D9] transition hover:bg-[#EDE9FE]"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'stats' && (
          <section className="rounded-[2rem] border border-[#DDD6FE] bg-white p-6 shadow-soft">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-[2rem] bg-[#F8F0FF] p-6 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#6D28D9]">Current streak</p>
                <p className="mt-4 text-5xl font-semibold text-[#321d6d]">{sessionStats.streak}</p>
              </div>
              <div className="rounded-[2rem] bg-[#F8F0FF] p-6 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#6D28D9]">Minutes this month</p>
                <p className="mt-4 text-5xl font-semibold text-[#321d6d]">{sessionStats.totalMinutesMonth}</p>
              </div>
              <div className="rounded-[2rem] bg-[#F8F0FF] p-6 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#6D28D9]">Longest session</p>
                <p className="mt-4 text-5xl font-semibold text-[#321d6d]">{Math.round(sessionStats.longestSession / 60)} min</p>
              </div>
            </div>
            <div className="mt-6 rounded-[2rem] border border-[#DDD6FE] bg-[#F3E8FF] p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#6D28D9]">Session history</p>
              <div className="mt-4 space-y-3">
                {sessions.length === 0 ? (
                  <div className="rounded-[1.75rem] bg-white p-5 text-sm text-[#4C1D95]">No completed sessions yet.</div>
                ) : (
                  sessions.slice(0, 6).map((session) => (
                    <div key={session.id} className="rounded-[1.75rem] bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#321d6d]">{session.type}</p>
                          <p className="text-sm text-[#5B3E81]">{friendlyLongDate(session.date.toDate())}</p>
                        </div>
                        <p className="text-lg font-semibold text-[#6D28D9]">{Math.round(session.duration / 60)} min</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-sm text-[#4C1D95]">
                        <span>Before {session.moodBefore || '—'}</span>
                        <span>After {session.moodAfter || '—'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'gratitude' && (
          <section className="rounded-[2rem] border border-[#DDD6FE] bg-white p-6 shadow-soft">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#6D28D9]">Gratitude journal</p>
                <p className="mt-3 text-sm text-[#5B3E81]">Write three things you are grateful for each day.</p>
                <div className="mt-5 space-y-4">
                  <input
                    type="date"
                    value={gratitudeDate}
                    onChange={(e) => setGratitudeDate(e.target.value)}
                    className="w-full rounded-[1.75rem] border border-[#DDD6FE] bg-[#F8F0FF] px-4 py-3 outline-none"
                  />
                  {gratitudeRows.map((entry, index) => (
                    <input
                      key={index}
                      value={entry}
                      onChange={(e) => setGratitudeRows((prev) => {
                        const next = [...prev];
                        next[index] = e.target.value;
                        return next;
                      })}
                      placeholder={`Gratitude ${index + 1}`}
                      className="w-full rounded-[1.75rem] border border-[#DDD6FE] bg-[#F8F0FF] px-4 py-3 outline-none"
                    />
                  ))}
                  <button
                    type="button"
                    onClick={saveGratitude}
                    className="rounded-full bg-[#7C3AED] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5B21B6]"
                  >
                    Save gratitude
                  </button>
                </div>
              </div>
              <div className="rounded-[2rem] bg-[#F8F0FF] p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#6D28D9]">Past entries</p>
                <div className="mt-4 space-y-3">
                  {gratitudeEntries.length === 0 ? (
                    <p className="text-sm text-[#4C1D95]">No gratitude entries yet.</p>
                  ) : (
                    gratitudeEntries.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="rounded-[1.75rem] bg-white p-4 shadow-sm">
                        <p className="text-sm font-semibold text-[#321d6d]">{friendlyDate(new Date(entry.id))}</p>
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#5B3E81]">
                          {entry.entries?.map((line, index) => (
                            <li key={index}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Meditation;
