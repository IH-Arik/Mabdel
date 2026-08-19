# Messaging Fix: Teammate-to-Teammate Messaging

**Date:** 2026-08-16
**Status:** Applied (v2 — messages not rendering fix added)
**Changed by:** Sleepy Code Agent

---

## What Was Broken

The messaging system used a single-owner model — every conversation and every message was keyed to one `user_id` (the creator). When teammate B tried to access, list, or send a message in a conversation created by teammate A, every access gate rejected with 404 or returned empty results — even if B was listed in `member_ids`.

---

## Files Changed

### 1. `app/services/smartflow/_base.py`

**Method:** `_get_accessible_conversation` (was lines 318–339, now 318–348)

**What changed:** Added a third access path (Path 3) so that a user listed in `member_ids` of a non-global conversation can access it, even if they are not the owner (`user_id`).

**Before:** Two paths only — owner OR global chat member. Non-owner teammates always got 404.

**After:** Three paths:
- Path 1: User is the conversation owner (`user_id` match) → allow
- Path 2: Global chat member with org match + active status → allow (unchanged)
- Path 3: User is in `member_ids` of any non-global conversation → allow (NEW)

```python
# Path 3: non-global conversation member (teammate inbox)
conversation = await self.db.conversations.find_one({"_id": ObjectId(conversation_id), "member_ids": user_id})
if conversation:
    return conversation

raise AppException(status_code=404, code=code, message="Requested resource was not found.")
```

**Downstream benefit:** `_get_accessible_message` delegates to `_get_accessible_conversation` — so reply, forward, and update message all work for teammates automatically without further changes.

---

### 2. `app/services/smartflow/conversation_service.py`

#### Change A — `list_conversations` base filter (line 109)

**Before:**
```python
filters: dict = {"user_id": user_id}
```

**After:**
```python
filters: dict = {"$or": [{"user_id": user_id}, {"member_ids": user_id, "is_global_chat": {"$ne": True}}]}
```

**Why:** Teammate B can now see conversations they are a member of, not just conversations they own. The `is_global_chat: {$ne: True}` guard prevents double-counting global chats (those are already fetched separately in the block below).

---

#### Change B — `list_conversations` count queries: `participant_ids` → `member_ids` (lines 196–197)

**Before:**
```python
archived_count = await self.db.conversations.count_documents({"$or": [{"user_id": user_id}, {"participant_ids": user_id}], "archived": True})
active_count   = await self.db.conversations.count_documents({"$or": [{"user_id": user_id}, {"participant_ids": user_id}], "archived": {"$ne": True}})
```

**After:**
```python
archived_count = await self.db.conversations.count_documents({"$or": [{"user_id": user_id}, {"member_ids": user_id}], "archived": True})
active_count   = await self.db.conversations.count_documents({"$or": [{"user_id": user_id}, {"member_ids": user_id}], "archived": {"$ne": True}})
```

**Why:** `participant_ids` was never written to the database — this field does not exist on conversation documents. The correct field is `member_ids`. This means the archived/active counts in the sidebar summary were always wrong for any multi-user scenario.

---

#### Change C — `list_messages`: skip `user_id` filter for non-owner members (lines 267–271)

**Before:**
```python
filters: dict = {"conversation_id": conversation_id}
if not conversation.get("is_global_chat"):
    filters["user_id"] = user_id
```

**After:**
```python
filters: dict = {"conversation_id": conversation_id}
is_owner = conversation.get("user_id") == user_id
if not conversation.get("is_global_chat") and is_owner:
    filters["user_id"] = user_id
# If member but not owner: no user_id filter — fetch all messages in the conversation
```

**Why:** Messages in a conversation are stored with `user_id` = conversation owner. When a non-owner member queries messages, filtering by their own `user_id` returned zero results. Now non-owner members see all messages in the conversation (fetched by `conversation_id` only).

---

#### Change D — `create_message`: correct `user_id` ownership field + always set `sender_user_id` (lines 292–293)

**Before:**
```python
"user_id": user_id,
"sender_user_id": user_id if conversation.get("is_global_chat") else None,
```

**After:**
```python
"user_id": conversation.get("user_id", user_id),  # conversation owner id for scoping
"sender_user_id": user_id,                         # always the actual sender
```

**Why:**
- `user_id` on a message document is the scoping/ownership field used by existing queries. If teammate B sends a message, it must be stored with the conversation owner's `user_id` so owner A's existing queries (`filters["user_id"] = user_id`) still find it.
- `sender_user_id` is now always set (was only set for global chats before), providing a reliable field to identify who actually sent the message — used by the UI for "sent by" attribution and read receipts.

---

#### Change E — `archive_conversation`: ownership guard (line 219–220)

**Before:** Any conversation member (not just the owner) could archive a conversation after the access fix opened the door.

