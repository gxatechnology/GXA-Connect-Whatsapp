import { useTranslation } from 'react-i18next';
import { AlertCircle, CircleDashed, Loader2, Megaphone, Plus, Search, X, Users, User, MessageCircle } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Channel, Chat, ContactStatusGroup, Session } from '../../services/api';
import type { ChatCategoryFilter } from '../../utils/chatFilters';
import ChatAvatar from './ChatAvatar';

export type ChatsTab = 'chats' | 'channels' | 'status';

interface ChatSidebarProps {
  sessions: Session[];
  selectedSessionId: string;
  onSelectSession: (sessionId: string) => void;
  activeTab: ChatsTab;
  onSwitchTab: (tab: ChatsTab) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  categoryFilter: ChatCategoryFilter;
  onCategoryFilterChange: (category: ChatCategoryFilter) => void;
  onComposeStatus: () => void;
  formatChatTime: (timestamp?: number) => string;
  chatsTab: {
    loading: boolean;
    chats: Chat[];
    allChatsCount: number;
    unreadCount: number;
    groupsCount: number;
    directCount: number;
    activeChatId?: string;
    pictures?: Record<string, string | null>;
    onSelectChat: (chat: Chat) => void;
  };
  channelsTab: {
    engineLoading: boolean;
    supported: boolean;
    query: UseQueryResult<Channel[], Error>;
    channels: Channel[];
    activeChannelId?: string;
    onSelectChannel: (channel: Channel) => void;
  };
  statusTab: {
    loading: boolean;
    error: boolean;
    groups: ContactStatusGroup[];
    activeContactId: string | null;
    onSelectContact: (contactId: string) => void;
  };
}

