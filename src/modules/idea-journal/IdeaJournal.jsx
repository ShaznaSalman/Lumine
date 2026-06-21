import React, { useEffect, useMemo, useState } from 'react';
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

const categories = ['Business', 'Creative', 'Personal', 'Tech', 'Travel', 'Random'];
const statuses = [
  { value: 'New Idea', label: 'New Idea 💡' },
  { value: 'In Progress', label: 'In Progress 🔨' },
  { value: 'Done', label: 'Done ✅' },
  { value: 'Shelved', label: 'Shelved 🗄️' }
];
const categoryColors = {
  Business: 'from-[#D0F4FF] to-[#B8EBFF]',
  Creative: 'from-[#E8D9FF] to-[#E5C6FF]',
  Personal: 'from-[#D8F8E8] to-[#C0F0D7]',
  Tech: 'from-[#E3F6FF] to-[#CFE8FF]',
  Travel: 'from-[#FFF1D6] to-[#FFE1A8]',
  Random: 'from-[#F0F7FF] to-[#D9E9FF]'
};
const boardColors = ['#E3F6FF', '#F0F7FF', '#FFF2D1', '#E7F7E7', '#F6E8FF', '#E8F0FF'];

const formatDate = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const formatTime = (date) => date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const IdeaJournal = () => {
  const { currentUser } = useAuth();
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [viewMode, setViewMode] = useState('board');
  const [quickOpen, setQuickOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [newIdea, setNewIdea] = useState({ title: '', description: '', category: 'Creative', tags: '', status: 'New Idea', isPinned: false });

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const loadIdeas = async () => {
      setLoading(true);
      try {
        const ideasRef = collection(db, 'users', currentUser.uid, 'idea-journal', 'ideas');
        const ideasQuery = query(ideasRef, orderBy('isPinned', 'desc'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(ideasQuery);
        const loaded = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setIdeas(loaded);
      } catch (error) {
        console.error('Load ideas error', error);
      } finally {
        setLoading(false);
      }
    };

    loadIdeas();
  }, [currentUser]);

  const filteredIdeas = useMemo(() => {
    return ideas.filter((idea) => {
      const matchesSearch = [idea.title, ...(idea.tags || [])].some((value) =>
        String(value).toLowerCase().includes(search.toLowerCase())
      );
      const matchesCategory = filterCategory === 'All' || idea.category === filterCategory;
      const matchesStatus = filterStatus === 'All' || idea.status === filterStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [ideas, search, filterCategory, filterStatus]);

  const randomRotation = (id) => {
    const hash = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return ((hash % 5) - 2) * 1.5;
  };

  const saveIdea = async (ideaData) => {
    if (!currentUser?.uid || !ideaData.title.trim()) return;
    try {
      const ideaRef = doc(collection(db, 'users', currentUser.uid, 'idea-journal', 'ideas'));
      const payload = {
        ...ideaData,
        tags: ideaData.tags?.split(',').map((tag) => tag.trim()).filter(Boolean) || [],
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
        updates: []
      };
      await setDoc(ideaRef, payload);
      setIdeas((prev) => [{ id: ideaRef.id, ...payload }, ...prev]);
      setNewIdea({ title: '', description: '', category: 'Creative', tags: '', status: 'New Idea', isPinned: false });
      setQuickOpen(false);
    } catch (error) {
      console.error('Save idea error', error);
    }
  };

  const updateIdea = async (ideaId, updates) => {
    if (!currentUser?.uid) return;
    try {
      const ideaRef = doc(db, 'users', currentUser.uid, 'idea-journal', 'ideas', ideaId);
      await updateDoc(ideaRef, { ...updates, updatedAt: Timestamp.fromDate(new Date()) });
      setIdeas((prev) => prev.map((idea) => (idea.id === ideaId ? { ...idea, ...updates, updatedAt: Timestamp.fromDate(new Date()) } : idea)));
      if (selectedIdea?.id === ideaId) {
        setSelectedIdea((prev) => ({ ...prev, ...updates, updatedAt: Timestamp.fromDate(new Date()) }));
      }
    } catch (error) {
      console.error('Update idea error', error);
    }
  };

  const deleteIdea = async (ideaId) => {
    if (!currentUser?.uid || !window.confirm('Delete this idea?')) return;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'idea-journal', 'ideas', ideaId));
      setIdeas((prev) => prev.filter((idea) => idea.id !== ideaId));
      if (selectedIdea?.id === ideaId) {
        setSelectedIdea(null);
        setEditMode(false);
      }
    } catch (error) {
      console.error('Delete idea error', error);
    }
  };

  const addUpdate = async () => {
    if (!currentUser?.uid || !selectedIdea || !noteText.trim()) return;
    const nextUpdate = { text: noteText.trim(), timestamp: Timestamp.fromDate(new Date()) };
    const updatedUpdates = [...(selectedIdea.updates || []), nextUpdate];
    await updateIdea(selectedIdea.id, { updates: updatedUpdates });
    setNoteText('');
  };

  const togglePin = async (idea) => {
    await updateIdea(idea.id, { isPinned: !idea.isPinned });
  };

  const pinBadge = (idea) => (idea.isPinned ? '⭐' : '');

  if (loading) {
    return <div className="min-h-screen bg-[#E6F5FF] flex items-center justify-center text-[#1A4A70]">Loading idea journal…</div>;
  }

  return (
    <div className="min-h-screen bg-[#E6F5FF] px-4 py-6 text-[#1A3D65] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[#B8E0FF] bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#2E6BAA]">Idea Journal</p>
              <h1 className="mt-3 text-4xl font-semibold text-[#0F3B67]">Capture and shape your brightest sparks.</h1>
              <p className="mt-2 text-sm text-[#4A6B8D]">Sticky-note style ideas, quick capture, filters, and a mini idea board.</p>
            </div>
            <button
              type="button"
              onClick={() => setQuickOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2563eb]"
            >
              ⚡ Capture idea
            </button>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] border border-[#B8E0FF] bg-white p-6 shadow-soft">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('board')}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${viewMode === 'board' ? 'bg-[#3B82F6] text-white' : 'bg-[#EFF6FF] text-[#1D4ED8]'}`}
                >
                  Board
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${viewMode === 'list' ? 'bg-[#3B82F6] text-white' : 'bg-[#EFF6FF] text-[#1D4ED8]'}`}
                >
                  List
                </button>
              </div>
              <div className="ml-auto flex flex-wrap gap-3">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title or tag"
                  className="w-full min-w-[220px] rounded-3xl border border-[#B8E0FF] bg-[#EFF6FF] px-4 py-3 outline-none"
                />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="rounded-3xl border border-[#B8E0FF] bg-[#EFF6FF] px-4 py-3 outline-none"
                >
                  <option value="All">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-3xl border border-[#B8E0FF] bg-[#EFF6FF] px-4 py-3 outline-none"
                >
                  <option value="All">All statuses</option>
                  {statuses.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#B8E0FF] bg-white p-6 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#2E6BAA]">Pinned ideas</p>
            <p className="mt-3 text-sm text-[#4A6B8D]">Pinned entries stay at the top of the board for easy inspiration.</p>
            <div className="mt-5 grid gap-3">
              {ideas.filter((idea) => idea.isPinned).length === 0 ? (
                <p className="rounded-3xl bg-[#EFF6FF] p-4 text-sm text-[#1D4ED8]">No pinned ideas yet. Pin a favourite idea to keep it visible.</p>
              ) : (
                ideas.filter((idea) => idea.isPinned).map((idea) => (
                  <div key={idea.id} className="rounded-3xl bg-[#EFF6FF] p-4 text-sm text-[#1D4ED8]">{idea.title}</div>
                ))
              )}
            </div>
          </div>
        </section>

        {viewMode === 'board' ? (
          <section className="rounded-[2rem] border border-[#B8E0FF] bg-white p-6 shadow-soft">
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredIdeas.length === 0 ? (
                <div className="rounded-[2rem] bg-[#EFF6FF] p-8 text-center text-[#1D4ED8]">No ideas match your filters.</div>
              ) : (
                filteredIdeas.map((idea) => (
                  <button
                    key={idea.id}
                    type="button"
                    onClick={() => { setSelectedIdea(idea); setEditMode(false); }}
                    className="group relative rounded-[2rem] border border-[#B8E0FF] bg-white p-5 text-left shadow-soft transition hover:-translate-y-1"
                    style={{ transform: `rotate(${randomRotation(idea.id)}deg)`, backgroundColor: boardColors[Math.abs(idea.id.charCodeAt(0)) % boardColors.length] }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[#1D4ED8] shadow-sm">{idea.category}</span>
                      <span className="text-sm">{pinBadge(idea)}</span>
                    </div>
                    <div className="mt-4">
                      <h2 className="text-xl font-semibold text-[#0F3B67]">{idea.title}</h2>
                      <p className="mt-3 line-clamp-4 text-sm text-[#334E7E]">{idea.description}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {idea.tags?.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSearch(tag); setFilterCategory('All'); setFilterStatus('All'); }}
                          className="rounded-full bg-[#DBEAFE] px-3 py-1 text-xs text-[#1D4ED8]"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-[#4A6B8D]">
                      <span>{formatDate(idea.createdAt.toDate())}</span>
                      <span>{statuses.find((status) => status.value === idea.status)?.label}</span>
                    </div>
                    <div className="mt-4 flex justify-between gap-2 text-xs text-[#4A6B8D]">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); togglePin(idea); }}
                        className="rounded-full bg-[#EFF6FF] px-3 py-2"
                      >
                        {idea.isPinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteIdea(idea.id); }}
                        className="rounded-full bg-[#FEE2E2] px-3 py-2 text-[#B91C1C]"
                      >
                        Delete
                      </button>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-[#B8E0FF] bg-white p-6 shadow-soft">
            {filteredIdeas.length === 0 ? (
              <div className="rounded-[2rem] bg-[#EFF6FF] p-8 text-center text-[#1D4ED8]">No ideas match your filters.</div>
            ) : (
              <div className="space-y-4">
                {filteredIdeas.map((idea) => (
                  <div key={idea.id} className="rounded-[2rem] border border-[#D6E9FF] bg-[#F8FBFF] p-5 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-xl font-semibold text-[#0F3B67]">{idea.title}</h2>
                        <p className="text-sm text-[#334E7E]">{idea.description}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-[#1D4ED8]">
                        <span className="rounded-full bg-[#DBEAFE] px-3 py-1">{idea.category}</span>
                        <span className="rounded-full bg-[#D1FAE5] px-3 py-1">{statuses.find((status) => status.value === idea.status)?.label}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {idea.tags?.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => { setSearch(tag); setFilterCategory('All'); setFilterStatus('All'); }}
                          className="rounded-full bg-[#E0F2FE] px-3 py-1 text-xs text-[#1D4ED8]"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#4A6B8D]">
                      <span>{formatDate(idea.createdAt.toDate())}</span>
                      <button
                        type="button"
                        onClick={() => { setSelectedIdea(idea); setEditMode(false); }}
                        className="rounded-full bg-[#EFF6FF] px-3 py-2 text-[#1D4ED8]"
                      >
                        View details
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePin(idea)}
                        className="rounded-full bg-[#EFF6FF] px-3 py-2 text-[#1D4ED8]"
                      >
                        {idea.isPinned ? 'Unpin' : 'Pin'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {selectedIdea && (
          <section className="rounded-[2rem] border border-[#B8E0FF] bg-white p-6 shadow-soft">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#2E6BAA]">Idea details</p>
                <h2 className="mt-3 text-3xl font-semibold text-[#0F3B67]">{selectedIdea.title}</h2>
                <p className="mt-2 text-sm text-[#4A6B8D]">{selectedIdea.category} • {statuses.find((status) => status.value === selectedIdea.status)?.label}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditMode((prev) => !prev)}
                className="rounded-full bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2563eb]"
              >
                {editMode ? 'View' : 'Edit'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIdea(null)}
                className="rounded-full bg-[#EFF6FF] px-5 py-3 text-sm font-semibold text-[#1D4ED8]"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <div>
                {editMode ? (
                  <div className="space-y-4">
                    <input
                      value={selectedIdea.title}
                      onChange={(e) => setSelectedIdea((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full rounded-3xl border border-[#B8E0FF] bg-[#EFF6FF] px-4 py-3 outline-none"
                    />
                    <textarea
                      value={selectedIdea.description}
                      onChange={(e) => setSelectedIdea((prev) => ({ ...prev, description: e.target.value }))}
                      rows="6"
                      className="w-full rounded-3xl border border-[#B8E0FF] bg-[#EFF6FF] px-4 py-3 outline-none"
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <select
                        value={selectedIdea.category}
                        onChange={(e) => setSelectedIdea((prev) => ({ ...prev, category: e.target.value }))}
                        className="rounded-3xl border border-[#B8E0FF] bg-[#EFF6FF] px-4 py-3 outline-none"
                      >
                        {categories.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                      <select
                        value={selectedIdea.status}
                        onChange={(e) => setSelectedIdea((prev) => ({ ...prev, status: e.target.value }))}
                        className="rounded-3xl border border-[#B8E0FF] bg-[#EFF6FF] px-4 py-3 outline-none"
                      >
                        {statuses.map((status) => (
                          <option key={status.value} value={status.value}>{status.label}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      value={(selectedIdea.tags || []).join(', ')}
                      onChange={(e) => setSelectedIdea((prev) => ({ ...prev, tags: e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) }))}
                      placeholder="Tags, comma separated"
                      className="w-full rounded-3xl border border-[#B8E0FF] bg-[#EFF6FF] px-4 py-3 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateIdea(selectedIdea.id, {
                        title: selectedIdea.title,
                        description: selectedIdea.description,
                        category: selectedIdea.category,
                        status: selectedIdea.status,
                        tags: selectedIdea.tags
                      })}
                      className="rounded-full bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2563eb]"
                    >
                      Save changes
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className={`rounded-[2rem] border border-[#DBEAFE] bg-gradient-to-br ${categoryColors[selectedIdea.category] || 'from-[#E3F6FF] to-[#D9E9FF]'} p-6`}>
                      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#1D4ED8]">{selectedIdea.category}</p>
                      <p className="mt-4 text-sm leading-7 text-[#1E3A8A]">{selectedIdea.description}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {(selectedIdea.tags || []).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => { setSearch(tag); setFilterCategory('All'); setFilterStatus('All'); }}
                          className="rounded-full bg-[#DBEAFE] px-3 py-1 text-xs text-[#1D4ED8]"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-[2rem] border border-[#B8E0FF] bg-[#EFF6FF] p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#2E6BAA]">Updates</p>
                <div className="mt-4 space-y-3">
                  {(selectedIdea.updates || []).slice().reverse().map((update, index) => (
                    <div key={`${update.timestamp.toMillis()}-${index}`} className="rounded-3xl bg-white p-4 shadow-sm">
                      <p className="text-sm text-[#1D4ED8]">{update.text}</p>
                      <p className="mt-2 text-xs text-[#4A6B8D]">{formatDate(update.timestamp.toDate())} • {formatTime(update.timestamp.toDate())}</p>
                    </div>
                  ))}
                  {selectedIdea.updates?.length === 0 && <p className="text-sm text-[#4A6B8D]">No updates yet.</p>}
                </div>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows="3"
                  placeholder="Add a note or update"
                  className="mt-4 w-full rounded-3xl border border-[#B8E0FF] bg-white px-4 py-3 outline-none"
                />
                <button
                  type="button"
                  onClick={addUpdate}
                  className="mt-3 w-full rounded-full bg-[#3B82F6] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2563eb]"
                >
                  Add update
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      {quickOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#2E6BAA]">Quick capture</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#0F3B67]">Capture idea ⚡</h2>
              </div>
              <button
                type="button"
                onClick={() => setQuickOpen(false)}
                className="rounded-full bg-[#EFF6FF] px-4 py-2 text-sm text-[#1D4ED8]"
              >
                Close
              </button>
            </div>
            <div className="mt-6 grid gap-4">
              <input
                value={newIdea.title}
                onChange={(e) => setNewIdea((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Title"
                className="w-full rounded-3xl border border-[#B8E0FF] bg-[#EFF6FF] px-4 py-3 outline-none"
              />
              <textarea
                value={newIdea.description}
                onChange={(e) => setNewIdea((prev) => ({ ...prev, description: e.target.value }))}
                rows="3"
                placeholder="Description"
                className="w-full rounded-3xl border border-[#B8E0FF] bg-[#EFF6FF] px-4 py-3 outline-none"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <select
                  value={newIdea.category}
                  onChange={(e) => setNewIdea((prev) => ({ ...prev, category: e.target.value }))}
                  className="rounded-3xl border border-[#B8E0FF] bg-[#EFF6FF] px-4 py-3 outline-none"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <select
                  value={newIdea.status}
                  onChange={(e) => setNewIdea((prev) => ({ ...prev, status: e.target.value }))}
                  className="rounded-3xl border border-[#B8E0FF] bg-[#EFF6FF] px-4 py-3 outline-none"
                >
                  {statuses.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
              <input
                value={newIdea.tags}
                onChange={(e) => setNewIdea((prev) => ({ ...prev, tags: e.target.value }))}
                placeholder="Tags, comma separated"
                className="w-full rounded-3xl border border-[#B8E0FF] bg-[#EFF6FF] px-4 py-3 outline-none"
              />
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setQuickOpen(false)}
                  className="rounded-full bg-[#EFF6FF] px-5 py-3 text-sm font-semibold text-[#1D4ED8]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveIdea(newIdea)}
                  className="rounded-full bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2563eb]"
                >
                  Save idea
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IdeaJournal;
