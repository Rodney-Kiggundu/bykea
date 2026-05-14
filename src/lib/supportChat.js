import { supabase } from './supabaseClient';

const DEVICE_KEY_STORAGE = 'ingo_support_device_key';
const CUSTOMER_CONV_ID_STORAGE = 'ingo_support_conversation_id';
const CUSTOMER_CONV_EMAIL_PREFIX = 'ingo_support_conversation_email:';
const SHOP_OWNER_CONV_PREFIX = 'ingo_shop_owner_support_conversation:';
const DRIVER_CONV_PREFIX = 'ingo_driver_support_conversation:';

function getOrCreateDeviceKey() {
  try {
    const existing = localStorage.getItem(DEVICE_KEY_STORAGE);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_KEY_STORAGE, generated);
    return generated;
  } catch {
    return null;
  }
}

function convStorageKeyForSession(session) {
  const email = String(session?.email || '').trim().toLowerCase();
  if (email) return `${CUSTOMER_CONV_EMAIL_PREFIX}${email}`;
  return CUSTOMER_CONV_ID_STORAGE;
}

function saveCustomerConversationId(id, session) {
  try {
    localStorage.setItem(convStorageKeyForSession(session), id);
  } catch {
    // ignore
  }
}

function getSavedCustomerConversationId(session) {
  try {
    return localStorage.getItem(convStorageKeyForSession(session));
  } catch {
    return null;
  }
}

