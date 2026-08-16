import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { filterChats, filterChannels, groupStatusesByContact, type ChatCategoryFilter } from '../utils/chatFilters';
import { applyIncomingToChatList } from '../utils/chatList';
import { ArrowLeft, Loader2, Megaphone, CircleDashed, AlertCircle, MessageSquare, Info, RefreshCw, Smartphone, Plus } from 'lucide-react';
import { useProfilePicture } from '../hooks/useProfilePicture';
import { useProfilePictures } from '../hooks/useProfilePictures';
import { useResolvedPhone } from '../hooks/useResolvedPhone';
import { formatPhoneForDisplay } from '../utils/formatPhone';
import {
  sessionApi,
  messageApi,
  asMessageType,
  type Session,
  type Chat,
  type ChatKind,
  type Channel,
  type SearchHit,
  type ContactStatusGroup,
} from '../services/api';
import {
  applyMessageEdit,
  findRevokedIndex,
  getMediaSrc,
  type ChatMessageView,
  type MessageMedia,
} from '../utils/chatMessages';
import { useWebSocket } from '../hooks/useWebSocket';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../hooks/useToast';
import { PageHeader } from '../components/PageHeader';
import { GlobalSearch } from '../components/GlobalSearch';
import { useChatMessages, useChatMessagesActions, messagesQueryKey } from '../hooks/useChatMessages';
import { useChannelMessages } from '../hooks/useChannelMessages';
import { useContactStatuses } from '../hooks/useContactStatuses';
import { useChatScrollPosition } from '../hooks/useChatScrollPosition';
import { useCurrentEngineQuery } from '../hooks/queries';
import { createTrailingCoalescer } from '../utils/trailingCoalescer';
import { EmptyState } from '../components/common';
import MessageBody from '../components/chats/MessageBody';
import MediaLightbox, { type LightboxItem } from '../components/chats/MediaLightbox';
import KindIcon from '../components/chats/KindIcon';
import ChatSidebar, { type ChatsTab } from '../components/chats/ChatSidebar';
import ChatThread from '../components/chats/ChatThread';
import ChatComposer, { type StagedAttachment } from '../components/chats/ChatComposer';
import ContactDetailsPanel from '../components/chats/ContactDetailsPanel';
import StatusMedia from '../components/chats/StatusMedia';
import StatusComposeModal from '../components/chats/StatusComposeModal';
import './Chats.css';

const MARK_READ_DEBOUNCE_MS = 750;

interface IncomingWsMessage {
  id: string;
  chatId: string;
  from: string;
  to: string;
  body: string;
  type: string;
  timestamp: number;
  fromMe?: boolean;
  media?: MessageMedia;
  quotedMessage?: { id: string; body: string };
  call?: { video: boolean; missed: boolean };
  metadata?: ChatMessageView['metadata'];
  kind?: ChatKind;
  contact?: { id?: string; name?: string; pushName?: string };
  author?: string;
}

const STATUS_FONT: Record<number, { family?: string; weight?: number }> = {
  1: { family: 'serif' },
  2: { family: 'cursive' },
  3: { family: 'fantasy' },
  4: { family: 'serif' },
  5: { family: 'ui-rounded, system-ui, sans-serif' },
  6: { weight: 700 },
  7: { family: 'cursive' },
  8: { family: 'serif' },
  9: { family: 'sans-serif', weight: 800 },
  10: { family: 'monospace', weight: 700 },
};

const statusFontStyle = (font?: number): { fontFamily?: string; fontWeight?: number } => {
  if (font === undefined) return {};
  const slot = STATUS_FONT[font];
  if (!slot) return {};
  return {
    ...(slot.family ? { fontFamily: slot.family } : {}),
    ...(slot.weight ? { fontWeight: slot.weight } : {}),
  };
};

