import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../firebase';

const moduleList = [
  { id: 'period-tracker', title: 'Period Tracker', emoji: '🌺' },
  { id: 'workout-yoga', title: 'Workout & Yoga', emoji: '🧘' },
  { id: 'islamic-hub', title: 'Islamic Hub', emoji: '☪️' },
  { id: 'diet-nutrition', title: 'Diet & Nutrition', emoji: '🥗' },
  { id: 'selfcare', title: 'Selfcare', emoji: '💆' },
  { id: 'money-manager', title: 'Money Manager', emoji: '💰' },
  { id: 'idea-journal', title: 'Idea Journal', emoji: '📓' },
  { id: 'meditation', title: 'Meditation', emoji: '🧘‍♀️' },
  { id: 'hobby-tracker', title: 'Hobby Tracker', emoji: '🎨' },
  { id: 'study-tracker', title: 'Study Tracker', emoji: '📖' },
  { id: 'work-tracker', title: 'Work Tracker', emoji: '🗂️' },
  { id: 'vision-board', title: 'Vision Board', emoji: '🖼️' },
  { id: 'bucket-list', title: 'Bucket List', emoji: '🪣' }
];

const avatarOptions = ['🌸', '🌙', '✨', '🦋', '🌺', '🍀', '🌈', '⭐', '🌻', '🦄', '🌿', '💫'];
const accentColors = ['#7F77DD', '#B794F4', '#D6BCFA', '#C4B5FD', '#A3E635', '#FBBF24', '#38BDF8', '#F472B6'];
const currencyOptions = ['$', '€', '£', '¥', '₹', '₩', '₽', 'CAD', 'AUD', 'CHF'];

