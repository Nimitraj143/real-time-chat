import { Fragment, useEffect, useState, useRef } from "react";
import axios from "axios";
import { socket } from "../socket";
import {
  Phone, Video, EllipsisVertical, ArrowLeft, ArrowDown,
  Paperclip, Send, FileText, Smile, X, Check, CheckCheck,
  Mic, Trash2, Play, Pause,
} from "lucide-react";

const TYPING_TIMEOUT = 2000;
const API = "http://localhost:5000";

const EMOJIS = [
  "😀","😂","🥹","😍","😘","😎","🤔","😅",
  "😭","😡","🥳","🤝","👍","👎","👏","🙏",
  "💪","🔥","💯","✨","🎉","❤️","💜","💔",
  "🙌","👀","🤯","😴","🤗","😇","🥺","😤",
  "🤡","💀","🫡","🍕","☕","🎧","🚀","🌙",
];

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function formatSize(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
function formatDuration(sec) {
  sec = Math.floor(sec || 0);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function sameDay(a, b) { return new Date(a).toDateString() === new Date(b).toDateString(); }
function dayLabel(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  if (sameDay(d, now)) return "Today";
  const y = new Date(); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}
function formatLastSeen(dateVal) {
  if (!dateVal) return "Offline";
  const diffMin = Math.floor((Date.now() - new Date(dateVal).getTime()) / 60000);
  if (diffMin < 1)  return "Last seen just now";
  if (diffMin < 60) return `Last seen ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `Last seen ${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Last seen yesterday";
  return `Last seen ${new Date(dateVal).toLocaleDateString()}`;
}

const avatarColors = [
  "linear-gradient(135deg,#ff8a9b,#ff7a8a)",
  "linear-gradient(135deg,#7b7cff,#8f8fff)",
  "linear-gradient(135deg,#2fc08f,#26a97c)",
  "linear-gradient(135deg,#f0b34a,#e39a2a)",
];
const getAvatarColor = (name = "") => avatarColors[name.charCodeAt(0) % avatarColors.length];

function AvatarImg({ name, url, size = 42, fontSize = 16 }) {
  if (url) {
    return <img src={`${API}${url}`} alt={name} className="avatar"
      style={{ width: size, height: size, objectFit: "cover" }} />;
  }
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize, background: getAvatarColor(name) }}>
      {name?.[0]?.toUpperCase()}
    </div>
  );
}

function TickIcon({ m }) {
  if (m.seen)      return <CheckCheck size={14} className="ticks seen" />;
  if (m.delivered) return <CheckCheck size={14} className="ticks delivered" />;
  return <Check size={14} className="ticks sent" />;
}

// 👈 NEW — voice message player used inside a bubble
function VoicePlayer({ src, duration, mine }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);   // 0..1
  const [current, setCurrent] = useState(0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { a.play(); }
    setPlaying(!playing);
  };

  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    setProgress(a.currentTime / a.duration);
    setCurrent(a.currentTime);
  };

  const onEnded = () => { setPlaying(false); setProgress(0); setCurrent(0); };

  const seek = (e) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    a.currentTime = ratio * a.duration;
  };

  return (
    <div className="voice-player">
      <audio ref={audioRef} src={src} onTimeUpdate={onTimeUpdate} onEnded={onEnded} preload="metadata" />
      <button className="voice-play-btn" onClick={toggle} title={playing ? "Pause" : "Play"}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <div className="voice-track" onClick={seek}>
        <div className="voice-track-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="voice-duration">{formatDuration(playing || current ? current : duration)}</span>
    </div>
  );
}

