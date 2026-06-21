import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';

const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const salahStatuses = ['prayed', 'missed', 'qada'];
const duaCategories = ['Morning', 'Evening', 'Travel', 'Gratitude', 'Health', 'Custom'];
const fastingTypes = ['Ramadan', 'Monday/Thursday Sunnah', 'Voluntary', 'Qada'];
const defaultDuas = [
  { title: 'Morning Dua', arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا', translation: 'O Allah, by You we enter the morning.', category: 'Morning' },
  { title: 'Before Eating', arabic: 'بِسْمِ اللَّهِ', translation: 'In the name of Allah.', category: 'Gratitude' },
  { title: 'Before Sleeping', arabic: 'بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي', translation: 'In Your name, my Lord, I lie down.', category: 'Evening' },
  { title: 'Travel Dua', arabic: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا', translation: 'Glory to Him who has subjected this to us.', category: 'Travel' },
  { title: 'Gratitude Dua', arabic: 'الْحَمْدُ لِلَّهِ', translation: 'All praise is for Allah.', category: 'Gratitude' }
];

const formatDateKey = (date) => date.toISOString().split('T')[0];
const getFriendlyDate = (date) => date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const getTimeFromString = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  return date;
};

const IslamicHub = () => {
  const { currentUser } = useAuth();
  const todayKey = formatDateKey(new Date());
  const [activeTab, setActiveTab] = useState('salah');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settings, setSettings] = useState({ city: '', country: '', dailyQuranGoalMinutes: 10 });
  const [prayerTimes, setPrayerTimes] = useState(null);
  const [prayerError, setPrayerError] = useState('');
  const [salahLog, setSalahLog] = useState({});
  const [weeklySalah, setWeeklySalah] = useState([]);
  const [quranLogs, setQuranLogs] = useState([]);
  const [dailyQuranGoal, setDailyQuranGoal] = useState(10);
  const [dhikrCount, setDhikrCount] = useState(0);
  const [dhikrType, setDhikrType] = useState('SubhanAllah');
  const [dhikrTarget, setDhikrTarget] = useState(33);
  const [dhikrCustom, setDhikrCustom] = useState('');
  const [duas, setDuas] = useState([]);
  const [duaCategory, setDuaCategory] = useState('All');
  const [randomDua, setRandomDua] = useState(null);
  const [fastingLog, setFastingLog] = useState({});
  const [ramadanMode, setRamadanMode] = useState(false);
  const [fastingForm, setFastingForm] = useState({ type: 'Ramadan', status: 'fasting' });
  const [newDua, setNewDua] = useState({ title: '', arabic: '', translation: '', category: 'Custom' });
  const [prayerCountdown, setPrayerCountdown] = useState('');

  useEffect(() => {
    if (!currentUser?.uid) return;

    const loadAll = async () => {
      try {
        const settingsRef = doc(db, 'users', currentUser.uid, 'islamic-hub', 'settings');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          setSettings({
            city: data.city || '',
            country: data.country || '',
            dailyQuranGoalMinutes: data.dailyQuranGoalMinutes ?? 10
          });
          setDailyQuranGoal(data.dailyQuranGoalMinutes ?? 10);
        }

        const salahRef = collection(db, 'users', currentUser.uid, 'islamic-hub', 'salah');
        const salahSnap = await getDocs(salahRef);
        const salahData = {};
        salahSnap.docs.forEach((docItem) => {
          salahData[docItem.id] = docItem.data();
        });
        setSalahLog(salahData);
        setWeeklySalah(getWeeklySalah(salahData));

        const quranRef = query(collection(db, 'users', currentUser.uid, 'islamic-hub', 'quran-logs'), orderBy('date', 'desc'));
        const quranSnap = await getDocs(quranRef);
        setQuranLogs(quranSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));

        const dhikrRef = query(collection(db, 'users', currentUser.uid, 'islamic-hub', 'dhikr-sessions'), orderBy('date', 'desc'));
        const dhikrSnap = await getDocs(dhikrRef);
        if (dhikrSnap.docs.length) {
          const latest = dhikrSnap.docs[0].data();
          setDhikrType(latest.type || 'SubhanAllah');
          setDhikrTarget(latest.count || 33);
        }

        const duasRef = collection(db, 'users', currentUser.uid, 'islamic-hub', 'duas');
        const duasSnap = await getDocs(duasRef);
        if (duasSnap.docs.length) {
          setDuas(duasSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));
        } else {
          const defaultDocs = await Promise.all(defaultDuas.map(async (dua) => {
            const duaRef = doc(collection(db, 'users', currentUser.uid, 'islamic-hub', 'duas'));
            await setDoc(duaRef, { ...dua, isFavourite: false });
            return { id: duaRef.id, ...dua, isFavourite: false };
          }));
          setDuas(defaultDocs);
        }

        const fastingRef = collection(db, 'users', currentUser.uid, 'islamic-hub', 'fasting');
        const fastingSnap = await getDocs(fastingRef);
        const fastingData = {};
        fastingSnap.docs.forEach((docItem) => {
          fastingData[docItem.id] = docItem.data();
        });
        setFastingLog(fastingData);
      } catch (error) {
        console.error('Islamic Hub load error', error);
      } finally {
        setSettingsLoaded(true);
      }
    };

    loadAll();
  }, [currentUser]);

  useEffect(() => {
    if (!settings.city || !settings.country) return;

    const fetchPrayerTimes = async () => {
      try {
        setPrayerError('');
        const response = await fetch(
          `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(settings.city)}&country=${encodeURIComponent(settings.country)}&method=3`
        );
        const json = await response.json();
        if (json.code !== 200) {
          throw new Error(json.status || 'Prayer time fetch failed');
        }
        setPrayerTimes(json.data.timings);
      } catch (error) {
        console.error('Prayer times fetch error', error);
        setPrayerError('Unable to fetch prayer times. Check city or network.');
      }
    };

    fetchPrayerTimes();
  }, [settings.city, settings.country]);

  useEffect(() => {
    const interval = setInterval(() => {
      updatePrayerCountdown();
    }, 1000);
    updatePrayerCountdown();
    return () => clearInterval(interval);
  }, [prayerTimes]);

  const updatePrayerCountdown = () => {
    if (!prayerTimes) return;
    const now = new Date();
    const upcoming = prayerNames
      .map((name) => ({
        name,
        time: getTimeFromString(prayerTimes[name].replace('(+05)', '').trim())
      }))
      .filter((item) => item.time > now);

    const next = upcoming[0] || null;
    if (!next) {
      setPrayerCountdown('Next prayer tomorrow');
      return;
    }
    const diff = next.time - now;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    setPrayerCountdown(`${next.name} in ${minutes}m ${seconds}s`);
  };

  const getWeeklySalah = (salahData) => {
    const days = [];
    const today = new Date();
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - offset);
      const key = formatDateKey(day);
      days.push({ date: day, key, data: salahData[key] || {} });
    }
    return days;
  };

  const handleSettingsSave = async () => {
    if (!currentUser?.uid) return;
    try {
      const settingsRef = doc(db, 'users', currentUser.uid, 'islamic-hub', 'settings');
      await setDoc(settingsRef, { city, country, dailyQuranGoalMinutes: dailyQuranGoal });
      setSettings({ city, country, dailyQuranGoalMinutes: dailyQuranGoal });
    } catch (error) {
      console.error('Save settings error', error);
    }
  };

  const handleSalahStatus = async (prayer, status) => {
    if (!currentUser?.uid) return;
    const updated = { ...salahLog[todayKey], [prayer.toLowerCase()]: status };
    setSalahLog((prev) => ({ ...prev, [todayKey]: updated }));
    setWeeklySalah(getWeeklySalah({ ...salahLog, [todayKey]: updated }));
    const salahRef = doc(db, 'users', currentUser.uid, 'islamic-hub', 'salah', todayKey);
    await setDoc(salahRef, updated);
  };

  const salahStreak = useMemo(() => {
    let streak = 0;
    for (let i = 0; i < weeklySalah.length; i += 1) {
      const day = weeklySalah[weeklySalah.length - 1 - i];
      const data = day.data;
      if (prayerNames.every((prayer) => data[prayer.toLowerCase()] === 'prayed')) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  }, [weeklySalah]);

  const quranTodayMinutes = useMemo(() => {
    return quranLogs
      .filter((log) => formatDateKey(log.date.toDate()) === todayKey)
      .reduce((sum, log) => sum + (log.minutes || 0), 0);
  }, [quranLogs, todayKey]);

  const quranWeekAyahs = useMemo(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    return quranLogs.reduce((sum, log) => {
      if (log.date?.toDate() >= weekStart) {
        return sum + Math.max(0, (log.toAyah || 0) - (log.fromAyah || 0) + 1);
      }
      return sum;
    }, 0);
  }, [quranLogs]);

  const quranMonthAyahs = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    return quranLogs.reduce((sum, log) => {
      if (log.date?.toDate() >= monthStart) {
        return sum + Math.max(0, (log.toAyah || 0) - (log.fromAyah || 0) + 1);
      }
      return sum;
    }, 0);
  }, [quranLogs]);

  const dhikrTypes = [
    { label: 'SubhanAllah', target: 33 },
    { label: 'Alhamdulillah', target: 33 },
    { label: 'Allahu Akbar', target: 34 }
  ];

  const handleDhikrTap = async () => {
    const nextCount = dhikrCount + 1;
    setDhikrCount(nextCount);
    if (navigator?.vibrate) navigator.vibrate(10);
    if (nextCount >= dhikrTarget) {
      await saveDhikrSession(nextCount);
      setDhikrCount(0);
    }
  };

  const saveDhikrSession = async (count) => {
    if (!currentUser?.uid) return;
    const sessionRef = doc(collection(db, 'users', currentUser.uid, 'islamic-hub', 'dhikr-sessions'));
    await setDoc(sessionRef, {
      date: Timestamp.now(),
      type: dhikrType || dhikrCustom || 'Custom Dhikr',
      count
    });
  };

  const handleAddDua = async () => {
    if (!currentUser?.uid || !newDua.title.trim()) return;
    const duaRef = doc(collection(db, 'users', currentUser.uid, 'islamic-hub', 'duas'));
    const item = { ...newDua, isFavourite: false };
    await setDoc(duaRef, item);
    setDuas((prev) => [...prev, { id: duaRef.id, ...item }]);
    setNewDua({ title: '', arabic: '', translation: '', category: 'Custom' });
  };

  const toggleDuaFavourite = async (id) => {
    if (!currentUser?.uid) return;
    const match = duas.find((dua) => dua.id === id);
    if (!match) return;
    const updated = { ...match, isFavourite: !match.isFavourite };
    const duaRef = doc(db, 'users', currentUser.uid, 'islamic-hub', 'duas', id);
    await updateDoc(duaRef, { isFavourite: updated.isFavourite });
    setDuas((prev) => prev.map((dua) => (dua.id === id ? updated : dua)));
  };

  const filteredDuas = useMemo(() => {
    return duas.filter((dua) => duaCategory === 'All' || dua.category === duaCategory);
  }, [duas, duaCategory]);

  const showRandomDua = () => {
    if (!filteredDuas.length) return;
    setRandomDua(filteredDuas[Math.floor(Math.random() * filteredDuas.length)]);
  };

  const fastingDays = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    return Object.entries(fastingLog)
      .map(([date, data]) => ({ date, ...data }))
      .filter((item) => new Date(item.date) >= monthStart);
  }, [fastingLog]);

  const fastingStreak = useMemo(() => {
    const dates = Object.keys(fastingLog).sort((a, b) => new Date(b) - new Date(a));
    let streak = 0;
    for (const dateKey of dates) {
      const item = fastingLog[dateKey];
      if (item.status === 'fasting' && item.type === 'Monday/Thursday Sunnah') {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  }, [fastingLog]);

  const handleFastingSave = async () => {
    if (!currentUser?.uid) return;
    const key = formatDateKey(new Date());
    const fastingRef = doc(db, 'users', currentUser.uid, 'islamic-hub', 'fasting', key);
    await setDoc(fastingRef, fastingForm);
    setFastingLog((prev) => ({ ...prev, [key]: fastingForm }));
  };

  const hasSettings = settings.city && settings.country;

  return (
    <div className="min-h-screen bg-[#F7F3FC] px-4 py-6 text-[#2C2C2A] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-[#E5DEFA] bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#8A71D0]">Islamic Hub</p>
              <h1 className="mt-3 text-3xl font-semibold text-[#2C2C2A]">Nourish your spirit</h1>
            </div>
            <div className="flex items-center gap-3 rounded-full bg-[#F1E9FF] px-4 py-3 text-sm text-[#7F77DD] shadow-sm">
              <span className="text-xl">🌙</span>
              <span>Peaceful ritual flow</span>
            </div>
          </div>
        </header>

        <nav className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {['salah', 'prayer', 'quran', 'dhikr', 'duas', 'fasting'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab ? 'bg-[#E8E3FF] text-[#5A3BAF]' : 'bg-[#F6F2FF] text-[#7A67CE]'
              }`}
            >
              {tab === 'salah' ? 'Salah' : tab === 'prayer' ? 'Prayer Times' : tab === 'quran' ? 'Quran' : tab === 'dhikr' ? 'Dhikr' : tab === 'duas' ? 'Duas' : 'Fasting'}
            </button>
          ))}
        </nav>

        {activeTab === 'salah' && (
          <section className="rounded-[2rem] border border-[#E5DEFA] bg-white p-6 shadow-soft">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#2C2C2A]">Salah tracker</h2>
                <p className="mt-2 text-sm text-[#6D6B6F]">Mark your daily prayers and watch your weekly rhythm.</p>
              </div>
              <div className="rounded-full bg-[#F3E8FF] px-4 py-2 text-sm font-semibold text-[#7F77DD]">
                {salahStreak} days with all 5 prayers
              </div>
            </div>
            <div className="space-y-6">
              <div className="grid gap-4 rounded-[2rem] border border-[#EFE7FB] bg-[#FBF7FF] p-5">
                {prayerNames.map((prayer) => {
                  const status = salahLog[todayKey]?.[prayer.toLowerCase()] || null;
                  return (
                    <div key={prayer} className="grid gap-3 rounded-[1.75rem] border border-[#E8E0F8] bg-white p-4 sm:grid-cols-[1fr_auto]">
                      <div>
                        <p className="text-lg font-semibold text-[#2C2C2A]">{prayer}</p>
                        <p className="text-sm text-[#6D6B6F]">Tap a status for today.</p>
                      </div>
                      <div className="flex gap-2">
                        {salahStatuses.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => handleSalahStatus(prayer, option)}
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                              status === option ? 'bg-[#D9C6FF] text-[#5A3BAF]' : 'bg-[#F5F0FF] text-[#7F77DD]'
                            }`}
                          >
                            {option === 'prayed' ? '✅' : option === 'missed' ? '❌' : '🔄'} {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-[2rem] border border-[#E5DEFA] bg-[#F7F2FF] p-4">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#8A71D0]">Weekly overview</p>
                <div className="overflow-x-auto">
                  <div className="min-w-[560px] rounded-[1.75rem] border border-[#E8E0F8] bg-white p-4">
                    <div className="grid grid-cols-6 gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#7F77DD]">
                      <div className="text-left">Prayer</div>
                      {weeklySalah.map((day) => (
                        <div key={day.key} className="text-center">{day.date.getDate()}</div>
                      ))}
                    </div>
                    <div className="mt-3 space-y-3">
                      {prayerNames.map((prayer) => (
                        <div key={prayer} className="grid grid-cols-6 gap-2 text-sm">
                          <div className="text-left font-semibold text-[#2C2C2A]">{prayer}</div>
                          {weeklySalah.map((day) => {
                            const value = day.data[prayer.toLowerCase()];
                            const bg = value === 'prayed' ? 'bg-[#D9C6FF]' : value === 'missed' ? 'bg-[#FFE5E5]' : value === 'qada' ? 'bg-[#FFF3C6]' : 'bg-[#F7F2FF]';
                            const icon = value === 'prayed' ? '✅' : value === 'missed' ? '❌' : value === 'qada' ? '🔄' : '—';
                            return (
                              <div key={`${day.key}-${prayer}`} className={`rounded-2xl py-2 text-center ${bg}`}>
                                {icon}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'prayer' && (
          <section className="rounded-[2rem] border border-[#E5DEFA] bg-white p-6 shadow-soft">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#2C2C2A]">Prayer times</h2>
                <p className="mt-2 text-sm text-[#6D6B6F]">Keep your city saved for daily timings and countdowns.</p>
              </div>
              <div className="rounded-full bg-[#F3E8FF] px-4 py-2 text-sm font-semibold text-[#7F77DD]">{prayerCountdown}</div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-[#E8E0F8] bg-[#FBF7FF] p-5">
                <p className="mb-3 text-sm font-semibold text-[#8A71D0]">Location</p>
                <div className="grid gap-3">
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="w-full rounded-3xl border border-[#E5DEFA] bg-white px-4 py-3 outline-none focus:border-[#BBA4FF] focus:ring-2 focus:ring-[#EEE5FF]"
                  />
                  <input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Country"
                    className="w-full rounded-3xl border border-[#E5DEFA] bg-white px-4 py-3 outline-none focus:border-[#BBA4FF] focus:ring-2 focus:ring-[#EEE5FF]"
                  />
                  <button
                    type="button"
                    onClick={handleSettingsSave}
                    className="rounded-full bg-[#8A71D0] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#7559c3]"
                  >
                    Save location
                  </button>
                </div>
              </div>
              <div className="rounded-[2rem] border border-[#E8E0F8] bg-[#F9F5FF] p-5">
                {prayerError && <p className="mb-3 rounded-3xl bg-[#FFE5E5] px-4 py-3 text-sm text-[#9A3B3B]">{prayerError}</p>}
                {!hasSettings && <p className="text-sm text-[#6D6B6F]">Enter your city and country to load prayer times.</p>}
                {prayerTimes && (
                  <div className="space-y-3">
                    {prayerNames.map((prayer) => (
                      <div key={prayer} className="flex items-center justify-between rounded-3xl bg-white px-4 py-3 shadow-sm">
                        <span className="font-semibold text-[#2C2C2A]">{prayer}</span>
                        <span className="text-sm text-[#7F77DD]">{prayerTimes[prayer]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'quran' && (
          <section className="rounded-[2rem] border border-[#E5DEFA] bg-white p-6 shadow-soft">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#2C2C2A]">Quran tracker</h2>
                <p className="mt-2 text-sm text-[#6D6B6F]">Track reading progress and meet your daily goal.</p>
              </div>
              <div className="rounded-full bg-[#F3E8FF] px-4 py-2 text-sm font-semibold text-[#7F77DD]">
                Goal: {dailyQuranGoal} min
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-[1.75rem] bg-[#F8F3FF] p-4">
                <p className="text-sm font-semibold text-[#8A71D0]">This week</p>
                <p className="mt-3 text-3xl font-semibold text-[#2C2C2A]">{quranWeekAyahs}</p>
                <p className="text-sm text-[#6D6B6F]">ayahs read</p>
              </div>
              <div className="rounded-[1.75rem] bg-[#F8F3FF] p-4">
                <p className="text-sm font-semibold text-[#8A71D0]">This month</p>
                <p className="mt-3 text-3xl font-semibold text-[#2C2C2A]">{quranMonthAyahs}</p>
                <p className="text-sm text-[#6D6B6F]">ayahs read</p>
              </div>
              <div className="rounded-[1.75rem] bg-[#F8F3FF] p-4">
                <p className="text-sm font-semibold text-[#8A71D0]">Today</p>
                <p className="mt-3 text-3xl font-semibold text-[#2C2C2A]">{quranTodayMinutes}</p>
                <p className="text-sm text-[#6D6B6F]">minutes</p>
              </div>
            </div>
            <div className="mt-6 rounded-[2rem] border border-[#E8E0F8] bg-[#FBF7FF] p-5">
              <p className="text-sm font-semibold text-[#2C2C2A]">Daily progress</p>
              <div className="mt-3 h-4 overflow-hidden rounded-full bg-[#E7DBFF]">
                <div className="h-4 rounded-full bg-[#8A71D0]" style={{ width: `${Math.min(100, (quranTodayMinutes / dailyQuranGoal) * 100)}%` }} />
              </div>
              <p className="mt-2 text-sm text-[#6D6B6F]">{Math.min(100, Math.round((quranTodayMinutes / dailyQuranGoal) * 100))}% of goal</p>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="block rounded-[1.75rem] border border-[#E5DEFA] bg-white p-4">
                <span className="text-sm font-semibold text-[#2C2C2A]">Daily reading goal (minutes)</span>
                <input
                  type="number"
                  min="1"
                  value={dailyQuranGoal}
                  onChange={(e) => setDailyQuranGoal(Number(e.target.value))}
                  className="mt-3 w-full rounded-3xl border border-[#E5DEFA] bg-[#F8F3FF] px-4 py-3 outline-none focus:border-[#BBA4FF] focus:ring-2 focus:ring-[#EEE5FF]"
                />
              </label>
              <div className="rounded-[1.75rem] border border-[#E5DEFA] bg-[#F8F3FF] p-4">
                <p className="text-sm font-semibold text-[#2C2C2A]">Quick log</p>
                <div className="mt-4 space-y-3">
                  <input className="w-full rounded-3xl border border-[#E5DEFA] bg-white px-4 py-3" placeholder="Surah name/number" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input className="w-full rounded-3xl border border-[#E5DEFA] bg-white px-4 py-3" placeholder="From ayah" />
                    <input className="w-full rounded-3xl border border-[#E5DEFA] bg-white px-4 py-3" placeholder="To ayah" />
                  </div>
                  <input className="w-full rounded-3xl border border-[#E5DEFA] bg-white px-4 py-3" placeholder="Minutes" />
                  <button className="w-full rounded-full bg-[#8A71D0] px-4 py-3 text-white">Save reading</button>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'dhikr' && (
          <section className="rounded-[2rem] border border-[#E5DEFA] bg-white p-6 shadow-soft">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#2C2C2A]">Dhikr counter</h2>
                <p className="mt-2 text-sm text-[#6D6B6F]">Tap to count, and let it reset when the target is reached.</p>
              </div>
              <div className="rounded-full bg-[#F3E8FF] px-4 py-2 text-sm font-semibold text-[#7F77DD]">Target {dhikrTarget}</div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-[#E8E0F8] bg-[#FBF7FF] p-6 text-center">
                <p className="text-sm font-semibold text-[#8A71D0]">Current count</p>
                <p className="mt-4 text-6xl font-semibold text-[#2C2C2A]">{dhikrCount}</p>
                <button
                  type="button"
                  onClick={handleDhikrTap}
                  className="mt-6 inline-flex rounded-full bg-[#8A71D0] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#7559c3]"
                >
                  Tap Dhikr
                </button>
              </div>
              <div className="space-y-4 rounded-[2rem] border border-[#E8E0F8] bg-[#F8F3FF] p-6">
                {dhikrTypes.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => {
                      setDhikrType(option.label);
                      setDhikrTarget(option.target);
                      setDhikrCount(0);
                    }}
                    className={`w-full rounded-3xl px-4 py-3 text-left font-semibold transition ${
                      dhikrType === option.label ? 'bg-[#D9C6FF] text-[#5A3BAF]' : 'bg-white text-[#2C2C2A]'
                    }`}
                  >
                    {option.label} • {option.target}
                  </button>
                ))}
                <div className="rounded-3xl bg-white p-4">
                  <p className="text-sm font-semibold text-[#2C2C2A]">Custom dhikr</p>
                  <input
                    value={dhikrCustom}
                    onChange={(e) => setDhikrCustom(e.target.value)}
                    placeholder="Type text"
                    className="mt-3 w-full rounded-3xl border border-[#E5DEFA] bg-[#F8F3FF] px-4 py-3 outline-none"
                  />
                  <input
                    type="number"
                    min="1"
                    value={dhikrTarget}
                    onChange={(e) => setDhikrTarget(Number(e.target.value))}
                    className="mt-3 w-full rounded-3xl border border-[#E5DEFA] bg-[#F8F3FF] px-4 py-3 outline-none"
                    placeholder="Target count"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'duas' && (
          <section className="rounded-[2rem] border border-[#E5DEFA] bg-white p-6 shadow-soft">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#2C2C2A]">Dua manager</h2>
                <p className="mt-2 text-sm text-[#6D6B6F]">Save your favourite supplications and pull one at random.</p>
              </div>
              <button
                type="button"
                onClick={showRandomDua}
                className="rounded-full bg-[#8A71D0] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7559c3]"
              >
                Random dua
              </button>
            </div>
            {randomDua && (
              <div className="mb-6 rounded-[2rem] bg-[#F3E8FF] p-5 text-[#2C2C2A]">
                <p className="text-sm font-semibold text-[#7F77DD]">Random dua</p>
                <p className="mt-2 text-xl font-semibold">{randomDua.title}</p>
                {randomDua.arabic && <p className="mt-3 text-lg">{randomDua.arabic}</p>}
                <p className="mt-2 text-sm text-[#6D6B6F]">{randomDua.translation}</p>
              </div>
            )}
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div>
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDuaCategory('All')}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${duaCategory === 'All' ? 'bg-[#D9C6FF] text-[#5A3BAF]' : 'bg-[#F6F2FF] text-[#7F77DD]'}`}
                  >
                    All
                  </button>
                  {duaCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setDuaCategory(category)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${duaCategory === category ? 'bg-[#D9C6FF] text-[#5A3BAF]' : 'bg-[#F6F2FF] text-[#7F77DD]'}`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                <div className="space-y-4">
                  {filteredDuas.map((dua) => (
                    <div key={dua.id} className="rounded-[1.75rem] border border-[#E8E0F8] bg-[#FBF7FF] p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-[#2C2C2A]">{dua.title}</p>
                          <p className="text-sm text-[#6D6B6F]">{dua.category}</p>
                        </div>
                        <button type="button" onClick={() => toggleDuaFavourite(dua.id)} className="text-xl">
                          {dua.isFavourite ? '⭐' : '☆'}
                        </button>
                      </div>
                      {dua.arabic && <p className="mt-3 text-lg text-[#5A3BAF]">{dua.arabic}</p>}
                      <p className="mt-2 text-sm text-[#6D6B6F]">{dua.translation}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[1.75rem] border border-[#E8E0F8] bg-[#F8F3FF] p-5">
                <p className="text-sm font-semibold text-[#2C2C2A]">Add a new dua</p>
                <div className="mt-4 space-y-3">
                  <input
                    value={newDua.title}
                    onChange={(e) => setNewDua((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Title"
                    className="w-full rounded-3xl border border-[#E5DEFA] bg-white px-4 py-3 outline-none"
                  />
                  <input
                    value={newDua.arabic}
                    onChange={(e) => setNewDua((prev) => ({ ...prev, arabic: e.target.value }))}
                    placeholder="Arabic text"
                    className="w-full rounded-3xl border border-[#E5DEFA] bg-white px-4 py-3 outline-none"
                  />
                  <textarea
                    value={newDua.translation}
                    onChange={(e) => setNewDua((prev) => ({ ...prev, translation: e.target.value }))}
                    rows="3"
                    placeholder="Translation"
                    className="w-full rounded-3xl border border-[#E5DEFA] bg-white px-4 py-3 outline-none"
                  />
                  <select
                    value={newDua.category}
                    onChange={(e) => setNewDua((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full rounded-3xl border border-[#E5DEFA] bg-white px-4 py-3 outline-none"
                  >
                    {duaCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  <button type="button" onClick={handleAddDua} className="w-full rounded-full bg-[#8A71D0] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7559c3]">
                    Add dua
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'fasting' && (
          <section className="rounded-[2rem] border border-[#E5DEFA] bg-white p-6 shadow-soft">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#2C2C2A]">Fasting tracker</h2>
                <p className="mt-2 text-sm text-[#6D6B6F]">Log your fasting status and follow Ramadan rhythms.</p>
              </div>
              <button
                type="button"
                onClick={() => setRamadanMode((prev) => !prev)}
                className="rounded-full bg-[#E8E3FF] px-4 py-3 text-sm font-semibold text-[#5A3BAF]"
              >
                {ramadanMode ? 'Ramadan mode on' : 'Show Ramadan mode'}
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[1.75rem] bg-[#F8F3FF] p-5">
                <p className="text-sm font-semibold text-[#8A71D0]">Today</p>
                <div className="mt-4 space-y-3">
                  <select
                    value={fastingForm.type}
                    onChange={(e) => setFastingForm((prev) => ({ ...prev, type: e.target.value }))}
                    className="w-full rounded-3xl border border-[#E5DEFA] bg-white px-4 py-3 outline-none"
                  >
                    {fastingTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <select
                    value={fastingForm.status}
                    onChange={(e) => setFastingForm((prev) => ({ ...prev, status: e.target.value }))}
                    className="w-full rounded-3xl border border-[#E5DEFA] bg-white px-4 py-3 outline-none"
                  >
                    <option value="fasting">Fasting today ✅</option>
                    <option value="broke">Broke fast</option>
                    <option value="not-fasting">Not fasting</option>
                  </select>
                  <button type="button" onClick={handleFastingSave} className="w-full rounded-full bg-[#8A71D0] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7559c3]">
                    Save fasting day
                  </button>
                </div>
              </div>
              <div className="rounded-[1.75rem] bg-[#F8F3FF] p-5">
                <p className="text-sm font-semibold text-[#8A71D0]">Sunnah streak</p>
                <p className="mt-3 text-3xl font-semibold text-[#2C2C2A]">{fastingStreak} days</p>
                {ramadanMode && prayerTimes && (
                  <div className="mt-4 rounded-[1.5rem] bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-[#2C2C2A]">Ramadan rhythm</p>
                    <p className="mt-2 text-sm text-[#6D6B6F]">Suhoor: {prayerTimes?.Fajr}</p>
                    <p className="text-sm text-[#6D6B6F]">Iftar: {prayerTimes?.Maghrib}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 rounded-[2rem] border border-[#E8E0F8] bg-[#FBF7FF] p-6">
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#8A71D0]">Monthly fasting calendar</p>
              <div className="grid grid-cols-7 gap-2 text-center text-xs text-[#7F77DD]">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <div key={`${day}-${index}`}>{day}</div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-7 gap-2">
                {Array.from({ length: new Date().getDate() }, (_, index) => {
                  const date = new Date();
                  date.setDate(index + 1);
                  const key = formatDateKey(date);
                  const item = fastingLog[key];
                  const hasFast = item?.status === 'fasting';
                  return (
                    <div key={key} className={`rounded-2xl border p-3 ${hasFast ? 'bg-[#DDEBDB] border-[#B7D4BC]' : 'bg-[#F8F3FF] border-[#E8E0F8]'}`}>
                      <p className="text-sm font-semibold">{index + 1}</p>
                      {item && <p className="text-xs text-[#6D6B6F]">{item.type}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default IslamicHub;
