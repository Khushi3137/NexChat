import React from 'react';

const VideoCall = ({ localVideoRef, remoteVideoRef, onEnd, onScreenShare }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex-1">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <div className="absolute top-4 right-4 w-36 h-28 bg-gray-900 rounded-xl overflow-hidden border border-gray-600">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </div>
      </div>
      <div className="flex gap-6 justify-center p-6 bg-gray-900">
        <button onClick={onScreenShare} className="w-14 h-14 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-xl transition" title="Screen share">🖥️</button>
        <button onClick={onEnd} className="w-14 h-14 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-xl transition" title="End">📵</button>
      </div>
    </div>
  );
};

export default VideoCall;
