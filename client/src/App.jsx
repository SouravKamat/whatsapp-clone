import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'
import CallOverlay from './components/CallOverlay'
import VideoCall from './components/VideoCall'
import AddFriendModal from './components/AddFriendModal'

import { API_URL, SOCKET_URL } from './config/api'

// Generate room ID helper
const generateRoomId = (userId1, userId2) => {
  return [userId1, userId2].sort().join('_')
}

function App() {
  const [user, setUser] = useState(null)
  const [socket, setSocket] = useState(null)
  const [selectedChat, setSelectedChat] = useState(null)
  const [contacts, setContacts] = useState([])
  const [onlineUserIds, setOnlineUserIds] = useState([])
  const [incomingCall, setIncomingCall] = useState(null)
  const [activeCall, setActiveCall] = useState(null)
  const [callType, setCallType] = useState(null)
  const [showAddFriendModal, setShowAddFriendModal] = useState(false)
  const incomingCallRef = useRef(null)

  // Load contacts from API
  const loadContacts = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/contacts/${userId}`)
      if (response.ok) {
        const data = await response.json()
        setContacts(data)
      }
    } catch (error) {
      console.error('Failed to load contacts:', error)
    }
  }

  // Create or get user on login
  const handleLogin = async (userData) => {
    try {
      const response = await fetch(`${API_URL}/users/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: userData.username,
          avatar: userData.avatar
        })
      })

      if (response.ok) {
        const userResponse = await response.json()
        const newUser = {
          id: userResponse.id,
          username: userResponse.username,
          avatar: userResponse.avatar
        }
        setUser(newUser)
        await loadContacts(newUser.id)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to login')
      }
    } catch (error) {
      console.error('Login error:', error)
      alert('Failed to login')
    }
  }

  // Initialize Socket.IO connection
  useEffect(() => {
    if (user && user.id) {
      const newSocket = io(SOCKET_URL, {
        transports: ['websocket'],
        // Keepalive settings to match server and avoid intermediaries closing the socket
        pingInterval: 10000,
        pingTimeout: 20000,
        // Reconnection tuning
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: Infinity
      })
      
      newSocket.on('connect', () => {
        console.log('Connected to server')
        // Login with userId
        newSocket.emit('user-login', { userId: user.id })
      })

      // Handle new message
      newSocket.on('message', (message) => {
        // Update contacts list to show new message
        setContacts(prev => prev.map(contact => {
          const roomId = generateRoomId(user.id, contact.id)
          if (roomId === message.roomId) {
            return {
              ...contact,
              lastMessage: {
                text: message.text,
                timestamp: message.timestamp,
                from: message.from
              },
              unreadCount: contact.id === selectedChat?.userId 
                ? 0 
                : (contact.unreadCount || 0) + 1
            }
          }
          return contact
        }))
      })

      // Handle new message notification
      newSocket.on('new-message-notification', ({ fromId, roomId }) => {
        // Reload contacts to get updated unread counts
        loadContacts(user.id)
      })

      // Handle user online
      newSocket.on('user-online', ({ userId }) => {
        setOnlineUserIds(prev => {
          if (!prev.includes(userId)) {
            return [...prev, userId]
          }
          return prev
        })
      })

      // Handle user offline
      newSocket.on('user-offline', ({ userId }) => {
        setOnlineUserIds(prev => prev.filter(id => id !== userId))
      })

      // Handle incoming call
      newSocket.on('incoming-call', ({ from, fromUsername, type }) => {
        const callInfo = { from, fromUsername, type }
        incomingCallRef.current = callInfo
        setIncomingCall(callInfo)
      })

      // Handle call accepted (caller receives this)
      newSocket.on('call-accepted', ({ from }) => {
        const callInfo = incomingCallRef.current
        setIncomingCall(null)
        incomingCallRef.current = null
        const contact = contacts.find(c => c.id === from)
        const fromUsername = callInfo?.fromUsername || contact?.username || from
        setActiveCall({ 
          from, 
          fromUsername,
          type: callType,
          isCaller: true
        })
      })

      // Handle call rejected
      newSocket.on('call-rejected', () => {
        setIncomingCall(null)
        setCallType(null)
      })

      // Handle call ended
      newSocket.on('call-ended', ({ from }) => {
        if (activeCall?.from === from || incomingCall?.from === from) {
          setActiveCall(null)
          setIncomingCall(null)
          setCallType(null)
        }
      })

      setSocket(newSocket)

      return () => {
        newSocket.close()
      }
    }
  }, [user, selectedChat, callType, activeCall, incomingCall])

  // Reload contacts when user changes
  useEffect(() => {
    if (user?.id) {
      loadContacts(user.id)
      // Reload contacts every 30 seconds to update unread counts
      const interval = setInterval(() => {
        loadContacts(user.id)
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [user])

  const handleLogout = () => {
    if (socket) {
      socket.close()
    }
    setUser(null)
    setSelectedChat(null)
    setContacts([])
    setOnlineUserIds([])
    setIncomingCall(null)
    setActiveCall(null)
  }

  const handleSelectChat = (contact) => {
    setSelectedChat({
      userId: contact.userId || contact.id,
      username: contact.username,
      avatar: contact.avatar
    })

    // Mark messages as read
    if (contact.id) {
      const roomId = generateRoomId(user.id, contact.id)
      fetch(`${API_URL}/messages/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roomId,
          userId: user.id
        })
      }).then(() => {
        loadContacts(user.id)
      })
    }
  }

  const handleSendMessage = async (text, toUserId) => {
    if (socket && text.trim() && user) {
      const roomId = generateRoomId(user.id, toUserId)
      
      socket.emit('message', {
        from: user.id,
        to: toUserId,
        text: text.trim(),
        roomId
      })

      // Optimistically update UI
      setContacts(prev => prev.map(contact => {
        if (contact.id === toUserId) {
          return {
            ...contact,
            lastMessage: {
              text: text.trim(),
              timestamp: new Date().toISOString(),
              from: user.username
            }
          }
        }
        return contact
      }))
    }
  }

  const handleStartCall = (type, toUserId) => {
    if (socket) {
      setCallType(type)
      socket.emit('call-user', { to: toUserId, type })
    }
  }

  const handleAnswerCall = () => {
    if (socket && incomingCall) {
      socket.emit('answer-call', { to: incomingCall.from, answer: true })
      setCallType(incomingCall.type)
      setActiveCall({ 
        from: incomingCall.from, 
        fromUsername: incomingCall.fromUsername,
        type: incomingCall.type,
        isCaller: false
      })
      setIncomingCall(null)
    }
  }

  const handleRejectCall = () => {
    if (socket && incomingCall) {
      socket.emit('answer-call', { to: incomingCall.from, answer: false })
      setIncomingCall(null)
    }
  }

  const handleEndCall = () => {
    if (socket && activeCall) {
      socket.emit('end-call', { to: activeCall.from })
      setActiveCall(null)
      setCallType(null)
    }
  }

  const handleContactAdded = async (newContact) => {
    await loadContacts(user.id)
    setShowAddFriendModal(false)
    // Optionally open chat with new contact
    setSelectedChat({
      userId: newContact.id,
      username: newContact.username,
      avatar: newContact.avatar
    })
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  if (activeCall) {
    return (
      <VideoCall
        socket={socket}
        user={user}
        call={activeCall}
        onEndCall={handleEndCall}
      />
    )
  }

  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark">
      <Sidebar
        user={user}
        contacts={contacts}
        onlineUserIds={onlineUserIds}
        selectedChat={selectedChat}
        onSelectChat={handleSelectChat}
        onLogout={handleLogout}
        onAddFriendClick={() => setShowAddFriendModal(true)}
      />
      {selectedChat ? (
        <ChatWindow
          socket={socket}
          user={user}
          chat={selectedChat}
          onlineUserIds={onlineUserIds}
          onSendMessage={handleSendMessage}
          onStartCall={handleStartCall}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-background-light dark:bg-background-dark">
          <div className="text-center text-slate-500 dark:text-slate-400">
            <h2 className="text-2xl mb-2 font-display">Select a chat to start messaging</h2>
            <p className="text-sm">Choose a contact from the sidebar</p>
          </div>
        </div>
      )}
      {incomingCall && (
        <CallOverlay
          call={incomingCall}
          user={user}
          onAnswer={handleAnswerCall}
          onReject={handleRejectCall}
        />
      )}
      <AddFriendModal
        isOpen={showAddFriendModal}
        onClose={() => setShowAddFriendModal(false)}
        currentUserId={user.id}
        onContactAdded={handleContactAdded}
      />
    </div>
  )
}

export default App