export default function Chat({ conv, username, token, onlineUsers, isMobile, onBack, isOtherTyping, lastSeen, otherAvatar }) {
  const [messages, setMessages]       = useState([]);
  const [text, setText]               = useState("");
  const [uploading, setUploading]     = useState(false);
  const [openMenuId, setOpenMenuId]   = useState(null);
  const [tapId, setTapId]             = useState(null);
  const [seenByOther, setSeenByOther] = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [editText, setEditText]       = useState("");
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showEmoji, setShowEmoji]     = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl]   = useState(null);
  const [lightbox, setLightbox]       = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const [highlightId, setHighlightId] = useState(null);

  // 👈 NEW — voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime]   = useState(0);
  const [micDenied, setMicDenied]     = useState(false);

  const bottomRef      = useRef(null);
  const scrollRef      = useRef(null);
  const nearBottomRef  = useRef(true);
  const fileInputRef   = useRef(null);
  const inputRef       = useRef(null);
  const isTypingRef    = useRef(false);
  const typingTimerRef = useRef(null);

  // 👈 NEW — recorder refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const streamRef        = useRef(null);
  const recordTimerRef   = useRef(null);

  const otherUser = conv.otherUser || conv.members?.find(m => m !== username);
  const isOnline  = onlineUsers.includes(otherUser);

  useEffect(() => {
    if (!conv?._id) return;
    setSeenByOther(false);
    setTapId(null);
    setShowEmoji(false);
    setLightbox(null);
    setPendingFile(null);
    setPreviewUrl(null);
    setReplyTarget(null);
    nearBottomRef.current = true;

    axios.get(`${API}/api/conversations/${conv._id}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => setMessages(r.data)).catch(err => console.error("Failed to load messages:", err));

    socket.emit("join_conversation", conv._id);
    socket.emit("markAsSeen", { conversationId: conv._id, userId: username });

    const handleIncoming = (msg) => {
      if (msg.convId === conv._id || msg.conversationId === conv._id) {
        setMessages(prev => [...prev, msg]);
        if (msg.sender !== username)
          socket.emit("markAsSeen", { conversationId: conv._id, userId: username });
      }
    };
    const handleDeleted = ({ messageId, forEveryone }) => {
      setMessages(prev => forEveryone
        ? prev.map(m => m._id === messageId ? { ...m, deletedForEveryone: true, content: "", fileUrl: null } : m)
        : prev.filter(m => m._id !== messageId)
      );
    };
    const handleSeen = ({ conversationId, viewer }) => {
      if (conversationId === conv._id && viewer !== username) {
        setSeenByOther(true);
        setMessages(prev => prev.map(m => m.sender === username ? { ...m, seen: true, delivered: true } : m));
      }
    };
    const handleEdited = ({ messageId, content, edited }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, content, edited } : m));
    };

    socket.on("receive_message", handleIncoming);
    socket.on("message_deleted", handleDeleted);
    socket.on("messagesSeen", handleSeen);
    socket.on("message_edited", handleEdited);

    return () => {
      socket.off("receive_message", handleIncoming);
      socket.off("message_deleted", handleDeleted);
      socket.off("messagesSeen", handleSeen);
      socket.off("message_edited", handleEdited);
      socket.emit("leave_conversation", conv._id);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      stopRecording(true);   // safety: conversation switch hote hi recording band
    };
  }, [conv?._id]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (nearBottomRef.current || last?.sender === username) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOtherTyping]);

  // cleanup on unmount
  useEffect(() => () => stopRecording(true), []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = dist < 120;
    setShowScrollBtn(dist > 120);
  };

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  const jumpToMessage = (messageId) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(messageId);
      setTimeout(() => setHighlightId(null), 1200);
    }
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("typing", { convId: conv._id, sender: username, receiver: otherUser });
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit("stop_typing", { convId: conv._id, sender: username, receiver: otherUser });
    }, TYPING_TIMEOUT);
  };

  const addEmoji = (emo) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? text.length;
    const end   = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emo + text.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + emo.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const pickFile = (file) => {
    if (!file) return;
    setPendingFile(file);
    setPreviewUrl(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    setShowEmoji(false);
  };
  const clearPending = () => { setPendingFile(null); setPreviewUrl(null); };
  const handleFileSelect = (e) => { pickFile(e.target.files[0]); e.target.value = ""; };
  const handlePaste = (e) => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith("image/"));
    if (item) { e.preventDefault(); pickFile(item.getAsFile()); }
  };

  const sendFile = async () => {
    const file = pendingFile;
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await axios.post(`${API}/api/upload`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
      });
      const isImage = file.type.startsWith("image/");
      socket.emit("send_message", {
        convId: conv._id, sender: username, content: "",
        type: isImage ? "image" : "file", fileUrl: data.url, fileName: data.fileName || file.name,
        replyTo: replyTarget,
      });
      setSeenByOther(false);
      clearPending();
      setReplyTarget(null);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("File upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = () => {
    if (uploading) return;
    if (pendingFile) { sendFile(); return; }
    if (!text.trim()) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit("stop_typing", { convId: conv._id, sender: username, receiver: otherUser });
    }
    socket.emit("send_message", {
      convId: conv._id, sender: username, content: text.trim(), type: "text",
      replyTo: replyTarget,
    });
    setText("");
    setShowEmoji(false);
    setSeenByOther(false);
    setReplyTarget(null);
  };

  const deleteMessage = (messageId, forEveryone) => {
    socket.emit("delete_message", { messageId, convId: conv._id, username, forEveryone });
    setOpenMenuId(null);
  };

  const startEdit = (m) => { setEditingId(m._id); setEditText(m.content); setOpenMenuId(null); };
  const saveEdit  = () => {
    if (!editText.trim()) return;
    socket.emit("edit_message", { messageId: editingId, convId: conv._id, newContent: editText.trim(), username });
    setEditingId(null); setEditText("");
  };
  const cancelEdit = () => { setEditingId(null); setEditText(""); };

  const startReply = (m) => {
    setReplyTarget({
      messageId: m._id,
      sender: m.sender,
      content: m.deletedForEveryone ? "" : m.type === "text" ? m.content : m.type === "image" ? "📷 Photo" : m.type === "voice" ? "🎤 Voice message" : "📄 File",
      type: m.type,
    });
    setOpenMenuId(null);
    inputRef.current?.focus();
  };

  // ══════════════ Voice recording ══════════════
  const startRecording = async () => {
    if (isRecording || uploading || pendingFile) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start();
      setIsRecording(true);
      setRecordTime(0);
      setMicDenied(false);
      recordTimerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } catch (err) {
      console.error("Mic access denied:", err);
      setMicDenied(true);
    }
  };

  const stopRecording = (discard = false) => {
    const mr = mediaRecorderRef.current;
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }

    if (!mr || mr.state === "inactive") {
      cleanupStream();
      setIsRecording(false);
      return;
    }

    if (discard) {
      mr.onstop = null;
      mr.stop();
      cleanupStream();
      setIsRecording(false);
      setRecordTime(0);
      return;
    }

    mr.onstop = async () => {
      cleanupStream();
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const finalDuration = recordTime;
      setIsRecording(false);
      setRecordTime(0);
      if (blob.size > 0) await sendVoiceNote(blob, finalDuration);
    };
    mr.stop();
  };

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const sendVoiceNote = async (blob, duration) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, `voice-${Date.now()}.webm`);
      const { data } = await axios.post(`${API}/api/upload`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
      });
      socket.emit("send_message", {
        convId: conv._id, sender: username, content: "",
        type: "voice", fileUrl: data.url, fileName: data.fileName, duration,
        replyTo: replyTarget,
      });
      setSeenByOther(false);
      setReplyTarget(null);
    } catch (err) {
      console.error("Voice upload failed:", err);
      alert("Voice message send failed.");
    } finally {
      setUploading(false);
    }
  };

  const renderMessageContent = (m) => {
    if (m.deletedForEveryone) return "This message was deleted";
    if (m.type === "image" && m.fileUrl)
      return (
        <img src={`${API}${m.fileUrl}`} alt={m.fileName || "image"}
          style={{ maxWidth: 220, maxHeight: 220, borderRadius: 12, display: "block", cursor: "zoom-in" }}
          onClick={(e) => { e.stopPropagation(); setLightbox(`${API}${m.fileUrl}`); }} />
      );
    if (m.type === "voice" && m.fileUrl)
      return <VoicePlayer src={`${API}${m.fileUrl}`} duration={m.duration} mine={m.sender === username} />;
    if (m.type === "file" && m.fileUrl)
      return (
        <a href={`${API}${m.fileUrl}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          <FileText size={16} /> <span>{m.fileName || "Download file"}</span>
        </a>
      );
    return m.content;
  };

  return (
    <div className="panel chat-panel">
      <div className="chat-header">
        {isMobile && <button className="icon-btn sm" onClick={onBack} title="Back"><ArrowLeft size={18} /></button>}
        <AvatarImg name={otherUser} url={otherAvatar} size={42} fontSize={16} />
        <div className="head-info">
          <p className="head-name">{otherUser}</p>
          <p className={`head-status ${isOnline ? "on" : ""}`}>
            {isOnline && <span className="status-dot" />}
            {isOnline ? "Active now" : formatLastSeen(lastSeen)}
          </p>
        </div>
        <div className="head-actions">
          <button className="icon-btn" title="More"><EllipsisVertical size={17} /></button>
        </div>
      </div>

      <div className="msg-wrapper">
        <div className="msg-scroll" ref={scrollRef} onScroll={handleScroll}>
          {messages.map((m, i) => {
            const mine = m.sender === username;
            const canDeleteForEveryone = mine && !m.deletedForEveryone;
            const canEdit = mine && m.type === "text" && !m.deletedForEveryone;
            const isEditingThis = editingId === m._id;
            const showDay = i === 0 || !sameDay(messages[i - 1].createdAt, m.createdAt);
            const isMedia = (m.type === "image" || m.type === "voice") && !m.deletedForEveryone;

            return (
              <Fragment key={m._id || i}>
                {showDay && <div className="day-sep">{dayLabel(m.createdAt)}</div>}

                <div id={`msg-${m._id}`} className={`msg ${mine ? "mine" : "recv"} ${highlightId === m._id ? "msg-highlight" : ""}`}>
                  {isEditingThis ? (
                    <div className="edit-row">
                      <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }} />
                      <button className="save" onClick={saveEdit}>Save</button>
                      <button className="cancel" onClick={cancelEdit}>Cancel</button>
                    </div>
                  ) : (
                    <div className={`msg-row ${tapId === m._id ? "show" : ""} ${openMenuId === m._id ? "menu-open" : ""}`}>
                      <div
                        className={`bubble ${mine ? "mine" : "recv"} ${isMedia ? "media" : ""} ${m.type === "voice" ? "voice-bubble" : ""} ${m.deletedForEveryone ? "deleted" : ""}`}
                        onClick={() => setTapId(tapId === m._id ? null : m._id)}
                      >
                        {m.replyTo?.messageId && !m.deletedForEveryone && (
                          <div className="reply-preview" onClick={(e) => { e.stopPropagation(); jumpToMessage(m.replyTo.messageId); }}>
                            <p className="reply-preview-name">{m.replyTo.sender === username ? "You" : m.replyTo.sender}</p>
                            <p className="reply-preview-content">{m.replyTo.content}</p>
                          </div>
                        )}
                        {renderMessageContent(m)}
                      </div>

                      <div className="msg-meta">
                        <span>{formatTime(m.createdAt)}{m.edited ? " · edited" : ""}</span>
                        {mine && !m.deletedForEveryone && <TickIcon m={m} />}
                        {!m.deletedForEveryone && (
                          <button className="dots-btn" title="More"
                            onClick={() => setOpenMenuId(openMenuId === m._id ? null : m._id)}>
                            <EllipsisVertical size={16} />
                          </button>
                        )}
                      </div>

                      {openMenuId === m._id && (
                        <>
                          <div className="menu-backdrop" onClick={() => setOpenMenuId(null)} />
                          <div className="msg-menu">
                            {!m.deletedForEveryone && <button onClick={() => startReply(m)}>Reply</button>}
                            {canEdit && <button onClick={() => startEdit(m)}>Edit</button>}
                            <button onClick={() => deleteMessage(m._id, false)}>Delete for me</button>
                            {canDeleteForEveryone && (
                              <button className="danger" onClick={() => deleteMessage(m._id, true)}>Delete for everyone</button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })}

          {isOtherTyping && (
            <div className="typing">
              <span className="typing-dot" style={{ animationDelay: "0s" }} />
              <span className="typing-dot" style={{ animationDelay: "0.2s" }} />
              <span className="typing-dot" style={{ animationDelay: "0.4s" }} />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {showScrollBtn && (
          <button className="scroll-btn" onClick={scrollToBottom} title="Jump to latest"><ArrowDown size={18} /></button>
        )}
      </div>

      <div className="composer-wrap">
        {replyTarget && !isRecording && (
          <div className="quote-bar">
            <div className="quote-bar-text">
              <p className="quote-bar-name">{replyTarget.sender === username ? "You" : replyTarget.sender}</p>
              <p className="quote-bar-content">{replyTarget.content}</p>
            </div>
            <button onClick={() => setReplyTarget(null)} title="Cancel reply"><X size={16} /></button>
          </div>
        )}

        {pendingFile && !isRecording && (
          <div className="attach-preview">
            {previewUrl ? <img src={previewUrl} alt="preview" /> : <div className="file-chip"><FileText size={22} /></div>}
            <div className="attach-info">
              <p className="attach-name">{pendingFile.name}</p>
              <p className="attach-size">{formatSize(pendingFile.size)}{uploading ? " · Sending…" : ""}</p>
            </div>
            <button className="icon-btn sm" title="Remove" onClick={clearPending} disabled={uploading}><X size={16} /></button>
          </div>
        )}

        {showEmoji && !isRecording && (
          <>
            <div className="menu-backdrop" onClick={() => setShowEmoji(false)} />
            <div className="emoji-pop">
              <div className="emoji-grid">
                {EMOJIS.map(emo => <button key={emo} onClick={() => addEmoji(emo)}>{emo}</button>)}
              </div>
            </div>
          </>
        )}

        {micDenied && !isRecording && (
          <p className="mic-denied-note">Mic access blocked — allow microphone permission in your browser to record voice notes.</p>
        )}

        {isRecording ? (
          // 👈 NEW — recording bar replaces the normal composer while recording
          <div className="composer recording">
            <button className="icon-btn round danger-ghost" title="Cancel" onClick={() => stopRecording(true)}>
              <Trash2 size={17} />
            </button>
            <div className="record-indicator">
              <span className="rec-dot" />
              <span className="record-time">{formatDuration(recordTime)}</span>
              <span className="record-hint">Recording…</span>
            </div>
            <button className="send-btn" title="Send voice note" disabled={uploading} onClick={() => stopRecording(false)}>
              <Send size={17} />
            </button>
          </div>
        ) : (
          <div className="composer">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: "none" }} />
            <button className="icon-btn round" title="Attach file" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={17} />
            </button>
            <button className="icon-btn round" title="Emoji" disabled={uploading} onClick={() => setShowEmoji(s => !s)}>
              <Smile size={17} />
            </button>
            <input
              ref={inputRef}
              className="msg-input"
              value={text}
              onChange={handleTextChange}
              onPaste={handlePaste}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder={pendingFile ? "Press send to share the file" : "Type a message..."}
              disabled={uploading}
            />
            {text.trim() || pendingFile ? (
              <button className="send-btn" onClick={sendMessage} disabled={uploading} title="Send"><Send size={17} /></button>
            ) : (
              <button className="icon-btn round mic-btn" title="Record voice note" disabled={uploading} onClick={startRecording}>
                <Mic size={17} />
              </button>
            )}
          </div>
        )}
      </div>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" title="Close" onClick={() => setLightbox(null)}><X size={20} /></button>
          <img src={lightbox} alt="Full size" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}