import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCustomerSession, saveCustomerSession } from '../lib/customerSession';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './customerAccount.css';
import './requestFlow.css';

function BackArrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15.5 18.5L8.5 12l7-7.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ProfileEditPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = getCustomerSession();
    if (!s?.id) {
      navigate('/login', { replace: true });
      return;
    }
    setUserId(s.id);
    setFullName((s.full_name || '').trim());
    setPhone((s.phone || '').trim());
    setEmail((s.email || '').trim());
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!userId || !isSupabaseConfigured || !supabase) {
      setErrorMessage('Unable to save. Check you are logged in.');
      return;
    }
    const nextEmail = email.trim().toLowerCase();
    if (!fullName.trim() || !phone.trim() || !nextEmail) {
      setErrorMessage('Please fill in name, phone, and email.');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('app_users')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: nextEmail,
        })
        .eq('id', userId)
        .select('id, full_name, phone, email')
        .maybeSingle();

      if (error) {
        if (error.code === '23505') {
          setErrorMessage('That email is already used by another account.');
        } else {
          setErrorMessage(error.message || 'Could not save changes.');
        }
        return;
      }
      if (data) saveCustomerSession(data);
      navigate('/profile', { replace: true });
    } catch {
      setErrorMessage('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cust cust--pf-edit" style={{ background: '#fff' }}>
      <div className="flow-topbar">
        <Link to="/profile" className="flow-back" aria-label="Back to profile">
          <BackArrow />
        </Link>
        <h1 className="flow-topbar__title">Edit Profile</h1>
        <span className="flow-topbar__spacer" aria-hidden />
      </div>

      <div className="pf-bwrap" style={{ flex: 1, minHeight: 0 }}>
        <div className="pf-bwrap__scroll">
          <form className="pf-edit-form" onSubmit={handleSubmit} noValidate>
            <label className="pf-edit-label" htmlFor="pf-edit-name">
              Full name
            </label>
            <input
              id="pf-edit-name"
              className="pf-edit-input"
              value={fullName}
              onChange={(ev) => setFullName(ev.target.value)}
              autoComplete="name"
            />

            <label className="pf-edit-label" htmlFor="pf-edit-phone">
              Phone
            </label>
            <div className="pf-edit-phone">
              <span className="pf-edit-phone__code">+44</span>
              <input
                id="pf-edit-phone"
                className="pf-edit-input pf-edit-input--phone"
                value={phone}
                onChange={(ev) => setPhone(ev.target.value)}
                autoComplete="tel-national"
                inputMode="tel"
              />
            </div>

            <label className="pf-edit-label" htmlFor="pf-edit-email">
              Email
            </label>
            <input
              id="pf-edit-email"
              className="pf-edit-input"
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              autoComplete="email"
            />

            {errorMessage ? <p className="pf-edit-error">{errorMessage}</p> : null}

            <button type="submit" className="pf-edit-save" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
