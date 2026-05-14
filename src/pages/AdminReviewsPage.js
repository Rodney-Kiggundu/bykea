import { useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './adminPortal.css';

function formatDt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
}

function roleLabel(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'customer') return 'Customer';
  if (s === 'driver') return 'Driver';
  return '—';
}

export default function AdminReviewsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [driverMap, setDriverMap] = useState({});
  const [userMap, setUserMap] = useState({});

  useEffect(() => {
    let cancelled = false;
    if (!isSupabaseConfigured || !supabase) {
      setRows([]);
      setErr('Database is not configured. Add keys to load live reviews.');
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setErr('');

    (async () => {
      const { data, error } = await supabase
        .from('trip_reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (cancelled) return;
      if (error) {
        setErr(error.message || 'Could not load reviews.');
        setRows([]);
        setLoading(false);
        return;
      }
      const list = data || [];
      setRows(list);

      const userIds = [...new Set(list.flatMap((r) => [r.reviewer_app_user_id, r.reviewee_app_user_id]).filter(Boolean))];
      const driverIds = [...new Set(list.flatMap((r) => [r.reviewer_driver_id, r.reviewee_driver_id]).filter(Boolean))];

      if (userIds.length) {
        const { data: users } = await supabase.from('app_users').select('id, full_name, email').in('id', userIds);
        if (!cancelled && users) {
          const m = {};
          for (const u of users) m[u.id] = u;
          setUserMap(m);
        }
      } else {
        setUserMap({});
      }

      if (driverIds.length) {
        const { data: drivers } = await supabase
          .from('driver_registrations')
          .select('id, full_name, email')
          .in('id', driverIds);
        if (!cancelled && drivers) {
          const m = {};
          for (const d of drivers) m[d.id] = d;
          setDriverMap(m);
        }
      } else {
        setDriverMap({});
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const resolvePerson = (role, appUserId, driverId) => {
    if (String(role).toLowerCase() === 'customer') {
      const u = userMap[appUserId];
      return u?.full_name || u?.email || appUserId || 'Customer';
    }
    if (String(role).toLowerCase() === 'driver') {
      const d = driverMap[driverId];
      return d?.full_name || d?.email || driverId || 'Driver';
    }
    return '—';
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const reviewerRole = roleLabel(r.reviewer_role);
      const revieweeRole = roleLabel(r.reviewee_role);
      const reviewer = resolvePerson(r.reviewer_role, r.reviewer_app_user_id, r.reviewer_driver_id).toLowerCase();
      const reviewee = resolvePerson(r.reviewee_role, r.reviewee_app_user_id, r.reviewee_driver_id).toLowerCase();
      const txt = String(r.review_text || '').toLowerCase();
      const ref = `${r.booking_table || ''}:${r.booking_id || ''}`.toLowerCase();

      const roleOk =
        roleFilter === 'All' ||
        (roleFilter === 'By customers' && String(r.reviewer_role || '').toLowerCase() === 'customer') ||
        (roleFilter === 'By drivers' && String(r.reviewer_role || '').toLowerCase() === 'driver');

      const matchQ =
        !q ||
        reviewerRole.toLowerCase().includes(q) ||
        revieweeRole.toLowerCase().includes(q) ||
        reviewer.includes(q) ||
        reviewee.includes(q) ||
        txt.includes(q) ||
        ref.includes(q);
      return roleOk && matchQ;
    });
  }, [rows, search, roleFilter, userMap, driverMap]);

  return (
    <div className="adm">
      <section className="admCard" style={{ marginBottom: '0.85rem' }}>
        <div className="admToolbar" style={{ marginBottom: 0 }}>
          <div className="admSearch">
            <input
              placeholder="Search reviewer, reviewee, booking, feedback..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="admFilters">
            <select className="admSelect" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option>All</option>
              <option>By customers</option>
              <option>By drivers</option>
            </select>
          </div>
        </div>
      </section>

      <section className="admCard">
        {err ? (
          <p className="admDim" style={{ padding: '1rem', color: '#b42318' }}>
            {err}
          </p>
        ) : loading ? (
          <p className="admDim" style={{ padding: '1rem' }}>
            Loading reviews…
          </p>
        ) : filtered.length === 0 ? (
          <p className="admDim" style={{ padding: '1rem', margin: 0 }}>
            No reviews found.
          </p>
        ) : (
          <div className="admTableWrap">
            <table className="admTable admWideTable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reviewer</th>
                  <th>Reviewee</th>
                  <th>Rating</th>
                  <th>Feedback</th>
                  <th>Booking</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDt(r.created_at)}</td>
                    <td>
                      <span className="admBadgeStatus admBlue" style={{ marginRight: 6 }}>
                        {roleLabel(r.reviewer_role)}
                      </span>
                      {resolvePerson(r.reviewer_role, r.reviewer_app_user_id, r.reviewer_driver_id)}
                    </td>
                    <td>
                      <span className="admBadgeStatus admGreen" style={{ marginRight: 6 }}>
                        {roleLabel(r.reviewee_role)}
                      </span>
                      {resolvePerson(r.reviewee_role, r.reviewee_app_user_id, r.reviewee_driver_id)}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{'★'.repeat(Number(r.rating) || 0)} ({r.rating || 0}/5)</td>
                    <td style={{ maxWidth: 420 }}>{r.review_text || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.booking_table || '—'} <br />
                      <span className="admDim" style={{ fontSize: '0.75rem' }}>
                        {r.booking_id || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