export async function ensureCustomerSupportConversation(session) {
  if (!supabase) return { conversation: null, error: new Error('Supabase is not configured') };

  const appUserId = session?.id || null;
  const deviceKey = getOrCreateDeviceKey();

  if (appUserId) {
    const byUser = await supabase
      .from('support_conversations')
      .select('*')
      .eq('app_user_id', appUserId)
      .in('status', ['open', 'pending_admin', 'answered'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!byUser.error && byUser.data) {
      saveCustomerConversationId(byUser.data.id, session);
      return { conversation: byUser.data, error: null };
    }
  }

  const savedId = getSavedCustomerConversationId(session);
  if (savedId) {
    const { data, error } = await supabase
      .from('support_conversations')
      .select('*')
      .eq('id', savedId)
      .maybeSingle();
    if (
      !error &&
      data &&
      ((appUserId && data.app_user_id === appUserId) || (!appUserId && data.client_device_key === deviceKey))
    ) {
      return { conversation: data, error: null };
    }
  }

  if (deviceKey) {
    const byDevice = await supabase
      .from('support_conversations')
      .select('*')
      .eq('client_device_key', deviceKey)
      .in('status', ['open', 'pending_admin', 'answered'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!byDevice.error && byDevice.data) {
      saveCustomerConversationId(byDevice.data.id, session);
      return { conversation: byDevice.data, error: null };
    }
  }

  const payload = {
    app_user_id: appUserId,
    client_device_key: deviceKey,
    title: 'Support chat',
    customer_name: session?.full_name || null,
    customer_phone: session?.phone || null,
    customer_email: session?.email || null,
    status: 'open',
  };
  const created = await supabase.from('support_conversations').insert(payload).select('*').single();
  if (!created.error && created.data) {
    saveCustomerConversationId(created.data.id, session);
  }
  return { conversation: created.data || null, error: created.error || null };
}

function shopOwnerStorageKey(session) {
  const id = String(session?.id || '').trim();
  if (id) return `${SHOP_OWNER_CONV_PREFIX}${id}`;
  const email = String(session?.email || '').trim().toLowerCase();
  if (email) return `${SHOP_OWNER_CONV_PREFIX}${email}`;
  return `${SHOP_OWNER_CONV_PREFIX}guest`;
}

function saveShopOwnerConversationId(id, session) {
  try {
    localStorage.setItem(shopOwnerStorageKey(session), id);
  } catch {
    // ignore
  }
}

function getSavedShopOwnerConversationId(session) {
  try {
    return localStorage.getItem(shopOwnerStorageKey(session));
  } catch {
    return null;
  }
}

export async function ensureShopOwnerSupportConversation(session) {
  if (!supabase) return { conversation: null, error: new Error('Supabase is not configured') };
  const normalizedEmail = String(session?.email || '').trim().toLowerCase();
  const title = 'Shop owner support';

  const savedId = getSavedShopOwnerConversationId(session);
  if (savedId) {
    const byId = await supabase.from('support_conversations').select('*').eq('id', savedId).maybeSingle();
    if (!byId.error && byId.data) return { conversation: byId.data, error: null };
  }

  if (normalizedEmail) {
    const byEmail = await supabase
      .from('support_conversations')
      .select('*')
      .eq('title', title)
      .eq('customer_email', normalizedEmail)
      .in('status', ['open', 'pending_admin', 'answered'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!byEmail.error && byEmail.data) {
      saveShopOwnerConversationId(byEmail.data.id, session);
      return { conversation: byEmail.data, error: null };
    }
  }

  const payload = {
    app_user_id: null,
    client_device_key: getOrCreateDeviceKey(),
    title,
    customer_name: session?.business_name || session?.owner_full_name || 'Shop owner',
    customer_phone: session?.phone || null,
    customer_email: normalizedEmail || null,
    status: 'open',
  };
  const created = await supabase.from('support_conversations').insert(payload).select('*').single();
  if (!created.error && created.data) saveShopOwnerConversationId(created.data.id, session);
  return { conversation: created.data || null, error: created.error || null };
}

function driverStorageKey(session) {
  const id = String(session?.id || '').trim();
  if (id) return `${DRIVER_CONV_PREFIX}${id}`;
  const email = String(session?.email || '').trim().toLowerCase();
  if (email) return `${DRIVER_CONV_PREFIX}${email}`;
  return `${DRIVER_CONV_PREFIX}guest`;
}

function saveDriverConversationId(id, session) {
  try {
    localStorage.setItem(driverStorageKey(session), id);
  } catch {
    // ignore
  }
}

function getSavedDriverConversationId(session) {
  try {
    return localStorage.getItem(driverStorageKey(session));
  } catch {
    return null;
  }
}

export async function ensureDriverSupportConversation(session) {
  if (!supabase) return { conversation: null, error: new Error('Supabase is not configured') };
  const normalizedEmail = String(session?.email || '').trim().toLowerCase();
  const title = 'Driver support';

  const savedId = getSavedDriverConversationId(session);
  if (savedId) {
    const byId = await supabase.from('support_conversations').select('*').eq('id', savedId).maybeSingle();
    if (!byId.error && byId.data) return { conversation: byId.data, error: null };
  }

  if (normalizedEmail) {
    const byEmail = await supabase
      .from('support_conversations')
      .select('*')
      .eq('title', title)
      .eq('customer_email', normalizedEmail)
      .in('status', ['open', 'pending_admin', 'answered'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!byEmail.error && byEmail.data) {
      saveDriverConversationId(byEmail.data.id, session);
      return { conversation: byEmail.data, error: null };
    }
  }

  const payload = {
    app_user_id: null,
    client_device_key: getOrCreateDeviceKey(),
    title,
    customer_name: session?.full_name || 'Driver',
    customer_phone: session?.phone || null,
    customer_email: normalizedEmail || null,
    status: 'open',
  };
  const created = await supabase.from('support_conversations').insert(payload).select('*').single();
  if (!created.error && created.data) saveDriverConversationId(created.data.id, session);
  return { conversation: created.data || null, error: created.error || null };
}

export async function updateSupportConversationProfile(conversationId, session) {
  if (!supabase || !conversationId || !session?.id) return { data: null, error: null };
  return supabase
    .from('support_conversations')
    .update({
      app_user_id: session.id,
      customer_name: session.full_name || null,
      customer_phone: session.phone || null,
      customer_email: session.email || null,
    })
    .eq('id', conversationId)
    .select('*')
    .maybeSingle();
}

export async function listSupportMessages(conversationId) {
  if (!supabase || !conversationId) return { data: [], error: null };
  return supabase
    .from('support_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
}

export async function sendSupportMessage({
  conversationId,
  senderRole,
  body,
  authorAppUserId = null,
  adminDisplayName = null,
}) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') };
  return supabase
    .from('support_messages')
    .insert({
      conversation_id: conversationId,
      sender_role: senderRole,
      body: String(body || '').trim(),
      author_app_user_id: authorAppUserId,
      admin_display_name: adminDisplayName,
    })
    .select('*')
    .single();
}

export async function listSupportConversations() {
  if (!supabase) return { data: [], error: null };
  const convRes = await supabase
    .from('support_conversations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (convRes.error || !Array.isArray(convRes.data) || convRes.data.length === 0) return convRes;

  const missingConvs = convRes.data.filter((row) => !row.customer_name || row.customer_name === 'Customer');
  if (missingConvs.length === 0) return convRes;

  const latestCustomerMsgs = await supabase
    .from('support_messages')
    .select('conversation_id, author_app_user_id, sender_role, created_at')
    .eq('sender_role', 'customer')
    .not('author_app_user_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(2000);
  const msgUserByConversation = {};
  (latestCustomerMsgs.data || []).forEach((m) => {
    if (!msgUserByConversation[m.conversation_id]) msgUserByConversation[m.conversation_id] = m.author_app_user_id;
  });

  const missingIds = convRes.data
    .map((row) => row.app_user_id || msgUserByConversation[row.id] || null)
    .filter(Boolean);
  const uniqIds = [...new Set(missingIds)];
  if (uniqIds.length === 0) return convRes;

  const usersRes = await supabase.from('app_users').select('id, full_name').in('id', uniqIds);
  const fullNameById = Object.fromEntries((usersRes.data || []).map((u) => [u.id, u.full_name]));
  const patched = convRes.data.map((row) => ({
    ...row,
    customer_name: fullNameById[row.app_user_id || msgUserByConversation[row.id]] || row.customer_name,
  }));
  return { data: patched, error: convRes.error };
}

export async function markSupportConversationReadByAdmin(conversationId) {
  if (!supabase || !conversationId) return { data: null, error: null };
  return supabase
    .from('support_conversations')
    .update({ status: 'answered' })
    .eq('id', conversationId)
    .eq('status', 'pending_admin')
    .select('id, status')
    .maybeSingle();
}

