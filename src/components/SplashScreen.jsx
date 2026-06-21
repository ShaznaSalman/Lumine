import React from 'react';

const SplashScreen = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDF6FF] px-6">
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-[#F4F0FF] shadow-soft">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[#7F77DD]/10">
            <div className="absolute inset-0 rounded-full bg-[#7F77DD]/20 blur-2xl" />
            <div className="relative h-12 w-12 rounded-full bg-[#7F77DD] mask-[radial-gradient(circle_at_top_left,_transparent_40%,_black_41%)]" />
          </div>
        </div>
        <div className="space-y-2 text-center">
          <p className="text-5xl font-extrabold tracking-tight text-[#7F77DD] fade-in-up">Lumine</p>
          <p className="max-w-md text-sm text-[#6D6B6F]">A calm wellness space for your daily rhythm.</p>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
