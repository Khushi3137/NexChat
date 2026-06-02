module.exports = (io, socket, userId) => {
  socket.on('callUser', ({ userToCall, signalData, callType, from, chatId }) => {
    io.to(userToCall).emit('incomingCall', { signal: signalData, from, callType, chatId });
  });

  socket.on('answerCall', ({ to, signal, chatId }) => {
    io.to(to).emit('callAccepted', { signal, from: userId, chatId });
  });

  socket.on('declineCall', ({ to, chatId, reason = 'declined' }) => {
    io.to(to).emit('callDeclined', { from: userId, chatId, reason });
  });

  socket.on('endCall', ({ to, chatId, reason = 'ended' }) => {
    io.to(to).emit('callEnded', { from: userId, chatId, reason });
  });

  socket.on('iceCandidate', ({ to, candidate, chatId }) => {
    io.to(to).emit('iceCandidate', { candidate, from: userId, chatId });
  });
};
