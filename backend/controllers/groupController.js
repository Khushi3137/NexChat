const Chat = require('../models/Chat');
const User = require('../models/User');
const Message = require('../models/Message');
const GroupInvite = require('../models/GroupInvite');
const { sendGroupInviteEmail } = require('../utils/emailService');
const { hydrateChatForUser } = require('./chatController');
const {
  hasRelationshipWithUser,
  normalizeId,
  resolvePrivacySettings,
} = require('../utils/privacy');

const isGroupAdmin = (chat, userId) =>
  Array.isArray(chat?.admins)
  && chat.admins.some((adminId) => normalizeId(adminId) === normalizeId(userId));

const loadGroupChat = (chatId) =>
  Chat.findOne({ _id: chatId, isGroupChat: true })
    .populate('participants', '-password')
    .populate('lastMessage')
    .populate('pinnedMessages');

const emitGroupUpdate = async (io, chat) => {
  if (!io || !chat?.participants?.length) return;

  await Promise.all(
    chat.participants.map(async (participant) => {
      const participantId = normalizeId(participant);
      if (!participantId) return;

      const hydratedChat = await hydrateChatForUser(chat, participantId, participant);
      io.to(participantId).emit('chatUpserted', hydratedChat);
    })
  );
};

const emitGroupRemoval = async (io, participantIds, chatId) => {
  if (!io || !Array.isArray(participantIds) || !chatId) return;

  participantIds.forEach((participantId) => {
    const normalizedParticipantId = normalizeId(participantId);
    if (!normalizedParticipantId) return;

    io.to(normalizedParticipantId).emit('chatRemoved', {
      chatId: normalizeId(chatId),
    });
  });
};

const formatCountLabel = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const buildGroupCreateMessage = ({ inviteCount, blockedCount }) => {
  if (inviteCount && blockedCount) {
    return `Group created. ${formatCountLabel(inviteCount, 'invite request')} sent and ${formatCountLabel(blockedCount, 'person', 'people')} could not be invited.`;
  }

  if (inviteCount) {
    return `Group created. ${formatCountLabel(inviteCount, 'invite request')} sent.`;
  }

  return 'Group created';
};

const buildInviteEmailStatusMessage = ({ sentCount, totalCount, firstFailureReason }) => {
  if (!totalCount) return '';
  if (sentCount === totalCount) return ' Email notifications sent.';
  if (sentCount > 0) return ` ${sentCount} email notification${sentCount === 1 ? '' : 's'} sent; ${totalCount - sentCount} failed.`;
  return ` The in-app request is pending, but email was not sent${firstFailureReason ? `: ${firstFailureReason}` : '.'}`;
};

const resolveInvitePolicy = (invitee, inviterId) => {
  const inviteeName = invitee?.name || 'This person';
  const groupInvitePermission = resolvePrivacySettings(invitee?.privacySettings).groupInvitePermission;

  if (groupInvitePermission === 'nobody') {
    return {
      allowed: false,
      message: `${inviteeName} does not accept group requests.`,
    };
  }

  if (
    groupInvitePermission === 'contacts_only'
    && !hasRelationshipWithUser(invitee?.friends, inviterId)
    && !hasRelationshipWithUser(invitee?.contacts, inviterId)
  ) {
    return {
      allowed: false,
      message: `${inviteeName} only accepts group requests from contacts.`,
    };
  }

  return { allowed: true };
};

const createPendingInvite = async ({ chatId, inviterId, inviteeId }) => {
  const existingInvite = await GroupInvite.findOne({
    chatId,
    inviteeId,
    status: 'pending',
  });

  if (existingInvite) {
    return {
      invite: existingInvite,
      isNew: false,
    };
  }

  const invite = await GroupInvite.create({
    chatId,
    inviterId,
    inviteeId,
  });

  return {
    invite,
    isNew: true,
  };
};

const loadInviteForClient = (inviteId) =>
  GroupInvite.findById(inviteId)
    .populate('inviterId', 'name email profilePicture')
    .populate('chatId', 'chatName groupDescription groupPicture participants');

