import { useState, useMemo, useRef, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Upload,
  Users,
  Smartphone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  Loader2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Image,
  Video,
  FileText,
  Music,
  Check,
} from 'lucide-react';
import {
  parseManualRecipients,
  parseSpreadsheetFile,
  mapRowsToRecipients,
  type ParsedRecipient,
  type ValidationSummary,
  type ParsedWorkbookResult,
} from '../../utils/campaignRecipients';
import { contactApi, messageApi, templateApi, type Session, type MessageTemplate, type Contact } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import './CampaignBuilder.css';

interface CampaignBuilderProps {
  sessions: Session[];
  selectedSessionId: string;
  onSelectSession: (id: string) => void;
  onCampaignLaunched: (batchId: string) => void;
  initialRecipients?: ParsedRecipient[];
  initialCampaignName?: string;
}

type RecipientSourceMode = 'manual' | 'spreadsheet' | 'contacts';
type CampaignMessageType = 'text' | 'image' | 'video' | 'document' | 'audio';

export function CampaignBuilder({
  sessions,
  selectedSessionId,
  onSelectSession,
  onCampaignLaunched,
  initialRecipients,
  initialCampaignName,
}: CampaignBuilderProps) {
  const navigate = useNavigate();
  const { error: showErrorToast, success: showSuccessToast } = useToast();

  // Wizard Step (1: Setup & Audience, 2: Message & Media, 3: Delivery & Review)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Setup state
  const [campaignName, setCampaignName] = useState<string>(initialCampaignName || '');
  const [campaignCategory, setCampaignCategory] = useState<string>('General');

  // Audience state
  const [sourceMode, setSourceMode] = useState<RecipientSourceMode>(
    initialRecipients && initialRecipients.length > 0 ? 'manual' : 'manual',
  );
  const [manualText, setManualText] = useState<string>(
    initialRecipients ? initialRecipients.map(r => r.raw).join('\n') : '',
  );

  // Spreadsheet file state
  const [spreadsheetFile, setSpreadsheetFile] = useState<File | null>(null);
  const [parsedWorkbook, setParsedWorkbook] = useState<ParsedWorkbookResult | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [phoneColumn, setPhoneColumn] = useState<string>('');
  const [nameColumn, setNameColumn] = useState<string>('');
  const [parsingSpreadsheet, setParsingSpreadsheet] = useState<boolean>(false);

  // Saved contacts state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState<boolean>(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());

  // WhatsApp On-platform Verification state
  const [verifyingWhatsApp, setVerifyingWhatsApp] = useState<boolean>(false);
  const [verifiedSet, setVerifiedSet] = useState<Set<string>>(new Set());
  const [missingSet, setMissingSet] = useState<Set<string>>(new Set());
  const [verificationDone, setVerificationDone] = useState<boolean>(false);

  // Active validation tab
  const [activeValidationTab, setActiveValidationTab] = useState<'valid' | 'invalid' | 'duplicates'>('valid');

  // Message & Media state
  const [messageType, setMessageType] = useState<CampaignMessageType>('text');
  const [messageBody, setMessageBody] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Media Attachment state
  const [mediaFile, setMediaFile] = useState<{
    file: File;
    base64: string;
    mimetype: string;
    filename: string;
    previewUrl?: string;
  } | null>(null);

  // Templates
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState<boolean>(false);

  // Delivery pacing options
  const [delaySeconds, setDelaySeconds] = useState<number>(3);
  const [randomizeDelay, setRandomizeDelay] = useState<boolean>(true);
  const [stopOnError, setStopOnError] = useState<boolean>(false);

  // Preview state
  const [previewIndex, setPreviewIndex] = useState<number>(0);

  // Launching state
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Compute Validation Summary based on active source mode
  const validationSummary: ValidationSummary = useMemo(() => {
    if (sourceMode === 'manual') {
      return parseManualRecipients(manualText);
    }

    if (sourceMode === 'spreadsheet' && parsedWorkbook && phoneColumn) {
      return mapRowsToRecipients(parsedWorkbook.rows, phoneColumn, nameColumn);
    }

    if (sourceMode === 'contacts') {
      const selectedContacts = contacts.filter(c => selectedContactIds.has(c.id));
      const fakeRows = selectedContacts.map(c => ({
        phone: c.number || c.id.split('@')[0],
        name: c.name || c.pushName || '',
      }));
      return mapRowsToRecipients(fakeRows, 'phone', 'name');
    }

    return {
      totalImported: 0,
      validFormatCount: 0,
      invalidFormatCount: 0,
      duplicateCount: 0,
      uniqueRecipients: [],
      invalidRecipients: [],
      duplicateRecipients: [],
    };
  }, [sourceMode, manualText, parsedWorkbook, phoneColumn, nameColumn, contacts, selectedContactIds]);

  // Final sendable recipients (either verified on WhatsApp or unique valid)
  const sendableRecipients: ParsedRecipient[] = useMemo(() => {
    if (verificationDone && verifiedSet.size > 0) {
      return validationSummary.uniqueRecipients.filter(r => verifiedSet.has(r.digits));
    }
    return validationSummary.uniqueRecipients;
  }, [validationSummary.uniqueRecipients, verificationDone, verifiedSet]);

  // Extract all available variable keys
  const availableVariables: string[] = useMemo(() => {
    const keys = new Set<string>(['phone', 'name']);
    validationSummary.uniqueRecipients.slice(0, 10).forEach(r => {
      Object.keys(r.variables).forEach(k => keys.add(k));
    });
    return Array.from(keys);
  }, [validationSummary.uniqueRecipients]);

  // Load Saved Contacts when switching to contacts mode
  const handleLoadContacts = async (sId: string) => {
    if (!sId) return;
    setLoadingContacts(true);
    try {
      const data = await contactApi.list(sId);
      setContacts(data);
      setSelectedContactIds(new Set(data.map(c => c.id)));
    } catch (err) {
      showErrorToast('Failed to load contacts from WhatsApp account', err instanceof Error ? err.message : undefined);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Load Templates
  const handleLoadTemplates = async (sId: string) => {
    if (!sId) return;
    setLoadingTemplates(true);
    try {
      const list = await templateApi.list(sId);
      setTemplates(list);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Handle Spreadsheet File Pick
  const handleSpreadsheetFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSpreadsheetFile(file);
    setParsingSpreadsheet(true);
    try {
      const result = await parseSpreadsheetFile(file);
      setParsedWorkbook(result);
      if (result.sheetNames.length > 0) {
        setSelectedSheet(result.sheetNames[0]);
      }
      // Auto-detect phone and name column
      const lowerHeaders = result.headers.map(h => ({ raw: h, lower: h.toLowerCase() }));
      const phoneMatch = lowerHeaders.find(h => /phone|mobile|number|contact|tel|msisdn/i.test(h.lower));
      const nameMatch = lowerHeaders.find(h => /name|full_name|customer|client|recipient/i.test(h.lower));

      if (phoneMatch) setPhoneColumn(phoneMatch.raw);
      else if (result.headers.length > 0) setPhoneColumn(result.headers[0]);

      if (nameMatch) setNameColumn(nameMatch.raw);
    } catch (err) {
      showErrorToast('Failed to parse spreadsheet file', err instanceof Error ? err.message : undefined);
      setParsedWorkbook(null);
    } finally {
      setParsingSpreadsheet(false);
    }
  };

  // Switch Sheet
  const handleSheetChange = async (sheetName: string) => {
    if (!spreadsheetFile) return;
    setSelectedSheet(sheetName);
    setParsingSpreadsheet(true);
    try {
      const result = await parseSpreadsheetFile(spreadsheetFile, sheetName);
      setParsedWorkbook(result);
    } catch (err) {
      showErrorToast('Failed to switch sheet', err instanceof Error ? err.message : undefined);
    } finally {
      setParsingSpreadsheet(false);
    }
  };

  // Insert Variable at Textarea cursor
  const handleInsertVariable = (varKey: string) => {
    const textarea = textareaRef.current;
    const tag = `{{${varKey}}}`;
    if (!textarea) {
      setMessageBody(prev => prev + tag);
      return;
    }
    const start = textarea.selectionStart ?? messageBody.length;
    const end = textarea.selectionEnd ?? messageBody.length;
    const next = messageBody.slice(0, start) + tag + messageBody.slice(end);
    setMessageBody(next);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  // Select a Template
  const handleSelectTemplate = (templateId: string) => {
    const found = templates.find(t => t.id === templateId);
    if (!found) return;
    const combined = [found.header, found.body, found.footer].filter(Boolean).join('\n\n');
    setMessageBody(combined);
  };

  // Handle Media File Selection
  const handleMediaFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      const mimetype = file.type || 'application/octet-stream';
      setMediaFile({
        file,
        base64,
        mimetype,
        filename: file.name,
        previewUrl: file.type.startsWith('image/') ? result : undefined,
      });
    };
    reader.readAsDataURL(file);
  };

  // Batch Verify numbers on WhatsApp
  const handleVerifyOnWhatsApp = async () => {
    if (!selectedSessionId || validationSummary.uniqueRecipients.length === 0) return;
    setVerifyingWhatsApp(true);
    setVerificationDone(false);
    const exists = new Set<string>();
    const missing = new Set<string>();

    const queue = [...validationSummary.uniqueRecipients];
    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) return;
        try {
          const res = await contactApi.checkNumber(selectedSessionId, item.digits);
          if (res.exists) exists.add(item.digits);
          else missing.add(item.digits);
        } catch {
          missing.add(item.digits);
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(5, queue.length) }, worker));
      setVerifiedSet(exists);
      setMissingSet(missing);
      setVerificationDone(true);
      showSuccessToast(`Verification complete: ${exists.size} numbers found on WhatsApp`);
    } catch (err) {
      showErrorToast('Number verification encountered an error', err instanceof Error ? err.message : undefined);
    } finally {
      setVerifyingWhatsApp(false);
    }
  };

  // Generate resolved message for preview
  const resolvedPreviewText = useMemo(() => {
    if (sendableRecipients.length === 0) {
      return messageBody || 'Type a message to see the live preview...';
    }
    const currentRecipient = sendableRecipients[Math.min(previewIndex, sendableRecipients.length - 1)];
    let text = messageBody;
    availableVariables.forEach(vKey => {
      const val = currentRecipient.variables[vKey] || `{{${vKey}}}`;
      text = text.replaceAll(`{{${vKey}}}`, val);
    });
    return text;
  }, [messageBody, sendableRecipients, previewIndex, availableVariables]);

  // Execute Launch Campaign
  const handleLaunchCampaign = async () => {
    if (!selectedSessionId || !campaignName.trim() || sendableRecipients.length === 0) return;
    setIsLaunching(true);
    setShowConfirmModal(false);

    try {
      const items = sendableRecipients.map(r => {
        let content: any = {};
        if (messageType === 'text') {
          content = { text: messageBody.trim() };
        } else if (mediaFile) {
          content = {
            [messageType]: {
              base64: mediaFile.base64,
              mimetype: mediaFile.mimetype,
              filename: mediaFile.filename,
            },
            caption: messageBody.trim() || undefined,
          };
        }

        return {
          chatId: r.chatId,
          type: messageType,
          content,
          variables: r.variables,
        };
      });

      const payload = {
        campaignName: campaignName.trim(),
        messages: items,
        options: {
          delayBetweenMessages: Math.max(1, delaySeconds) * 1000,
          randomizeDelay,
          stopOnError,
        },
      };

      const result = await messageApi.sendBulk(selectedSessionId, payload);
      showSuccessToast(`Campaign "${campaignName.trim()}" started successfully with ${items.length} recipients.`);
      onCampaignLaunched(result.batchId);
    } catch (err) {
      showErrorToast('Failed to start campaign', err instanceof Error ? err.message : undefined);
    } finally {
      setIsLaunching(false);
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="builder-no-session-card">
        <Smartphone size={40} className="text-muted" />
        <h3>No WhatsApp Account Connected</h3>
        <p>You must connect a WhatsApp account before you can compose and dispatch broadcast campaigns.</p>
        <button type="button" className="btn-primary" onClick={() => navigate('/sessions')}>
          <Plus size={16} /> Go to WhatsApp Accounts
        </button>
      </div>
    );
  }

  return (
    <div className="campaign-builder-container">
      {/* Wizard Steps Indicator */}
      <div className="builder-steps-indicator">
        <div
          className={`step-bubble ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`}
          onClick={() => setCurrentStep(1)}
        >
          <span className="step-num">{currentStep > 1 ? <Check size={14} /> : '1'}</span>
          <span className="step-label">1. Setup & Audience</span>
        </div>
        <div className="step-line" />
        <div
          className={`step-bubble ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`}
          onClick={() => {
            if (sendableRecipients.length > 0) setCurrentStep(2);
          }}
        >
          <span className="step-num">{currentStep > 2 ? <Check size={14} /> : '2'}</span>
          <span className="step-label">2. Message & Media</span>
        </div>
        <div className="step-line" />
        <div
          className={`step-bubble ${currentStep === 3 ? 'active' : ''}`}
          onClick={() => {
            if (sendableRecipients.length > 0 && (messageBody || mediaFile)) setCurrentStep(3);
          }}
        >
          <span className="step-num">3</span>
          <span className="step-label">3. Review & Launch</span>
        </div>
      </div>

      {/* STEP 1: Setup & Audience */}
      {currentStep === 1 && (
        <div className="builder-step-content">
          <div className="builder-card">
            <h3 className="card-title">Campaign Configuration</h3>
            <div className="builder-grid-two">
              <div className="form-group">
                <label className="form-label">Campaign Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. August Client Announcement"
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  maxLength={120}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Sending WhatsApp Account *</label>
                <select
                  className="form-select"
                  value={selectedSessionId}
                  onChange={e => {
                    onSelectSession(e.target.value);
                    if (sourceMode === 'contacts') handleLoadContacts(e.target.value);
                    handleLoadTemplates(e.target.value);
                  }}
                >
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.phone ? `+${s.phone}` : 'Active'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Campaign Category</label>
                <select
                  className="form-select"
                  value={campaignCategory}
                  onChange={e => setCampaignCategory(e.target.value)}
                >
                  <option value="General">General Broadcast</option>
                  <option value="Marketing">Marketing & Promotion</option>
                  <option value="Announcement">Product Announcement</option>
                  <option value="Customer Support">Customer Support Notice</option>
                  <option value="Follow-up">Lead Follow-up</option>
                </select>
              </div>
            </div>
          </div>

          {/* Audience Source Selector */}
          <div className="builder-card">
            <h3 className="card-title">Recipient Audience</h3>
            <div className="source-tabs">
              <button
                type="button"
                className={`source-tab ${sourceMode === 'manual' ? 'active' : ''}`}
                onClick={() => setSourceMode('manual')}
              >
                Manual Paste
              </button>
              <button
                type="button"
                className={`source-tab ${sourceMode === 'spreadsheet' ? 'active' : ''}`}
                onClick={() => setSourceMode('spreadsheet')}
              >
                <FileSpreadsheet size={15} /> Excel / CSV Upload
              </button>
              <button
                type="button"
                className={`source-tab ${sourceMode === 'contacts' ? 'active' : ''}`}
                onClick={() => {
                  setSourceMode('contacts');
                  if (contacts.length === 0 && selectedSessionId) handleLoadContacts(selectedSessionId);
                }}
              >
                <Users size={15} /> Saved Contacts
              </button>
            </div>

            {/* Manual Paste */}
            {sourceMode === 'manual' && (
              <div className="source-body">
                <label className="form-label">
                  Paste Phone Numbers <span className="muted">(newline, comma, or semicolon separated)</span>
                </label>
                <textarea
                  className="form-textarea mono"
                  rows={6}
                  placeholder={'919876543210\n919123456789\n447123456789'}
                  value={manualText}
                  onChange={e => {
                    setManualText(e.target.value);
                    setVerificationDone(false);
                  }}
                />
              </div>
            )}

            {/* CSV / Excel File */}
            {sourceMode === 'spreadsheet' && (
              <div className="source-body">
                <div className="file-drop-zone">
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    id="spreadsheet-input"
                    style={{ display: 'none' }}
                    onChange={handleSpreadsheetFileChange}
                  />
                  <label htmlFor="spreadsheet-input" className="file-drop-label">
                    <Upload size={28} className="upload-icon" />
                    <span className="upload-text">
                      {spreadsheetFile ? spreadsheetFile.name : 'Click or Drag & Drop .xlsx, .xls, or .csv file'}
                    </span>
                    <span className="upload-subtext">Local client-side parsing. Your spreadsheet data is never shared.</span>
                  </label>
                </div>

                {parsingSpreadsheet && (
                  <div className="loading-inline">
                    <Loader2 size={16} className="animate-spin" /> Parsing workbook...
                  </div>
                )}

                {parsedWorkbook && (
                  <div className="workbook-mapping-box">
                    {parsedWorkbook.sheetNames.length > 1 && (
                      <div className="form-group">
                        <label className="form-label">Select Sheet</label>
                        <select
                          className="form-select"
                          value={selectedSheet}
                          onChange={e => handleSheetChange(e.target.value)}
                        >
                          {parsedWorkbook.sheetNames.map(sName => (
                            <option key={sName} value={sName}>
                              {sName}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="mapping-grid">
                      <div className="form-group">
                        <label className="form-label">Phone Number Column *</label>
                        <select
                          className="form-select"
                          value={phoneColumn}
                          onChange={e => {
                            setPhoneColumn(e.target.value);
                            setVerificationDone(false);
                          }}
                        >
                          <option value="">Select phone column...</option>
                          {parsedWorkbook.headers.map(h => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Recipient Name Column (Optional)</label>
                        <select
                          className="form-select"
                          value={nameColumn}
                          onChange={e => setNameColumn(e.target.value)}
                        >
                          <option value="">None (skip name)</option>
                          {parsedWorkbook.headers.map(h => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Saved Contacts */}
            {sourceMode === 'contacts' && (
              <div className="source-body">
                {loadingContacts ? (
                  <div className="loading-inline">
                    <Loader2 size={18} className="animate-spin" /> Loading contacts from WhatsApp...
                  </div>
                ) : contacts.length === 0 ? (
                  <p className="muted">No contacts found on this WhatsApp account.</p>
                ) : (
                  <div className="contacts-selection-list">
                    <div className="contacts-selection-header">
                      <span>
                        {selectedContactIds.size} of {contacts.length} contacts selected
                      </span>
                      <button
                        type="button"
                        className="btn-text"
                        onClick={() => {
                          if (selectedContactIds.size === contacts.length) setSelectedContactIds(new Set());
                          else setSelectedContactIds(new Set(contacts.map(c => c.id)));
                        }}
                      >
                        {selectedContactIds.size === contacts.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="contacts-scroll-area">
                      {contacts.map(c => (
                        <label key={c.id} className="contact-check-row">
                          <input
                            type="checkbox"
                            checked={selectedContactIds.has(c.id)}
                            onChange={e => {
                              const next = new Set(selectedContactIds);
                              if (e.target.checked) next.add(c.id);
                              else next.delete(c.id);
                              setSelectedContactIds(next);
                            }}
                          />
                          <span className="contact-name">{c.name || c.pushName || 'Unnamed'}</span>
                          <span className="contact-number mono">+{c.number || c.id.split('@')[0]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Validation Metrics Banner */}
            <div className="validation-metrics-bar">
              <div className="val-stat-box">
                <span className="val-label">Total Imported</span>
                <span className="val-number">{validationSummary.totalImported}</span>
              </div>
              <div className="val-stat-box ok">
                <span className="val-label">Valid Format</span>
                <span className="val-number ok">{validationSummary.validFormatCount}</span>
              </div>
              <div className="val-stat-box bad">
                <span className="val-label">Invalid</span>
                <span className="val-number bad">{validationSummary.invalidFormatCount}</span>
              </div>
              <div className="val-stat-box warn">
                <span className="val-label">Duplicates</span>
                <span className="val-number warn">{validationSummary.duplicateCount}</span>
              </div>
              {verificationDone && (
                <>
                  <div className="val-stat-box verified">
                    <span className="val-label">On WhatsApp</span>
                    <span className="val-number ok">{verifiedSet.size}</span>
                  </div>
                  {missingSet.size > 0 && (
                    <div className="val-stat-box bad">
                      <span className="val-label">Not on WhatsApp</span>
                      <span className="val-number bad">{missingSet.size}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Verification & Table Tabs */}
            {validationSummary.totalImported > 0 && (
              <div className="validation-breakdown-section">
                <div className="val-table-header">
                  <div className="val-tabs">
                    <button
                      type="button"
                      className={`val-tab ${activeValidationTab === 'valid' ? 'active' : ''}`}
                      onClick={() => setActiveValidationTab('valid')}
                    >
                      Valid ({validationSummary.validFormatCount})
                    </button>
                    {validationSummary.invalidFormatCount > 0 && (
                      <button
                        type="button"
                        className={`val-tab ${activeValidationTab === 'invalid' ? 'active' : ''}`}
                        onClick={() => setActiveValidationTab('invalid')}
                      >
                        Invalid ({validationSummary.invalidFormatCount})
                      </button>
                    )}
                    {validationSummary.duplicateCount > 0 && (
                      <button
                        type="button"
                        className={`val-tab ${activeValidationTab === 'duplicates' ? 'active' : ''}`}
                        onClick={() => setActiveValidationTab('duplicates')}
                      >
                        Duplicates ({validationSummary.duplicateCount})
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn-secondary verify-btn"
                    onClick={handleVerifyOnWhatsApp}
                    disabled={verifyingWhatsApp || validationSummary.validFormatCount === 0}
                  >
                    {verifyingWhatsApp ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Verifying on WhatsApp...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={14} /> Verify Numbers on WhatsApp
                      </>
                    )}
                  </button>
                </div>

                {/* Recipient list table */}
                <div className="val-table-scroll">
                  <table className="val-table">
                    <thead>
                      <tr>
                        <th>Recipient</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Variables Detected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeValidationTab === 'valid'
                        ? validationSummary.uniqueRecipients
                        : activeValidationTab === 'invalid'
                        ? validationSummary.invalidRecipients
                        : validationSummary.duplicateRecipients
                      )
                        .slice(0, 50)
                        .map((r, i) => (
                          <tr key={`${r.digits}-${i}`}>
                            <td className="mono">+{r.digits || r.raw}</td>
                            <td>{r.name || '—'}</td>
                            <td>
                              {r.validFormat && !r.duplicate && (
                                <span className="val-badge ok">
                                  <CheckCircle2 size={12} /> Valid
                                </span>
                              )}
                              {!r.validFormat && (
                                <span className="val-badge bad">
                                  <XCircle size={12} /> Invalid Format
                                </span>
                              )}
                              {r.duplicate && (
                                <span className="val-badge warn">
                                  <AlertTriangle size={12} /> Duplicate Dropped
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="vars-chip-list">
                                {Object.entries(r.variables).map(([k, v]) => (
                                  <span key={k} className="var-mini-chip">
                                    {k}: <em>{v}</em>
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="builder-step-footer">
            <div />
            <button
              type="button"
              className="btn-primary next-step-btn"
              onClick={() => setCurrentStep(2)}
              disabled={!campaignName.trim() || sendableRecipients.length === 0}
            >
              Continue to Message <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Message, Media & Personalization */}
      {currentStep === 2 && (
        <div className="builder-step-content">
          <div className="builder-two-column-layout">
            {/* Left: Composer */}
            <div className="composer-column">
              <div className="builder-card">
                <div className="card-header-with-action">
                  <h3 className="card-title">Message Composer</h3>
                  {(templates.length > 0 || loadingTemplates) && (
                    <select
                      className="template-select-inline"
                      onChange={e => handleSelectTemplate(e.target.value)}
                      disabled={loadingTemplates}
                    >
                      <option value="">{loadingTemplates ? 'Loading templates...' : 'Insert Saved Template...'}</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Message Type Tabs */}
                <div className="message-type-pills">
                  <button
                    type="button"
                    className={`type-pill ${messageType === 'text' ? 'active' : ''}`}
                    onClick={() => {
                      setMessageType('text');
                      setMediaFile(null);
                    }}
                  >
                    Plain Text
                  </button>
                  <button
                    type="button"
                    className={`type-pill ${messageType === 'image' ? 'active' : ''}`}
                    onClick={() => setMessageType('image')}
                  >
                    <Image size={14} /> Image
                  </button>
                  <button
                    type="button"
                    className={`type-pill ${messageType === 'video' ? 'active' : ''}`}
                    onClick={() => setMessageType('video')}
                  >
                    <Video size={14} /> Video
                  </button>
                  <button
                    type="button"
                    className={`type-pill ${messageType === 'document' ? 'active' : ''}`}
                    onClick={() => setMessageType('document')}
                  >
                    <FileText size={14} /> Document / PDF
                  </button>
                  <button
                    type="button"
                    className={`type-pill ${messageType === 'audio' ? 'active' : ''}`}
                    onClick={() => setMessageType('audio')}
                  >
                    <Music size={14} /> Audio
                  </button>
                </div>

                {/* Media Attachment Upload Box */}
                {messageType !== 'text' && (
                  <div className="media-attachment-box">
                    <input
                      type="file"
                      id="campaign-media-input"
                      style={{ display: 'none' }}
                      accept={
                        messageType === 'image'
                          ? 'image/*'
                          : messageType === 'video'
                          ? 'video/*'
                          : messageType === 'audio'
                          ? 'audio/*'
                          : '*/*'
                      }
                      onChange={handleMediaFileChange}
                    />

                    {mediaFile ? (
                      <div className="media-staged-banner">
                        {mediaFile.previewUrl ? (
                          <img src={mediaFile.previewUrl} alt="" className="media-thumb" />
                        ) : (
                          <div className="media-file-icon">
                            <FileText size={24} />
                          </div>
                        )}
                        <div className="media-info">
                          <span className="media-filename">{mediaFile.filename}</span>
                          <span className="media-filesize">
                            {(mediaFile.file.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn-remove-media"
                          onClick={() => setMediaFile(null)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <label htmlFor="campaign-media-input" className="media-picker-label">
                        <Upload size={20} />
                        <span>Upload {messageType.toUpperCase()} file</span>
                      </label>
                    )}
                  </div>
                )}

                {/* Variable insertion toolbar */}
                <div className="variables-toolbar">
                  <span className="vars-label">
                    <Sparkles size={13} /> Personalization Variables:
                  </span>
                  <div className="variable-chips">
                    {availableVariables.map(vKey => (
                      <button
                        key={vKey}
                        type="button"
                        className="var-insert-chip"
                        onClick={() => handleInsertVariable(vKey)}
                        title={`Click to insert {{${vKey}}}`}
                      >
                        +{vKey}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message Textarea */}
                <div className="composer-textarea-wrap">
                  <textarea
                    ref={textareaRef}
                    className="message-composer-textarea"
                    rows={8}
                    placeholder={
                      messageType !== 'text'
                        ? 'Write a caption for your media...'
                        : 'Hi {{name}}, we are pleased to announce our latest updates...'
                    }
                    value={messageBody}
                    onChange={e => setMessageBody(e.target.value)}
                  />
                  <div className="composer-char-count">
                    <span>{messageBody.length} characters</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Live Preview */}
            <div className="preview-column">
              <div className="builder-card live-preview-card">
                <div className="preview-card-header">
                  <h3 className="card-title">Live Message Preview</h3>
                  {sendableRecipients.length > 1 && (
                    <div className="preview-pager">
                      <button
                        type="button"
                        className="pager-arrow"
                        disabled={previewIndex <= 0}
                        onClick={() => setPreviewIndex(prev => Math.max(0, prev - 1))}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="pager-text">
                        {previewIndex + 1} of {sendableRecipients.length}
                      </span>
                      <button
                        type="button"
                        className="pager-arrow"
                        disabled={previewIndex >= sendableRecipients.length - 1}
                        onClick={() => setPreviewIndex(prev => Math.min(sendableRecipients.length - 1, prev + 1))}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Smartphone Preview Mockup */}
                <div className="smartphone-preview-frame">
                  <div className="preview-chat-stream">
                    <div className="preview-bubble outgoing">
                      {mediaFile && (
                        <div className="bubble-media-preview">
                          {mediaFile.previewUrl ? (
                            <img src={mediaFile.previewUrl} alt="" className="preview-img" />
                          ) : (
                            <div className="preview-doc-box">
                              <FileText size={20} />
                              <span>{mediaFile.filename}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <p className="preview-bubble-text">{resolvedPreviewText}</p>
                      <span className="preview-timestamp">12:00 PM</span>
                    </div>
                  </div>
                </div>

                {sendableRecipients.length > 0 && (
                  <div className="preview-recipient-info">
                    <span>
                      Previewing for: <strong>+{sendableRecipients[previewIndex]?.digits}</strong> (
                      {sendableRecipients[previewIndex]?.name || 'No name'})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="builder-step-footer">
            <button type="button" className="btn-secondary" onClick={() => setCurrentStep(1)}>
              <ChevronLeft size={16} /> Back to Audience
            </button>
            <button
              type="button"
              className="btn-primary next-step-btn"
              onClick={() => setCurrentStep(3)}
              disabled={!messageBody.trim() && !mediaFile}
            >
              Continue to Review <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Delivery Pacing, Review & Launch */}
      {currentStep === 3 && (
        <div className="builder-step-content">
          <div className="builder-card">
            <h3 className="card-title">Operational Rate & Delivery Pacing</h3>
            <div className="builder-grid-two">
              <div className="form-group">
                <label className="form-label">Delay Between Messages</label>
                <select
                  className="form-select"
                  value={delaySeconds}
                  onChange={e => setDelaySeconds(Number(e.target.value))}
                >
                  <option value={2}>2 seconds (Fast)</option>
                  <option value={3}>3 seconds (Standard)</option>
                  <option value={5}>5 seconds (Safe)</option>
                  <option value={8}>8 seconds (Conservative)</option>
                  <option value={12}>12 seconds (High Caution)</option>
                </select>
              </div>

              <div className="form-group checkboxes-group">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={randomizeDelay}
                    onChange={e => setRandomizeDelay(e.target.checked)}
                  />
                  <span>Add randomized pacing jitter (±1–2s natural pacing)</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={stopOnError}
                    onChange={e => setStopOnError(e.target.checked)}
                  />
                  <span>Stop entire campaign if a recipient fails</span>
                </label>
              </div>
            </div>
          </div>

          {/* Executive Review Card */}
          <div className="builder-card review-audit-card">
            <h3 className="card-title">Campaign Executive Summary</h3>
            <div className="review-details-grid">
              <div className="review-item">
                <span className="review-label">Campaign Name</span>
                <span className="review-value">{campaignName}</span>
              </div>
              <div className="review-item">
                <span className="review-label">Target WhatsApp Account</span>
                <span className="review-value">
                  {sessions.find(s => s.id === selectedSessionId)?.name} (+
                  {sessions.find(s => s.id === selectedSessionId)?.phone || 'Active'})
                </span>
              </div>
              <div className="review-item">
                <span className="review-label">Final Recipients</span>
                <span className="review-value highlight">{sendableRecipients.length.toLocaleString()}</span>
              </div>
              <div className="review-item">
                <span className="review-label">Message Format</span>
                <span className="review-value">
                  {messageType.toUpperCase()} {mediaFile ? `(${mediaFile.filename})` : ''}
                </span>
              </div>
              <div className="review-item">
                <span className="review-label">Estimated Duration</span>
                <span className="review-value">
                  ~{Math.ceil((sendableRecipients.length * delaySeconds) / 60)} minutes
                </span>
              </div>
              <div className="review-item">
                <span className="review-label">Pacing Setting</span>
                <span className="review-value">{delaySeconds}s delay {randomizeDelay ? '(with jitter)' : ''}</span>
              </div>
            </div>

            {/* Safety Warning */}
            <div className="safety-warning-banner">
              <AlertTriangle size={18} className="warn-icon" />
              <div>
                <strong>Operational Broadcast Advisory</strong>
                <p>
                  WhatsApp messages will be dispatched sequentially using your connected WhatsApp Web account. Ensure
                  your recipient list has given prior consent for business messaging.
                </p>
              </div>
            </div>
          </div>

          <div className="builder-step-footer">
            <button type="button" className="btn-secondary" onClick={() => setCurrentStep(2)}>
              <ChevronLeft size={16} /> Back to Message
            </button>
            <button
              type="button"
              className="btn-primary launch-campaign-btn"
              onClick={() => setShowConfirmModal(true)}
              disabled={isLaunching || sendableRecipients.length === 0}
            >
              <Send size={16} /> Launch Campaign
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="confirm-modal-backdrop" onMouseDown={() => setShowConfirmModal(false)}>
          <div className="confirm-modal-dialog" onMouseDown={e => e.stopPropagation()}>
            <div className="confirm-modal-header">
              <h3>Confirm Campaign Launch</h3>
            </div>
            <div className="confirm-modal-body">
              <p>
                You are about to start broadcasting <strong>"{campaignName}"</strong> to{' '}
                <strong>{sendableRecipients.length} recipients</strong>.
              </p>
              <p className="muted">
                Messages will be queued and sent in the background. You can monitor live progress and cancel at any
                time.
              </p>
            </div>
            <div className="confirm-modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowConfirmModal(false)}
                disabled={isLaunching}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleLaunchCampaign}
                disabled={isLaunching}
              >
                {isLaunching ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Starting...
                  </>
                ) : (
                  'Yes, Start Campaign'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
