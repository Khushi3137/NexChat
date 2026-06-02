import React from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

const ReactionPicker = ({ onSelect, onClose }) => {
  return (
    <div className="absolute bottom-full mb-2 z-30">
      <Picker
        data={data}
        onEmojiSelect={(e) => { onSelect(e.native); onClose(); }}
        theme="dark"
        previewPosition="none"
        skinTonePosition="none"
      />
    </div>
  );
};

export default ReactionPicker;
