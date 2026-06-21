import React from 'react';

const StreakBadge = ({ count = 0, label = 'day streak' }) => {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${count > 0 ? 'bg-[#F4F0FF] text-[#7F77DD] shadow-[0_0_20px_rgba(127,119,221,0.18)] animate-pulse' : 'bg-white text-[#6D6B6F] border-[#E9E3F4]'}`}>
      <span>🔥</span>
      <span>{count}</span>
      <span className="text-[#6D6B6F]">{label}</span>
    </div>
  );
};

export default StreakBadge;
