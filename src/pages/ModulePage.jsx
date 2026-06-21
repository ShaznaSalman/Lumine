import React from 'react';
import { useParams, Link } from 'react-router-dom';
import PeriodTracker from '../modules/period-tracker/PeriodTracker';
import WorkoutYoga from '../modules/workout-yoga/WorkoutYoga';
import IslamicHub from '../modules/islamic-hub/IslamicHub';
import DietNutrition from '../modules/diet-nutrition/DietNutrition';
import Selfcare from '../modules/selfcare/Selfcare';
import MoneyManager from '../modules/money-manager/MoneyManager';
import IdeaJournal from '../modules/idea-journal/IdeaJournal';
import Meditation from '../modules/meditation/Meditation';
import HobbyTracker from '../modules/hobby-tracker/HobbyTracker';
import StudyTracker from '../modules/study-tracker/StudyTracker';
import WorkTracker from '../modules/work-tracker/WorkTracker';
import VisionBoard from '../modules/vision-board/VisionBoard';
import BucketList from '../modules/bucket-list/BucketList';

const ModulePage = () => {
  const { moduleId } = useParams();

  if (moduleId === 'period-tracker') {
    return (
      <div className="min-h-screen bg-[#FDF6FF] text-[#2C2C2A]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-[#7F77DD]">
            ← Back to dashboard
          </Link>
          <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-soft border border-[#E9E3F4]">
            <PeriodTracker />
          </div>
        </div>
      </div>
    );
  }

  if (moduleId === 'workout-yoga') {
    return (
      <div className="min-h-screen bg-[#FDF6FF] text-[#2C2C2A]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-[#7F77DD]">
            ← Back to dashboard
          </Link>
          <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-soft border border-[#E9E3F4]">
            <WorkoutYoga />
          </div>
        </div>
      </div>
    );
  }

  if (moduleId === 'islamic-hub') {
    return (
      <div className="min-h-screen bg-[#FDF6FF] text-[#2C2C2A]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-[#7F77DD]">
            ← Back to dashboard
          </Link>
          <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-soft border border-[#E9E3F4]">
            <IslamicHub />
          </div>
        </div>
      </div>
    );
  }

  if (moduleId === 'diet-nutrition') {
    return (
      <div className="min-h-screen bg-[#FDF6FF] text-[#2C2C2A]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-[#7F77DD]">
            ← Back to dashboard
          </Link>
          <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-soft border border-[#E9E3F4]">
            <DietNutrition />
          </div>
        </div>
      </div>
    );
  }

  if (moduleId === 'selfcare') {
    return (
      <div className="min-h-screen bg-[#FDF6FF] text-[#2C2C2A]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-[#7F77DD]">
            ← Back to dashboard
          </Link>
          <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-soft border border-[#E9E3F4]">
            <Selfcare />
          </div>
        </div>
      </div>
    );
  }

  if (moduleId === 'money-manager') {
    return (
      <div className="min-h-screen bg-[#FDF6FF] text-[#2C2C2A]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-[#7F77DD]">
            ← Back to dashboard
          </Link>
          <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-soft border border-[#E9E3F4]">
            <MoneyManager />
          </div>
        </div>
      </div>
    );
  }

  if (moduleId === 'idea-journal') {
    return (
      <div className="min-h-screen bg-[#FDF6FF] text-[#2C2C2A]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-[#7F77DD]">
            ← Back to dashboard
          </Link>
          <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-soft border border-[#E9E3F4]">
            <IdeaJournal />
          </div>
        </div>
      </div>
    );
  }

  if (moduleId === 'meditation') {
    return (
      <div className="min-h-screen bg-[#FDF6FF] text-[#2C2C2A]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-[#7F77DD]">
            ← Back to dashboard
          </Link>
          <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-soft border border-[#E9E3F4]">
            <Meditation />
          </div>
        </div>
      </div>
    );
  }

  if (moduleId === 'hobby-tracker') {
    return (
      <div className="min-h-screen bg-[#FDF6FF] text-[#2C2C2A]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-[#7F77DD]">
            ← Back to dashboard
          </Link>
          <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-soft border border-[#E9E3F4]">
            <HobbyTracker />
          </div>
        </div>
      </div>
    );
  }

  if (moduleId === 'study-tracker') {
    return (
      <div className="min-h-screen bg-[#FDF6FF] text-[#2C2C2A]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-[#7F77DD]">
            ← Back to dashboard
          </Link>
          <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-soft border border-[#E9E3F4]">
            <StudyTracker />
          </div>
        </div>
      </div>
    );
  }

  if (moduleId === 'work-tracker') {
    return (
      <div className="min-h-screen bg-[#FDF6FF] text-[#2C2C2A]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-[#7F77DD]">
            ← Back to dashboard
          </Link>
          <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-soft border border-[#E9E3F4]">
            <WorkTracker />
          </div>
        </div>
      </div>
    );
  }

  if (moduleId === 'vision-board') {
    return (
      <div className="min-h-screen bg-[#FDF6FF] text-[#2C2C2A]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-[#7F77DD]">
            ← Back to dashboard
          </Link>
          <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-soft border border-[#E9E3F4]">
            <VisionBoard />
          </div>
        </div>
      </div>
    );
  }

  if (moduleId === 'bucket-list') {
    return (
      <div className="min-h-screen bg-[#FDF6FF] text-[#2C2C2A]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-[#7F77DD]">
            ← Back to dashboard
          </Link>
          <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-soft border border-[#E9E3F4]">
            <BucketList />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF6FF] px-6 py-10 text-[#2C2C2A]">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link to="/" className="inline-flex items-center gap-2 text-[#7F77DD]">
          ← Back to dashboard
        </Link>
        <div className="rounded-[2rem] border border-[#E9E3F4] bg-white p-8 shadow-soft">
          <h1 className="text-4xl font-bold capitalize">{moduleId}</h1>
          <p className="mt-4 text-sm text-[#6D6B6F]">
            This module is a placeholder for your wellness journeys. Customize the path, prompts, and micro goals for each focus area.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.75rem] border border-[#F5DFA0] bg-[#FFFAF1] p-6">
              <h2 className="text-xl font-semibold text-[#2C2C2A]">Focus</h2>
              <p className="mt-3 text-sm text-[#6D6B6F]">Reflect on today and set gentle intentions.</p>
            </div>
            <div className="rounded-[1.75rem] border border-[#A8DEC1] bg-[#F4FFF8] p-6">
              <h2 className="text-xl font-semibold text-[#2C2C2A]">Practice</h2>
              <p className="mt-3 text-sm text-[#6D6B6F]">Short activities for restful movement and mindful ease.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModulePage;
