import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Loader2,
  Mail,
  MessageSquare,
  MoreVertical,
  Plus,
  Search,
  Send,
  Settings,
  Shield,
  Trash2,
  User,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { smartflowApi } from '../api/services';
import { useAuthStore } from '../store/useAuthStore';

const getApiData = (response) => response?.data?.data || response?.data || response || {};

const toItems = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
};

const toMessages = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.messages)) return value.messages;
  return [];
};

const getStoredAccessToken = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('access_token');
};

const getCurrentUserId = () => useAuthStore.getState().user?.id || useAuthStore.getState().user?._id || null;

const getInitials = (value) =>
  String(value || 'GP')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'GP';

const normalizeGroup = (group) => ({
  ...group,
  id: group?.id || group?._id,
  name: group?.name || group?.title || 'Untitled Group',
  member_count: Number(group?.member_count || group?.memberCount || group?.members?.length || 0),
  members: Array.isArray(group?.members) ? group.members : [],
  pending_invites: Array.isArray(group?.pending_invites) ? group.pending_invites : [],
  can_manage: group?.can_manage !== false,
  can_leave: group?.can_leave !== false,
  is_global_chat: Boolean(group?.is_global_chat),
  is_system_managed: Boolean(group?.is_system_managed || group?.is_global_chat),
});

const normalizeMessage = (message) => ({
  ...message,
  id: message?.id || message?._id || `${Date.now()}-${Math.random()}`,
  content: message?.content || message?.text || '',
  timestamp:
    message?.timestamp ||
    message?.created_at ||
    message?.createdAt ||
    message?.updated_at ||
    message?.updatedAt,
  direction:
    message?.direction ||
    ((message?.sender_user_id && message.sender_user_id === getCurrentUserId()) || message?.sender_is_self ? 'outbound' : 'inbound'),
  sender_name:
    message?.sender_name ||
    message?.senderName ||
    message?.sender?.name ||
    message?.sender?.full_name ||
    message?.sender?.fullName ||
    'Member',
});

const formatDateTime = (value) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatMessageTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function GroupAvatar({ name, avatarUrl, size = 'w-12 h-12 text-sm' }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${size} rounded-2xl border border-cyan-500/20 object-cover`}
      />
    );
  }

  return (
    <div className={`${size} rounded-2xl border border-cyan-500/20 bg-cyan-950/50 flex items-center justify-center font-black text-cyan-400`}>
      {getInitials(name)}
    </div>
  );
}

function MessageBubble({ message }) {
  const outbound = message.direction === 'outbound';

  return (
    <div className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-3 text-xs font-semibold leading-relaxed ${
          outbound
            ? 'rounded-tr-none bg-[#11C7E5] text-[#041118]'
            : 'rounded-tl-none border border-slate-900 bg-[#121625] text-slate-200'
        }`}
      >
        {!outbound ? (
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-cyan-400">
            {message.sender_name}
          </p>
        ) : null}
        <p className="whitespace-pre-wrap">{message.content || 'Attachment'}</p>
        <p className={`mt-2 text-[9px] font-bold uppercase tracking-wider ${outbound ? 'text-[#041118]/60' : 'text-slate-500'}`}>
          {formatMessageTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}

