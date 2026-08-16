/**
 * Search filtering and status grouping for the conversation tabs.
 *
 * One search box drives Chats, Channels and Status, with category filters (All, Unread, Groups, Direct)
 * matching against real available conversation metadata.
 */

export type ChatCategoryFilter = 'all' | 'unread' | 'groups' | 'direct';

/** Case-insensitive "does any of these fields contain the query". Absent fields never match. */
const matches = (query: string, ...fields: (string | undefined)[]): boolean => {
  const needle = query.toLowerCase();
  return fields.some(f => (f ?? '').toLowerCase().includes(needle));
};

export interface ChatLike {
  id: string;
  name?: string;
  kind?: string;
  unreadCount?: number;
  isGroup?: boolean;
}

/**
 * Chats tab: real conversations only with optional category filtering (All, Unread, Groups, Direct).
 */
export function filterChats<T extends ChatLike>(
  chats: T[],
  query: string,
  category: ChatCategoryFilter = 'all',
): T[] {
  return chats.filter(c => {
    if (c.kind === 'channel' || c.kind === 'status') return false;
    if (category === 'unread' && (!c.unreadCount || c.unreadCount <= 0)) return false;
    if (category === 'groups' && !c.isGroup && c.kind !== 'group') return false;
    if (category === 'direct' && (c.isGroup || c.kind === 'group')) return false;
    return matches(query, c.name, c.id);
  });
}

/** Channels tab: same search box, matched on the channel's own name/id. */
export function filterChannels<T extends { id: string; name: string }>(channels: T[], query: string): T[] {
  return channels.filter(ch => matches(query, ch.name, ch.id));
}

export interface StatusItemLike<C> {
  contact: C;
  timestamp: string;
}

/**
 * Status tab: collapse the flat status list to one row per contact.
 */
export function groupStatusesByContact<
  C extends { id: string; name?: string; pushName?: string },
  T extends StatusItemLike<C>,
>(statuses: T[], query: string): { contact: C; items: T[]; latest: string }[] {
  const byContact = new Map<string, { contact: C; items: T[]; latest: string }>();
  for (const item of statuses) {
    const existing = byContact.get(item.contact.id);
    if (existing) {
      existing.items.push(item);
      if (item.timestamp > existing.latest) existing.latest = item.timestamp;
    } else {
      byContact.set(item.contact.id, { contact: item.contact, items: [item], latest: item.timestamp });
    }
  }
  for (const group of byContact.values()) group.items.reverse();
  return Array.from(byContact.values())
    .filter(g => matches(query, g.contact.name, g.contact.pushName, g.contact.id))
    .sort((a, b) => (a.latest < b.latest ? 1 : a.latest > b.latest ? -1 : 0));
}
