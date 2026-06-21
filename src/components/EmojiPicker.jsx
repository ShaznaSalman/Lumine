import React from 'react';

const EmojiPicker = ({ value, onChange, options = [] }) => {
  return (
    <div className="flex flex-wrap gap-3 rounded-[2rem] border border-[#E9E3F4] bg-white p-3 shadow-soft">
      {options.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          className={`flex h-12 w-12 items-center justify-center rounded-3xl border text-2xl transition ${value === emoji ? 'border-[#7F77DD] bg-[#F4F0FF]' : 'border-[#E9E3F4] bg-[#F8F7FF] hover:bg-[#F4F0FF]'}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default EmojiPicker;
