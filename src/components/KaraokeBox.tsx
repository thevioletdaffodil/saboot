import React, { useMemo } from 'react';

interface KaraokeBoxProps {
  text: string;
  isActive: boolean;
  activeWordIndex: number;
}

export const KaraokeBox: React.FC<KaraokeBoxProps> = ({ text, isActive, activeWordIndex }) => {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  return (
    <div className="bg-[#efe8d5] dark:bg-[#23204f] border-2 border-dashed border-[#17153b] dark:border-indigo-400 rounded-2xl p-3.5 text-base leading-relaxed">
      {words.map((word, index) => (
        <span
          key={`${index}-${word}`}
          className={`mr-1.5 inline-block rounded px-1 py-0.5 transition-colors ${
            isActive && index === activeWordIndex
              ? 'bg-[#f4a300] font-bold text-[#17153b]'
              : ''
          }`}
        >
          {word}
        </span>
      ))}
    </div>
  );
};
