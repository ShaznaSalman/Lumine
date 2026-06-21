import React, { useEffect, useState } from 'react';

const ProgressRing = ({ percentage = 0, size = 120, color = '#7F77DD', label }) => {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => setProgress(percentage), 50);
    return () => window.clearTimeout(timeout);
  }, [percentage]);

  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="inline-flex flex-col items-center justify-center font-sans text-center">
      <svg width={size} height={size} className="block">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E9E7FF"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s ease-out' }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="-mt-[80px] flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-semibold text-[#2C2C2A]">{Math.round(progress)}%</span>
        {label && <span className="text-sm text-[#6D6B6F]">{label}</span>}
      </div>
    </div>
  );
};

export default ProgressRing;
