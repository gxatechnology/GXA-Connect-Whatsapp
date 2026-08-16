import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, RefreshCw, Search, Users, UserX, Smartphone, Plus } from 'lucide-react';
import { useSessionsQuery } from '../hooks/queries';
import { contactApi, type Contact } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/common';
import './Contacts.css';

function downloadContactsCsv(contacts: Contact[]) {
  const rows = [
    ['Name', 'Push Name', 'Phone Number', 'WhatsApp ID'],
    ...contacts.map(c => [c.name || '', c.pushName || '', c.number || '', c.id]),
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gxa-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Contacts() {
  const navigate = useNavigate();
  const { data: sessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const ready = sessions.filter(s => s.status === 'ready');
  const [sessionId, setSessionId] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!sessionId && ready[0]) setSessionId(ready[0].id);
  }, [ready, sessionId]);

  const load = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      setContacts(await contactApi.list(sessionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load contacts from WhatsApp account.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c =>
      [c.name, c.pushName, c.number, c.id].some(v => String(v || '').toLowerCase().includes(q)),
    );
  }, [contacts, search]);

  if (loadingSessions) {
    return <LoadingState message="Loading WhatsApp accounts..." minHeight="360px" />;
  }

  if (ready.length === 0) {
    return (
      <div className="contacts-container">
        <PageHeader
          title="Contacts"
          subtitle="Real address book and contacts synced from your connected WhatsApp account."
        />
        <div style={{ marginTop: '1.5rem' }}>
          <EmptyState
            icon={Smartphone}
            title="No WhatsApp Accounts Connected"
            description="Link a WhatsApp account to view your synced contact list and export your address book."
            action={
              <button type="button" className="btn-primary" onClick={() => navigate('/sessions')}>
                <Plus size={16} /> Connect WhatsApp Account
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="contacts-container">
      <PageHeader
        title="Contacts"
        subtitle="Real address book and contacts synced from your connected WhatsApp account."
        badge={
          <span className="contacts-count-pill">
            <Users size={14} />
            {contacts.length.toLocaleString()} Contacts
          </span>
        }
        actions={
          <div className="contacts-header-actions">
            <select
              className="contacts-session-select"
              value={sessionId}
              onChange={e => setSessionId(e.target.value)}
            >
              {ready.length === 0 && <option value="">No connected account</option>}
              {ready.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.phone ? `(${s.phone})` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary"
              onClick={load}
              disabled={loading || !sessionId}
            >
              <RefreshCw size={15} /> Refresh
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => downloadContactsCsv(filtered)}
              disabled={filtered.length === 0}
            >
              <Download size={15} /> Export CSV
            </button>
          </div>
        }
      />

      {error && (
        <ErrorState
          title="Contacts Error"
          message={error}
          onRetry={load}
        />
      )}

      <div className="contacts-card">
        <div className="contacts-search-bar">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="contacts-search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contact by name, push name, or phone number..."
          />
          {search && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearch('')}
            >
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <LoadingState message="Fetching contacts from WhatsApp..." minHeight="240px" />
        ) : filtered.length === 0 ? (
          contacts.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Contacts Available"
              description="No contacts found for this WhatsApp account. Contacts will sync automatically when messages are sent or received."
            />
          ) : (
            <EmptyState
              icon={UserX}
              title="No Contacts Found"
              description={`No contacts match "${search}". Try searching for a different name or number.`}
              action={
                <button type="button" className="btn-secondary" onClick={() => setSearch('')}>
                  Clear Search
                </button>
              }
            />
          )
        ) : (
          <div className="contacts-table-wrap">
            <table className="contacts-table">
              <thead>
                <tr>
                  <th>Contact Name</th>
                  <th>Push Name</th>
                  <th>Phone Number</th>
                  <th>WhatsApp ID</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td>
                      <strong className="contact-main-name">{c.name || c.pushName || 'Unknown'}</strong>
                    </td>
                    <td>
                      <span className="contact-push-name">{c.pushName || '—'}</span>
                    </td>
                    <td>
                      <span className="contact-phone mono">{c.number || '—'}</span>
                    </td>
                    <td>
                      <span className="contact-jid mono">{c.id}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
