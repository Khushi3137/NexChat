const activeSocketsByUser = new Map();

const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';

const getSocketMap = (userId) => activeSocketsByUser.get(normalizeId(userId)) || new Map();
const getVisibleCount = (sockets) =>
  Array.from(sockets.values()).filter((isVisible) => Boolean(isVisible)).length;

exports.addUserSocket = (userId, socketId, options = {}) => {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId || !socketId) return 0;

  const sockets = getSocketMap(normalizedUserId);
  const beforeVisibleCount = getVisibleCount(sockets);

  sockets.set(socketId, options.isVisible !== false);
  activeSocketsByUser.set(normalizedUserId, sockets);

  const visibleCount = getVisibleCount(sockets);
  return {
    totalCount: sockets.size,
    visibleCount,
    becameOnline: beforeVisibleCount === 0 && visibleCount > 0,
    becameOffline: beforeVisibleCount > 0 && visibleCount === 0,
  };
};

exports.removeUserSocket = (userId, socketId) => {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId) {
    return {
      totalCount: 0,
      visibleCount: 0,
      becameOffline: false,
    };
  }

  const sockets = getSocketMap(normalizedUserId);
  const beforeVisibleCount = getVisibleCount(sockets);

  if (!sockets.size) {
    return {
      totalCount: 0,
      visibleCount: 0,
      becameOffline: false,
    };
  }

  sockets.delete(socketId);
  if (!sockets.size) {
    activeSocketsByUser.delete(normalizedUserId);
    return {
      totalCount: 0,
      visibleCount: 0,
      becameOffline: beforeVisibleCount > 0,
    };
  }

  activeSocketsByUser.set(normalizedUserId, sockets);
  const visibleCount = getVisibleCount(sockets);
  return {
    totalCount: sockets.size,
    visibleCount,
    becameOffline: beforeVisibleCount > 0 && visibleCount === 0,
  };
};

exports.updateUserSocketVisibility = (userId, socketId, isVisible) => {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId || !socketId) {
    return null;
  }

  const sockets = getSocketMap(normalizedUserId);
  if (!sockets.size || !sockets.has(socketId)) {
    return null;
  }

  const beforeVisibleCount = getVisibleCount(sockets);
  sockets.set(socketId, Boolean(isVisible));
  activeSocketsByUser.set(normalizedUserId, sockets);

  const visibleCount = getVisibleCount(sockets);
  return {
    totalCount: sockets.size,
    visibleCount,
    becameOnline: beforeVisibleCount === 0 && visibleCount > 0,
    becameOffline: beforeVisibleCount > 0 && visibleCount === 0,
  };
};

exports.isUserCurrentlyOnline = (userId) => {
  const normalizedUserId = normalizeId(userId);
  return Boolean(normalizedUserId && getVisibleCount(getSocketMap(normalizedUserId)));
};

exports.getOnlineUserIds = () =>
  Array.from(activeSocketsByUser.entries())
    .filter(([, sockets]) => getVisibleCount(sockets) > 0)
    .map(([userId]) => userId);
