import { useEffect, useRef, useState, type Dispatch, type SetStateAction, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Paperclip, Send, Smile, X, Image, FileText, Music, Video } from 'lucide-react';
import { messageApi, type Chat, type MessageType } from '../../services/api';
import { promoteChatWithSnippet } from '../../utils/chatList';
import { useChatMessagesActions } from '../../hooks/useChatMessages';
import { useRole } from '../../hooks/useRole';
import { useToast } from '../../hooks/useToast';
import type { ScrollDirection } from '../../utils/scrollDecision';

const messageTypeFromMime = (mimetype: string): MessageType => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'document';
};

export interface StagedAttachment {
  file: File;
  base64: string;
  mimetype: string;
  filename: string;
}

interface ChatComposerProps {
  selectedSessionId: string;
  activeChat: Chat;
  replyingTo: any | null;
  setReplyingTo: Dispatch<SetStateAction<any | null>>;
  onMessageAppended: (direction: ScrollDirection) => void;
  setChats: Dispatch<SetStateAction<Chat[]>>;
  messageInput: string;
  setMessageInput: Dispatch<SetStateAction<string>>;
  attachment: StagedAttachment | null;
  setAttachment: Dispatch<SetStateAction<StagedAttachment | null>>;
  previewUrl: string | null;
  setPreviewUrl: Dispatch<SetStateAction<string | null>>;
}

const POPULAR_EMOJIS = [
  '👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '🎉', '😊',
  '✅', '🤝', '💯', '✨', '👋', '🚀', '😍', '🤔', '🙌', '⭐',
  '😎', '🥳', '💪', '👌', '💬', '📞', '📍', '💡', '⏰', '📌',
];

