import React from 'react';
import { useNavigate } from 'react-router-dom';

const ModuleHeader = ({ title, emoji, color = '#7F77DD', description }) => {
  const navigate = useNavigate();

  return (
    <div className="rounded-[2rem] border border-[#E9E3F4] bg-white shadow-soft">
      <div className="overflow-hidden rounded-[2rem]">
        <div className="flex flex-col gap-6 bg-gradient-to-br from-white via-[#F5F3FF] to-[#F9F7FF] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex h-12 w-12 items-center justify-center rounded-3xl border border-[#E9E3F4] bg-white text-lg text-[#7F77DD] shadow-sm transition hover:bg-[#F4F0FF]"
            >
              ←
            </button>
            <div>
              <div className="flex items-center gap-3 text-2xl font-semibold text-[#2C2C2A]">
                <span className="rounded-3xl bg-white px-3 py-2 shadow-sm" style={{ color }}>{emoji}</span>
                <span>{title}</span>
              </div>
              {description && <p className="mt-2 text-sm text-[#6D6B6F]">{description}</p>}
            </div>
          </div>
          <div className="rounded-3xl bg-[#F4F0FF] px-4 py-2 text-sm font-semibold text-[#7F77DD] shadow-sm" style={{ borderColor: color }}>
            {title} space
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModuleHeader;
