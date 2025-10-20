const express = require('express');
const router = express.Router();
const Task = require('../models/task');
const User = require('../models/user');
const { buildMongooseQuery, parseJSONParam } = require('./util');

// default limit 100 for tasks
function applyDefaultLimit(req) {
  if (req.query.limit == null) {
    req.query.limit = '100';
  }
}

// /api/tasks
router.get('/', async (req, res) => {
  try {
    applyDefaultLimit(req);
    const built = buildMongooseQuery(Task, req);
    if (built.error) return res.status(400).json({ message: built.error, data: {} });
    if (built.count) {
      const c = await Task.countDocuments(built.query.getQuery());
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
    const { name, description, deadline, completed, assignedUser, assignedUserName } = req.body;
    if (!name || !deadline) {
      return res.status(400).json({ message: 'name and deadline are required', data: {} });
    }

    const t = new Task({
      name,
      description: description || '',
      deadline,
      completed: completed === true || completed === 'true',
      assignedUser: assignedUser || '',
      assignedUserName: assignedUserName || 'unassigned'
    });

    // if assignedUser is provided, ensure user exists and two-way reference
    if (t.assignedUser) {
      const u = await User.findById(t.assignedUser);
      if (!u) {
        return res.status(400).json({ message: 'assignedUser does not exist', data: {} });
      }
      t.assignedUserName = u.name;
      // push into user's pendingTasks if task not completed
      if (!t.completed) {
        if (!u.pendingTasks.includes(String(t._id))) {
          u.pendingTasks.push(String(t._id));
          await u.save();
        }
      }
    }

    await t.save();
    return res.status(201).json({ message: 'Task created', data: t });
  } catch (err) {
    if (err && err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message, data: {} });
    }
    return res.status(500).json({ message: 'Server error', data: {} });
  }
});

// /api/tasks/:id
router.get('/:id', async (req, res) => {
  try {
    const pSelect = parseJSONParam(req.query.select, 'select');
    if (!pSelect.ok) return res.status(400).json({ message: pSelect.error, data: {} });
    const q = Task.findById(req.params.id);
    if (pSelect.value) q.select(pSelect.value);
    const doc = await q.exec();
    if (!doc) return res.status(404).json({ message: 'Task not found', data: {} });
    return res.status(200).json({ message: 'OK', data: doc });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', data: {} });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description, deadline, completed, assignedUser, assignedUserName } = req.body;
    if (!name || !deadline) {
      return res.status(400).json({ message: 'name and deadline are required', data: {} });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found', data: {} });

    // Clean up references from old assignment
    const prevAssignedUser = task.assignedUser;
    const prevCompleted = !!task.completed;

    // Update fields
    task.name = name;
    task.description = description || '';
    task.deadline = deadline;
    task.completed = completed === true || completed === 'true';
    task.assignedUser = assignedUser || '';
    task.assignedUserName = assignedUserName || (task.assignedUser ? task.assignedUserName : 'unassigned');

    // If assignment changed or completion changed, update user pendingTasks accordingly
    // 1) If task had a previous assigned user, remove from their pendingTasks
    if (prevAssignedUser) {
      const oldUser = await User.findById(prevAssignedUser);
      if (oldUser) {
        oldUser.pendingTasks = (oldUser.pendingTasks || []).filter(id => id !== String(task._id));
        await oldUser.save();
      }
    }

    // 2) If task has a new assigned user, ensure user exists and set two-way reference
    if (task.assignedUser) {
      const newUser = await User.findById(task.assignedUser);
      if (!newUser) {
        return res.status(400).json({ message: 'assignedUser does not exist', data: {} });
      }
      task.assignedUserName = newUser.name;
      // only pending if not completed
      if (!task.completed) {
        if (!newUser.pendingTasks.includes(String(task._id))) {
          newUser.pendingTasks.push(String(task._id));
          await newUser.save();
        }
      }
    } else {
      task.assignedUserName = 'unassigned';
    }

    await task.save();
    return res.status(200).json({ message: 'Task updated', data: task });
  } catch (err) {
    if (err && err.name == 'ValidationError') {
      return res.status(400).json({ message: err.message, data: {} });
    }
    return res.status(500).json({ message: 'Server error', data: {} });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found', data: {} });

    const assignedUser = task.assignedUser;
    await task.deleteOne();

    // Remove from assigned user's pendingTasks
    if (assignedUser) {
      const u = await User.findById(assignedUser);
      if (u) {
        u.pendingTasks = (u.pendingTasks || []).filter(id => id !== String(task._id));
        await u.save();
      }
    }

    return res.status(204).json({ message: 'Task deleted', data: {} });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', data: {} });
  }
});

module.exports = router;
