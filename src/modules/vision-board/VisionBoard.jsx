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

const cardTypes = ['Image', 'Quote', 'Affirmation', 'Goal', 'Word'];
const pastelColors = ['#FCE7F3', '#FDE2E7', '#FEE2C5', '#E9D5FF', '#DBEAFE'];
const affirmationGradients = [
  'linear-gradient(135deg, #FBCFE8 0%, #FCE7F3 100%)',
  'linear-gradient(135deg, #C7D2FE 0%, #E0E7FF 100%)',
  'linear-gradient(135deg, #FDE68A 0%, #FEF3C7 100%)',
  'linear-gradient(135deg, #FEE2E2 0%, #FDE8E8 100%)'
];

const defaultBoard = { name: 'Dream Life' };

const VisionBoard = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState([]);
  const [cards, setCards] = useState([]);
  const [affirmations, setAffirmations] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState('');
  const [boardModalOpen, setBoardModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [affirmationModalOpen, setAffirmationModalOpen] = useState(false);
  const [editAffirmationId, setEditAffirmationId] = useState(null);
  const [affirmationDisplay, setAffirmationDisplay] = useState(null);
  const [newBoard, setNewBoard] = useState({ name: '' });
  const [newCard, setNewCard] = useState({
    type: 'Image',
    imageUrl: '',
    caption: '',
    quote: '',
    author: '',
    affirmation: '',
    goalTitle: '',
    deadline: '',
    progress: 0,
    word: '',
    fontSize: 48,
    bgColor: pastelColors[0]
  });
  const [newAffirmation, setNewAffirmation] = useState({ text: '' });

  useEffect(() => {
    if (!currentUser?.uid) return;

    const loadBoardData = async () => {
      setLoading(true);
      try {
        const boardsRef = collection(db, 'users', currentUser.uid, 'vision-board', 'boards');
        const cardsRef = collection(db, 'users', currentUser.uid, 'vision-board', 'cards');
        const affirmationsRef = collection(db, 'users', currentUser.uid, 'vision-board', 'affirmations');

        const [boardsSnap, cardsSnap, affSnap] = await Promise.all([
          getDocs(query(boardsRef, orderBy('createdAt', 'desc'))),
          getDocs(query(cardsRef, orderBy('createdAt', 'desc'))),
          getDocs(query(affirmationsRef, orderBy('createdAt', 'desc')))
        ]);

        const loadedBoards = boardsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        const loadedCards = cardsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        const loadedAffirmations = affSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

        setBoards(loadedBoards);
        setCards(loadedCards);
        setAffirmations(loadedAffirmations);
        if (loadedBoards.length) {
          setActiveBoardId((prev) => prev || loadedBoards[0].id);
        }
      } catch (error) {
        console.error('Vision board load error', error);
      } finally {
        setLoading(false);
      }
    };

    loadBoardData();
  }, [currentUser]);

  useEffect(() => {
    if (!boards.length && currentUser?.uid) {
      const createDefaultBoard = async () => {
        const ref = doc(collection(db, 'users', currentUser.uid, 'vision-board', 'boards'));
        const payload = { ...defaultBoard, createdAt: Timestamp.now() };
        await setDoc(ref, payload);
        setBoards([{ id: ref.id, ...payload }]);
        setActiveBoardId(ref.id);
      };
      createDefaultBoard().catch(console.error);
    }
  }, [boards.length, currentUser]);

  const activeBoard = useMemo(() => boards.find((board) => board.id === activeBoardId), [boards, activeBoardId]);
  const boardCards = useMemo(() => cards.filter((card) => card.boardId === activeBoardId), [cards, activeBoardId]);

  const addBoard = async () => {
    if (!currentUser?.uid || !newBoard.name.trim()) return;
    try {
      const ref = doc(collection(db, 'users', currentUser.uid, 'vision-board', 'boards'));
      const payload = { ...newBoard, createdAt: Timestamp.now() };
      await setDoc(ref, payload);
      setBoards((prev) => [{ id: ref.id, ...payload }, ...prev]);
      setActiveBoardId(ref.id);
      setNewBoard({ name: '' });
      setBoardModalOpen(false);
    } catch (error) {
      console.error('Add board error', error);
    }
  };

  const addCard = async () => {
    if (!currentUser?.uid || !activeBoardId) return;
    const content = {};
    switch (newCard.type) {
      case 'Image':
        if (!newCard.imageUrl.trim()) return;
        content.imageUrl = newCard.imageUrl;
        content.caption = newCard.caption;
        break;
      case 'Quote':
        if (!newCard.quote.trim()) return;
        content.quote = newCard.quote;
        content.author = newCard.author;
        content.bgColor = newCard.bgColor;
        break;
      case 'Affirmation':
        if (!newCard.affirmation.trim()) return;
        content.affirmation = newCard.affirmation;
        content.gradient = affirmationGradients[Math.floor(Math.random() * affirmationGradients.length)];
        break;
      case 'Goal':
        if (!newCard.goalTitle.trim()) return;
        content.goalTitle = newCard.goalTitle;
        content.deadline = newCard.deadline;
        content.progress = newCard.progress;
        break;
      case 'Word':
        if (!newCard.word.trim()) return;
        content.word = newCard.word;
        content.fontSize = newCard.fontSize;
        content.bgColor = newCard.bgColor;
        break;
      default:
        return;
    }

    try {
      const ref = doc(collection(db, 'users', currentUser.uid, 'vision-board', 'cards'));
      const payload = {
        boardId: activeBoardId,
        type: newCard.type,
        content,
        position: boardCards.length,
        createdAt: Timestamp.now()
      };
      await setDoc(ref, payload);
      setCards((prev) => [{ id: ref.id, ...payload }, ...prev]);
      setCardModalOpen(false);
      setNewCard({
        type: 'Image',
        imageUrl: '',
        caption: '',
        quote: '',
        author: '',
        affirmation: '',
        goalTitle: '',
        deadline: '',
        progress: 0,
        word: '',
        fontSize: 48,
        bgColor: pastelColors[0]
      });
    } catch (error) {
      console.error('Add card error', error);
    }
  };

  const addAffirmation = async () => {
    if (!currentUser?.uid || !newAffirmation.text.trim()) return;
    try {
      const ref = editAffirmationId
        ? doc(db, 'users', currentUser.uid, 'vision-board', 'affirmations', editAffirmationId)
        : doc(collection(db, 'users', currentUser.uid, 'vision-board', 'affirmations'));
      const payload = { text: newAffirmation.text, createdAt: Timestamp.now() };
      await setDoc(ref, payload);
      if (editAffirmationId) {
        setAffirmations((prev) => prev.map((item) => (item.id === editAffirmationId ? { id: editAffirmationId, ...payload } : item)));
      } else {
        setAffirmations((prev) => [{ id: ref.id, ...payload }, ...prev]);
      }
      setNewAffirmation({ text: '' });
      setAffirmationModalOpen(false);
      setEditAffirmationId(null);
    } catch (error) {
      console.error('Add affirmation error', error);
    }
  };

  const deleteAffirmation = async (id) => {
    if (!currentUser?.uid) return;
    try {
      const ref = doc(db, 'users', currentUser.uid, 'vision-board', 'affirmations', id);
      await deleteDoc(ref);
      setAffirmations((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error('Delete affirmation error', error);
    }
  };

  const openEditAffirmation = (affirmation) => {
    setEditAffirmationId(affirmation.id);
    setNewAffirmation({ text: affirmation.text });
    setAffirmationModalOpen(true);
  };

  const randomAffirmation = () => {
    if (!affirmations.length) return;
    const choice = affirmations[Math.floor(Math.random() * affirmations.length)];
    setAffirmationDisplay(choice);
  };

  const closeAffirmationDisplay = () => setAffirmationDisplay(null);

  if (loading) {
    return <div className="min-h-screen bg-[#FDF2F8] flex items-center justify-center text-[#9D174D]">Loading vision board…</div>;
  }

  return (
    <div className="min-h-screen bg-[#FDF2F8] px-4 py-6 text-[#831843] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[#FBCFE8] bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#BE185D]">Vision Board</p>
              <h1 className="mt-3 text-4xl font-semibold text-[#831843]">Dream it. Place it. Keep it glowing.</h1>
              <p className="mt-2 text-sm text-[#9D174D]">Build boards of goals, affirmations, inspirations, and vision cards in a soft rose space.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setBoardModalOpen(true)}
                className="rounded-full bg-[#DB2777] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#BE185D]"
              >
                + New board
              </button>
              <button
                type="button"
                onClick={() => setCardModalOpen(true)}
                className="rounded-full bg-[#F9A8D4] px-5 py-3 text-sm font-semibold text-[#5B21B6] shadow-sm hover:bg-[#F472B6]"
              >
                Add card ✨
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#FBCFE8] bg-white p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {boards.map((board) => (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => setActiveBoardId(board.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${board.id === activeBoardId ? 'bg-[#BE185D] text-white' : 'bg-[#FCE7F3] text-[#831843]'}`}
                >
                  {board.name}
                </button>
              ))}
            </div>
            <div className="block sm:hidden">
              <select
                value={activeBoardId}
                onChange={(e) => setActiveBoardId(e.target.value)}
                className="rounded-3xl border border-[#FBCFE8] bg-[#FDF2F8] px-4 py-3 text-sm outline-none"
              >
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>{board.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#831843]">
            <span className="rounded-full bg-[#FCE7F3] px-3 py-2">Board cards {boardCards.length}</span>
            <span className="rounded-full bg-[#FCE7F3] px-3 py-2">Affirmations {affirmations.length}</span>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#FBCFE8] bg-[#FFF1F8] p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#BE185D]">Affirmations</p>
              <p className="mt-2 text-sm text-[#9D174D]">Keep personal affirmations close and view one at random.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setAffirmationModalOpen(true)}
                className="rounded-full bg-[#F9A8D4] px-5 py-3 text-sm font-semibold text-[#831843] hover:bg-[#F472B6]"
              >
                + Affirmation
              </button>
              <button
                type="button"
                onClick={randomAffirmation}
                className="rounded-full bg-[#BE185D] px-5 py-3 text-sm font-semibold text-white hover:bg-[#9D174D]"
              >
                Random affirmation
              </button>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {affirmations.map((affirmation) => (
              <div key={affirmation.id} className="rounded-[2rem] bg-[#FCE7F3] p-5 shadow-sm">
                <p className="text-lg font-semibold text-[#831843]">"{affirmation.text}"</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#831843]">
                  <button
                    type="button"
                    onClick={() => openEditAffirmation(affirmation)}
                    className="rounded-full bg-white px-3 py-2 font-semibold text-[#831843]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteAffirmation(affirmation.id)}
                    className="rounded-full bg-[#FECACA] px-3 py-2 font-semibold text-[#831843]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#FBCFE8] bg-white p-6 shadow-soft">
          <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
            {boardCards.map((card) => {
              const renderCard = () => {
                const content = card.content || {};
                switch (card.type) {
                  case 'Image':
                    return (
                      <div className="space-y-3 rounded-[2rem] bg-white p-4 shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:scale-[1.02]">
                        <img src={content.imageUrl} alt={content.caption || 'Vision image'} className="h-48 w-full rounded-[1.5rem] object-cover" />
                        <p className="text-sm text-[#831843]">{content.caption}</p>
                      </div>
                    );
                  case 'Quote':
                    return (
                      <div className="space-y-3 rounded-[2rem] p-6 shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:scale-[1.02]" style={{ backgroundColor: content.bgColor || '#FCE7F3' }}>
                        <p className="text-lg font-semibold text-[#831843]">“{content.quote}”</p>
                        <p className="text-sm text-[#831843]">— {content.author || 'Unknown'}</p>
                      </div>
                    );
                  case 'Affirmation':
                    return (
                      <div className="space-y-3 rounded-[2rem] p-6 shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:scale-[1.02]" style={{ background: content.gradient }}>
                        <p className="text-xl font-bold uppercase tracking-[0.1em] text-[#831843]">{content.affirmation}</p>
                      </div>
                    );
                  case 'Goal':
                    return (
                      <div className="space-y-4 rounded-[2rem] bg-[#FEF2F8] p-6 shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:scale-[1.02]">
                        <p className="text-lg font-semibold text-[#831843]">{content.goalTitle}</p>
                        <p className="text-sm text-[#831843]">Deadline {content.deadline ? formatDateKey(new Date(content.deadline)) : 'No date'}</p>
                        <div className="h-3 overflow-hidden rounded-full bg-[#FCE7F3]">
                          <div className="h-3 rounded-full bg-[#BE185D]" style={{ width: `${content.progress}%` }} />
                        </div>
                        <p className="text-sm text-[#831843]">{content.progress}% complete</p>
                      </div>
                    );
                  case 'Word':
                    return (
                      <div className="rounded-[2rem] p-8 shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:scale-[1.02]" style={{ backgroundColor: content.bgColor || '#FCE7F3' }}>
                        <p className="break-words text-center font-bold text-[#831843]" style={{ fontSize: `${content.fontSize}px` }}>{content.word}</p>
                      </div>
                    );
                  default:
                    return null;
                }
              };

              return (
                <div key={card.id} className="mb-4 break-inside-avoid">
                  {renderCard()}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {boardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
          <div className="w-full max-w-xl rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#BE185D]">New board</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#831843]">Create a new board</h2>
              </div>
              <button type="button" onClick={() => setBoardModalOpen(false)} className="rounded-full bg-[#FCE7F3] px-4 py-2 text-sm text-[#831843]">Close</button>
            </div>
            <div className="mt-6">
              <input
                value={newBoard.name}
                onChange={(e) => setNewBoard({ name: e.target.value })}
                placeholder="Board name"
                className="w-full rounded-3xl border border-[#FBCFE8] bg-[#FEF2F8] px-4 py-3 text-sm outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setBoardModalOpen(false)} className="rounded-full bg-[#FCE7F3] px-5 py-3 text-sm font-semibold text-[#831843]">Cancel</button>
              <button type="button" onClick={addBoard} className="rounded-full bg-[#DB2777] px-5 py-3 text-sm font-semibold text-white">Create board</button>
            </div>
          </div>
        </div>
      )}

      {cardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
          <div className="w-full max-w-3xl rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#BE185D]">New card</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#831843]">Add a vision card</h2>
              </div>
              <button type="button" onClick={() => setCardModalOpen(false)} className="rounded-full bg-[#FCE7F3] px-4 py-2 text-sm text-[#831843]">Close</button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <select
                value={newCard.type}
                onChange={(e) => setNewCard((prev) => ({ ...prev, type: e.target.value }))}
                className="rounded-3xl border border-[#FBCFE8] bg-[#FEF2F8] px-4 py-3 text-sm outline-none"
              >
                {cardTypes.map((type) => (
                  <option key={type} value={type}>{type} Card</option>
                ))}
              </select>
              <input
                type="text"
                value={newCard.bgColor}
                onChange={(e) => setNewCard((prev) => ({ ...prev, bgColor: e.target.value }))}
                placeholder="Background color"
                className="rounded-3xl border border-[#FBCFE8] bg-[#FEF2F8] px-4 py-3 text-sm outline-none"
              />

              {newCard.type === 'Image' && (
                <>
                  <input
                    value={newCard.imageUrl}
                    onChange={(e) => setNewCard((prev) => ({ ...prev, imageUrl: e.target.value }))}
                    placeholder="Image URL"
                    className="col-span-2 rounded-3xl border border-[#FBCFE8] bg-[#FEF2F8] px-4 py-3 text-sm outline-none"
                  />
                  <input
                    value={newCard.caption}
                    onChange={(e) => setNewCard((prev) => ({ ...prev, caption: e.target.value }))}
                    placeholder="Caption"
                    className="col-span-2 rounded-3xl border border-[#FBCFE8] bg-[#FEF2F8] px-4 py-3 text-sm outline-none"
                  />
                </>
              )}

              {newCard.type === 'Quote' && (
                <>
                  <textarea
                    value={newCard.quote}
                    onChange={(e) => setNewCard((prev) => ({ ...prev, quote: e.target.value }))}
                    rows="3"
                    placeholder="Quote"
                    className="col-span-2 rounded-[1.75rem] border border-[#FBCFE8] bg-[#FEF2F8] px-4 py-3 text-sm outline-none"
                  />
                  <input
                    value={newCard.author}
                    onChange={(e) => setNewCard((prev) => ({ ...prev, author: e.target.value }))}
                    placeholder="Author"
                    className="rounded-3xl border border-[#FBCFE8] bg-[#FEF2F8] px-4 py-3 text-sm outline-none"
                  />
                </>
              )}

              {newCard.type === 'Affirmation' && (
                <textarea
                  value={newCard.affirmation}
                  onChange={(e) => setNewCard((prev) => ({ ...prev, affirmation: e.target.value }))}
                  rows="3"
                  placeholder="Affirmation text"
                  className="col-span-2 rounded-[1.75rem] border border-[#FBCFE8] bg-[#FEF2F8] px-4 py-3 text-sm outline-none"
                />
              )}

              {newCard.type === 'Goal' && (
                <>
                  <input
                    value={newCard.goalTitle}
                    onChange={(e) => setNewCard((prev) => ({ ...prev, goalTitle: e.target.value }))}
                    placeholder="Goal title"
                    className="rounded-3xl border border-[#FBCFE8] bg-[#FEF2F8] px-4 py-3 text-sm outline-none"
                  />
                  <input
                    type="date"
                    value={newCard.deadline}
                    onChange={(e) => setNewCard((prev) => ({ ...prev, deadline: e.target.value }))}
                    className="rounded-3xl border border-[#FBCFE8] bg-[#FEF2F8] px-4 py-3 text-sm outline-none"
                  />
                  <div className="col-span-2 space-y-2">
                    <label className="text-sm text-[#831843]">Progress {newCard.progress}%</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={newCard.progress}
                      onChange={(e) => setNewCard((prev) => ({ ...prev, progress: Number(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                </>
              )}

              {newCard.type === 'Word' && (
                <>
                  <input
                    value={newCard.word}
                    onChange={(e) => setNewCard((prev) => ({ ...prev, word: e.target.value }))}
                    placeholder="Word or phrase"
                    className="col-span-2 rounded-3xl border border-[#FBCFE8] bg-[#FEF2F8] px-4 py-3 text-sm outline-none"
                  />
                  <div className="space-y-2">
                    <label className="text-sm text-[#831843]">Font size {newCard.fontSize}px</label>
                    <input
                      type="range"
                      min="24"
                      max="72"
                      value={newCard.fontSize}
                      onChange={(e) => setNewCard((prev) => ({ ...prev, fontSize: Number(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setCardModalOpen(false)} className="rounded-full bg-[#FCE7F3] px-5 py-3 text-sm font-semibold text-[#831843]">Cancel</button>
              <button type="button" onClick={addCard} className="rounded-full bg-[#DB2777] px-5 py-3 text-sm font-semibold text-white">Save card</button>
            </div>
          </div>
        </div>
      )}

      {affirmationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
          <div className="w-full max-w-xl rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#BE185D]">Affirmation</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#831843]">{editAffirmationId ? 'Edit' : 'Add'} affirmation</h2>
              </div>
              <button type="button" onClick={() => { setAffirmationModalOpen(false); setEditAffirmationId(null); }} className="rounded-full bg-[#FCE7F3] px-4 py-2 text-sm text-[#831843]">Close</button>
            </div>
            <div className="mt-6">
              <textarea
                value={newAffirmation.text}
                onChange={(e) => setNewAffirmation({ text: e.target.value })}
                rows="5"
                placeholder="Affirmation text"
                className="w-full rounded-[1.75rem] border border-[#FBCFE8] bg-[#FEF2F8] px-4 py-3 text-sm outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { setAffirmationModalOpen(false); setEditAffirmationId(null); }} className="rounded-full bg-[#FCE7F3] px-5 py-3 text-sm font-semibold text-[#831843]">Cancel</button>
              <button type="button" onClick={addAffirmation} className="rounded-full bg-[#DB2777] px-5 py-3 text-sm font-semibold text-white">Save</button>
            </div>
          </div>
        </div>
      )}

      {affirmationDisplay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#FCE7F3]/95 px-4 py-8">
          <div className="relative w-full max-w-3xl rounded-[2rem] bg-white/90 p-10 text-center shadow-2xl backdrop-blur-sm">
            <button
              type="button"
              onClick={closeAffirmationDisplay}
              className="absolute right-6 top-6 rounded-full bg-[#FBCFE8] px-3 py-2 text-sm font-semibold text-[#831843]"
            >
              Close
            </button>
            <div className="animate-pulse rounded-[2rem] bg-gradient-to-br from-[#FBCFE8] via-[#FEE2E2] to-[#FDE8E8] p-10 shadow-inner">
              <p className="text-3xl font-bold uppercase tracking-[0.2em] text-[#831843]">{affirmationDisplay.text}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisionBoard;