export default function Groups() {
  const location = useLocation();
  const [viewMode, setViewMode] = useState('dashboard');
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupDetails, setGroupDetails] = useState({});
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [currentMessageText, setCurrentMessageText] = useState('');
  const [createForm, setCreateForm] = useState({ name: '', description: '', avatar_url: '' });
  const [settingsForm, setSettingsForm] = useState({ name: '', description: '', avatar_url: '' });
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', phone: '', role: 'member' });
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [addingMemberId, setAddingMemberId] = useState('');
  const [removingMemberId, setRemovingMemberId] = useState('');
  const [changingRoleId, setChangingRoleId] = useState('');
  const [inviteSaving, setInviteSaving] = useState(false);
  const chatBottomRef = useRef(null);
  const threadSocketRef = useRef(null);

  const activeGroup = useMemo(() => {
    const fromList = groups.find((group) => group.id === selectedGroupId) || null;
    const fromDetails = selectedGroupId ? groupDetails[selectedGroupId] : null;
    return normalizeGroup({ ...(fromList || {}), ...(fromDetails || {}) });
  }, [groupDetails, groups, selectedGroupId]);

  const availableContacts = useMemo(() => {
    const existingIds = new Set((activeGroup?.members || []).map((member) => String(member.id)));
    return contacts.filter((contact) => !existingIds.has(String(contact.id)));
  }, [activeGroup?.members, contacts]);

  const filteredContacts = useMemo(() => {
    const query = memberSearchQuery.trim().toLowerCase();
    if (!query) return availableContacts;
    return availableContacts.filter((contact) => {
      const haystack = `${contact.name || ''} ${contact.email || ''} ${contact.phone || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [availableContacts, memberSearchQuery]);

  const selectedContacts = useMemo(
    () => contacts.filter((contact) => selectedMemberIds.includes(String(contact.id))),
    [contacts, selectedMemberIds],
  );

  const syncListGroup = useCallback((nextGroup) => {
    const normalized = normalizeGroup(nextGroup);
    setGroups((current) => {
      const existing = current.some((group) => group.id === normalized.id);
      const next = existing
        ? current.map((group) => (group.id === normalized.id ? { ...group, ...normalized } : group))
        : [normalized, ...current];
      return next.sort(
        (left, right) =>
          new Date(right.updated_at || right.created_at || 0).getTime() -
          new Date(left.updated_at || left.created_at || 0).getTime(),
      );
    });
    setGroupDetails((current) => ({ ...current, [normalized.id]: normalized }));
    return normalized;
  }, []);

  const fetchContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const response = await smartflowApi.getContacts({ page: 1, page_size: 100 });
      const data = getApiData(response);
      setContacts(toItems(data));
    } catch (contactError) {
      setContacts([]);
      setError(contactError?.response?.data?.message || 'Could not load contacts for group member selection.');
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const fetchGroups = useCallback(async (search = '') => {
    setLoading(true);
    try {
      const response = await smartflowApi.listGroups({ page: 1, page_size: 100, search: search || undefined });
      const data = getApiData(response);
      const items = toItems(data).map(normalizeGroup);
      setGroups(items);
      if (!selectedGroupId && items.length) {
        setSelectedGroupId(items[0].id);
      } else if (selectedGroupId && !items.some((group) => group.id === selectedGroupId)) {
        setSelectedGroupId(items[0]?.id || null);
      }
      setError('');
    } catch (groupError) {
      setGroups([]);
      setSelectedGroupId(null);
      setError(groupError?.response?.data?.message || 'Could not load groups.');
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId]);

  const fetchGroupDetail = useCallback(async (groupId) => {
    if (!groupId) return;
    try {
      const response = await smartflowApi.getGroup(groupId);
      const normalized = normalizeGroup(getApiData(response));
      setGroupDetails((current) => ({ ...current, [groupId]: normalized }));
      setSettingsForm({
        name: normalized.name || '',
        description: normalized.description || '',
        avatar_url: normalized.avatar_url || '',
      });
    } catch (detailError) {
      setError(detailError?.response?.data?.message || 'Could not load group details.');
    }
  }, []);

  const fetchMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    setThreadLoading(true);
    try {
      const response = await smartflowApi.getMessages(conversationId, { page: 1, page_size: 100 });
      const data = getApiData(response);
      const nextMessages = toMessages(data)
        .map(normalizeMessage)
        .sort((left, right) => new Date(left.timestamp || 0).getTime() - new Date(right.timestamp || 0).getTime());
      setMessages(nextMessages);
      setError('');
    } catch (messageError) {
      setMessages([]);
      setError(messageError?.response?.data?.message || 'Could not load group chat thread.');
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchContacts();
  }, [fetchContacts, fetchGroups]);

  useEffect(() => {
    const prefill = location.state?.prefill;
    if (!prefill) return;

    setCreateForm({
      name: prefill.group_name || prefill.groupName || prefill.name || prefill.title || '',
      description: prefill.description || '',
      avatar_url: prefill.avatar_url || '',
    });
    setViewMode('create');
    window.history.replaceState({}, '');
  }, [location.state]);

  useEffect(() => {
    if (!selectedGroupId) return;
    fetchGroupDetail(selectedGroupId);
  }, [fetchGroupDetail, selectedGroupId]);

  useEffect(() => {
    if (viewMode !== 'chat' || !activeGroup?.conversation_id) {
      setMessages([]);
      if (threadSocketRef.current) {
        threadSocketRef.current.close();
        threadSocketRef.current = null;
      }
      return;
    }

    fetchMessages(activeGroup.conversation_id);
    const token = getStoredAccessToken();
    if (!token) return undefined;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(
      `${protocol}://127.0.0.1:8000/api/v1/smartflow/ws/conversations/${activeGroup.conversation_id}?token=${encodeURIComponent(token)}`,
    );
    threadSocketRef.current = socket;
    socket.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.event !== 'message.created' && payload?.event !== 'message.updated') return;
        const incoming = normalizeMessage(payload.data);
        setMessages((current) => {
          const exists = current.some((item) => item.id === incoming.id);
          if (exists) {
            return current.map((item) => (item.id === incoming.id ? incoming : item));
          }
          return [...current, incoming].sort(
            (left, right) => new Date(left.timestamp || 0).getTime() - new Date(right.timestamp || 0).getTime(),
          );
        });
        await fetchMessages(activeGroup.conversation_id);
      } catch {
        // Ignore malformed realtime payloads and keep the thread usable.
      }
    };

    return () => {
      socket.close();
      threadSocketRef.current = null;
    };
  }, [activeGroup?.conversation_id, fetchMessages, viewMode]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, viewMode]);

  const handleCreateGroup = async (event) => {
    event.preventDefault();
    if (!createForm.name.trim()) {
      setError('Group name is required.');
      return;
    }
    if (!selectedMemberIds.length) {
      setError('Add at least one member to create a group.');
      return;
    }

    setSaving(true);
    try {
      const response = await smartflowApi.createGroup({
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        avatar_url: createForm.avatar_url.trim() || undefined,
        member_ids: selectedMemberIds,
      });
      const created = syncListGroup(getApiData(response));
      setSelectedGroupId(created.id);
      setSelectedMemberIds([]);
      setCreateForm({ name: '', description: '', avatar_url: '' });
      setSuccess('Group created successfully.');
      setError('');
      setViewMode('settings');
    } catch (createError) {
      setError(createError?.response?.data?.message || 'Could not create group.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async (event) => {
    event.preventDefault();
    if (!activeGroup?.id) return;

    setSaving(true);
    try {
      const response = await smartflowApi.updateGroup(activeGroup.id, {
        name: settingsForm.name.trim() || undefined,
        description: settingsForm.description.trim() || '',
        avatar_url: settingsForm.avatar_url.trim() || '',
      });
      syncListGroup(getApiData(response));
      setSuccess('Group settings saved.');
      setError('');
    } catch (saveError) {
      setError(saveError?.response?.data?.message || 'Could not save group settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (contactId) => {
    if (!activeGroup?.id || !contactId) return;
    setAddingMemberId(contactId);
    try {
      const response = await smartflowApi.addGroupMembers(activeGroup.id, { member_ids: [contactId] });
      syncListGroup(getApiData(response));
      setSuccess('Member added to group.');
      setError('');
    } catch (memberError) {
      setError(memberError?.response?.data?.message || 'Could not add member.');
    } finally {
      setAddingMemberId('');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!activeGroup?.id || !memberId) return;
    if (!window.confirm('Remove this member from the group?')) return;
    setRemovingMemberId(memberId);
    try {
      const response = await smartflowApi.removeGroupMember(activeGroup.id, memberId);
      syncListGroup(getApiData(response));
      setSuccess('Member removed.');
      setError('');
    } catch (removeError) {
      setError(removeError?.response?.data?.message || 'Could not remove member.');
    } finally {
      setRemovingMemberId('');
    }
  };

  const handleRoleChange = async (memberId, role) => {
    if (!activeGroup?.id || !memberId) return;
    setChangingRoleId(memberId);
    try {
      const response = await smartflowApi.updateGroupMember(activeGroup.id, memberId, { role });
      syncListGroup(getApiData(response));
      setSuccess(`Member role updated to ${role}.`);
      setError('');
    } catch (roleError) {
      setError(roleError?.response?.data?.message || 'Could not update member role.');
    } finally {
      setChangingRoleId('');
    }
  };

  const handleInvite = async (event) => {
    event.preventDefault();
    if (!activeGroup?.id) return;

    setInviteSaving(true);
    try {
      const payload = {
        name: inviteForm.name.trim() || undefined,
        email: inviteForm.email.trim() || undefined,
        phone: inviteForm.phone.trim() || undefined,
        role: inviteForm.role,
      };
      const response = await smartflowApi.createGroupInvite(activeGroup.id, payload);
      syncListGroup(getApiData(response));
      setInviteForm({ name: '', email: '', phone: '', role: 'member' });
      setSuccess('Invite created.');
      setError('');
    } catch (inviteError) {
      setError(inviteError?.response?.data?.message || 'Could not create invite.');
    } finally {
      setInviteSaving(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeGroup?.id) return;
    if (!activeGroup.can_leave) {
      setError('This group owner cannot leave the group. Delete it instead.');
      setSuccess('');
      return;
    }
    if (!window.confirm(`Leave "${activeGroup.name}"?`)) return;
    try {
      await smartflowApi.leaveGroup(activeGroup.id);
      setSuccess('You left the group.');
      setError('');
      const nextId = groups.find((group) => group.id !== activeGroup.id)?.id || null;
      setGroups((current) => current.filter((group) => group.id !== activeGroup.id));
      setSelectedGroupId(nextId);
      setViewMode('dashboard');
    } catch (leaveError) {
      setError(leaveError?.response?.data?.message || 'Could not leave the group.');
    }
  };

  const handleDeleteGroup = async () => {
    if (!activeGroup?.id) return;
    if (!window.confirm(`Delete "${activeGroup.name}"?`)) return;

    try {
      await smartflowApi.deleteGroup(activeGroup.id);
      setSuccess('Group deleted.');
      setError('');
      const nextId = groups.find((group) => group.id !== activeGroup.id)?.id || null;
      setGroups((current) => current.filter((group) => group.id !== activeGroup.id));
      setSelectedGroupId(nextId);
      setViewMode('dashboard');
    } catch (deleteError) {
      setError(deleteError?.response?.data?.message || 'Could not delete the group.');
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const content = currentMessageText.trim();
    if (!content || !activeGroup?.conversation_id || sending) return;

    setSending(true);
    try {
      await smartflowApi.sendMessage({
        conversation_id: activeGroup.conversation_id,
        content,
        platform: 'ai',
        direction: 'outbound',
      });
      setCurrentMessageText('');
      await fetchMessages(activeGroup.conversation_id);
      await fetchGroups(searchQuery.trim());
      setError('');
    } catch (sendError) {
      setError(sendError?.response?.data?.message || 'Could not send message to this group.');
    } finally {
      setSending(false);
    }
  };

  const filteredGroupsList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((group) => {
      const haystack = `${group.name || ''} ${group.description || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [groups, searchQuery]);

  return (
    <div className="h-full flex flex-col space-y-6">
      {(error || success) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${error ? 'border-rose-500/30 bg-rose-950/20 text-rose-200' : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'}`}>
          <div className="flex items-center justify-between gap-4">
            <span>{error || success}</span>
            <button
              onClick={() => {
                setError('');
                setSuccess('');
              }}
              className="text-current/70 hover:text-current"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {viewMode === 'create' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          <div className="flex-1 bg-[#0c101b]/95 border border-slate-900 rounded-3xl p-8">
            <div className="flex items-center gap-3 pb-6 border-b border-slate-900/60">
              <button
                onClick={() => setViewMode('dashboard')}
                className="p-2 bg-slate-950/60 hover:bg-slate-900 border border-slate-900 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <h1 className="text-xl font-bold text-white">Create Group</h1>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-6 mt-6">
              <div className="flex flex-col items-center space-y-3">
                <GroupAvatar name={createForm.name || 'New Group'} avatarUrl={createForm.avatar_url} size="w-20 h-20 text-2xl" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Group Image</span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 tracking-wide uppercase">Group Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Enter group name..."
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl text-white text-sm font-semibold placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 tracking-wide uppercase">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Brief group description..."
                  className="w-full min-h-24 px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl text-white text-sm font-semibold placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 tracking-wide uppercase">Avatar URL</label>
                <input
                  type="url"
                  value={createForm.avatar_url}
                  onChange={(event) => setCreateForm((current) => ({ ...current, avatar_url: event.target.value }))}
                  placeholder="https://..."
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl text-white text-sm font-semibold placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-400 tracking-wide uppercase">
                    Members ({selectedMemberIds.length} Selected)
                  </label>
                  {contactsLoading ? <Loader2 size={14} className="animate-spin text-cyan-400" /> : null}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(event) => setMemberSearchQuery(event.target.value)}
                    placeholder="Search contacts..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-900 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500/40"
                  />
                </div>

                {selectedContacts.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedContacts.map((member) => (
                      <button
                        type="button"
                        key={member.id}
                        onClick={() => setSelectedMemberIds((current) => current.filter((item) => item !== String(member.id)))}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#121625] border border-slate-900 text-xs font-bold text-slate-300"
                      >
                        <span>{member.name}</span>
                        <X size={12} />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="max-h-72 overflow-y-auto space-y-1.5 p-1 border border-slate-900 rounded-2xl">
                  {filteredContacts.length ? filteredContacts.map((contact) => {
                    const selected = selectedMemberIds.includes(String(contact.id));
                    return (
                      <button
                        type="button"
                        key={contact.id}
                        onClick={() => {
                          setSelectedMemberIds((current) =>
                            selected
                              ? current.filter((item) => item !== String(contact.id))
                              : [...current, String(contact.id)],
                          );
                        }}
                        className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl text-left transition-colors ${
                          selected ? 'bg-cyan-950/20 border border-cyan-500/20' : 'hover:bg-slate-950'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{contact.name || 'Unnamed Contact'}</p>
                          <p className="text-[10px] text-slate-500 truncate">{contact.email || contact.phone || 'No email or phone'}</p>
                        </div>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected ? 'border-cyan-500 bg-cyan-950 text-cyan-400' : 'border-slate-800'}`}>
                          {selected ? <Check size={10} /> : null}
                        </div>
                      </button>
                    );
                  }) : (
                    <div className="p-6 text-center text-xs text-slate-500">No contacts available for selection.</div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-cyan-400 hover:bg-cyan-300 text-[#070a13] rounded-xl font-bold shadow-lg shadow-cyan-400/10 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Create Group
              </button>
            </form>
          </div>

          <div className="w-full lg:w-[360px] bg-[#0c101b] border border-slate-900 rounded-3xl p-6 space-y-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Preview</p>
              <div className="mt-4 rounded-3xl border border-slate-900 bg-[#121625]/40 p-5 text-center">
                <div className="flex justify-center">
                  <GroupAvatar name={createForm.name || 'New Group'} avatarUrl={createForm.avatar_url} size="w-16 h-16 text-xl" />
                </div>
                <h3 className="mt-4 text-lg font-extrabold text-white">{createForm.name || 'New Group'}</h3>
                <p className="mt-1 text-xs text-slate-500">{selectedMemberIds.length} members selected</p>
                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                  {createForm.description || 'Add a description so the team knows what this group is for.'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-900 bg-slate-950/40 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Runtime notes</p>
              <ul className="mt-3 space-y-2 text-xs text-slate-400">
                <li>Creates a real SmartFlow group record.</li>
                <li>Uses real contact IDs as members.</li>
                <li>Creates a linked conversation thread for group chat.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'settings' && activeGroup?.id && (
        <div className="flex-1 flex flex-col xl:flex-row gap-6 min-h-0">
          <div className="flex-1 bg-[#0c101b]/95 border border-slate-900 rounded-3xl p-8 overflow-y-auto">
            <div className="flex items-center gap-3 pb-6 border-b border-slate-900/60">
              <button
                onClick={() => setViewMode('dashboard')}
                className="p-2 bg-slate-950/60 hover:bg-slate-900 border border-slate-900 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <h1 className="text-xl font-bold text-white">Group Settings</h1>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-6 mt-6">
              {activeGroup.is_system_managed ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-200">
                  This organization global chat is managed automatically from the Owner Dashboard. Members can chat here, but membership and settings are controlled outside the Community page.
                </div>
              ) : null}

              <div className="flex items-center gap-4">
                <GroupAvatar name={settingsForm.name || activeGroup.name} avatarUrl={settingsForm.avatar_url || activeGroup.avatar_url} size="w-16 h-16 text-xl" />
                <div>
                  <h2 className="text-lg font-extrabold text-white">{activeGroup.name}</h2>
                  <p className="text-xs text-slate-500">{activeGroup.member_count} members</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-600 mt-1">
                    Updated {formatDateTime(activeGroup.updated_at || activeGroup.created_at)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Group Name</label>
                  <input
                    type="text"
                    value={settingsForm.name}
                    onChange={(event) => setSettingsForm((current) => ({ ...current, name: event.target.value }))}
                    readOnly={activeGroup.is_system_managed}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl text-white text-sm font-semibold placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Avatar URL</label>
                  <input
                    type="url"
                    value={settingsForm.avatar_url}
                    onChange={(event) => setSettingsForm((current) => ({ ...current, avatar_url: event.target.value }))}
                    readOnly={activeGroup.is_system_managed}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl text-white text-sm font-semibold placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Description</label>
                <textarea
                  value={settingsForm.description}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, description: event.target.value }))}
                  readOnly={activeGroup.is_system_managed}
                  className="w-full min-h-24 px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl text-white text-sm font-semibold placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                />
              </div>

              <div className="flex items-center gap-3">
                {!activeGroup.is_system_managed ? (
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#070a13] font-bold flex items-center gap-2 disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Settings size={14} />}
                    Save
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setViewMode('chat')}
                  className="px-5 py-3 rounded-xl border border-slate-900 bg-slate-950 text-slate-300 hover:text-white font-bold flex items-center gap-2"
                >
                  <MessageSquare size={14} />
                  Open Chat
                </button>
              </div>
            </form>

            <div className="mt-8 border-t border-slate-900/60 pt-8">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Members ({activeGroup.members.length})</h3>
                {contactsLoading ? <Loader2 size={14} className="animate-spin text-cyan-400" /> : null}
              </div>

              <div className="mt-4 space-y-3">
                {activeGroup.members.length ? activeGroup.members.map((member) => (
                  <div key={member.id} className="rounded-2xl border border-slate-900 bg-[#121625]/30 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex items-center gap-3">
                      <GroupAvatar name={member.name} avatarUrl={member.avatar_url} size="w-10 h-10 text-xs" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{member.name}</p>
                        <p className="text-xs text-slate-500 truncate">{member.email || member.phone || 'No email or phone'}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${member.role === 'admin' ? 'bg-cyan-950/40 text-cyan-400' : 'bg-slate-950 text-slate-400'}`}>
                        {member.role === 'admin' ? <Shield size={11} /> : <User size={11} />}
                        {member.role}
                      </span>
                      {!activeGroup.is_system_managed ? (
                        <>
                          <select
                            value={member.role === 'admin' ? 'admin' : 'member'}
                            onChange={(event) => handleRoleChange(member.id, event.target.value)}
                            disabled={changingRoleId === member.id}
                            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-900 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/40 disabled:opacity-60"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={removingMemberId === member.id}
                            className="p-2 rounded-xl border border-slate-900 bg-slate-950 text-slate-500 hover:text-rose-400 disabled:opacity-60"
                            title="Remove member"
                          >
                            {removingMemberId === member.id ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                )) : (
                  <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-900 rounded-2xl">
                    No members yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="w-full xl:w-[360px] space-y-6">
            {activeGroup.is_system_managed ? (
              <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6">
                <h3 className="text-sm font-extrabold text-white">Owner-controlled membership</h3>
                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                  This conversation follows organization membership from the Owner Dashboard. Users cannot add, remove, invite, leave, or delete this global chat from Community.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6">
                  <div className="flex items-center gap-2">
                    <UserPlus size={15} className="text-cyan-400" />
                    <h3 className="text-sm font-extrabold text-white">Add Members</h3>
                  </div>
                  <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(event) => setMemberSearchQuery(event.target.value)}
                      placeholder="Search contacts..."
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-900 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500/40"
                    />
                  </div>
                  <div className="mt-4 max-h-72 overflow-y-auto space-y-2">
                    {filteredContacts.length ? filteredContacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-900 bg-slate-950/40">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{contact.name || 'Unnamed Contact'}</p>
                          <p className="text-[10px] text-slate-500 truncate">{contact.email || contact.phone || 'No email or phone'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddMember(String(contact.id))}
                          disabled={addingMemberId === String(contact.id)}
                          className="px-3 py-2 rounded-xl bg-cyan-400 text-[#041118] text-[11px] font-black disabled:opacity-60"
                        >
                          {addingMemberId === String(contact.id) ? 'Adding...' : 'Add'}
                        </button>
                      </div>
                    )) : (
                      <div className="p-4 text-center text-xs text-slate-500">No addable contacts found.</div>
                    )}
                  </div>
                </div>

                <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6">
                  <div className="flex items-center gap-2">
                    <Mail size={15} className="text-cyan-400" />
                    <h3 className="text-sm font-extrabold text-white">Invite by Email or Phone</h3>
                  </div>
                  <form onSubmit={handleInvite} className="mt-4 space-y-3">
                    <input
                      type="text"
                      value={inviteForm.name}
                      onChange={(event) => setInviteForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Invitee name"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500/40"
                    />
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="Email address"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500/40"
                    />
                    <input
                      type="tel"
                      value={inviteForm.phone}
                      onChange={(event) => setInviteForm((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="Phone number"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500/40"
                    />
                    <select
                      value={inviteForm.role}
                      onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500/40"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="submit"
                      disabled={inviteSaving}
                      className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#041118] text-xs font-black disabled:opacity-60"
                    >
                      {inviteSaving ? 'Sending...' : 'Create Invite'}
                    </button>
                  </form>

                  {activeGroup.pending_invites?.length ? (
                    <div className="mt-5 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Pending Invites ({activeGroup.pending_invites.length})
                      </p>
                      {activeGroup.pending_invites.map((invite) => (
                        <div key={invite.id} className="rounded-2xl border border-slate-900 bg-slate-950/40 px-3 py-2">
                          <p className="text-xs font-bold text-white">{invite.name || invite.email || invite.phone}</p>
                          <p className="text-[10px] text-slate-500">{invite.email || invite.phone}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6">
                  <h3 className="text-sm font-extrabold text-white">Danger Zone</h3>
                  <div className="mt-4 space-y-3">
                    {activeGroup.can_leave ? (
                      <button
                        type="button"
                        onClick={handleLeaveGroup}
                        className="w-full py-3 rounded-xl border border-rose-500/30 text-rose-300 text-xs font-black hover:bg-rose-950/20"
                      >
                        Leave Group
                      </button>
                    ) : (
                      <div className="rounded-xl border border-slate-900 bg-slate-950/50 px-4 py-3 text-[11px] text-slate-400">
                        Group owners cannot leave. Delete the group if you no longer need it.
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleDeleteGroup}
                      className="w-full py-3 rounded-xl bg-rose-500/90 text-white text-xs font-black hover:bg-rose-500"
                    >
                      Delete Group
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {viewMode === 'chat' && activeGroup?.id && (
        <div className="flex-1 flex flex-col bg-[#0c101b] border border-slate-900 rounded-3xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-900/60 px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode('dashboard')}
                className="p-2 bg-slate-950/60 hover:bg-slate-900 border border-slate-900 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <GroupAvatar name={activeGroup.name} avatarUrl={activeGroup.avatar_url} size="w-10 h-10 text-xs" />
              <div>
                <h2 className="text-base font-extrabold text-white">{activeGroup.name}</h2>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">
                  {activeGroup.member_count} members
                </p>
              </div>
            </div>
            <button
              onClick={() => setViewMode('settings')}
              className="p-2 rounded-xl border border-slate-900 bg-slate-950 text-slate-400 hover:text-white"
              title="Group settings"
            >
              <Settings size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {threadLoading ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                <Loader2 size={18} className="animate-spin mr-2 text-cyan-400" />
                Loading group chat...
              </div>
            ) : messages.length ? (
              messages.map((message) => <MessageBubble key={message.id} message={message} />)
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <MessageSquare size={34} className="mb-3 opacity-40" />
                <p className="text-sm font-bold text-white">{activeGroup.name}</p>
                <p className="mt-1 text-xs">No messages yet. Start the conversation.</p>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          <form onSubmit={handleSendMessage} className="border-t border-slate-900/60 p-4 flex items-end gap-3">
            <div className="flex-1 rounded-2xl border border-slate-900 bg-slate-950">
              <textarea
                value={currentMessageText}
                onChange={(event) => setCurrentMessageText(event.target.value)}
                placeholder="Type a message..."
                rows={2}
                className="w-full min-h-[52px] max-h-32 resize-none rounded-2xl bg-transparent px-4 py-3 text-xs font-semibold text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={sending || !currentMessageText.trim()}
              className="h-12 w-12 rounded-2xl bg-cyan-400 text-[#041118] flex items-center justify-center disabled:opacity-60"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      )}

      {viewMode === 'dashboard' && (
        <div className="h-full flex flex-col space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Groups</h1>
              <p className="text-slate-400 text-sm mt-1">
                Manage your contact groups and team conversations.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search groups..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-900 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500/40"
                />
              </div>
              <button
                onClick={() => {
                  setCreateForm({ name: '', description: '', avatar_url: '' });
                  setSelectedMemberIds([]);
                  setMemberSearchQuery('');
                  setViewMode('create');
                }}
                className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-[#070a13] rounded-xl text-xs font-extrabold shadow-lg shadow-cyan-500/5 transition-all flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>Create Group</span>
              </button>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
            <div className="lg:col-span-8 overflow-y-auto pr-1">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-40 rounded-2xl border border-slate-900 bg-[#0c101b]/60 animate-pulse" />
                  ))}
                </div>
              ) : filteredGroupsList.length === 0 ? (
                <div className="p-12 text-center bg-[#0c101b]/50 border border-slate-900 rounded-2xl text-slate-500">
                  <Users size={36} className="mx-auto mb-3 text-slate-600" />
                  <p className="font-bold">No groups found</p>
                  <p className="text-xs text-slate-600 mt-1">Change your search query or create a new group.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredGroupsList.map((group) => {
                    const isSelected = selectedGroupId === group.id;
                    return (
                      <div
                        key={group.id}
                        onClick={() => setSelectedGroupId(group.id)}
                        className={`p-5 rounded-2xl border transition-all flex flex-col justify-between h-40 text-left cursor-pointer relative overflow-hidden group ${
                          isSelected
                            ? 'bg-[#0c101b] border-cyan-500/35 shadow-[0_0_20px_rgba(6,182,212,0.02)]'
                            : 'bg-[#0c101b]/60 border-slate-900/60 hover:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <GroupAvatar name={group.name} avatarUrl={group.avatar_url} size="w-10 h-10 text-sm" />
                          <button className="p-1 text-slate-600 hover:text-white rounded-lg hover:bg-slate-950 transition-colors" title="Actions">
                            <MoreVertical size={14} />
                          </button>
                        </div>

                        <div>
                          <h3 className="font-extrabold text-white text-base leading-tight truncate">{group.name}</h3>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                            <Users size={10} /> {group.member_count} Members
                          </p>
                          {group.description ? (
                            <p className="mt-2 text-[11px] text-slate-400 line-clamp-2">{group.description}</p>
                          ) : null}
                        </div>

                        <div className="absolute right-5 bottom-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-2">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedGroupId(group.id);
                              setViewMode('chat');
                            }}
                            className="p-2 bg-slate-950 border border-slate-900 text-slate-400 hover:text-white hover:border-slate-800 rounded-xl transition-all"
                            title="Open Chat"
                          >
                            <MessageSquare size={14} />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedGroupId(group.id);
                              setViewMode('settings');
                            }}
                            className="p-2 bg-slate-950 border border-slate-900 text-slate-400 hover:text-white hover:border-slate-800 rounded-xl transition-all"
                            title="Group Settings"
                          >
                            <Settings size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-4">
              {activeGroup?.id ? (
                <div className="bg-[#0c101b]/95 border border-slate-900 rounded-3xl p-6 h-full flex flex-col justify-between">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-900/60">
                      <span className="text-xs font-bold text-slate-500 tracking-widest uppercase">Group Preview</span>
                      <button
                        onClick={handleDeleteGroup}
                        className="p-2 bg-slate-950/60 hover:bg-red-950/20 border border-slate-900 text-slate-400 hover:text-red-400 rounded-xl transition-all"
                        title="Delete Group"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="flex flex-col items-center space-y-3.5 text-center">
                      <GroupAvatar name={activeGroup.name} avatarUrl={activeGroup.avatar_url} size="w-16 h-16 text-xl" />
                      <div>
                        <h3 className="text-lg font-extrabold text-white leading-tight">{activeGroup.name}</h3>
                        <p className="text-xs text-slate-500 font-semibold mt-1">
                          {activeGroup.member_count} Members
                        </p>
                      </div>

                      <div className="flex items-center gap-3.5 pt-2 text-xs font-bold">
                        <button
                          onClick={() => setViewMode('chat')}
                          className="px-4 py-2 bg-cyan-950/40 border border-cyan-500/20 hover:bg-cyan-950/70 text-cyan-400 rounded-xl transition-all flex items-center gap-1"
                        >
                          <MessageSquare size={12} /> Message
                        </button>
                        <button
                          onClick={() => setViewMode('settings')}
                          className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-white rounded-xl transition-all flex items-center gap-1"
                        >
                          <Settings size={12} /> Settings
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 text-left pt-2">
                      <h4 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Details</h4>
                      <div className="rounded-2xl border border-slate-900 bg-slate-950/30 p-4 space-y-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-slate-500">Description</p>
                          <p className="mt-1 text-xs text-slate-300">{activeGroup.description || 'No description added.'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-slate-500">Conversation</p>
                          <p className="mt-1 text-xs text-slate-300 break-all">{activeGroup.conversation_id || 'No linked thread found.'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-slate-500">Updated</p>
                          <p className="mt-1 text-xs text-slate-300">{formatDateTime(activeGroup.updated_at || activeGroup.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-slate-900/60">
                    <button
                      onClick={() => setViewMode('settings')}
                      className="w-full py-2.5 bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Settings size={12} />
                      <span>Group Settings</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full border border-slate-900 border-dashed rounded-3xl flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  <Users size={24} className="text-slate-600 mb-2" />
                  <p className="text-sm font-semibold">Select a group</p>
                  <p className="text-xs text-slate-600 mt-1">Choose a group card to view its details and chat panel.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
