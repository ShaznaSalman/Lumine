import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';

const modules = [
  { id: 'period-tracker', title: 'Period Tracker', description: 'Track cycles, symptoms, and self-care.', emoji: '🌺', deco: '🌸', bg: '#FDE8F3' },
  { id: 'workout-yoga', title: 'Workout & Yoga', description: 'Move gently with guided sessions.', emoji: '🧘', deco: '🌿', bg: '#E5F7EE' },
  { id: 'islamic-hub', title: 'Islamic Hub', description: 'Daily prayers, reflections, and peace.', emoji: '☪️', deco: '✨', bg: '#EDE8FD' },
  { id: 'diet-nutrition', title: 'Diet & Nutrition', description: 'Fuel your body with wholesome choices.', emoji: '🥗', deco: '🍋', bg: '#FEF6DC' },
  { id: 'selfcare', title: 'Selfcare', description: 'Soft routines to feel restored.', emoji: '💆', deco: '🧴', bg: '#FDE9E0' },
  { id: 'money-manager', title: 'Money Manager', description: 'Stay mindful of spending and savings.', emoji: '💰', deco: '💸', bg: '#DFF5F3' },
  { id: 'idea-journal', title: 'Idea Journal', description: 'Capture your brightest inspirations.', emoji: '📓', deco: '💡', bg: '#E4F0FD' },
  { id: 'meditation', title: 'Meditation', description: 'Quiet your mind with gentle guidance.', emoji: '🧘‍♀️', deco: '🌙', bg: '#EEE8FE' },
  { id: 'hobby-tracker', title: 'Hobby Tracker', description: 'Nurture your creative passions.', emoji: '🎨', deco: '🎸', bg: '#E8F6E4' },
  { id: 'study-tracker', title: 'Study Tracker', description: 'Keep learning with focus and calm.', emoji: '📖', deco: '📚', bg: '#FDF4E4' },
  { id: 'work-tracker', title: 'Work Tracker', description: 'Build momentum with soft productivity.', emoji: '🗂️', deco: '💼', bg: '#E0F4FA' },
  { id: 'vision-board', title: 'Vision Board', description: 'Dream your next chapters in color.', emoji: '🖼️', deco: '🌟', bg: '#FDE8F8' },
  { id: 'bucket-list', title: 'Bucket List', description: 'Turn wishes into joy-filled plans.', emoji: '🪣', deco: '🌈', bg: '#E4EEF8' }
];

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { phrase: 'Good morning', emoji: '☀️' };
  if (hour < 17) return { phrase: 'Good afternoon', emoji: '🌤️' };
  return { phrase: 'Good evening', emoji: '🌙' };
};

