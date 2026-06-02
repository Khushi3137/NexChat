import React from 'react';

const TypingIndicator = ({ typingUsers }) => {
  const names = Object.values(typingUsers || {});
  if (!names.length) return null;

  const label =
    names.length === 1 ? `${names[0]} is typing` : `${names.slice(0, 2).join(', ')} are typing`;

  return (
    <div className="flex items-center gap-3 pl-1">
      <div className="flex gap-1.5">
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#7c6aff]" style={{ animationDelay: '0ms' }} />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#7c6aff]" style={{ animationDelay: '120ms' }} />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#7c6aff]" style={{ animationDelay: '240ms' }} />
      </div>
      <span className="text-sm italic text-white/40">{label}...</span>
    </div>
  );
};

export default TypingIndicator;