export function Chats() {
  const { t } = useTranslation();
  useDocumentTitle('GXA Connect — Inbox');
  const { error: showErrorToast, warning: showWarningToast } = useToast();

  // Sessions list & active session
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [loadingSessions, setLoadingSessions] = useState<boolean>(true);

  // Chats list & filters
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<ChatCategoryFilter>('all');

  // Active chat room & details
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeStatusContactId, setActiveStatusContactId] = useState<string | null>(null);
  const [showContactDetails, setShowContactDetails] = useState<boolean>(false);

  // Status creation modal & lightbox
  const [composeOpen, setComposeOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Tab switching: chats, channels, status
  const [activeTab, setActiveTab] = useState<ChatsTab>('chats');
  const switchTab = (tab: ChatsTab) => {
    setActiveTab(tab);
    setActiveChat(null);
    setActiveChannel(null);
    setActiveStatusContactId(null);
  };

  // Composer draft state
  const [messageInput, setMessageInput] = useState<string>('');
  const [attachment, setAttachment] = useState<StagedAttachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessageView | null>(null);

  // Query & message actions
  const queryClient = useQueryClient();
  const { appendMessage, updateMessage, removeMessage } = useChatMessagesActions();

  // Load chat messages
  const {
    data: messages = [],
    isLoading: loadingMessages,
    isError: messagesError,
  } = useChatMessages(selectedSessionId || '', activeChat?.id ?? null);

  // Scroll tracking
  const { containerRef, onMessageAppended, onMediaLoad } = useChatScrollPosition(
    activeChat?.id ?? null,
    !loadingMessages,
  );

  const lastRoomIdRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const currentId = activeChat?.id ?? null;
    if (currentId !== lastRoomIdRef.current) {
      if (lastRoomIdRef.current !== null && currentId !== null && currentId !== lastRoomIdRef.current) {
        setAttachment(null);
        setPreviewUrl(null);
      }
      lastRoomIdRef.current = currentId;
    }
  }, [activeChat?.id]);

  // Profile pictures
  const listPics = useProfilePictures(
    selectedSessionId || undefined,
    useMemo(() => chats.map(c => c.id), [chats]),
  );

  const activePp = useProfilePicture(selectedSessionId || undefined, activeChat?.id);

  // Phone number resolution for @lid
  const activePhoneDisplay = activeChat ? formatPhoneForDisplay(activeChat.id) : null;
  const needsPhoneResolution = Boolean(activeChat && activeChat.kind === 'individual' && !activePhoneDisplay);
  const resolvedPhoneQ = useResolvedPhone(
    needsPhoneResolution ? selectedSessionId || undefined : undefined,
    needsPhoneResolution ? activeChat?.id : undefined,
  );
  const activePhoneText =
    activePhoneDisplay ?? (resolvedPhoneQ.data ? formatPhoneForDisplay(resolvedPhoneQ.data) : null);

  // Engine queries for channels & status
  const currentEngine = useCurrentEngineQuery();
  const channelsSupported = currentEngine.data?.engineType === 'wwebjs';

  const channelsQuery = useQuery({
    queryKey: ['sessions', selectedSessionId, 'channels'],
    queryFn: () => sessionApi.getSubscribedChannels(selectedSessionId),
    enabled: Boolean(selectedSessionId && channelsSupported && activeTab === 'channels'),
    staleTime: 60_000,
  });

  const channelMessages = useChannelMessages(selectedSessionId || null, activeChannel?.id ?? null);
  const channelFeedRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = channelFeedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeChannel?.id, channelMessages.data]);

  const statusesQuery = useContactStatuses(selectedSessionId || null, activeTab === 'status');

  // Load Sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        setLoadingSessions(true);
        const list = await sessionApi.list();
        const readySessions = list.filter(s => s.status === 'ready');
        setSessions(readySessions);
        if (readySessions.length > 0) {
          setSelectedSessionId(readySessions[0].id);
        }
      } catch (err) {
        showErrorToast(t('chats.errors.loadSessions', { defaultValue: 'Failed to load sessions' }), err instanceof Error ? err.message : undefined);
      } finally {
        setLoadingSessions(false);
      }
    };
    void loadSessions();
  }, [t, showErrorToast]);

  // Load Chats for selected session
  const loadChats = useCallback(
    async (sessionId: string) => {
      if (!sessionId) return;
      try {
        setLoadingChats(true);
        const data = await sessionApi.getChats(sessionId);
        const sorted = [...data].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setChats(sorted);
      } catch (err) {
        showErrorToast(t('chats.errors.loadChats', { defaultValue: 'Failed to load chats' }), err instanceof Error ? err.message : undefined);
        setChats([]);
      } finally {
        setLoadingChats(false);
      }
    },
    [t, showErrorToast],
  );

  useEffect(() => {
    if (selectedSessionId) {
      void loadChats(selectedSessionId);
      setActiveChat(null);
      setActiveChannel(null);
      setActiveStatusContactId(null);
      setShowContactDetails(false);
      setAttachment(null);
      setPreviewUrl(null);
      lastRoomIdRef.current = null;
    }
  }, [selectedSessionId, loadChats]);

  // Mark as read coalescing
  const markReadCoalescer = useMemo(
    () =>
      createTrailingCoalescer<string>(chatId => {
        void sessionApi.markChatRead(selectedSessionId, chatId).catch(err => {
          showWarningToast(t('chats.errors.markRead', { defaultValue: 'Failed to mark chat as read' }), err instanceof Error ? err.message : undefined);
        });
      }, MARK_READ_DEBOUNCE_MS),
    [selectedSessionId, t, showWarningToast],
  );

  useEffect(() => () => markReadCoalescer.flush(), [markReadCoalescer]);

  const markChatRead = useCallback(
    (chatId: string) => {
      markReadCoalescer.call(chatId);
    },
    [markReadCoalescer],
  );

  // WebSocket Live Events
  const handleIncomingMessage = useCallback(
    (event: { sessionId: string; message: Record<string, unknown> }) => {
      if (event.sessionId !== selectedSessionId) return;

      const newMsg = event.message as unknown as IncomingWsMessage;

      const mappedMessage: ChatMessageView = {
        id: newMsg.id,
        waMessageId: newMsg.id,
        chatId: newMsg.chatId,
        chatName: newMsg.contact?.pushName ?? newMsg.contact?.name,
        author: newMsg.author,
        from: newMsg.from,
        to: newMsg.to,
        body: newMsg.body,
        type: asMessageType(newMsg.type),
        timestamp: newMsg.timestamp,
        createdAt: new Date((newMsg.timestamp || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        direction: newMsg.fromMe ? 'outgoing' : 'incoming',
        status: newMsg.fromMe ? 'sent' : 'delivered',
        metadata: {
          media: newMsg.media,
          call: newMsg.call,
          quotedMessage: newMsg.quotedMessage,
          ...newMsg.metadata,
        },
      };

      appendMessage(selectedSessionId, newMsg.chatId, mappedMessage);

      const isActive = activeChat?.id === newMsg.chatId;
      setChats(prevChats => {
        const res = applyIncomingToChatList(prevChats, newMsg, {
          activeChatId: activeChat?.id,
          locationLabel: 'Location',
        });
        if (res.needsSidebarRefetch && selectedSessionId) {
          void loadChats(selectedSessionId);
        }
        return res.chats;
      });

      if (isActive && !newMsg.fromMe) {
        markChatRead(newMsg.chatId);
        onMessageAppended('incoming');
      }
    },
    [selectedSessionId, activeChat?.id, appendMessage, markChatRead, onMessageAppended, loadChats],
  );

  const handleMessageRevoked = useCallback(
    (event: { sessionId: string; id: string; chatId: string }) => {
      if (event.sessionId !== selectedSessionId) return;
      const targetChatId = event.chatId || activeChat?.id;
      if (!targetChatId) return;

      const cached = queryClient.getQueryData<ChatMessageView[]>(
        messagesQueryKey(selectedSessionId, targetChatId),
      );
      if (!cached) return;

      const index = findRevokedIndex(cached, { id: event.id });
      if (index === -1) return;

      const target = cached[index];
      updateMessage(selectedSessionId, targetChatId, target.id, {
        body: '',
      });
    },
    [selectedSessionId, activeChat?.id, queryClient, updateMessage],
  );

  const handleMessageEdited = useCallback(
    (event: { sessionId: string; messageId: string; chatId: string; body: string }) => {
      if (event.sessionId !== selectedSessionId) return;
      const targetChatId = event.chatId || activeChat?.id;
      if (!targetChatId) return;

      const cached = queryClient.getQueryData<ChatMessageView[]>(
        messagesQueryKey(selectedSessionId, targetChatId),
      );
      if (!cached) return;

      const updated = applyMessageEdit(cached, { messageId: event.messageId, body: event.body });
      if (updated !== cached) {
        queryClient.setQueryData(messagesQueryKey(selectedSessionId, targetChatId), updated);
      }
    },
    [selectedSessionId, activeChat?.id, queryClient],
  );

  const handleMessageAck = useCallback(
    (event: { sessionId: string; messageId: string; status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' }) => {
      if (event.sessionId !== selectedSessionId) return;
      const targetChatId = activeChat?.id;
      if (!targetChatId) return;

      const cached = queryClient.getQueryData<ChatMessageView[]>(
        messagesQueryKey(selectedSessionId, targetChatId),
      );
      if (!cached) return;

      const target = cached.find(m => m.id === event.messageId || m.waMessageId === event.messageId);
      if (!target) return;

      updateMessage(selectedSessionId, targetChatId, target.id, { status: event.status });
    },
    [selectedSessionId, activeChat?.id, queryClient, updateMessage],
  );

  const [connectionFailed, setConnectionFailed] = useState(false);

  const reconnect = useCallback(() => {
    setConnectionFailed(false);
    if (selectedSessionId) void loadChats(selectedSessionId);
  }, [selectedSessionId, loadChats]);

  useWebSocket({
    onMessage: handleIncomingMessage,
    onMessageRevoked: handleMessageRevoked,
    onMessageEdited: handleMessageEdited,
    onMessageAck: handleMessageAck,
    onServerError: () => setConnectionFailed(true),
  });

  // Reactions & message actions
  const handleReactMessage = useCallback(
    async (message: ChatMessageView, emoji: string) => {
      if (!selectedSessionId || !activeChat) return;
      const targetMessageId = message.waMessageId || message.id;
      try {
        await messageApi.react(selectedSessionId, {
          chatId: activeChat.id,
          messageId: targetMessageId,
          emoji,
        });
      } catch (err) {
        showErrorToast(t('chats.errors.react', { defaultValue: 'Failed to add reaction' }), err instanceof Error ? err.message : undefined);
      }
    },
    [selectedSessionId, activeChat, t, showErrorToast],
  );

  const handleDeleteMessage = useCallback(
    async (message: ChatMessageView) => {
      if (!selectedSessionId || !activeChat) return;
      const targetMessageId = message.waMessageId || message.id;
      try {
        await messageApi.delete(selectedSessionId, {
          chatId: activeChat.id,
          messageId: targetMessageId,
          forEveryone: true,
        });
        removeMessage(selectedSessionId, activeChat.id, message.id);
      } catch (err) {
        showErrorToast(t('chats.errors.delete', { defaultValue: 'Failed to delete message' }), err instanceof Error ? err.message : undefined);
      }
    },
    [selectedSessionId, activeChat, removeMessage, t, showErrorToast],
  );

  const handleSearchHit = useCallback(
    (hit: SearchHit) => {
      if (hit.sessionId && hit.sessionId !== selectedSessionId) {
        setSelectedSessionId(hit.sessionId);
      }
      const existing = chats.find(c => c.id === hit.chatId);
      if (existing) {
        setActiveChat(existing);
      } else {
        setActiveChat({
          id: hit.chatId,
          name: hit.chatId.split('@')[0],
          unreadCount: 0,
          timestamp: hit.timestamp,
          isGroup: hit.chatId.endsWith('@g.us'),
          kind: hit.chatId.endsWith('@g.us') ? 'group' : 'individual',
        });
      }
    },
    [chats, selectedSessionId],
  );

  const formatChatTime = useCallback(
    (timestamp?: number) => {
      if (!timestamp) return '';
      const date = new Date(timestamp * 1000);
      const now = new Date();
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    },
    [],
  );

  // Category counts and filter list
  const unreadCount = useMemo(() => chats.filter(c => (c.unreadCount ?? 0) > 0).length, [chats]);
  const groupsCount = useMemo(() => chats.filter(c => c.isGroup || c.kind === 'group').length, [chats]);
  const directCount = useMemo(() => chats.filter(c => !c.isGroup && c.kind !== 'group').length, [chats]);

  const filteredChats = useMemo(
    () => filterChats(chats, searchQuery, categoryFilter),
    [chats, searchQuery, categoryFilter],
  );

  const filteredChannels = filterChannels(channelsQuery.data ?? [], searchQuery);
  const groupedStatuses: ContactStatusGroup[] = groupStatusesByContact(statusesQuery.data ?? [], searchQuery);

  const activeStatusGroup = activeStatusContactId
    ? (groupedStatuses.find(g => g.contact.id === activeStatusContactId) ?? null)
    : null;

  const statusFeedRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = statusFeedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeStatusGroup?.contact.id, activeStatusGroup?.items]);

  const imageMedia = useMemo<LightboxItem[]>(
    () =>
      messages
        .filter(m => m.type === 'image' && Boolean(getMediaSrc(m.metadata?.media)))
        .map(m => ({
          id: m.id,
          url: getMediaSrc(m.metadata?.media),
          alt: m.body || m.metadata?.media?.filename || '',
          senderName: undefined,
          timestamp: formatChatTime(m.timestamp || Math.floor(new Date(m.createdAt).getTime() / 1000)),
        })),
    [messages, formatChatTime],
  );

  const activeSession = sessions.find(s => s.id === selectedSessionId);

  return (
    <div className="chats-page">
      <PageHeader
        title="Inbox"
        subtitle="Real-time WhatsApp conversations, direct messages, and media delivery."
        actions={sessions.length > 0 && <GlobalSearch currentSessionId={selectedSessionId} onHit={handleSearchHit} />}
      />

      {connectionFailed && (
        <div className="chats-reconnect-banner" role="alert">
          <AlertCircle size={16} />
          <span>{t('common.disconnected', { defaultValue: 'Connection lost' })}</span>
          <button className="btn-secondary" onClick={reconnect}>
            {t('common.refresh', { defaultValue: 'Reconnect' })}
          </button>
        </div>
      )}

      {loadingSessions ? (
        <div className="chats-loading-container">
          <Loader2 className="animate-spin" size={32} />
          <p>{t('common.loading', { defaultValue: 'Loading WhatsApp conversations...' })}</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="chats-no-sessions-container">
          <EmptyState
            icon={Smartphone}
            title="No WhatsApp Accounts Connected"
            description="Link your WhatsApp account to view your inbox, reply to chats, and send media."
            action={
              <a href="/sessions" className="btn-primary">
                <Plus size={16} /> Connect WhatsApp Account
              </a>
            }
          />
        </div>
      ) : (
        <div className={`chats-layout ${activeChat || activeChannel || activeStatusGroup ? 'has-active-chat' : ''}`}>
          {/* LEFT SIDEBAR: session & chat list */}
          <ChatSidebar
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSelectSession={setSelectedSessionId}
            activeTab={activeTab}
            onSwitchTab={switchTab}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            onComposeStatus={() => setComposeOpen(true)}
            formatChatTime={formatChatTime}
            chatsTab={{
              loading: loadingChats,
              chats: filteredChats,
              allChatsCount: chats.length,
              unreadCount,
              groupsCount,
              directCount,
              activeChatId: activeChat?.id,
              pictures: listPics.data,
              onSelectChat: setActiveChat,
            }}
            channelsTab={{
              engineLoading: currentEngine.isLoading,
              supported: channelsSupported,
              query: channelsQuery,
              channels: filteredChannels,
              activeChannelId: activeChannel?.id,
              onSelectChannel: setActiveChannel,
            }}
            statusTab={{
              loading: statusesQuery.isLoading,
              error: statusesQuery.isError,
              groups: groupedStatuses,
              activeContactId: activeStatusContactId,
              onSelectContact: setActiveStatusContactId,
            }}
          />

          {/* CENTER VIEW: active chat room */}
          <main className="chats-room">
            {activeChat ? (
              <div className="room-container">
                {/* Room Header */}
                <header className="room-header">
                  <button className="room-back" onClick={() => setActiveChat(null)} aria-label={t('common.back', { defaultValue: 'Back' })}>
                    <ArrowLeft size={20} />
                  </button>

                  <div className="room-avatar" onClick={() => setShowContactDetails(open => !open)} style={{ cursor: 'pointer' }}>
                    {activePp.data ? (
                      <img src={activePp.data} alt="" onError={() => activePp.refetch()} />
                    ) : (
                      <KindIcon kind={activeChat.kind} />
                    )}
                  </div>

                  <div className="room-contact-info" onClick={() => setShowContactDetails(open => !open)} style={{ cursor: 'pointer' }}>
                    <h3>{activeChat.name || activeChat.id.split('@')[0]}</h3>
                    <span className="room-contact-phone">
                      {activePhoneText ??
                        (activeChat.isGroup ? t('chats.groupSubtitle', { defaultValue: 'Group' }) : t('chats.privateContactSubtitle', { defaultValue: 'Direct Contact' }))}
                    </span>
                  </div>

                  <div className="room-header-actions">
                    <button
                      type="button"
                      className="room-header-action-btn"
                      onClick={() => loadChats(selectedSessionId)}
                      title="Refresh conversation"
                    >
                      <RefreshCw size={17} />
                    </button>

                    <button
                      type="button"
                      className={`room-header-action-btn ${showContactDetails ? 'active' : ''}`}
                      onClick={() => setShowContactDetails(open => !open)}
                      title="Toggle contact details"
                    >
                      <Info size={18} />
                    </button>
                  </div>
                </header>

                {/* Messages Body */}
                <ChatThread
                  activeChat={activeChat}
                  messages={messages}
                  loadingMessages={loadingMessages}
                  messagesError={messagesError}
                  messagesContainerRef={containerRef}
                  onMediaLoad={onMediaLoad}
                  onOpenImage={messageId => {
                    const idx = imageMedia.findIndex(x => x.id === messageId);
                    if (idx >= 0) setLightboxIndex(idx);
                  }}
                  onReply={setReplyingTo}
                  onReact={handleReactMessage}
                  onDelete={handleDeleteMessage}
                />

                {/* Composer */}
                <ChatComposer
                  selectedSessionId={selectedSessionId}
                  activeChat={activeChat}
                  replyingTo={replyingTo}
                  setReplyingTo={setReplyingTo}
                  onMessageAppended={onMessageAppended}
                  setChats={setChats}
                  messageInput={messageInput}
                  setMessageInput={setMessageInput}
                  attachment={attachment}
                  setAttachment={setAttachment}
                  previewUrl={previewUrl}
                  setPreviewUrl={setPreviewUrl}
                />
              </div>
            ) : activeChannel ? (
              <div key={activeChannel.id} className="channel-room">
                <header className="chats-room-header">
                  <button className="room-back" onClick={() => setActiveChannel(null)} aria-label={t('common.back', { defaultValue: 'Back' })}>
                    <ArrowLeft size={20} />
                  </button>
                  <Megaphone size={20} />
                  <h2>{activeChannel.name}</h2>
                </header>
                <div className="messages-list" ref={channelFeedRef}>
                  {channelMessages.isLoading ? (
                    <div className="messages-loading">
                      <Loader2 className="animate-spin" size={32} />
                      <span>{t('chats.loadingMessages', { defaultValue: 'Loading messages...' })}</span>
                    </div>
                  ) : channelMessages.error ? (
                    <div className="messages-empty">
                      <MessageSquare size={32} />
                      <span>{t('chats.loadMessagesError', { defaultValue: 'Unable to load channel messages' })}</span>
                    </div>
                  ) : (channelMessages.data ?? []).length === 0 ? (
                    <div className="messages-empty">
                      <MessageSquare size={32} />
                      <span>{t('chats.noMessagesInChat', { defaultValue: 'No messages in channel' })}</span>
                    </div>
                  ) : (
                    (channelMessages.data ?? []).map(m => (
                      <div key={m.id} className="message-bubble incoming">
                        {m.hasMedia && m.mediaUrl && <img className="channel-media" src={m.mediaUrl} alt="" />}
                        {m.body && <MessageBody text={m.body} className="message-text" />}
                        <span className="message-time">{formatChatTime(m.timestamp)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : activeStatusGroup ? (
              <div key={activeStatusGroup.contact.id} className="channel-room">
                <header className="chats-room-header">
                  <button
                    className="room-back"
                    onClick={() => setActiveStatusContactId(null)}
                    aria-label={t('common.back', { defaultValue: 'Back' })}
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <CircleDashed size={20} />
                  <h2>
                    {activeStatusGroup.contact.name ??
                      activeStatusGroup.contact.pushName ??
                      activeStatusGroup.contact.id}
                  </h2>
                </header>
                <div className="messages-list" ref={statusFeedRef}>
                  {activeStatusGroup.items.map(item => (
                    <div
                      key={item.id}
                      className="message-bubble incoming"
                      style={
                        item.type === 'text' && (item.backgroundColor || item.font)
                          ? {
                              ...(item.backgroundColor ? { backgroundColor: item.backgroundColor, color: '#fff' } : {}),
                              ...statusFontStyle(item.font),
                            }
                          : undefined
                      }
                    >
                      {item.mediaUrl && (
                        <StatusMedia
                          sessionId={selectedSessionId || null}
                          statusId={item.id}
                          type={item.type === 'video' ? 'video' : item.type === 'voice' ? 'audio' : 'image'}
                        />
                      )}
                      {item.caption && <MessageBody text={item.caption} className="message-text" />}
                      <span className="message-time">
                        {formatChatTime(Math.floor(new Date(item.timestamp).getTime() / 1000))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="chats-room-placeholder">
                <MessageSquare size={80} className="placeholder-icon" />
                <h2>Select a Conversation</h2>
                <p>Choose a contact or group from the left panel to view messages, send replies, or share media.</p>
              </div>
            )}
          </main>

          {/* RIGHT VIEW: Collapsible Contact Details */}
          {showContactDetails && activeChat && (
            <ContactDetailsPanel
              chat={activeChat}
              sessionName={activeSession?.name}
              pictureUrl={activePp.data}
              resolvedPhone={activePhoneText}
              onClose={() => setShowContactDetails(false)}
            />
          )}
        </div>
      )}

      <MediaLightbox
        items={imageMedia}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />

      {composeOpen && (
        <StatusComposeModal
          sessionId={selectedSessionId}
          onClose={() => setComposeOpen(false)}
          onPosted={() => statusesQuery.refetch()}
        />
      )}
    </div>
  );
}

export default Chats;