const notifyGroupInvite = async ({ io, invite, invitee, inviter, group, forceEmail = false }) => {
  if (!invite) {
    return { emailSent: false, emailReason: 'Invite was not created' };
  }

  if (io) {
    const populatedInvite = await loadInviteForClient(invite._id);
    io.to(normalizeId(invitee._id)).emit('groupInviteReceived', mapInviteForClient(populatedInvite));
  }

  if (!forceEmail && invite.isExistingInvite) {
    return { emailSent: false, emailReason: 'Invite already pending' };
  }

  const emailResult = await sendGroupInviteEmail({
    invitee,
    inviter,
    group,
  });

  return {
    emailSent: Boolean(emailResult?.sent),
    emailReason: emailResult?.reason || '',
  };
};

const mapInviteForClient = (invite) => {
  const chat = invite?.chatId;
  const inviter = invite?.inviterId;
  const inviteeId = normalizeId(invite?.inviteeId);
  const participantIds = Array.isArray(chat?.participants) ? chat.participants.map((participant) => normalizeId(participant)) : [];
  const participantCount = participantIds.includes(inviteeId)
    ? participantIds.length
    : participantIds.length + 1;

  return {
    _id: invite._id,
    createdAt: invite.createdAt,
    inviter: inviter
      ? {
          _id: inviter._id,
          name: inviter.name,
          email: inviter.email,
          profilePicture: inviter.profilePicture || '',
        }
      : null,
    chat: chat
      ? {
          _id: chat._id,
          chatName: chat.chatName || 'Untitled group',
          groupDescription: chat.groupDescription || '',
          groupPicture: chat.groupPicture || '',
          participantCount,
        }
      : null,
  };
};

// GET /api/groups/invites
exports.getPendingInvites = async (req, res) => {
  const invites = await GroupInvite.find({
    inviteeId: req.user.id,
    status: 'pending',
  })
    .sort({ createdAt: -1 })
    .populate('inviterId', 'name email profilePicture')
    .populate('chatId', 'chatName groupDescription groupPicture participants');

  const payload = [];

  for (const invite of invites) {
    if (!invite.chatId) {
      invite.status = 'canceled';
      invite.respondedAt = new Date();
      await invite.save();
      continue;
    }

    payload.push(mapInviteForClient(invite));
  }

  res.json(payload);
};

// PUT /api/groups/invites/:inviteId/respond
exports.respondToInvite = async (req, res) => {
  const io = req.app.get('io');
  const action =
    req.body.action === 'accept'
      ? 'accept'
      : req.body.action === 'decline'
        ? 'decline'
        : null;

  if (!action) {
    return res.status(400).json({ message: 'Invalid invite action' });
  }

  const invite = await GroupInvite.findOne({
    _id: req.params.inviteId,
    inviteeId: req.user.id,
    status: 'pending',
  });

  if (!invite) {
    return res.status(404).json({ message: 'Group request not found' });
  }

  if (action === 'decline') {
    invite.status = 'declined';
    invite.respondedAt = new Date();
    await invite.save();

    return res.json({
      message: 'Group request declined',
      inviteId: normalizeId(invite._id),
      status: 'declined',
    });
  }

  let group = await loadGroupChat(invite.chatId);

  if (!group) {
    invite.status = 'canceled';
    invite.respondedAt = new Date();
    await invite.save();
    return res.status(404).json({ message: 'This group no longer exists' });
  }

  if (!group.participants.some((participant) => normalizeId(participant) === normalizeId(req.user.id))) {
    group.participants.push(req.user.id);
    await group.save();
  }

  invite.status = 'accepted';
  invite.respondedAt = new Date();
  await invite.save();

  group = await loadGroupChat(group._id);
  await emitGroupUpdate(io, group);

  res.json({
    message: `You joined ${group.chatName || 'the group'}`,
    status: 'accepted',
    chat: await hydrateChatForUser(group, req.user.id, req.user),
  });
};

