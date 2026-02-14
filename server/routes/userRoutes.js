// server/index.js
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import dotenv from 'dotenv'
import connectDB from './config/database.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
import User from './models/User.js'
import Message from './models/Message.js'
import { generateRoomId } from './utils/roomUtils.js'

// Routes
import userRoutes from './routes/userRoutes.js'
import contactRoutes from './routes/contactRoutes.js'
import messageRoutes from './routes/messageRoutes.js'
import inviteRoutes from './routes/inviteRoutes.js'

dotenv.config()

const isProduction = process.env.NODE_ENV === 'production'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

const app = express()
const httpServer = createServer(app)

app.use(cors({ origin: FRONTEND_URL, credentials: true }))
app.use(express.json())

// Connect to MongoDB
connectDB()

// API Routes
app.use('/api/users', userRoutes)
app.use('/api/contacts', contactRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/invite', inviteRoutes)

// Serve built frontend in production (SPA fallback after static files)
if (isProduction) {
  app.use(express.static(path.join(__dirname, '../client/dist')))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(__dirname, '../client/dist', 'index.html'))
  })
}

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST']
  }
})

// Store users and their socket IDs (userId -> socketId)
const onlineUsers = new Map()

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  // Handle user login with userId
  socket.on('user-login', async ({ userId }) => {
    try {
      const user = await User.findById(userId)
      if (!user) {
        socket.emit('login-error', { error: 'User not found' })
        return
      }

      onlineUsers.set(userId, socket.id)
      socket.userId = userId
      socket.username = user.username

      // Join user's contact rooms
      const userDoc = await User.findById(userId).populate('contacts')
      userDoc.contacts.forEach(contact => {
        const roomId = generateRoomId(userId, contact._id.toString())
        socket.join(roomId)
      })

      // Emit online status to contacts
      socket.broadcast.emit('user-online', { userId, username: user.username })
      
      console.log(`${user.username} (${userId}) logged in`)
    } catch (error) {
      console.error('Login error:', error)
      socket.emit('login-error', { error: 'Login failed' })
    }
  })

  // Handle messages with private rooms
  socket.on('message', async (messageData) => {
    try {
      const { from, to, text, roomId } = messageData

      if (!socket.userId || socket.userId !== from) {
        socket.emit('message-error', { error: 'Unauthorized' })
        return
      }

      // Verify both users are contacts
      const fromUser = await User.findById(from)
      const toUser = await User.findById(to)

      if (!fromUser || !toUser) {
        socket.emit('message-error', { error: 'User not found' })
        return
      }

      // Check if they are contacts
      const areContacts = fromUser.contacts.includes(to) && toUser.contacts.includes(from)
      if (!areContacts) {
        socket.emit('message-error', { error: 'Users are not contacts' })
        return
      }

      // Generate room ID if not provided
      const finalRoomId = roomId || generateRoomId(from, to)

      // Save message to database
      const message = await Message.create({
        roomId: finalRoomId,
        from,
        to,
        text,
        read: false
      })

      const populatedMessage = await Message.findById(message._id)
        .populate('from', 'username avatar')
        .populate('to', 'username avatar')
        .lean()

      // Emit to room (both users)
      io.to(finalRoomId).emit('message', {
        ...populatedMessage,
        id: populatedMessage._id.toString(),
        from: populatedMessage.from.username,
        to: populatedMessage.to.username,
        timestamp: populatedMessage.createdAt
      })

      // Notify recipient if online
      const recipientSocketId = onlineUsers.get(to)
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('new-message-notification', {
          from: fromUser.username,
          fromId: from,
          roomId: finalRoomId
        })
      }
    } catch (error) {
      console.error('Message error:', error)
      socket.emit('message-error', { error: 'Failed to send message' })
    }
  })

  // Handle join room (when opening a chat)
  socket.on('join-room', ({ roomId }) => {
    socket.join(roomId)
  })

  // Handle leave room
  socket.on('leave-room', ({ roomId }) => {
    socket.leave(roomId)
  })

  // Handle get chat history
  socket.on('get-chat-history', async ({ roomId, userId }) => {
    try {
      if (!socket.userId || socket.userId !== userId) {
        socket.emit('chat-history-error', { error: 'Unauthorized' })
        return
      }

      const messages = await Message.find({ roomId })
        .populate('from', 'username avatar')
        .populate('to', 'username avatar')
        .sort({ createdAt: 1 })
        .limit(100)
        .lean()

      socket.emit('chat-history', {
        roomId,
        messages: messages.map(msg => ({
          ...msg,
          id: msg._id.toString(),
          from: msg.from.username,
          to: msg.to.username,
          timestamp: msg.createdAt
        }))
      })
    } catch (error) {
      console.error('Get chat history error:', error)
      socket.emit('chat-history-error', { error: 'Failed to get chat history' })
    }
  })

  // Handle call initiation
  socket.on('call-user', async ({ to, type }) => {
    try {
      const from = socket.userId
      if (!from) {
        socket.emit('call-failed', { reason: 'Not authenticated' })
        return
      }

      // Verify they are contacts
      const fromUser = await User.findById(from)
      if (!fromUser.contacts.includes(to)) {
        socket.emit('call-failed', { reason: 'User is not a contact' })
        return
      }

      const recipientSocketId = onlineUsers.get(to)
      if (recipientSocketId) {
        const fromUser = await User.findById(from).select('username')
        io.to(recipientSocketId).emit('incoming-call', {
          from,
          fromUsername: fromUser.username,
          type
        })
        console.log(`${socket.username} calling ${to} (${type})`)
      } else {
        socket.emit('call-failed', { reason: 'User not online' })
      }
    } catch (error) {
      console.error('Call error:', error)
      socket.emit('call-failed', { reason: 'Call failed' })
    }
  })

  // Handle call answer
  socket.on('answer-call', ({ to, answer }) => {
    const recipientSocketId = onlineUsers.get(to)
    if (recipientSocketId) {
      if (answer) {
        io.to(recipientSocketId).emit('call-accepted', {
          from: socket.userId
        })
        console.log(`${socket.username} accepted call from ${to}`)
      } else {
        io.to(recipientSocketId).emit('call-rejected', {
          from: socket.userId
        })
        console.log(`${socket.username} rejected call from ${to}`)
      }
    }
  })

  // Handle WebRTC offer
  socket.on('offer', ({ to, offer }) => {
    const recipientSocketId = onlineUsers.get(to)
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('offer', {
        offer,
        from: socket.userId
      })
    }
  })

  // Handle WebRTC answer
  socket.on('answer', ({ to, answer }) => {
    const recipientSocketId = onlineUsers.get(to)
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('answer', {
        answer,
        from: socket.userId
      })
    }
  })

  // Handle ICE candidates
  socket.on('ice-candidate', ({ to, candidate }) => {
    const recipientSocketId = onlineUsers.get(to)
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('ice-candidate', {
        candidate,
        from: socket.userId
      })
    }
  })

  // Handle call end
  socket.on('end-call', ({ to }) => {
    const recipientSocketId = onlineUsers.get(to)
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('call-ended', {
        from: socket.userId
      })
    }
    socket.emit('call-ended', {
      from: to
    })
  })

  // Handle contact added (join new room)
  socket.on('contact-added', async ({ friendId }) => {
    try {
      const roomId = generateRoomId(socket.userId, friendId)
      socket.join(roomId)
    } catch (error) {
      console.error('Contact added error:', error)
    }
  })

  // Handle disconnect
  socket.on('disconnect', async () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId)
      socket.broadcast.emit('user-offline', { userId: socket.userId })
      console.log(`${socket.username} (${socket.userId}) disconnected`)
    }
  })
})

const PORT = process.env.PORT || 5000

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

// Express error handler (logs message for Render)
app.use((err, req, res, next) => {
  if (err) {
    console.error(err.message)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
  next()
})

// Unhandled promise rejections and uncaught exceptions
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason && reason.message ? reason.message : reason)
})
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && err.message ? err.message : err)
  process.exit(1)
})