import { useState, useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'
import { API_URL } from '../config/api'

// Generate room ID helper
const generateRoomId = (userId1, userId2) => {
  return [userId1, userId2].sort().join('_')
}

function ChatWindow({ socket, user, chat, onlineUserIds, onSendMessage, onStartCall }) {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef(null)
  const chatUserId = chat?.userId

  // Load chat history
  useEffect(() => {
    if (socket && chatUserId && user?.id) {
      const roomId = generateRoomId(user.id, chatUserId)
      
      // Join room
      socket.emit('join-room', { roomId })

      // Load chat history
      const loadHistory = async () => {
        setLoading(true)
        try {
          const response = await fetch(`${API_URL}/messages/history/${roomId}`)
          if (response.ok) {
            const data = await response.json()
            setMessages(data.map(msg => ({
              ...msg,
              id: msg._id || msg.id,
              from: typeof msg.from === 'object' ? msg.from.username : msg.from,
              to: typeof msg.to === 'object' ? msg.to.username : msg.to,
              timestamp: msg.createdAt || msg.timestamp
            })))
          }
        } catch (error) {
          console.error('Failed to load chat history:', error)
        } finally {
          setLoading(false)
        }
      }

      loadHistory()

      // Listen for new messages in this room
      const handleNewMessage = (msg) => {
        if (msg.roomId === roomId) {
          setMessages(prev => {
            const exists = prev.some(m => 
              m.id === msg.id || 
              (m.text === msg.text && m.timestamp === msg.timestamp)
            )
            if (!exists) {
              return [...prev, {
                ...msg,
                from: typeof msg.from === 'object' ? msg.from.username : msg.from,
                to: typeof msg.to === 'object' ? msg.to.username : msg.to
              }]
            }
            return prev
          })
        }
      }

      socket.on('message', handleNewMessage)

      return () => {
        socket.off('message', handleNewMessage)
        socket.emit('leave-room', { roomId })
      }
    } else {
      setMessages([])
      setLoading(false)
    }
  }, [socket, chatUserId, user?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (message.trim() && chatUserId) {
      onSendMessage(message.trim(), chatUserId)
      setMessage('')
    }
  }

  const isOnline = onlineUserIds.includes(chatUserId)

  return (
    <div className="flex-1 flex flex-col h-full bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-primary/5 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={chat.avatar}
              alt={chat.username}
              className="w-10 h-10 rounded-full object-cover border-2 border-primary/20"
            />
            {isOnline && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-full border-2 border-background-dark"></div>
            )}
          </div>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm text-slate-900 dark:text-white">{chat.username}</h1>
            <span className="text-[11px] text-primary font-medium">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onStartCall('voice', chatUserId)}
            className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-300 hover:text-primary transition-colors"
            title="Voice Call"
          >
            <span className="material-icons">call</span>
          </button>
          <button
            onClick={() => onStartCall('video', chatUserId)}
            className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-300 hover:text-primary transition-colors"
            title="Video Call"
          >
            <span className="material-icons">videocam</span>
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 hide-scrollbar relative">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" style={{backgroundImage: 'radial-gradient(#33e67a 0.5px, transparent 0.5px)', backgroundSize: '20px 20px'}}></div>
        
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500 relative z-10">
            <div className="text-center">
              <span className="material-icons animate-spin text-3xl mb-2 block">refresh</span>
              <p>Loading messages...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Date Marker */}
            <div className="flex justify-center my-2 relative z-10">
              <span className="px-3 py-1 bg-primary/10 dark:bg-primary/5 rounded-full text-[10px] uppercase tracking-widest font-bold text-primary/80">Today</span>
            </div>

            {/* System Message */}
            <div className="flex justify-center mb-2 relative z-10">
              <div className="max-w-[80%] text-center px-4 py-2 bg-slate-100 dark:bg-slate-900/40 rounded-lg text-[10px] text-slate-500 dark:text-slate-400">
                <span className="material-icons text-[12px] align-middle mr-1">lock</span>
                Messages are end-to-end encrypted. No one outside of this chat can read or listen to them.
              </div>
            </div>

            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500 relative z-10">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={msg.id || index} className="relative z-10">
                  <MessageBubble
                    message={msg}
                    isOwn={msg.from === user.username || msg.from === user.id}
                    isRead={msg.read}
                  />
                </div>
              ))
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Bar */}
      <footer className="p-4 bg-background-light dark:bg-background-dark border-t border-primary/5 pb-6">
        <div className="flex items-end gap-3">
          <div className="flex items-center gap-1 mb-1">
            <button
              type="button"
              className="w-10 h-10 flex items-center justify-center text-slate-400 dark:text-slate-300 hover:text-primary transition-colors"
              title="Add"
            >
              <span className="material-icons text-[28px]">add</span>
            </button>
          </div>
          <div className="flex-1 relative flex items-center">
            <button className="absolute left-3 text-slate-400 hover:text-primary transition-colors">
              <span className="material-icons text-[22px]">sentiment_satisfied_alt</span>
            </button>
            <form onSubmit={handleSubmit} className="w-full">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="w-full bg-white dark:bg-white/5 border-none rounded-full py-3.5 pl-11 pr-12 focus:ring-1 focus:ring-primary/30 text-[15px] placeholder:text-slate-500 shadow-sm text-slate-900 dark:text-white"
              />
            </form>
            <button className="absolute right-3 text-slate-400 hover:text-primary transition-colors">
              <span className="material-icons text-[22px]">content_copy</span>
            </button>
          </div>
          {message.trim() ? (
            <button
              onClick={handleSubmit}
              className="w-12 h-12 flex items-center justify-center bg-primary rounded-full shadow-lg shadow-primary/20 text-background-dark active:scale-95 transition-transform"
              title="Send"
            >
              <span className="material-icons text-[26px]">send</span>
            </button>
          ) : (
            <button
              type="button"
              className="w-12 h-12 flex items-center justify-center bg-primary rounded-full shadow-lg shadow-primary/20 text-background-dark active:scale-95 transition-transform"
              title="Voice Message"
            >
              <span className="material-icons text-[26px]">mic</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}

export default ChatWindow
