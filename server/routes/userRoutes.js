import express from 'express'
import User from '../models/User.js'

const router = express.Router()

// Search users - MUST be before /:userId
router.get('/search', async (req, res) => {
  try {
    const { query, excludeUserId } = req.query
    if (!query || query.trim().length < 2) return res.json([])
    const searchRegex = new RegExp(query, 'i')
    const searchQuery = { username: searchRegex }
    if (excludeUserId) searchQuery._id = { $ne: excludeUserId }
    const users = await User.find(searchQuery).select('_id username avatar').limit(10).lean()
    res.json(users.map(u => ({ id: u._id.toString(), username: u.username, avatar: u.avatar })))
  } catch (err) {
    console.error('[GET /search]', err.message, err)
    res.status(500).json({ error: 'Failed to search users' })
  }
})

// Create or get user
router.post('/create', async (req, res) => {
  try {
    const { username, avatar } = req.body || {}

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' })
    }
    const trimmed = username.trim()
    if (trimmed.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' })
    }

    if (!avatar || typeof avatar !== 'string') {
      return res.status(400).json({ error: 'Avatar is required' })
    }

    const normalized = trimmed.toLowerCase()

    let user = await User.findOne({ username: normalized }).select('_id username avatar contacts')

    if (user) {
      return res.json({
        id: user._id.toString(),
        userId: user._id.toString(),
        username: user.username,
        avatar: user.avatar,
        contacts: (user.contacts || []).map(c => c.toString())
      })
    }

    user = await User.create({
      username: normalized,
      avatar
    })

    res.status(201).json({
      id: user._id.toString(),
      userId: user._id.toString(),
      username: user.username,
      avatar: user.avatar,
      contacts: []
    })
  } catch (err) {
    console.error('[POST /create]', err.message, err)
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Username already exists' })
    }
    res.status(500).json({ error: 'Failed to create user', details: err.message })
  }
})

// Get user by ID - MUST be last
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('_id username avatar').lean()
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ id: user._id.toString(), userId: user._id.toString(), username: user.username, avatar: user.avatar })
  } catch (err) {
    console.error('[GET /:userId]', err.message, err)
    res.status(500).json({ error: 'Failed to get user', details: err.message })
  }
})

export default router
