import { useState, useEffect } from "react";
import axios from "axios";
import { Search, SquarePen, Bookmark, LogOut, Sun, Moon } from "lucide-react";

const avatarColors = [
  "linear-gradient(135deg,#ff8a9b,#ff7a8a)",
  "linear-gradient(135deg,#7b7cff,#8f8fff)",
  "linear-gradient(135deg,#2fc08f,#26a97c)",
  "linear-gradient(135deg,#f0b34a,#e39a2a)",
];
const getAvatarColor = (name = "") => avatarColors[name.charCodeAt(0) % avatarColors.length];

export default function Sidebar({
  conversations, activeConv, onSelectConv, onOpenChat, onlineUsers,
  username, onLogout, token, isMobile, typingMap = {},
  theme, onToggleTheme,
}) {
  const [search, setSearch]         = useState("");
  const [results, setResults]       = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await axios.get(
          `https://real-time-chat-vt6f.onrender.com/api/users/search?q=${encodeURIComponent(search)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setResults(data);
      } catch (err) {
        console.error("Search failed:", err);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [search, token]);

  const getOtherUser = (conv) => conv.members?.find(m => m !== username) || conv.otherUser;
  const meOnline = onlineUsers.includes(username);
  const isDark = theme === "dark";

  return (
    <div className="panel sidebar">
      {/* Header */}
      <div className="sb-head">
        <p className="sb-name">{username}</p>
        <p className={`sb-status ${meOnline ? "on" : ""}`}>{meOnline ? "● Online" : "○ Connecting…"}</p>
      </div>
      <div className="sb-divider" />

      {/* Action buttons */}
      <div className="sb-actions">
        <button className="icon-btn" title="Search" onClick={() => setShowSearch(s => !s)}>
          <Search size={17} />
        </button>
        <button className="icon-btn" title="New chat" onClick={() => setShowSearch(true)}>
          <SquarePen size={17} />
        </button>
        <button className="icon-btn" title="Saved (coming soon)">
          <Bookmark size={17} />
        </button>
        <span className="spacer" />
        <button className="icon-btn" title={isDark ? "Switch to light mode" : "Switch to dark mode"} onClick={onToggleTheme}>
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button className="icon-btn" title="Logout" onClick={onLogout}>
          <LogOut size={17} />
        </button>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="sb-search">
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users..."
          />
          {results.map(u => (
            <div key={u._id} className="sb-result"
              onClick={() => { onOpenChat(u.username); setShowSearch(false); setSearch(""); }}>
              <div className="avatar" style={{ width: 38, height: 38, fontSize: 15, background: getAvatarColor(u.username) }}>
                {u.username[0].toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500 }}>{u.username}</p>
                <p style={{ fontSize: 12, color: onlineUsers.includes(u.username) ? "var(--green)" : "var(--text-muted)" }}>
                  {onlineUsers.includes(u.username) ? "Active now" : "Offline"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conversations */}
      <p className="sb-section">Messages</p>
      <div className="conv-list">
        {conversations.length === 0 && (
          <p className="empty-list">No conversations yet. Search for a user to start chatting.</p>
        )}
        {conversations.map(conv => {
          const other    = getOtherUser(conv);
          const isActive = activeConv?._id === conv._id;
          const unread   = conv.unreadCount || 0;
          const isTyping = !!typingMap[conv._id];

          return (
            <div key={conv._id}
              className={`conv ${isActive ? "active" : ""}`}
              onClick={() => onSelectConv({ ...conv, otherUser: other })}>
              <div className="avatar" style={{ width: 44, height: 44, fontSize: 17, background: getAvatarColor(other) }}>
                {other?.[0]?.toUpperCase()}
              </div>

              <div className="conv-info">
                <p className="conv-name">{other}</p>
                {isTyping ? (
                  <p className="conv-last typing">typing...</p>
                ) : (
                  <p className={`conv-last ${unread > 0 ? "unread" : ""}`}>
                    {conv.lastMessage || "Start a conversation"}
                  </p>
                )}
              </div>

              {unread > 0 && !isTyping && (
                <span className="unread-badge">{unread > 9 ? "9+" : unread}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}