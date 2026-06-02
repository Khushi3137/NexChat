import React from 'react';

const gradients = [
  'linear-gradient(135deg, #7c6aff, #ff6ab0)',
  'linear-gradient(135deg, #5f7dff, #6affe8)',
  'linear-gradient(135deg, #ff8a5b, #ff6ab0)',
  'linear-gradient(135deg, #57d39b, #6affe8)',
  'linear-gradient(135deg, #7c6aff, #5f7dff)',
];

const Avatar = ({
  src,
  name = '',
  size = 10,
  online = false,
  shape = 'soft',
  presenceBorder = 'none',
}) => {
  const px = size * 4;
  const safeName = name || 'User';
  const initials = /^(ai bot|nexus ai)$/i.test(safeName)
    ? 'AI'
    : safeName
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
  const gradientIndex = safeName.charCodeAt(0) % gradients.length || 0;
  const radiusClass = shape === 'round' ? 'rounded-full' : 'rounded-2xl';
  const presenceBorderClass =
    presenceBorder === 'active'
      ? 'border-2 border-[#4affa0] shadow-[0_0_0_1px_rgba(74,255,160,0.22),0_0_20px_rgba(74,255,160,0.18)]'
      : presenceBorder === 'inactive'
        ? 'border-2 border-[#ff6b7a] shadow-[0_0_0_1px_rgba(255,107,122,0.2),0_0_18px_rgba(255,107,122,0.14)]'
        : 'border border-transparent';

  return (
    <div className="relative shrink-0" style={{ width: px, height: px }}>
      {src ? (
        <img
          src={src}
          alt={safeName}
          className={`h-full w-full object-cover ${radiusClass} ${presenceBorderClass}`}
        />
      ) : (
        <div
          className={`brand-font flex h-full w-full items-center justify-center text-white ${radiusClass} ${presenceBorderClass}`}
          style={{
            background: gradients[gradientIndex],
            fontSize: Math.max(12, Math.round(px * 0.34)),
            fontWeight: 700,
          }}
        >
          {initials}
        </div>
      )}

      {online ? (
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0f0f1a] bg-[#4affa0] shadow-[0_0_12px_rgba(74,255,160,0.4)]" />
      ) : null}
    </div>
  );
};

export default Avatar;