const Settings = () => {
  const { currentUser } = useAuth();
  const username = currentUser?.displayName || 'Friend';
  const email = currentUser?.email || `${username}@lumine.app`;
  const [settings, setSettings] = useState({
    currency: '$',
    city: '',
    country: '',
    firstDayOfWeek: 'Monday',
    accentColor: '#7F77DD',
    avatarEmoji: '🌸',
    moduleOrder: moduleList.map((item) => item.id),
    hiddenModules: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [passwordState, setPasswordState] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [draggedId, setDraggedId] = useState(null);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const loadSettings = async () => {
      setLoading(true);
      try {
        const settingsRef = doc(db, 'users', currentUser.uid, 'settings');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          setSettings((prev) => ({
            ...prev,
            ...data,
            moduleOrder: data.moduleOrder || prev.moduleOrder,
            hiddenModules: data.hiddenModules || prev.hiddenModules
          }));
        }
      } catch (error) {
        console.error('Load settings error', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [currentUser]);

  useEffect(() => {
    document.documentElement.style.setProperty('--lumine-accent', settings.accentColor);
  }, [settings.accentColor]);

  const orderedModules = useMemo(
    () => settings.moduleOrder.map((id) => moduleList.find((module) => module.id === id) || { id, title: id, emoji: '•' }),
    [settings.moduleOrder]
  );

  const handleSaveSettings = async () => {
    if (!currentUser?.uid) return;
    setSaving(true);
    try {
      const settingsRef = doc(db, 'users', currentUser.uid, 'settings');
      await setDoc(settingsRef, settings, { merge: true });
      setMessage('Settings saved successfully');
      window.setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Save settings error', error);
      setMessage('Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentUser) return;
    const { currentPassword, newPassword, confirmPassword } = passwordState;
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage('Please fill all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage('New password and confirm password must match.');
      return;
    }
    setPasswordSaving(true);
    try {
      const credential = EmailAuthProvider.credential(email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setPasswordState({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMessage('Password updated successfully.');
    } catch (error) {
      console.error('Password change error', error);
      setPasswordMessage('Unable to change password. Check your current password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const exportDocument = async (docRef) => {
    const result = {};
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      result.data = docSnap.data();
    }
    return result;
  };

  const handleExportData = async () => {
    if (!currentUser?.uid) return;
    setExporting(true);
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const payload = await exportDocument(userDocRef);
      const fileName = `lumine-data-${username || currentUser.uid}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage('Your data export is ready.');
      window.setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Export data error', error);
      setMessage('Could not export data.');
    } finally {
      setExporting(false);
    }
  };

  const deleteDocument = async (docRef) => {
    await deleteDoc(docRef);
  };

  const handleClearAllData = async () => {
    if (!currentUser?.uid) return;
    const confirmed = window.confirm('Clear all Lumine data? This cannot be undone.');
    if (!confirmed) return;
    const typed = window.prompt('Type CLEAR ALL to confirm.');
    if (typed !== 'CLEAR ALL') return;
    setClearing(true);
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await deleteDocument(userDocRef);
      setMessage('All Firestore data cleared.');
      window.setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Clear data error', error);
      setMessage('Unable to clear data.');
    } finally {
      setClearing(false);
    }
  };

  const handleDragStart = (event, id) => {
    setDraggedId(id);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event, id) => {
    event.preventDefault();
    if (draggedId === id) return;
    const nextOrder = [...settings.moduleOrder];
    const fromIndex = nextOrder.indexOf(draggedId);
    const toIndex = nextOrder.indexOf(id);
    if (fromIndex === -1 || toIndex === -1) return;
    nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, draggedId);
    setSettings((prev) => ({ ...prev, moduleOrder: nextOrder }));
  };

  const handleToggleHidden = (moduleId) => {
    setSettings((prev) => {
      const isHidden = prev.hiddenModules.includes(moduleId);
      return {
        ...prev,
        hiddenModules: isHidden
          ? prev.hiddenModules.filter((id) => id !== moduleId)
          : [...prev.hiddenModules, moduleId]
      };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDF6FF] text-[#2C2C2A]">
        <div className="mx-auto flex min-h-screen items-center justify-center px-6 py-20">
          <div className="rounded-[2rem] border border-[#E9E3F4] bg-white p-10 shadow-soft text-center">
            <p className="text-xl font-semibold text-[#7F77DD]">Loading settings…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F5FF] text-[#2C2C2A]">
      <div className="sticky top-0 z-20 border-b border-[#E9E3F4] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 text-[#7F77DD]">
            <Link to="/" className="inline-flex items-center gap-2 rounded-3xl border border-[#E9E3F4] bg-[#F4F0FF] px-4 py-2 text-sm font-semibold hover:bg-[#EEE7FF]">
              ← Dashboard
            </Link>
            <span className="text-lg font-semibold">Settings</span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-6">
          <section className="rounded-[2rem] border border-[#E9E3F4] bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#7F77DD]">Profile</p>
                <h1 className="mt-2 text-3xl font-semibold text-[#2C2C2A]">Personal details</h1>
                <p className="mt-2 text-sm text-[#6D6B6F]">Update your avatar and account preferences securely.</p>
              </div>
              <div className="rounded-full bg-[#F4F0FF] px-4 py-2 text-sm font-semibold text-[#7F77DD]">Logged in as {username}</div>
            </div>

            <div className="mt-8 space-y-6">
              <div className="rounded-[1.75rem] border border-[#E9E3F4] bg-[#F8F7FF] p-5">
                <p className="text-sm font-semibold text-[#2C2C2A]">Username</p>
                <p className="mt-3 rounded-3xl border border-[#E9E3F4] bg-white px-4 py-3 text-sm text-[#6D6B6F]">{username}</p>
              </div>

              <div className="rounded-[1.75rem] border border-[#E9E3F4] bg-[#F8F7FF] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#2C2C2A]">Profile avatar</p>
                    <p className="mt-2 text-sm text-[#6D6B6F]">Choose a soft icon that feels like you.</p>
                  </div>
                  <div className="rounded-3xl bg-white px-4 py-3 text-2xl shadow-sm">{settings.avatarEmoji}</div>
                </div>
                <div className="mt-4 grid grid-cols-6 gap-3 sm:grid-cols-12">
                  {avatarOptions.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSettings((prev) => ({ ...prev, avatarEmoji: emoji }))}
                      className={`flex h-12 items-center justify-center rounded-3xl border px-3 text-2xl transition ${settings.avatarEmoji === emoji ? 'border-[#7F77DD] bg-[#F4F0FF]' : 'border-[#E9E3F4] bg-white hover:bg-[#F7F3FF]'}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-[#E9E3F4] bg-[#F8F7FF] p-5">
                <p className="text-sm font-semibold text-[#2C2C2A]">Change password</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <input
                    type="password"
                    placeholder="Current password"
                    value={passwordState.currentPassword}
                    onChange={(e) => setPasswordState((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    className="rounded-3xl border border-[#E9E3F4] bg-white px-4 py-3 text-sm outline-none"
                  />
                  <input
                    type="password"
                    placeholder="New password"
                    value={passwordState.newPassword}
                    onChange={(e) => setPasswordState((prev) => ({ ...prev, newPassword: e.target.value }))}
                    className="rounded-3xl border border-[#E9E3F4] bg-white px-4 py-3 text-sm outline-none"
                  />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={passwordState.confirmPassword}
                    onChange={(e) => setPasswordState((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    className="rounded-3xl border border-[#E9E3F4] bg-white px-4 py-3 text-sm outline-none"
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={passwordSaving}
                    className="rounded-full bg-[#7F77DD] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#6B5BC7] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {passwordSaving ? 'Saving…' : 'Update password'}
                  </button>
                  {passwordMessage && <p className="text-sm text-[#6D6B6F]">{passwordMessage}</p>}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-[#E9E3F4] bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#7F77DD]">App preferences</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#2C2C2A]">Global experience</h2>
                <p className="mt-2 text-sm text-[#6D6B6F]">Tailor how Lumine feels across Money Manager, prayer times, and your dashboard.</p>
              </div>
              <div className="rounded-3xl bg-[#F4F0FF] px-4 py-2 text-sm font-semibold text-[#7F77DD]">Accent: {settings.accentColor}</div>
            </div>

            <div className="mt-8 grid gap-4">
              <div className="grid gap-2 rounded-3xl border border-[#E9E3F4] bg-[#F8F7FF] p-4">
                <label className="text-sm font-semibold text-[#2C2C2A]">Default currency</label>
                <select
                  value={settings.currency}
                  onChange={(e) => setSettings((prev) => ({ ...prev, currency: e.target.value }))}
                  className="rounded-3xl border border-[#E9E3F4] bg-white px-4 py-3 text-sm outline-none"
                >
                  {currencyOptions.map((symbol) => (
                    <option key={symbol} value={symbol}>{symbol}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 rounded-3xl border border-[#E9E3F4] bg-[#F8F7FF] p-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-[#2C2C2A]">City</label>
                  <input
                    value={settings.city}
                    onChange={(e) => setSettings((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="City"
                    className="rounded-3xl border border-[#E9E3F4] bg-white px-4 py-3 text-sm outline-none"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-[#2C2C2A]">Country</label>
                  <input
                    value={settings.country}
                    onChange={(e) => setSettings((prev) => ({ ...prev, country: e.target.value }))}
                    placeholder="Country"
                    className="rounded-3xl border border-[#E9E3F4] bg-white px-4 py-3 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-2 rounded-3xl border border-[#E9E3F4] bg-[#F8F7FF] p-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-[#2C2C2A]">First day of week</p>
                  <div className="mt-3 flex gap-3">
                    {['Monday', 'Sunday'].map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSettings((prev) => ({ ...prev, firstDayOfWeek: day }))}
                        className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${settings.firstDayOfWeek === day ? 'bg-[#7F77DD] text-white' : 'bg-white text-[#2C2C2A] border border-[#E9E3F4]'}`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#2C2C2A]">App color theme</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {accentColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSettings((prev) => ({ ...prev, accentColor: color }))}
                        className={`h-12 w-12 rounded-3xl border-2 transition ${settings.accentColor === color ? 'border-[#7F77DD]' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-[#E9E3F4] bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#7F77DD]">Dashboard customisation</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#2C2C2A]">Reorder and hide modules</h2>
                <p className="mt-2 text-sm text-[#6D6B6F]">Move your favorite tools to the top and hide the ones you don’t use every day.</p>
              </div>
              <div className="rounded-3xl bg-[#F4F0FF] px-4 py-2 text-sm font-semibold text-[#7F77DD]">Hidden modules stay in sidebar</div>
            </div>

            <div className="mt-8 space-y-3">
              {orderedModules.map((module) => {
                const isHidden = settings.hiddenModules.includes(module.id);
                return (
                  <div
                    key={module.id}
                    draggable
                    onDragStart={(event) => handleDragStart(event, module.id)}
                    onDragOver={(event) => handleDragOver(event, module.id)}
                    className={`flex cursor-grab items-center justify-between gap-3 rounded-[1.75rem] border border-[#E9E3F4] bg-white px-4 py-4 shadow-sm transition ${isHidden ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-[#F4F0FF] text-xl">{module.emoji}</div>
                      <div>
                        <p className="text-sm font-semibold text-[#2C2C2A]">{module.title}</p>
                        <p className="text-xs text-[#6D6B6F]">Drag to reorder</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleHidden(module.id)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${isHidden ? 'bg-[#FDE8F3] text-[#C81F7A]' : 'bg-[#EEF2FF] text-[#7F77DD]'}`}
                    >
                      {isHidden ? 'Hidden' : 'Visible'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[2rem] border border-[#E9E3F4] bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#7F77DD]">Data</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#2C2C2A]">Backup and reset</h2>
                <p className="mt-2 text-sm text-[#6D6B6F]">Export your Firestore profile, or clear everything with confirmation.</p>
              </div>
              <div className="rounded-3xl bg-[#F4F0FF] px-4 py-2 text-sm font-semibold text-[#7F77DD]">Private cloud storage</div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleExportData}
                disabled={exporting}
                className="rounded-[1.75rem] border border-[#E9E3F4] bg-[#F4F0FF] px-5 py-4 text-left text-sm font-semibold text-[#2C2C2A] transition hover:bg-[#EEE7FF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <p>Export my data</p>
                <p className="mt-2 text-xs text-[#6D6B6F]">Download all Firestore user data as JSON.</p>
              </button>
              <button
                type="button"
                onClick={handleClearAllData}
                disabled={clearing}
                className="rounded-[1.75rem] border border-[#F9D8E6] bg-[#FEF1F8] px-5 py-4 text-left text-sm font-semibold text-[#B82573] transition hover:bg-[#FCE7F6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <p>Clear all data</p>
                <p className="mt-2 text-xs text-[#6D6B6F]">Deletes all Firestore documents for your account.</p>
              </button>
            </div>
          </section>

          <section className="rounded-[2rem] border border-[#E9E3F4] bg-white p-6 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#7F77DD]">About</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-[#F8F7FF] p-4">
                <p className="text-sm text-[#6D6B6F]">App version</p>
                <p className="mt-2 text-lg font-semibold text-[#2C2C2A]">1.0.0</p>
              </div>
              <div className="rounded-3xl bg-[#F8F7FF] p-4">
                <p className="text-sm text-[#6D6B6F]">Made with</p>
                <p className="mt-2 text-lg font-semibold text-[#2C2C2A]">💜 for {username}</p>
              </div>
              <div className="rounded-3xl bg-[#F8F7FF] p-4">
                <p className="text-sm text-[#6D6B6F]">Privacy note</p>
                <p className="mt-2 text-sm text-[#4F4B70]">Your data is private and stored securely in your personal cloud.</p>
              </div>
            </div>
          </section>

          <div className="rounded-[2rem] border border-[#E9E3F4] bg-[#F4F0FF] p-6 text-sm text-[#2C2C2A] shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-[#2C2C2A]">Save changes</p>
                <p className="text-sm text-[#6D6B6F]">Tap to save your current preferences and module layout.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {message && <span className="rounded-full bg-[#EEF2FF] px-4 py-2 text-sm text-[#4338CA]">{message}</span>}
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="rounded-full bg-[#7F77DD] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#6B5BC7] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
