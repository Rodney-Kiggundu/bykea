import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDriverSession } from '../lib/driverSession';
import { ensureDriverSupportConversation, listSupportMessages, sendSupportMessage } from '../lib/supportChat';
import './chatNotifyRating.css';

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatMessageTime(ts) {
  if (!ts) return timeNow();
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return timeNow();
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function toUiMessage(row) {
  if (row.sender_role === 'system') return { id: row.id, kind: 'sys', text: row.body };
  return {
    id: row.id,
    kind: row.sender_role === 'admin' ? 'recv' : 'sent',
    text: row.body,
    t: formatMessageTime(row.created_at),
    read: row.sender_role !== 'admin',
  };
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path d="M15.5 19.5L8 12l7.5-7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" transform="translate(0.5,0.5)" />
    </svg>
  );
}

function Ticks() {
  return (
    <span className="ingChat__tick" aria-label="Read">
      <svg viewBox="0 0 20 10" width="16" height="8" fill="none" aria-hidden>
        <path d="M1.5 5.5l2.2 2.2L6.8 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M6.5 5.5l2.2 2.2L11.8 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export default function DriverSupportChatPage() {
  const navigate = useNavigate();
  const session = getDriverSession();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const endRef = useRef(null);

  const loadMessages = useCallback(async (convId) => {
    if (!convId) return;
    const { data, error } = await listSupportMessages(convId);
    if (error) return;
    if (Array.isArray(data) && data.length > 0) {
      setMessages(data.map(toUiMessage));
      return;
    }
    const driverName = session?.full_name || 'Driver';
    setMessages([
      { id: 'driver-welcome-1', kind: 'recv', text: `Hi ${driverName}! InGo admin support is online.`, t: timeNow() },
      { id: 'driver-welcome-2', kind: 'sys', text: 'Ask your issue and admin will reply here.' },
    ]);
  }, [session?.full_name]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { conversation, error } = await ensureDriverSupportConversation(session);
      if (!alive || error || !conversation?.id) return;
      setConversationId(conversation.id);
      await loadMessages(conversation.id);
    })();
    return () => {
      alive = false;
    };
  }, [loadMessages, session]);

  useEffect(() => {
    if (!conversationId) return undefined;
    const timer = window.setInterval(() => {
      loadMessages(conversationId);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [conversationId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || !conversationId) return;
    setInput('');
    sendSupportMessage({
      conversationId,
      senderRole: 'customer',
      body: text,
      adminDisplayName: null,
      authorAppUserId: null,
    }).then(() => loadMessages(conversationId));
  }, [conversationId, input, loadMessages]);

  return (
    <div className="ingChat ingChat--support ingChat--inDriverShell" role="main" aria-label="Driver support chat">
      <header className="ingChat__head">
        <button type="button" className="ingChat__back" onClick={() => navigate('/driver/home')} aria-label="Back">
          <BackIcon />
        </button>
        <div className="ingChat__headC">
          <div className="ingChat__ava ingChat__ava--support" aria-hidden />
          <h1 className="ingChat__name">InGo Admin Support</h1>
          <p className="ingChat__sub">
            <span className="ingChat__dotA" aria-hidden />
            <span className="ingChat__subA">Support</span>
          </p>
          <span className="ingChat__pill" aria-label="Chat type">Driver support</span>
        </div>
        <span className="ingChat__spacerRt" aria-hidden />
      </header>

      <div className="ingChat__msgs" aria-live="polite" aria-atomic="false">
        {messages.map((m) => {
          if (m.kind === 'sys') {
            return <div key={m.id} className="ingChat__sys" role="status">{m.text}</div>;
          }
          if (m.kind === 'recv') {
            return (
              <div key={m.id} className="ingChat__row ingChat__row--L ingChat__row--support">
                <span className="ingChat__avaS ingChat__avaS--support" aria-hidden />
                <div>
                  <div className="ingChat__bubbleR">{m.text}</div>
                  <time className="ingChat__metaL" dateTime={m.t}>{m.t}</time>
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className="ingChat__row ingChat__row--R">
              <div>
                <div className="ingChat__bubbleS">{m.text}</div>
                <div className="ingChat__metaR">
                  <time dateTime={m.t}>{m.t}</time>
                  {m.read ? <Ticks /> : null}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form
        className="ingChat__inBar"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          className="ingChat__in"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message InGo Admin..."
          aria-label="Type a message"
        />
        <button type="submit" className="ingChat__send" aria-label="Send message">
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