function ChatSidebar({
  sessions,
  selectedSessionId,
  onSelectSession,
  activeTab,
  onSwitchTab,
  searchQuery,
  onSearchQueryChange,
  categoryFilter,
  onCategoryFilterChange,
  onComposeStatus,
  formatChatTime,
  chatsTab,
  channelsTab,
  statusTab,
}: ChatSidebarProps) {
  const { t } = useTranslation();

  const formatLastMessageSnippet = (chat: Chat) => chat.lastMessage || '';

  // Keep full phone number or label readable
  const formatChatIdentifier = (chat: Chat) => {
    const raw = chat.id.split('@')[0];
    if (chat.isGroup || chat.kind === 'group') return t('chats.groupSubtitle', { defaultValue: 'Group' });
    if (chat.id.endsWith('@c.us') && /^\d+$/.test(raw)) return `+${raw}`;
    if (chat.id.endsWith('@lid')) return `LID: ${raw}`;
    return raw;
  };

  const renderChatRow = (chat: Chat) => {
    const isActive = chatsTab.activeChatId === chat.id;
    return (
      <div
        key={chat.id}
        className={`chat-item-card ${isActive ? 'active' : ''}`}
        onClick={() => chatsTab.onSelectChat(chat)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && chatsTab.onSelectChat(chat)}
      >
        <ChatAvatar pictureUrl={chatsTab.pictures?.[chat.id]} kind={chat.kind} />

        <div className="chat-item-info">
          <div className="chat-item-top">
            <span className="chat-item-name" title={chat.name || chat.id}>
              {chat.name || chat.id.split('@')[0]}
            </span>
            {chat.timestamp ? <span className="chat-item-time">{formatChatTime(chat.timestamp)}</span> : null}
          </div>

          <div className="chat-item-mid">
            <span className="chat-item-phone" title={formatChatIdentifier(chat)}>
              {formatChatIdentifier(chat)}
            </span>
            {chat.kind !== 'individual' && chat.kind !== 'unknown' && (
              <span className={`chat-kind-badge kind-${chat.kind}`}>{t(`chats.kind.${chat.kind}`, { defaultValue: chat.kind })}</span>
            )}
          </div>

          <div className="chat-item-bottom">
            <span className="chat-item-snippet" title={formatLastMessageSnippet(chat)}>
              {formatLastMessageSnippet(chat) || <span className="no-message">{t('chats.noMessageYet', { defaultValue: 'No messages yet' })}</span>}
            </span>
            {chat.unreadCount > 0 && (
              <span
                className="chat-unread-badge"
                title={t('chats.unreadBadge', { count: chat.unreadCount })}
                aria-label={t('chats.unreadBadge', { count: chat.unreadCount })}
              >
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside className="chats-sidebar">
      <div className="sidebar-header-box">
        {/* Session selector */}
        <div className="session-select-group">
          <label className="form-label">{t('chats.sessionLabel', { defaultValue: 'WhatsApp Account' })}</label>
          <select
            value={selectedSessionId}
            onChange={e => onSelectSession(e.target.value)}
            className="session-selector"
          >
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.phone || t('chats.noPhone', { defaultValue: 'No phone' })})
              </option>
            ))}
          </select>
        </div>

        {/* Top tabs (Chats / Channels / Status) */}
        <div className="chats-tabs" role="tablist">
          {(['chats', 'channels', 'status'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={`chats-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => onSwitchTab(tab)}
            >
              {t(`chats.tab.${tab}`, { defaultValue: tab.charAt(0).toUpperCase() + tab.slice(1) })}
            </button>
          ))}
        </div>

        {/* Search bar with instant clear */}
        <div className="chat-search-input-wrap">
          <Search size={16} className="chat-search-icon" />
          <input
            type="text"
            className="chat-search-input-field"
            placeholder={t('chats.searchPlaceholder', { defaultValue: 'Search by name or number...' })}
            value={searchQuery}
            onChange={e => onSearchQueryChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="chat-search-clear-btn"
              onClick={() => onSearchQueryChange('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category filters (All / Unread / Groups / Contacts) for Chats tab */}
        {activeTab === 'chats' && (
          <div className="chats-category-pills" role="tablist">
            <button
              type="button"
              className={`cat-pill ${categoryFilter === 'all' ? 'active' : ''}`}
              onClick={() => onCategoryFilterChange('all')}
            >
              <MessageCircle size={13} />
              All
            </button>
            <button
              type="button"
              className={`cat-pill ${categoryFilter === 'unread' ? 'active' : ''}`}
              onClick={() => onCategoryFilterChange('unread')}
            >
              Unread
              {chatsTab.unreadCount > 0 && <span className="cat-badge">{chatsTab.unreadCount}</span>}
            </button>
            <button
              type="button"
              className={`cat-pill ${categoryFilter === 'groups' ? 'active' : ''}`}
              onClick={() => onCategoryFilterChange('groups')}
            >
              <Users size={13} />
              Groups
            </button>
            <button
              type="button"
              className={`cat-pill ${categoryFilter === 'direct' ? 'active' : ''}`}
              onClick={() => onCategoryFilterChange('direct')}
            >
              <User size={13} />
              Contacts
            </button>
          </div>
        )}

        {/* Compose a new status — only on Status tab */}
        {activeTab === 'status' && (
          <button type="button" className="btn-primary status-compose-trigger" onClick={onComposeStatus}>
            <Plus size={16} />
            {t('chats.status.compose', { defaultValue: 'Post Status' })}
          </button>
        )}
      </div>

      {/* Main Chats list */}
      {activeTab === 'chats' && (
        <div className="chats-list">
          {chatsTab.loading ? (
            <div className="chats-list-loading">
              <Loader2 className="animate-spin" size={24} />
              <span>{t('chats.loadingChats', { defaultValue: 'Loading chats...' })}</span>
            </div>
          ) : chatsTab.chats.length === 0 ? (
            <div className="chats-list-empty">
              <span>
                {searchQuery
                  ? `No conversations match "${searchQuery}"`
                  : categoryFilter !== 'all'
                  ? `No ${categoryFilter} conversations found`
                  : t('chats.empty', { defaultValue: 'No conversations found' })}
              </span>
            </div>
          ) : (
            chatsTab.chats.map(renderChatRow)
          )}
        </div>
      )}

      {/* Channels list */}
      {activeTab === 'channels' && (
        <div className="chats-list">
          {channelsTab.engineLoading ? (
            <div className="chats-list-loading">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : !channelsTab.supported ? (
            <div className="chats-list-empty">
              <span>{t('chats.channels.notSupported', { defaultValue: 'Channels not supported' })}</span>
            </div>
          ) : channelsTab.query.isLoading ? (
            <div className="chats-list-loading">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : channelsTab.query.error ? (
            <div className="chats-list-empty">
              <AlertCircle size={24} className="text-warn" />
              <span>{t('chats.channels.notReady', { defaultValue: 'Unable to load channels' })}</span>
            </div>
          ) : (channelsTab.query.data?.length ?? 0) === 0 ? (
            <div className="chats-list-empty">
              <span>{t('chats.channels.empty', { defaultValue: 'No channels subscribed' })}</span>
            </div>
          ) : (
            channelsTab.channels.map(ch => (
              <div
                key={ch.id}
                className={`chat-item-card ${channelsTab.activeChannelId === ch.id ? 'active' : ''}`}
                onClick={() => channelsTab.onSelectChannel(ch)}
              >
                <div className="chat-avatar">
                  <Megaphone size={18} />
                </div>
                <div className="chat-item-info">
                  <div className="chat-item-top">
                    <span className="chat-item-name">{ch.name}</span>
                  </div>
                  {ch.subscriberCount != null && (
                    <div className="chat-item-bottom">
                      <span className="chat-item-snippet">
                        {t('chats.channels.subscribers', { count: ch.subscriberCount })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Status list */}
      {activeTab === 'status' && (
        <div className="chats-list">
          {statusTab.loading ? (
            <div className="chats-list-loading">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : statusTab.error ? (
            <div className="chats-list-empty">
              <AlertCircle size={24} className="text-warn" />
              <span>{t('chats.status.loadError', { defaultValue: 'Unable to load statuses' })}</span>
            </div>
          ) : statusTab.groups.length === 0 ? (
            <div className="chats-list-empty">
              <span>{t('chats.status.empty', { defaultValue: 'No recent status updates' })}</span>
            </div>
          ) : (
            statusTab.groups.map(group => (
              <div
                key={group.contact.id}
                className={`chat-item-card ${statusTab.activeContactId === group.contact.id ? 'active' : ''}`}
                onClick={() => statusTab.onSelectContact(group.contact.id)}
              >
                <div className="chat-avatar">
                  <CircleDashed size={18} />
                </div>
                <div className="chat-item-info">
                  <div className="chat-item-top">
                    <span className="chat-item-name">
                      {group.contact.name ?? group.contact.pushName ?? group.contact.id}
                    </span>
                    <span className="chat-item-time">
                      {formatChatTime(Math.floor(new Date(group.latest).getTime() / 1000))}
                    </span>
                  </div>
                  <div className="chat-item-bottom">
                    <span className="chat-item-snippet">
                      {t('chats.status.itemCount', { count: group.items.length })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
}

export default ChatSidebar;
