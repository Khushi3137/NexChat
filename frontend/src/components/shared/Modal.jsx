import React from 'react';

const Modal = ({ isOpen, onClose, title, children, maxWidthClass = 'max-w-md', panelClassName = '' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 mx-4 w-full rounded-2xl border border-gray-700 bg-gray-900 p-6 ${maxWidthClass} ${panelClassName}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default Modal;
