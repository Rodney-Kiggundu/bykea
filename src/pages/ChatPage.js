import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCustomerSession } from '../lib/customerSession';
import {
  ensureCustomerSupportConversation,
  listSupportMessages,
  sendSupportMessage,
  updateSupportConversationProfile,
} from '../lib/supportChat';
import './chatNotifyRating.css';

const DRIVER_QUICK = ['Where are you?', 'On my way', 'At the door', 'Thank you'];

/** @typedef {{ id: string, kind?: string, text: string, t?: string, read?: boolean }} ChatMsg */

let idSeq = 0;
function nextId() {
  idSeq += 1;
  return `m${idSeq}`;
}

const DRIVER_INITIAL = [
  { id: 's0', kind: 'sys', text: 'Order #ING-00234 assigned' },
  { id: 'r1', kind: 'recv', text: "Hi! I'm on my way to the pickup point.", t: '2:10 PM' },
  { id: 's1', kind: 'sent', text: "Great, I'll be at the door.", t: '2:12 PM', read: true },
];

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatMessageTime(ts) {
  if (!ts) return timeNow();
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return timeNow();
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function toSupportUiMessage(row) {
  if (row.sender_role === 'system') {
    return { id: row.id, kind: 'sys', text: row.body };
  }
  return {
    id: row.id,
    kind: row.sender_role === 'customer' ? 'sent' : 'recv',
    text: row.body,
    t: formatMessageTime(row.created_at),
    read: row.sender_role === 'customer',
  };
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M15.5 19.5L8 12l7.5-7.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.97.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.92z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M9.5 8.5L15 3.5a2.5 2.5 0 0 1 3.5 0l.5.5a2.5 2.5 0 0 1 0 3.5L8.5 18.5a2.5 2.5 0 0 1-3.5-3.5L12 4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

/**
 * @param {{ support?: boolean }} props
 */
export default function ChatPage({ support = false }) {
  const navigate = useNavigate();
  /** React Router sets `location.state` to `null` when absent; default `{}` only applies for `undefined`. */
  const state = useLocation().state ?? {};
  const inferredSupport = Boolean(support || state.role === 'support' || state.withAdmin);
  const isSupport = inferredSupport;

  const session = getCustomerSession();
  const customerFirst = typeof session?.full_name === 'string' ? session.full_name.trim().split(/\s+/)[0] || '' : '';

  const driverPeerName = state.name || 'Zain Ahmed';
  const supportTitle = (state.name && String(state.name).trim()) || 'InGo Support';

  const [messages, setMessages] = useState(() => (isSupport ? [] : DRIVER_INITIAL));
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const endRef = useRef(null);

  const scrollBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollBottom();
  }, [messages, scrollBottom]);

  const loadSupportMessages = useCallback(async (convId) => {
    if (!convId) return;
    const { data, error } = await listSupportMessages(convId);
    if (error) return;
    if (Array.isArray(data) && data.length > 0) {
      setMessages(data.map(toSupportUiMessage));
      return;
    }
    const welcome = customerFirst ? `Hi ${customerFirst}!` : 'Hi there!';
    setMessages([
      { id: 'sys-welcome-1', kind: 'recv', text: `${welcome} You are now connected to InGo Support.`, t: timeNow() },
      { id: 'sys-welcome-2', kind: 'sys', text: 'Ask your issue and admin will reply here.' },
    ]);
  }, [customerFirst]);

  useEffect(() => {
    if (!isSupport) return undefined;
    let alive = true;
    (async () => {
      const { conversation, error } = await ensureCustomerSupportConversation(session);
      if (!alive || error || !conversation?.id) return;
      if (session?.id) await updateSupportConversationProfile(conversation.id, session);
      setConversationId(conversation.id);
      await loadSupportMessages(conversation.id);
    })();
    return () => {
      alive = false;
    };
  }, [isSupport, loadSupportMessages, session]);

  useEffect(() => {
    if (!isSupport || !conversationId) return undefined;
    const timer = window.setInterval(() => {
      loadSupportMessages(conversationId);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [conversationId, isSupport, loadSupportMessages]);

  const send = useCallback(() => {
    const t = input.trim();
    if (!t) return;
    setInput('');
    if (!isSupport) {
      setMessages((m) => [...m, { id: nextId(), kind: 'sent', text: t, t: timeNow(), read: true }]);
      return;
    }
    if (!conversationId) return;
    sendSupportMessage({
      conversationId,
      senderRole: 'customer',
      body: t,
      authorAppUserId: session?.id || null,
    }).then(() => loadSupportMessages(conversationId));
  }, [conversationId, input, isSupport, loadSupportMessages, session?.id]);

  const applyChip = (q) => {
    setInput(q);
  };
  const displayName = isSupport ? supportTitle : driverPeerName;

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/profile', { replace: true });
  };

  return (
    <div
      className={`ingChat${isSupport ? ' ingChat--support ingChat--inCustomerShell' : ''}`}
      role="main"
      aria-label={isSupport ? 'Support chat with admin' : 'Chat'}
    >
      <header className="ingChat__head">
        <button type="button" className="ingChat__back" onClick={goBack} aria-label="Back">
          <BackIcon />
        </button>
        <div className="ingChat__headC">
          <div className={`ingChat__ava${isSupport ? ' ingChat__ava--support' : ''}`} aria-hidden />
          <h1 className="ingChat__name">{displayName}</h1>
          <p className="ingChat__sub">
            <span className={isSupport ? 'ingChat__dotA' : 'ingChat__dotO'} aria-hidden />
            <span className={isSupport ? 'ingChat__subA' : 'ingChat__subO'}>
              {isSupport ? 'Support' : 'Online'}
            </span>
          </p>
          {isSupport ? (
            <span className="ingChat__pill" aria-label="Chat type">
              Admin support
            </span>
          ) : null}
        </div>
        {isSupport ? (
          <span className="ingChat__spacerRt" aria-hidden />
        ) : (
          <a className="ingChat__call" href="tel:+447700900123" aria-label="Call rider">
            <PhoneIcon />
          </a>
        )}
      </header>

      <div className="ingChat__msgs" id="ing-chat-messages" aria-live="polite" aria-atomic="false">
        {messages.map((m) => {
          if (m.kind === 'sys') {
            return (
              <div key={m.id} className="ingChat__sys" role="status">
                {m.text}
              </div>
            );
          }
          if (m.kind === 'recv') {
            return (
              <div key={m.id} className={`ingChat__row ingChat__row--L${isSupport ? ' ingChat__row--support' : ''}`}>
                <span className={`ingChat__avaS${isSupport ? ' ingChat__avaS--support' : ''}`} aria-hidden />
                <div>
                  <div className="ingChat__bubbleR">{m.text}</div>
                  <time className="ingChat__metaL" dateTime={m.t}>
                    {m.t}
                  </time>
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

      {!isSupport ? (
        <div className="ingChat__chips" role="toolbar" aria-label="Quick replies">
          {DRIVER_QUICK.map((q) => (
            <button key={q} type="button" className="ingChat__chip" onClick={() => applyChip(q)}>
              {q}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="ingChat__inBar"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <button type="button" className="ingChat__attach" aria-label="Attachment" disabled={isSupport}>
          <PaperclipIcon />
        </button>
        <input
          className="ingChat__in"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isSupport ? 'Message InGo Support…' : 'Type a message…'}
          aria-label="Type a message"
        />
        <button type="submit" className="ingChat__send" aria-label="Send message">
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