function ChatComposer({
  selectedSessionId,
  activeChat,
  replyingTo,
  setReplyingTo,
  onMessageAppended,
  setChats,
  messageInput,
  setMessageInput,
  attachment,
  setAttachment,
  previewUrl,
  setPreviewUrl,
}: ChatComposerProps) {
  const { t } = useTranslation();
  const { canWrite } = useRole();
  const { error: showErrorToast } = useToast();
  const { appendMessage, updateMessage } = useChatMessagesActions();

  const [sending, setSending] = useState<boolean>(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [showAttachMenu, setShowAttachMenu] = useState<boolean>(false);

  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);
  const attachButtonRef = useRef<HTMLButtonElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileAcceptFilter, setFileAcceptFilter] = useState<string>('*/*');
  const attachmentReadSeq = useRef(0);

  useEffect(() => {
    return () => {
      attachmentReadSeq.current += 1;
    };
  }, [activeChat.id]);

  // Handle outside clicks and Esc key for popovers
  useEffect(() => {
    if (!showEmojiPicker && !showAttachMenu) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        showEmojiPicker &&
        !emojiPickerRef.current?.contains(target) &&
        !emojiButtonRef.current?.contains(target)
      ) {
        setShowEmojiPicker(false);
      }
      if (
        showAttachMenu &&
        !attachMenuRef.current?.contains(target) &&
        !attachButtonRef.current?.contains(target)
      ) {
        setShowAttachMenu(false);
      }
    };

    const onKeyDown = (event: KeyboardEventInit) => {
      if (event.key === 'Escape') {
        setShowEmojiPicker(false);
        setShowAttachMenu(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showEmojiPicker, showAttachMenu]);

  // Insert emoji at current cursor position in textarea
  const handleEmojiClick = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessageInput(prev => prev + emoji);
      return;
    }

    const start = textarea.selectionStart ?? messageInput.length;
    const end = textarea.selectionEnd ?? messageInput.length;
    const nextText = messageInput.slice(0, start) + emoji + messageInput.slice(end);
    setMessageInput(nextText);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + emoji.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleOpenAttachType = (accept: string) => {
    setFileAcceptFilter(accept);
    setShowAttachMenu(false);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset native input so selecting the same file again triggers change
    e.target.value = '';

    const seq = ++attachmentReadSeq.current;
    const reader = new FileReader();

    reader.onload = () => {
      if (seq !== attachmentReadSeq.current) return;
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      const mimetype = file.type || 'application/octet-stream';

      setAttachment({
        file,
        base64,
        mimetype,
        filename: file.name,
      });

      if (file.type.startsWith('image/')) {
        setPreviewUrl(result);
      } else {
        setPreviewUrl(null);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    setPreviewUrl(null);
    attachmentReadSeq.current += 1;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleSend = async () => {
    const trimmedInput = messageInput.trim();
    if (!canWrite || sending || (!trimmedInput && !attachment)) return;

    const currentAttachment = attachment;
    const currentInput = messageInput;
    const currentReplying = replyingTo;

    // Clear input optimistically for snappy responsiveness
    setMessageInput('');
    setAttachment(null);
    setPreviewUrl(null);
    setReplyingTo(null);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);

    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const nowSec = Math.floor(Date.now() / 1000);

    let tempType: MessageType = 'text';
    if (currentAttachment) {
      tempType = messageTypeFromMime(currentAttachment.mimetype);
    }

    appendMessage(selectedSessionId, activeChat.id, {
      id: tempId,
      waMessageId: tempId,
      chatId: activeChat.id,
      from: 'me',
      to: activeChat.id,
      body: trimmedInput || (currentAttachment ? currentAttachment.filename : ''),
      type: tempType,
      timestamp: nowSec,
      createdAt: new Date().toISOString(),
      direction: 'outgoing',
      status: 'pending',
      metadata: {
        media: currentAttachment
          ? {
              data: previewUrl || undefined,
              mimetype: currentAttachment.mimetype,
              filename: currentAttachment.filename,
            }
          : undefined,
        quotedMessage: currentReplying
          ? {
              id: currentReplying.id,
              body: currentReplying.body,
            }
          : undefined,
      },
    });

    onMessageAppended('outgoing');

    try {
      let result;
      if (currentAttachment) {
        result = await messageApi.sendMedia(
          selectedSessionId,
          activeChat.id,
          tempType === 'document' ? 'document' : (tempType as 'image' | 'video' | 'audio'),
          {
            base64: currentAttachment.base64,
            mimetype: currentAttachment.mimetype,
            filename: currentAttachment.filename,
            caption: trimmedInput || undefined,
          },
        );
      } else if (currentReplying) {
        result = await messageApi.reply(selectedSessionId, {
          chatId: activeChat.id,
          quotedMessageId: currentReplying.id,
          text: trimmedInput,
        });
      } else {
        result = await messageApi.sendText(selectedSessionId, activeChat.id, trimmedInput);
      }

      updateMessage(selectedSessionId, activeChat.id, tempId, {
        id: result.messageId || tempId,
        status: 'sent',
      });

      const snippet = trimmedInput || (currentAttachment ? currentAttachment.filename : '');
      const sentAt = result.timestamp || nowSec;
      setChats(prevChats => promoteChatWithSnippet(prevChats, activeChat.id, snippet, sentAt));
    } catch (err) {
      showErrorToast(t('chats.errors.send', { defaultValue: 'Failed to send message' }), err instanceof Error ? err.message : undefined);
      updateMessage(selectedSessionId, activeChat.id, tempId, { status: 'failed' });
      // Restore input text on error so user doesn't lose their draft
      setMessageInput(currentInput);
      if (currentAttachment) setAttachment(currentAttachment);
    } finally {
      setSending(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  return (
    <div className="composer-root-container">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept={fileAcceptFilter}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Attachment preview banner */}
      {attachment && (
        <div className="attachment-preview-banner">
          {previewUrl ? (
            <img src={previewUrl} alt={attachment.filename} className="preview-thumbnail" />
          ) : (
            <div className="preview-file-icon">
              {attachment.mimetype.startsWith('audio/') ? (
                <Music size={24} />
              ) : attachment.mimetype.startsWith('video/') ? (
                <Video size={24} />
              ) : (
                <FileText size={24} />
              )}
            </div>
          )}
          <div className="preview-file-info">
            <span className="preview-filename">{attachment.filename}</span>
            <span className="preview-filesize">
              ({(attachment.file.size / (1024 * 1024) >= 1
                ? `${(attachment.file.size / (1024 * 1024)).toFixed(2)} MB`
                : `${(attachment.file.size / 1024).toFixed(1)} KB`)})
            </span>
          </div>
          <button
            type="button"
            className="btn-remove-attachment"
            onClick={handleRemoveAttachment}
            title="Remove attachment"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Replying preview banner */}
      {replyingTo && (
        <div className="replying-preview-banner">
          <div className="replying-preview-content">
            <div className="replying-to-title">
              {t('chats.replyingTo', {
                name:
                  replyingTo.direction === 'outgoing' ? t('chats.you', { defaultValue: 'You' }) : activeChat.name || activeChat.id.split('@')[0],
              })}
            </div>
            <div className="replying-to-body">
              {replyingTo.type !== 'text' ? `[${replyingTo.type}]` : replyingTo.body}
            </div>
          </div>
          <button
            type="button"
            className="btn-close-reply"
            onClick={() => setReplyingTo(null)}
            title="Cancel reply"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Attachment options dropdown */}
      {showAttachMenu && (
        <div className="attachment-popover-menu" ref={attachMenuRef} role="menu">
          <button
            type="button"
            className="attach-menu-item"
            onClick={() => handleOpenAttachType('image/*')}
          >
            <Image size={18} className="attach-item-icon img-icon" />
            <span>Photos</span>
          </button>
          <button
            type="button"
            className="attach-menu-item"
            onClick={() => handleOpenAttachType('video/*')}
          >
            <Video size={18} className="attach-item-icon video-icon" />
            <span>Videos</span>
          </button>
          <button
            type="button"
            className="attach-menu-item"
            onClick={() => handleOpenAttachType('*/*')}
          >
            <FileText size={18} className="attach-item-icon doc-icon" />
            <span>Document</span>
          </button>
          <button
            type="button"
            className="attach-menu-item"
            onClick={() => handleOpenAttachType('audio/*')}
          >
            <Music size={18} className="attach-item-icon audio-icon" />
            <span>Audio</span>
          </button>
        </div>
      )}

      {/* Popular emojis panel */}
      {showEmojiPicker && (
        <div className="chats-emoji-picker" ref={emojiPickerRef} role="dialog" aria-label="Emoji Picker">
          <div className="emoji-grid">
            {POPULAR_EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                className="emoji-btn"
                onClick={() => handleEmojiClick(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message input bar */}
      <footer className="room-input-footer">
        <div className="composer-input-row">
          <button
            type="button"
            ref={attachButtonRef}
            onClick={() => setShowAttachMenu(open => !open)}
            disabled={!canWrite || sending}
            className={`btn-input-accessory ${showAttachMenu ? 'active' : ''}`}
            title="Attach file or media"
          >
            <Paperclip size={20} />
          </button>

          <button
            type="button"
            ref={emojiButtonRef}
            onClick={() => setShowEmojiPicker(open => !open)}
            disabled={!canWrite || sending}
            className={`btn-input-accessory ${showEmojiPicker ? 'active' : ''}`}
            title="Insert emoji"
          >
            <Smile size={20} />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            placeholder={
              canWrite
                ? attachment
                  ? t('chats.captionPlaceholder', { defaultValue: 'Add a caption...' })
                  : t('chats.placeholder', { defaultValue: 'Type a message...' })
                : t('chats.noPermission', { defaultValue: 'No permission to send' })
            }
            value={messageInput}
            onChange={e => setMessageInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!canWrite || sending}
            className="message-textarea-input"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!canWrite || (!messageInput.trim() && !attachment) || sending}
            className="btn-send-message"
            aria-label={t('chats.send', { defaultValue: 'Send' })}
            title="Send (Enter, Shift+Enter for newline)"
          >
            {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default ChatComposer;
