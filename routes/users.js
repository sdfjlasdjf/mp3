const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Task = require('../models/task');
const { buildMongooseQuery, parseJSONParam } = require('./util');

// /api/users
router.get('/', async (req, res) => {
  try {
    const built = buildMongooseQuery(User, req);
    if (built.error) return res.status(400).json({ message: built.error, data: {} });
    if (built.count) {
      const c = await User.countDocuments(built.query.getQuery());
      return res.status(200).json({ message: 'OK', data: c });
    }
    const docs = await built.query.exec();
    return res.status(200).json({ message: 'OK', data: docs });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', data: {} });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, pendingTasks } = req.body;
    if (!name || !email) {
      return res.status(400).json({ message: 'name and email are required', data: {} });
    }
    const u = new User({
      name,
      email,
      pendingTasks: Array.isArray(pendingTasks) ? pendingTasks : []
    });
    await u.save();
    return res.status(201).json({ message: 'User created', data: u });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(400).json({ message: 'email must be unique', data: {} });
    }
    if (err && err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message, data: {} });
    }
    return res.status(500).json({ message: 'Server error', data: {} });
  }
});

// /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    // Support ?select={} on the singular GET
    const pSelect = parseJSONParam(req.query.select, 'select');
    if (!pSelect.ok) return res.status(400).json({ message: pSelect.error, data: {} });

    const q = User.findById(req.params.id);
    if (pSelect.value) q.select(pSelect.value);
    const doc = await q.exec();

    if (!doc) return res.status(404).json({ message: 'User not found', data: {} });
    return res.status(200).json({ message: 'OK', data: doc });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', data: {} });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, email, pendingTasks } = req.body;
    if (!name || !email) {
      return res.status(400).json({ message: 'name and email are required', data: {} });
    }

    // Replace entire user document
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found', data: {} });

    // Unassign all their existing pending tasks first (we'll re-assign from the new list next)
    const prevPending = user.pendingTasks || [];
    if (prevPending.length > 0) {
      await Task.updateMany(
        { _id: { $in: prevPending } },
        { $set: { assignedUser: '', assignedUserName: 'unassigned' } }
      );
    }

    user.name = name;
    user.email = email;
    user.pendingTasks = Array.isArray(pendingTasks) ? pendingTasks : [];

    // For every pending task in the new list, set its assignedUser/Name to this user
    if (user.pendingTasks.length > 0) {
      await Task.updateMany(
        { _id: { $in: user.pendingTasks } },
        { $set: { assignedUser: String(user._id), assignedUserName: user.name } }
      );
    }

    await user.save();
    return res.status(200).json({ message: 'User updated', data: user });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(400).json({ message: 'email must be unique', data: {} });
    }
    if (err && err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message, data: {} });
    }
    return res.status(500).json({ message: 'Server error', data: {} });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found', data: {} });

    // Unassign this user's pending tasks
    if (user.pendingTasks && user.pendingTasks.length > 0) {
      await Task.updateMany(
        { _id: { $in: user.pendingTasks } },
        { $set: { assignedUser: '', assignedUserName: 'unassigned' } }
      );
    }

    await user.deleteOne();
    return res.status(204).json({ message: 'User deleted', data: {} });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', data: {} });
  }
});

module.exports = router;
