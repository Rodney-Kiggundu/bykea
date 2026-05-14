import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  listSupportConversations,
  listSupportMessages,
  markSupportConversationReadByAdmin,
  sendSupportMessage,
} from '../lib/supportChat';
import './adminPortal.css';

const convTabs = ['All', 'Customers', 'Drivers', 'Shops'];
const channels = ['Push Notification', 'SMS', 'Email', 'WhatsApp', 'All Channels'];

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function mapConversation(row) {
  const title = String(row.title || '').toLowerCase();
  const isShopOwner = title.includes('shop owner');
  const isDriver = title.includes('driver');
  const preview = String(row.last_message_preview || '').trim();
  const hasMessages = Boolean(preview) || Boolean(row.last_message_at);
  return {
    id: row.id,
    name: row.customer_name || row.customer_email || 'Customer',
    role: isShopOwner ? 'Shop Owner' : isDriver ? 'Driver' : 'Customer',
    lastMessage: preview,
    time: fmtTime(row.last_message_at || row.updated_at),
    unread: row.status === 'pending_admin' ? 1 : 0,
    type: isShopOwner ? 'Shops' : isDriver ? 'Drivers' : 'Customers',
    appUserId: row.app_user_id || null,
    hasMessages,
  };
}

function mapMessage(row) {
  if (row.sender_role === 'system') return { id: row.id, type: 'system', text: row.body };
  if (row.sender_role === 'admin') return { id: row.id, type: 'sent', text: row.body, time: fmtTime(row.created_at) };
  return { id: row.id, type: 'received', text: row.body, time: fmtTime(row.created_at) };
}