// POST /api/groups
exports.createGroup = async (req, res) => {
  const io = req.app.get('io');
  const { chatName, participants, groupDescription } = req.body;
  const normalizedName = String(chatName || '').trim();
  const selectedParticipantIds = [
    ...new Set(
      (Array.isArray(participants) ? participants : [])
        .map(normalizeId)
        .filter((participantId) => participantId && participantId !== normalizeId(req.user.id))
    ),
  ];

  if (!normalizedName) {
    return res.status(400).json({ message: 'Group name is required' });
  }

  if (normalizedName.length > 60) {
    return res.status(400).json({ message: 'Group name can be up to 60 characters' });
  }

  if (!selectedParticipantIds.length) {
    return res.status(400).json({ message: 'Add at least one other member' });
  }

  const selectedUsers = await User.find({ _id: { $in: selectedParticipantIds } })
    .select('_id name email privacySettings notificationPreferences contacts friends');

  if (selectedUsers.length !== selectedParticipantIds.length) {
    return res.status(400).json({ message: 'One or more selected members were not found' });
  }

  const inviteableUsers = [];
  const blockedUsers = [];

  selectedUsers.forEach((selectedUser) => {
    const invitePolicy = resolveInvitePolicy(selectedUser, req.user.id);
    if (invitePolicy.allowed) {
      inviteableUsers.push(selectedUser);
      return;
    }

    blockedUsers.push({
      user: selectedUser,
      message: invitePolicy.message,
    });
  });

  if (!inviteableUsers.length) {
    return res.status(400).json({
      message: blockedUsers[0]?.message || 'The selected members do not accept group requests from you.',
    });
  }

  const group = await Chat.create({
    chatName: normalizedName,
    isGroupChat: true,
    participants: [req.user.id],
    admins: [req.user.id],
    groupDescription: String(groupDescription || '').trim(),
  });

  const inviteNotificationResults = await Promise.all(
    inviteableUsers.map(async (invitee) => {
      const { invite, isNew } = await createPendingInvite({
        chatId: group._id,
        inviterId: req.user.id,
        inviteeId: invitee._id,
      });

      return notifyGroupInvite({
        io,
        invite: { ...invite.toObject(), _id: invite._id, isExistingInvite: !isNew },
        invitee,
        inviter: req.user,
        group,
        forceEmail: true,
      });
    })
  );

  const populated = await loadGroupChat(group._id);
  await emitGroupUpdate(io, populated);
  const inviteEmailSentCount = inviteNotificationResults.filter((result) => result.emailSent).length;

  res.status(201).json({
    ...(await hydrateChatForUser(populated, req.user.id, req.user)),
    pendingInviteCount: inviteableUsers.length,
    blockedInviteCount: blockedUsers.length,
    inviteEmailSentCount,
    message: `${buildGroupCreateMessage({
      inviteCount: inviteableUsers.length,
      blockedCount: blockedUsers.length,
    })}${buildInviteEmailStatusMessage({
      sentCount: inviteEmailSentCount,
      totalCount: inviteableUsers.length,
      firstFailureReason: inviteNotificationResults.find((result) => !result.emailSent)?.emailReason,
    })}`,
  });
};

// PUT /api/groups/:id/name
exports.renameGroup = async (req, res) => {
  const io = req.app.get('io');
  const normalizedName = String(req.body.chatName || '').trim();

  if (!normalizedName) {
    return res.status(400).json({ message: 'Group name is required' });
  }

  if (normalizedName.length > 60) {
    return res.status(400).json({ message: 'Group name can be up to 60 characters' });
  }

  let group = await loadGroupChat(req.params.id);
  if (!group || !group.participants.some((participant) => normalizeId(participant) === normalizeId(req.user.id))) {
    return res.status(404).json({ message: 'Group not found' });
  }

  if (!isGroupAdmin(group, req.user.id)) {
    return res.status(403).json({ message: 'Only group admins can change the group name' });
  }

  group.chatName = normalizedName;
  await group.save();

  group = await loadGroupChat(group._id);
  await emitGroupUpdate(io, group);
  res.json(await hydrateChatForUser(group, req.user.id, req.user));
};

