import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { MessageCircle } from "lucide-react";
import { socket } from "../socket";
import Sidebar from "../components/Sidebar";
import Chat from "../components/Chat";

const API = "http://localhost:5000";

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch (err) {
    console.error("Could not play notification sound:", err);
  }
}

function getInitialTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ChatPage() {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv]       = useState(null);
  const [onlineUsers, setOnlineUsers]     = useState([]);
  const [isMobile, setIsMobile]           = useState(window.innerWidth <= 768);
  const [typingMap, setTypingMap]         = useState({});
  const [lastSeenMap, setLastSeenMap]     = useState({});
  const [theme, setTheme]                 = useState(getInitialTheme);
  const [myAvatar, setMyAvatar]           = useState(localStorage.getItem("avatarUrl") || null);

  const navigate  = useNavigate();
  const username  = localStorage.getItem("username");
  const token     = localStorage.getItem("token");
  const activeConvRef = useRef(activeConv);
  activeConvRef.current = activeConv;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === "dark" ? "light" : "dark"));

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    socket.connect();
    socket.emit("user_online", username);

    axios.get(`${API}/api/conversations`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => {
      setConversations(r.data);
      setLastSeenMap(prev => {
        const merged = { ...prev };
        r.data.forEach(c => {
          if (c.otherUserInfo?.lastSeen) merged[c.otherUserInfo.username] = c.otherUserInfo.lastSeen;
        });
        return merged;
      });
    });

    axios.get(`${API}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => {
      if (r.data?.avatarUrl !== undefined) {
        setMyAvatar(r.data.avatarUrl);
        if (r.data.avatarUrl) localStorage.setItem("avatarUrl", r.data.avatarUrl);
        else localStorage.removeItem("avatarUrl");
      }
    });

    socket.on("online_users", users => setOnlineUsers(users));
    socket.on("initial_last_seen", (map) => setLastSeenMap(prev => ({ ...prev, ...map })));
    socket.on("user_last_seen", ({ username: u, lastSeen }) => {
      setLastSeenMap(prev => ({ ...prev, [u]: lastSeen }));
    });

    socket.on("conversation_updated", ({ convId, sender, lastMessage, lastMessageTime, unreadCount }) => {
      setConversations(prev => {
        const exists = prev.find(c => c._id === convId);
        if (!exists) return prev;
        return prev.map(c =>
          c._id === convId
            ? { ...c, lastMessage, lastMessageTime, unreadCount: unreadCount ? (unreadCount[username] || 0) : c.unreadCount }
            : c
        ).sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
      });

      if (sender && sender !== username) playNotificationSound();
    });

    socket.on("user_typing", ({ convId }) => setTypingMap(prev => ({ ...prev, [convId]: true })));
    socket.on("user_stop_typing", ({ convId }) => setTypingMap(prev => ({ ...prev, [convId]: false })));

    return () => {
      socket.off("online_users");
      socket.off("initial_last_seen");
      socket.off("user_last_seen");
      socket.off("conversation_updated");
      socket.off("user_typing");
      socket.off("user_stop_typing");
      socket.disconnect();
    };
  }, []);

  const selectConv = (conv) => {
    setActiveConv(conv);
    socket.emit("seen_conversation", { convId: conv._id, username });
    setConversations(prev => prev.map(c =>
      c._id === conv._id ? { ...c, unreadCount: 0 } : c
    ));
  };

  const openChat = async (otherUser, otherAvatar) => {
    const { data } = await axios.post(`${API}/api/conversations`,
      { otherUser },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setActiveConv({ ...data, otherUser, otherAvatar });
    if (!conversations.find(c => c._id === data._id)) {
      setConversations(prev => [{ ...data, otherUserInfo: { username: otherUser, avatarUrl: otherAvatar } }, ...prev]);
    }
    socket.emit("seen_conversation", { convId: data._id, username });
  };

  const deleteConv = async (convId) => {
    try {
      await axios.delete(`${API}/api/conversations/${convId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(prev => prev.filter(c => c._id !== convId));
      if (activeConv?._id === convId) setActiveConv(null);
    } catch (err) {
      console.error("Delete chat failed:", err);
    }
  };

  const handleAvatarChange = (url) => {
    setMyAvatar(url);
    if (url) localStorage.setItem("avatarUrl", url);
    else localStorage.removeItem("avatarUrl");
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("avatarUrl");
    socket.disconnect();
    navigate("/login");
  };

  const showSidebar = !isMobile || (isMobile && !activeConv);
  const showChat    = !isMobile || (isMobile && !!activeConv);

  return (
    <div className="app-shell">
      {showSidebar && (
        <Sidebar
          conversations={conversations}
          activeConv={activeConv}
          onSelectConv={selectConv}
          onOpenChat={openChat}
          onlineUsers={onlineUsers}
          username={username}
          onLogout={logout}
          token={token}
          isMobile={isMobile}
          typingMap={typingMap}
          theme={theme}
          onToggleTheme={toggleTheme}
          myAvatar={myAvatar}
          onAvatarChange={handleAvatarChange}
          onDeleteConv={deleteConv}
        />
      )}
      {showChat && (
        activeConv
          ? <Chat
              conv={activeConv}
              username={username}
              token={token}
              onlineUsers={onlineUsers}
              isMobile={isMobile}
              onBack={() => setActiveConv(null)}
              isOtherTyping={!!typingMap[activeConv._id]}
              lastSeen={lastSeenMap[activeConv.otherUser || activeConv.members?.find(m => m !== username)]}
              otherAvatar={activeConv.otherAvatar || activeConv.otherUserInfo?.avatarUrl}
            />
          : (
            <div className="panel chat-panel empty-state">
              <div className="empty-icon"><MessageCircle size={32} /></div>
              <p className="empty-title">Your messages</p>
              <p className="empty-sub">Pick a conversation or search for a user to start chatting.</p>
            </div>
          )
      )}
    </div>
  );
}