export default function AdminCommunicationsPage() {
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [activeConvId, setActiveConvId] = useState(null);
  const [draft, setDraft] = useState('');
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [recipient, setRecipient] = useState('All Customers');
  const [schedule, setSchedule] = useState('Send Now');
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const chatBodyRef = useRef(null);

  const loadConversations = useCallback(async () => {
    const { data, error } = await listSupportConversations();
    if (error) return;
    const rows = (data || []).map(mapConversation).filter((row) => row.hasMessages);
    setConversations(rows);
    if (!activeConvId && rows[0]?.id) setActiveConvId(rows[0].id);
  }, [activeConvId]);

  const loadMessages = useCallback(async (convId) => {
    if (!convId) {
      setMessages([]);
      return;
    }
    const { data, error } = await listSupportMessages(convId);
    if (error) return;
    setMessages((data || []).map(mapMessage));
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    loadMessages(activeConvId);
  }, [activeConvId, loadMessages]);

  useEffect(() => {
    if (!conversations.length) {
      if (activeConvId) setActiveConvId(null);
      return;
    }
    if (activeConvId && conversations.some((c) => c.id === activeConvId)) return;
    setActiveConvId(conversations[0].id);
  }, [activeConvId, conversations]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadConversations();
      if (activeConvId) loadMessages(activeConvId);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [activeConvId, loadConversations, loadMessages]);

  useEffect(() => {
    const el = chatBodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, activeConvId]);

  const filteredConversations = useMemo(
    () =>
      conversations.filter((conv) => {
        const q = search.toLowerCase();
        const matchQ = !q || conv.name.toLowerCase().includes(q) || conv.lastMessage.toLowerCase().includes(q);
        const matchTab = activeTab === 'All' || conv.type === activeTab;
        return matchQ && matchTab;
      }),
    [activeTab, conversations, search],
  );

  const activeConv = conversations.find((conv) => conv.id === activeConvId) || filteredConversations[0] || null;

  const openConversation = useCallback(async (convId) => {
    setActiveConvId(convId);
    await markSupportConversationReadByAdmin(convId);
    await loadConversations();
    await loadMessages(convId);
  }, [loadConversations, loadMessages]);

  const sendAdmin = async () => {
    const text = draft.trim();
    if (!text || !activeConvId) return;
    setDraft('');
    await sendSupportMessage({
      conversationId: activeConvId,
      senderRole: 'admin',
      body: text,
      adminDisplayName: 'InGo Admin',
    });
    await loadConversations();
    await loadMessages(activeConvId);
  };

  return (
    <div className="adm">
      <div className="admToolbar">
        <h2 style={{ margin: 0 }}>Communications</h2>
        <button className="admBtn admBtnAuto" type="button" onClick={() => setShowBroadcast(true)}>
          ✉ New Message
        </button>
      </div>

      <section className="admCommGrid">
        <aside className="admCard admCommLeft">
          <div className="admSearch" style={{ marginBottom: '0.55rem' }}>
            <input
              placeholder="Search conversations..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="admTabs" style={{ marginBottom: '0.45rem' }}>
            {convTabs.map((tab) => (
              <button key={tab} type="button" className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </div>

          <div>
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                className={`admConvRow${conv.unread > 0 ? ' unread' : ''}${activeConvId === conv.id ? ' active' : ''}`}
                type="button"
                onClick={() => {
                  openConversation(conv.id);
                }}
              >
                <span className="admMiniAvatar">{conv.name.slice(0, 2).toUpperCase()}</span>
                <span className="admConvMeta">
                  <strong>{conv.name}</strong>
                  <small>{conv.lastMessage}</small>
                </span>
                <span className="admConvEnd">
                  <small>{conv.time}</small>
                  {conv.unread > 0 && <b>{conv.unread}</b>}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="admCard admCommRight">
          <header className="admCommHead">
            <div className="admInlineUser">
              <span className="admMiniAvatar">{(activeConv?.name || 'CU').slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{activeConv?.name || 'No conversation selected'}</strong>
                <div>
                  <span className="admBadgeStatus admGreen">{activeConv?.role || 'Customer'}</span>
                </div>
              </div>
            </div>
            <div className="admActions">
              <button type="button" aria-label="More">⋯</button>
            </div>
          </header>

          <div className="admChatBody" ref={chatBodyRef}>
            {messages.length === 0 ? (
              <p className="admDim" style={{ margin: 0 }}>
                No unread chats.
              </p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`admMsg ${message.type}`}>
                  {message.type === 'system' ? (
                    <span>{message.text}</span>
                  ) : (
                    <>
                      <p>{message.text}</p>
                      <small>{message.time}</small>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          <footer className="admInputBar">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type a message..."
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  sendAdmin();
                }
              }}
            />
            <button type="button" className="admBtnSmall" aria-label="Send" onClick={sendAdmin}>Send</button>
          </footer>
        </section>
      </section>

      {showBroadcast && (
        <div className="admModalOverlay" role="presentation" onClick={() => setShowBroadcast(false)}>
          <div className="admModal admModalWide" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Send Broadcast</h3>

            <div className="admField">
              <label>Recipients</label>
              <div className="admPillsRow">
                {['All Customers', 'All Drivers', 'All Shops', 'Custom Group'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`admPillBtn${recipient === item ? ' active' : ''}`}
                    onClick={() => setRecipient(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {recipient === 'Custom Group' && (
              <div className="admField">
                <label>Custom group filters</label>
                <div className="admFilters">
                  <select className="admSelect"><option>By city</option></select>
                  <select className="admSelect"><option>By status</option></select>
                  <select className="admSelect"><option>By activity</option></select>
                </div>
              </div>
            )}

            <div className="admField">
              <label>Message Type</label>
              <div className="admChecksGrid">
                {channels.map((item) => (
                  <label key={item} className="admCheckLabel" htmlFor={item}>
                    <input id={item} type="checkbox" defaultChecked={item === 'Push Notification'} />
                    {item}
                  </label>
                ))}
              </div>
            </div>

            <div className="admField">
              <label htmlFor="broadcast-subject">Subject</label>
              <input id="broadcast-subject" className="admInput" placeholder="Subject (for email)" />
            </div>
            <div className="admField">
              <label htmlFor="broadcast-message">Message</label>
              <textarea id="broadcast-message" className="admTextarea" maxLength={500} placeholder="Write your message..." />
              <small className="admDim" style={{ float: 'right' }}>0 / 500</small>
            </div>

            <div className="admField">
              <label>Schedule</label>
              <div className="admPillsRow">
                {['Send Now', 'Schedule'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`admPillBtn${schedule === item ? ' active' : ''}`}
                    onClick={() => setSchedule(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              {schedule === 'Schedule' && (
                <div className="admFilters" style={{ marginTop: '0.5rem' }}>
                  <input className="admInput" placeholder="Pick date" />
                  <input className="admInput" placeholder="Pick time" />
                </div>
              )}
            </div>

            <div className="admModalActions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <small className="admDim">This will reach 12,450 users</small>
              <div style={{ display: 'flex', gap: '0.45rem' }}>
                <button className="admOutlineBtn" type="button">Preview</button>
                <button className="admBtn admBtnAuto" type="button" onClick={() => setShowBroadcast(false)}>
                  Send Broadcast
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
