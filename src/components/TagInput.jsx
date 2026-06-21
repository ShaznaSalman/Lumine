import React, { useState } from 'react';

const TagInput = ({ tags = [], onChange }) => {
  const [inputValue, setInputValue] = useState('');

  const addTag = (value) => {
    const trimmed = value.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setInputValue('');
  };

  const removeTag = (tag) => {
    onChange(tags.filter((item) => item !== tag));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTag(inputValue);
    }
  };

  return (
    <div className="rounded-[2rem] border border-[#E9E3F4] bg-white px-4 py-3 shadow-soft">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-2 rounded-full bg-[#F4F0FF] px-3 py-2 text-sm text-[#2C2C2A]">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="text-xs font-semibold text-[#7F77DD]">×</button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a tag and press Enter"
        className="mt-3 w-full rounded-3xl border border-[#E9E3F4] bg-[#F8F7FF] px-4 py-3 text-sm outline-none"
      />
    </div>
  );
};

export default TagInput;
