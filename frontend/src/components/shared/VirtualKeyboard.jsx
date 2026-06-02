import React, { useMemo, useState } from 'react';

const LETTER_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const SYMBOL_ROWS = [
  ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
  ['-', '_', '=', '+', '/', '\\', ':', ';', '"', "'"],
  ['.', ',', '?', '!', '[', ']', '{', '}', '<', '>'],
];

const renderRows = (symbolMode, shiftEnabled) => {
  if (symbolMode) {
    return SYMBOL_ROWS;
  }

  return LETTER_ROWS.map((row) =>
    row.map((key) => {
      if (/[a-z]/.test(key)) {
        return shiftEnabled ? key.toUpperCase() : key;
      }

      return key;
    })
  );
};

const VirtualKeyboard = ({ onInput, onBackspace, onSpace, onEnter, onClose, className = '' }) => {
  const [shiftEnabled, setShiftEnabled] = useState(false);
  const [symbolMode, setSymbolMode] = useState(false);

  const rows = useMemo(
    () => renderRows(symbolMode, shiftEnabled),
    [shiftEnabled, symbolMode]
  );

  const handleCharacter = (key) => {
    onInput(key);
    if (!symbolMode && shiftEnabled) {
      setShiftEnabled(false);
    }
  };

  const controlButtonClass =
    'rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white/68 transition hover:bg-white/[0.08] hover:text-white';

  return (
    <div
      className={`rounded-[24px] border border-white/10 bg-[#11111b]/96 p-4 shadow-[0_28px_72px_rgba(0,0,0,0.45)] backdrop-blur-xl ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#d9d2ff]">
            Virtual Keyboard
          </div>
          <div className="mt-1 text-xs text-white/38">Tap keys to type without your physical keyboard.</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white/55 transition hover:bg-white/[0.08] hover:text-white"
        >
          Close
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex flex-wrap justify-center gap-2">
            {row.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleCharacter(key)}
                className="min-w-[42px] rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 transition hover:bg-white/[0.08] hover:text-white"
              >
                {key}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setSymbolMode((previous) => !previous)}
          className={`${controlButtonClass} ${symbolMode ? 'border-[#7c6aff]/30 bg-[#7c6aff]/14 text-[#e4ddff]' : ''}`}
        >
          {symbolMode ? 'ABC' : '?123'}
        </button>
        <button
          type="button"
          onClick={() => setShiftEnabled((previous) => !previous)}
          className={`${controlButtonClass} ${shiftEnabled ? 'border-[#7c6aff]/30 bg-[#7c6aff]/14 text-[#e4ddff]' : ''}`}
        >
          Shift
        </button>
        <button
          type="button"
          onClick={onSpace}
          className="min-w-[120px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/68 transition hover:bg-white/[0.08] hover:text-white"
        >
          Space
        </button>
        <button type="button" onClick={onBackspace} className={controlButtonClass}>
          Backspace
        </button>
        <button
          type="button"
          onClick={onEnter}
          className="rounded-2xl border border-[#7c6aff]/30 bg-[#7c6aff]/16 px-4 py-2 text-sm font-semibold text-[#e6e1ff] transition hover:bg-[#7c6aff]/24"
        >
          Enter
        </button>
      </div>
    </div>
  );
};

export default VirtualKeyboard;
