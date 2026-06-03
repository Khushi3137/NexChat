// module.exports = (io, socket, userId) => {
//   socket.on('callUser', ({ userToCall, signalData, callType, from, chatId }) => {
//     io.to(userToCall).emit('incomingCall', { signal: signalData, from, callType, chatId });
//   });

//   socket.on('answerCall', ({ to, signal, chatId }) => {
//     io.to(to).emit('callAccepted', { signal, from: userId, chatId });
//   });

//   socket.on('declineCall', ({ to, chatId, reason = 'declined' }) => {
//     io.to(to).emit('callDeclined', { from: userId, chatId, reason });
//   });

//   socket.on('endCall', ({ to, chatId, reason = 'ended' }) => {
//     io.to(to).emit('callEnded', { from: userId, chatId, reason });
//   });

//   socket.on('iceCandidate', ({ to, candidate, chatId }) => {
//     io.to(to).emit('iceCandidate', { candidate, from: userId, chatId });
//   });
// };

module.exports = (io, socket, userId) => {
  // 🔥 IMPORTANT: join user room
  socket.join(userId);

  // ======================
  // CALL USER
  // ======================
  socket.on('callUser', ({ userToCall, signalData, callType, from, chatId }) => {
    io.to(userToCall).emit('incomingCall', {
      signal: signalData,
      from,
      callType,
      chatId,
    });
  });

  // ======================
  // ANSWER CALL
  // ======================
  socket.on('answerCall', ({ to, signal, chatId }) => {
    io.to(to).emit('callAccepted', {
      signal,
      from: userId,
      chatId,
    });
  });

  // ======================
  // DECLINE CALL
  // ======================
  socket.on('declineCall', ({ to, chatId, reason = 'declined' }) => {
    io.to(to).emit('callDeclined', {
      from: userId,
      chatId,
      reason,
    });
  });

  // ======================
  // END CALL
  // ======================
  socket.on('endCall', ({ to, chatId, reason = 'ended' }) => {
    io.to(to).emit('callEnded', {
      from: userId,
      chatId,
      reason,
    });
  });

  // ======================
  // ICE CANDIDATES
  // ======================
  socket.on('iceCandidate', ({ to, candidate, chatId }) => {
    io.to(to).emit('iceCandidate', {
      candidate,
      from: userId,
      chatId,
    });
  });

  // ======================
  // DISCONNECT CLEANUP
  // ======================
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${userId}`);
  });
}; 
