import { useState } from 'react'

function Sidebar({ user, contacts, onlineUserIds, selectedChat, onSelectChat, onLogout, onAddFriendClick }) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredContacts = contacts.filter(contact =>
    contact.username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="w-96 bg-background-light dark:bg-background-dark border-r border-primary/10 flex flex-col h-full">
      {/* Header */}
      <div className="bg-background-dark p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <img
              src={user.avatar}
              alt={user.username}
              className="w-10 h-10 rounded-full object-cover border-2 border-primary/20"
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-full border-2 border-background-dark"></div>
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">{user.username}</h2>
            <p className="text-xs text-primary font-medium">Online</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="p-2 hover:bg-primary/10 rounded-lg transition text-white"
          title="Logout"
        >
          <span className="material-icons text-xl">logout</span>
        </button>
      </div>

      {/* Search Bar with Add Friend Button */}
      <div className="p-3 bg-background-light dark:bg-background-dark border-b border-primary/5">
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-primary/50 text-xl">search</span>
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-white/5 border-none rounded-full text-sm focus:ring-1 focus:ring-primary/50 placeholder:text-slate-500"
            />
          </div>
          <button
            onClick={onAddFriendClick}
            className="p-2.5 bg-primary hover:bg-primary/90 text-background-dark rounded-full transition-all shadow-lg shadow-primary/20"
            title="Add Friend"
          >
            <span className="material-icons">person_add</span>
          </button>
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {filteredContacts.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            {contacts.length === 0 ? (
              <>
                <span className="material-icons text-4xl mb-2 block">person_add</span>
                <p className="text-sm">No contacts yet</p>
                <p className="text-xs mt-2">Click the + button to add friends</p>
              </>
            ) : (
              <>
                <span className="material-icons text-4xl mb-2 block">search_off</span>
                <p className="text-sm">No contacts found</p>
                <p className="text-xs mt-2">Try a different search term</p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-primary/5">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => onSelectChat({
                  userId: contact.id,
                  username: contact.username,
                  avatar: contact.avatar
                })}
                className={`p-4 cursor-pointer hover:bg-white/5 dark:hover:bg-white/5 transition ${
                  selectedChat?.userId === contact.id ? 'bg-primary/10' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <img
                      src={contact.avatar}
                      alt={contact.username}
                      className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                    />
                    {onlineUserIds.includes(contact.id) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary border-2 border-background-dark rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate">{contact.username}</h3>
                      {contact.lastMessage && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                          {formatTime(contact.lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
                        {contact.lastMessage ? contact.lastMessage.text : 'No messages'}
                      </p>
                      {contact.unreadCount > 0 && (
                        <span className="ml-2 bg-primary text-background-dark text-xs font-semibold rounded-full min-w-[20px] h-5 flex items-center justify-center flex-shrink-0 px-1.5">
                          {contact.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Sidebar
