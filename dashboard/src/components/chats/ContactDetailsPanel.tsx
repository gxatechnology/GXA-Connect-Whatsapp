import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Copy, Check, User, Users, Phone, Smartphone, Hash, UserCheck, Plus } from 'lucide-react';
import type { Chat } from '../../services/api';
import ChatAvatar from './ChatAvatar';
import { useCrmLeadByPhoneQuery, useCreateLeadMutation } from '../../hooks/queries';
import { LeadDetailDrawer } from '../crm/LeadDetailDrawer';
import { useToast } from '../../hooks/useToast';
import './ContactDetailsPanel.css';

interface ContactDetailsPanelProps {
  chat: Chat;
  sessionName?: string;
  pictureUrl?: string | null;
  resolvedPhone?: string | null;
  onClose: () => void;
}

export function ContactDetailsPanel({
  chat,
  sessionName,
  pictureUrl,
  resolvedPhone,
  onClose,
}: ContactDetailsPanelProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const rawPhone = chat.id.split('@')[0];
  const isDirect = chat.id.endsWith('@c.us') || chat.kind === 'individual';
  const isGroup = chat.isGroup || chat.kind === 'group';

  const displayPhone = resolvedPhone || (isDirect && /^\d+$/.test(rawPhone) ? `+${rawPhone}` : null);

  const { data: crmLead, isLoading: isCheckingCrm } = useCrmLeadByPhoneQuery(
    rawPhone,
    undefined,
    isDirect,
  );
  const createLeadMutation = useCreateLeadMutation();

  const handleCopyPhone = () => {
    const textToCopy = displayPhone || chat.id;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddToCrm = () => {
    if (!rawPhone) return;
    createLeadMutation.mutate(
      {
        name: chat.name || rawPhone,
        phone: rawPhone,
        contactId: chat.id,
        source: 'WhatsApp',
        stage: 'New',
      },
      {
        onSuccess: (newLead) => {
          toast.success('Added to CRM Leads');
          setSelectedLeadId(newLead.id);
        },
        onError: (err) => {
          toast.error((err as Error).message || 'Failed to add to CRM');
        },
      },
    );
  };

  return (
    <>
      <aside className="contact-details-panel" aria-label="Contact Details">
        <div className="details-header">
          <h3 className="details-title">Details</h3>
          <button
            type="button"
            className="details-close-btn"
            onClick={onClose}
            aria-label={t('common.close', { defaultValue: 'Close' })}
          >
            <X size={18} />
          </button>
        </div>

        <div className="details-body">
          {/* Profile Card */}
          <div className="details-profile-card">
            <div className="details-avatar-wrap">
              <ChatAvatar pictureUrl={pictureUrl} kind={chat.kind} />
            </div>
            <h4 className="details-name">{chat.name || rawPhone}</h4>
            <span className="details-type-tag">
              {isGroup ? (
                <>
                  <Users size={13} /> Group Chat
                </>
              ) : (
                <>
                  <User size={13} /> Direct Contact
                </>
              )}
            </span>
          </div>

          {/* CRM Status Section (Direct Contacts Only) */}
          {isDirect && (
            <div className="details-section">
              <h5 className="details-section-title">CRM Integration</h5>
              {isCheckingCrm ? (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Checking CRM records...
                </div>
              ) : crmLead ? (
                <div
                  style={{
                    background: 'var(--bg-secondary, #f8fafc)',
                    border: '1px solid var(--border, #e2e8f0)',
                    borderRadius: '0.375rem',
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      CRM STAGE:
                    </span>
                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '0.2rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: 'rgba(11, 77, 187, 0.1)',
                        color: 'var(--gxa-blue, #0B4DBB)',
                      }}
                    >
                      {crmLead.stage}
                    </span>
                  </div>

                  {crmLead.company && (
                    <div style={{ fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Company: </span>
                      <span style={{ fontWeight: 600 }}>{crmLead.company}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn-create-lead"
                    style={{
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.8125rem',
                      marginTop: '0.25rem',
                      width: '100%',
                      justifyContent: 'center',
                    }}
                    onClick={() => setSelectedLeadId(crmLead.id)}
                  >
                    <UserCheck size={14} /> View CRM Lead
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-create-lead"
                  style={{
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.8125rem',
                    width: '100%',
                    justifyContent: 'center',
                  }}
                  onClick={handleAddToCrm}
                  disabled={createLeadMutation.isPending}
                >
                  <Plus size={14} /> Add to CRM Leads
                </button>
              )}
            </div>
          )}

          {/* Info Rows */}
          <div className="details-section">
            <h5 className="details-section-title">Contact Information</h5>

            {displayPhone && (
              <div className="details-info-row">
                <div className="info-icon">
                  <Phone size={16} />
                </div>
                <div className="info-content">
                  <span className="info-label">Phone Number</span>
                  <span className="info-value mono">{displayPhone}</span>
                </div>
                <button
                  type="button"
                  className="btn-copy-info"
                  onClick={handleCopyPhone}
                  title="Copy phone number"
                >
                  {copied ? <Check size={15} color="#16a34a" /> : <Copy size={15} />}
                </button>
              </div>
            )}

            <div className="details-info-row">
              <div className="info-icon">
                <Hash size={16} />
              </div>
              <div className="info-content">
                <span className="info-label">WhatsApp ID (JID)</span>
                <span className="info-value mono jid-value" title={chat.id}>
                  {chat.id}
                </span>
              </div>
            </div>

            {sessionName && (
              <div className="details-info-row">
                <div className="info-icon">
                  <Smartphone size={16} />
                </div>
                <div className="info-content">
                  <span className="info-label">WhatsApp Account</span>
                  <span className="info-value">{sessionName}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {selectedLeadId && (
        <LeadDetailDrawer
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
        />
      )}
    </>
  );
}

export default ContactDetailsPanel;
