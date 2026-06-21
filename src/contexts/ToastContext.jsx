import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4 sm:px-0">
        <div className="space-y-3">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-3xl border px-4 py-3 text-sm shadow-soft transition ${toast.type === 'success' ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#166534]' : toast.type === 'error' ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]' : 'bg-[#F4F0FF] border-[#DDD6FE] text-[#4C1D95]'}`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