const Dashboard = () => {
  const { currentUser, logout } = useAuth();
  const username = currentUser?.displayName || 'Friend';
  const userInitial = username?.[0]?.toUpperCase() ?? 'N';
  const [stats, setStats] = useState({
    prayersLoggedToday: 0,
    waterGlassesToday: 0,
    tasksCompletedToday: 0,
    currentStreakDays: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const welcome = useMemo(() => greeting(), []);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const getSummary = async () => {
      setStatsLoading(true);
      try {
        const summaryRef = doc(db, 'users', currentUser.uid, 'summary', 'today');
        const summarySnap = await getDoc(summaryRef);
        if (summarySnap.exists()) {
          const data = summarySnap.data();
          setStats({
            prayersLoggedToday: data.prayersLoggedToday ?? 0,
            waterGlassesToday: data.waterGlassesToday ?? 0,
            tasksCompletedToday: data.tasksCompletedToday ?? 0,
            currentStreakDays: data.currentStreakDays ?? 0
          });
        }
      } catch (error) {
        console.error('Failed to load dashboard summary', error);
      } finally {
        setStatsLoading(false);
      }
    };

    getSummary();
  }, [currentUser]);

  const statItems = [
    {
      label: 'Prayers logged today',
      value: stats.prayersLoggedToday,
      accent: 'bg-[#EDE8FD]',
      emoji: '☪️'
    },
    {
      label: 'Water glasses',
      value: stats.waterGlassesToday,
      accent: 'bg-[#E5F7EE]',
      emoji: '🥤'
    },
    {
      label: 'Tasks completed',
      value: stats.tasksCompletedToday,
      accent: 'bg-[#FEF6DC]',
      emoji: '✅'
    },
    {
      label: 'Current streak',
      value: stats.currentStreakDays,
      accent: 'bg-[#FDE8F8]',
      emoji: '🔥'
    }
  ];

  return (
    <div className="min-h-screen bg-[#FDF6FF] text-[#2C2C2A]">
      <div className="sticky top-0 z-20 border-b border-[#E9E3F4] bg-[#FDF6FF]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-lg font-semibold text-[#7F77DD]">Lumine <span className="text-xl">✨</span></div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E4DBFF] text-lg font-semibold text-[#7F77DD]">
              {userInitial}
            </div>
            <div className="hidden min-w-[120px] flex-col text-right sm:flex">
              <span className="text-sm font-semibold">{username}</span>
              <span className="text-xs text-[#6D6B6F]">Wellness seeker</span>
            </div>
            <button
              onClick={logout}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#E9E3F4] bg-white text-[#7F77DD] transition hover:bg-[#F4F0FF]"
              aria-label="Logout"
            >
              ⎋
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <section className="rounded-[2rem] border border-[#E9E3F4] bg-white p-8 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-3xl font-semibold text-[#2C2C2A]">
                {welcome.phrase} <span>{welcome.emoji}</span>
              </p>
              <p className="mt-2 text-sm text-[#6D6B6F]">Welcome back, {username}</p>
            </div>
            <div className="rounded-3xl bg-[#F4F0FF] px-5 py-3 text-sm font-semibold text-[#7F77DD] shadow-sm">
              {statsLoading ? 'Loading stats…' : `Today's pulse updated`}
            </div>
          </div>
        </section>

        <section className="mt-6 overflow-x-auto pb-2">
          <div className="inline-flex gap-4">
            {statItems.map((item) => (
              <div
                key={item.label}
                className={`min-w-[210px] rounded-[1.75rem] border border-[#E9E3F4] bg-white p-4 shadow-soft ${item.accent}`}
              >
                <div className="flex items-center justify-between text-sm font-semibold text-[#2C2C2A]">
                  <span>{item.label}</span>
                  <span>{item.emoji}</span>
                </div>
                <p className="mt-4 text-3xl font-bold">{statsLoading ? '—' : item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => (
            <Link
              key={module.id}
              to={`/module/${module.id}`}
              className="group relative overflow-hidden rounded-3xl p-5 shadow-soft transition hover:-translate-y-1"
              style={{ backgroundColor: module.bg }}
            >
              <div className="absolute right-4 top-4 text-3xl opacity-20 rotate-12">
                {module.deco}
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-3xl bg-white/80 p-3 text-xl shadow-sm">{module.emoji}</div>
                <h3 className="text-xl font-semibold text-[#2C2C2A]">{module.title}</h3>
              </div>
              <p className="mt-4 text-sm text-[#6D6B6F]">{module.description}</p>
            </Link>
          ))}
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#E9E3F4] bg-white px-5 py-3 shadow-soft sm:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <button className="flex flex-col items-center gap-1 text-[#7F77DD]">
            <span className="text-xl">🏠</span>
            <span className="text-xs">Home</span>
          </button>
          <Link to="/module/islamic-hub" className="flex flex-col items-center gap-1 text-[#7F77DD]">
            <span className="text-xl">☪️</span>
            <span className="text-xs">Islamic</span>
          </Link>
          <Link to="/module/workout-yoga" className="flex flex-col items-center gap-1 text-[#7F77DD]">
            <span className="text-xl">🧘</span>
            <span className="text-xs">Yoga</span>
          </Link>
          <Link to="/module/diet-nutrition" className="flex flex-col items-center gap-1 text-[#7F77DD]">
            <span className="text-xl">🥗</span>
            <span className="text-xs">Diet</span>
          </Link>
        </div>
      </nav>
    </div>
  );
};

export default Dashboard;
