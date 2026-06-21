import React, { useEffect } from 'react';

const QuickLogModal = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-soft sm:mx-4" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#2C2C2A]">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full bg-[#F4F0FF] px-3 py-2 text-sm font-semibold text-[#7F77DD]">Close</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};

export default QuickLogModal;
