const express = require('express');
const router = express.Router();
const {
  createGroup,
  renameGroup,
  addMember,
  removeMember,
  promoteToAdmin,
  leaveGroup,
  deleteGroup,
  getPendingInvites,
  respondToInvite,
} = require('../controllers/groupController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, createGroup);
router.get('/invites', auth, getPendingInvites);
router.put('/invites/:inviteId/respond', auth, respondToInvite);
router.put('/:id/name', auth, renameGroup);
router.put('/:id/add', auth, addMember);
router.put('/:id/remove', auth, removeMember);
router.put('/:id/promote', auth, promoteToAdmin);
router.put('/:id/leave', auth, leaveGroup);
router.delete('/:id', auth, deleteGroup);

module.exports = router;
