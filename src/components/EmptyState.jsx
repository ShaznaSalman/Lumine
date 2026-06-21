import React from 'react';

const EmptyState = ({ emoji, title, message, actionLabel, onAction }) => {
  return (
    <div className="rounded-[2rem] border border-[#E9E3F4] bg-white p-8 text-center shadow-soft">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#F4F0FF] text-5xl">{emoji}</div>
      <h2 className="mt-6 text-2xl font-semibold text-[#2C2C2A]">{title}</h2>
      <p className="mt-3 text-sm text-[#6D6B6F]">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 rounded-full bg-[#7F77DD] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#6B5BC7]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