// PUT /api/groups/:id/add
exports.addMember = async (req, res) => {
  const targetUserId = normalizeId(req.body.userId);

  if (!targetUserId) {
    return res.status(400).json({ message: 'Member is required' });
  }

  let group = await loadGroupChat(req.params.id);
  if (!group || !group.participants.some((participant) => normalizeId(participant) === normalizeId(req.user.id))) {
    return res.status(404).json({ message: 'Group not found' });
  }

  if (!isGroupAdmin(group, req.user.id)) {
    return res.status(403).json({ message: 'Only group admins can add new members' });
  }

  const userToAdd = await User.findById(targetUserId)
    .select('_id name email privacySettings notificationPreferences contacts friends');

  if (!userToAdd) {
    return res.status(404).json({ message: 'Member not found' });
  }

  if (group.participants.some((participant) => normalizeId(participant) === targetUserId)) {
    return res.status(400).json({ message: 'This person is already in the group' });
  }

  const invitePolicy = resolveInvitePolicy(userToAdd, req.user.id);
  if (!invitePolicy.allowed) {
    return res.status(403).json({ message: invitePolicy.message });
  }

  const { invite, isNew } = await createPendingInvite({
    chatId: group._id,
    inviterId: req.user.id,
    inviteeId: targetUserId,
  });

  const io = req.app.get('io');
  const notificationResult = await notifyGroupInvite({
    io,
    invite: { ...invite.toObject(), _id: invite._id, isExistingInvite: !isNew },
    invitee: userToAdd,
    inviter: req.user,
    group,
    forceEmail: true,
  });

  res.status(202).json({
    approvalRequired: true,
    emailSent: notificationResult.emailSent,
    emailReason: notificationResult.emailReason,
    message: isNew
      ? `Invite request sent to ${userToAdd.name}. ${notificationResult.emailSent ? 'Email notification delivered.' : `The in-app request is pending, but email was not sent${notificationResult.emailReason ? `: ${notificationResult.emailReason}` : '.'}`} They can accept it from Privacy settings.`
      : `${userToAdd.name} already has a pending group request. ${notificationResult.emailSent ? 'Email notification resent.' : `The in-app request is still pending, but email was not resent${notificationResult.emailReason ? `: ${notificationResult.emailReason}` : '.'}`}`,
  });
};

// PUT /api/groups/:id/remove
exports.removeMember = async (req, res) => {
  const group = await Chat.findByIdAndUpdate(
    req.params.id,
    { $pull: { participants: req.body.userId } },
    { new: true }
  ).populate('participants', '-password');
  res.json(group);
};

// PUT /api/groups/:id/promote
exports.promoteToAdmin = async (req, res) => {
  const group = await Chat.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { admins: req.body.userId } },
    { new: true }
  );
  res.json(group);
};

// PUT /api/groups/:id/leave
exports.leaveGroup = async (req, res) => {
  const io = req.app.get('io');
  let group = await loadGroupChat(req.params.id);

  if (!group || !group.participants.some((participant) => normalizeId(participant) === normalizeId(req.user.id))) {
    return res.status(404).json({ message: 'Group not found' });
  }

  const remainingParticipantIds = (group.participants || [])
    .map((participant) => normalizeId(participant))
    .filter((participantId) => participantId && participantId !== normalizeId(req.user.id));
  const remainingAdminIds = (group.admins || [])
    .map((adminId) => normalizeId(adminId))
    .filter((adminId) => adminId && adminId !== normalizeId(req.user.id) && remainingParticipantIds.includes(adminId));

  if (!remainingParticipantIds.length) {
    await Promise.all([
      Message.deleteMany({ chatId: group._id }),
      GroupInvite.deleteMany({ chatId: group._id }),
      Chat.findByIdAndDelete(group._id),
    ]);
    await emitGroupRemoval(io, [req.user.id], group._id);

    return res.json({
      message: 'You left the group',
      chatId: normalizeId(group._id),
    });
  }

  group.participants = remainingParticipantIds;
  group.admins = remainingAdminIds.length ? remainingAdminIds : [remainingParticipantIds[0]];
  await group.save();

  await emitGroupRemoval(io, [req.user.id], group._id);
  group = await loadGroupChat(group._id);
  await emitGroupUpdate(io, group);

  res.json({
    message: 'You left the group',
    chatId: normalizeId(group._id),
  });
};

// DELETE /api/groups/:id
exports.deleteGroup = async (req, res) => {
  const io = req.app.get('io');
  const group = await loadGroupChat(req.params.id);

  if (!group || !group.participants.some((participant) => normalizeId(participant) === normalizeId(req.user.id))) {
    return res.status(404).json({ message: 'Group not found' });
  }

  if (!isGroupAdmin(group, req.user.id)) {
    return res.status(403).json({ message: 'Only group admins can delete the group' });
  }

  const participantIds = (group.participants || []).map((participant) => normalizeId(participant)).filter(Boolean);

  await Promise.all([
    Message.deleteMany({ chatId: group._id }),
    GroupInvite.deleteMany({ chatId: group._id }),
    Chat.findByIdAndDelete(group._id),
  ]);
  await emitGroupRemoval(io, participantIds, group._id);

  res.json({
    message: 'Group deleted',
    chatId: normalizeId(group._id),
  });
};