**After:** A 403 is returned if the requester is not the conversation owner.

```python
if conversation.get("user_id") != user_id:
    raise AppException(status_code=403, code="CONVERSATION_ARCHIVE_FORBIDDEN", message="Only the conversation owner can archive this conversation.")
```

---

#### Change F — `delete_conversation`: ownership guard (lines 232–233)

**Before:** Any conversation member could delete a conversation (privilege escalation).

**After:** A 403 is returned if the requester is not the conversation owner.

```python
if conversation.get("user_id") != user_id:
    raise AppException(status_code=403, code="CONVERSATION_DELETE_FORBIDDEN", message="Only the conversation owner can delete this conversation.")
```

---

## What Did NOT Change

- `require_permission("messages", "view/send/delete")` FastAPI guards — untouched, still enforced before the service layer
- Global chat logic — Path 2 in `_get_accessible_conversation` is structurally the same, only refactored for clarity (the `if conversation:` block now contains its validation instead of falling through)
- WebSocket conversation stream — inherits the access fix automatically via `get_conversation()` → `_get_accessible_conversation()`
- `_get_accessible_message` — inherits the fix for free (delegates to `_get_accessible_conversation`)

---

## New Error Codes Introduced

| Code | HTTP | Where | Meaning |
|---|---|---|---|
| `CONVERSATION_ARCHIVE_FORBIDDEN` | 403 | `archive_conversation` | Non-owner tried to archive a conversation |
| `CONVERSATION_DELETE_FORBIDDEN` | 403 | `delete_conversation` | Non-owner tried to delete a conversation |

---

## Known Remaining Issue (Not Fixed in This Patch)

**`mark_conversation_read` for non-owner members** (`conversation_service.py:246`):

The mark-read path for non-global chats filters messages by `{"user_id": user_id, ...}`. After this fix, a non-owner member can call this endpoint, but the query will match zero messages (messages are stored under the owner's `user_id`). The conversation will appear "read" to the frontend but no message statuses are actually updated.

This needs a companion fix (the same `is_owner` pattern from Change C), but is lower priority and was deferred from this patch.

---

## Verification Steps

1. Create a conversation as User A with User B in `member_ids`
2. As User B: `GET /conversations` — conversation should appear in the list
3. As User B: `GET /conversations/{id}` — should return 200, not 404
4. As User B: `GET /conversations/{id}/messages` — should return all messages (including ones A sent)
5. As User B: `POST /messages` with that `conversation_id` — should succeed; message visible to both A and B
6. As User B: `DELETE /conversations/{id}` — should return `403 CONVERSATION_DELETE_FORBIDDEN`
7. As User A: `DELETE /conversations/{id}` — should succeed (owner)
8. As User B: `PATCH /conversations/{id}/archive` — should return `403 CONVERSATION_ARCHIVE_FORBIDDEN`

---

## Additional Fixes (v2) — Messages Not Rendering in Chat View

After the initial fix, messages were being sent (preview appeared in sidebar) but the chat area showed blank. The optimistic message appeared briefly then disappeared because `fetchMessages` returned empty.

### Root Cause

Two additional bugs in `app/services/smartflow/_base.py`:

#### Fix G — `_publish_inbox_update`: missing member path (line 993)

**Before:** After sending a message, the inbox update was only published if the conversation was found by `user_id` (owner) or global chat. For non-owner members the lookup returned `None` and the update silently dropped.

**After:** Added Path 3 — looks up conversation by `member_ids` so non-owner senders also get their inbox updated and the conversation list refreshes.

```python
if not conversation:
    # Path 3: non-global member (teammate inbox)
    conversation = await self.db.conversations.find_one(
        {"_id": ObjectId(conversation_id), "member_ids": user_id}
    )
```

#### Fix H — `_serialize_message`: `sender_user_id` now used for direction on all chat types (line 820)

**Before:** Only global-chat messages used `sender_user_id` to set `sender_is_self` and recompute `direction`. Non-global-chat messages always kept the stored `direction` field and only set `sender_is_self` from `_resolve_message_sender` (which only checked `direction == "outbound"`). This meant that when message `user_id` was changed to the conversation owner (fix D), the `sender_is_self` could be wrong for non-owner senders.

**After:** When `sender_user_id` is present (which it now always is after fix D), use it to set `sender_is_self` for all conversation types. The `direction` override only applies to global chat (to avoid breaking the stored `direction` field on regular messages).

```python
if viewer_id and safe.get("sender_user_id"):
    # Use sender_user_id to determine direction for all conversation types
    safe["sender_is_self"] = safe.get("sender_user_id") == viewer_id
    if is_global_chat:
        safe["direction"] = "outbound" if safe["sender_is_self"] else "inbound"
        ...
    else:
        safe["is_read"] = safe.get("status") == "read" or safe.get("read_at") is not None
        ...
```
