import React from 'react';

const StatCard = ({ label, value, emoji, color = '#7F77DD' }) => {
  return (
    <div className="rounded-[2rem] border border-[#E9E3F4] bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#7F77DD]">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-[#2C2C2A]">{value}</p>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#F4F0FF] text-2xl" style={{ color }}>
          {emoji}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
