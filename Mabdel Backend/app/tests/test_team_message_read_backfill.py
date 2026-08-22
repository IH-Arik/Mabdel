from __future__ import annotations

import asyncio

from scripts.backfill_team_message_read_state import backfill


def test_backfill_marks_existing_shared_history_as_read(mock_db) -> None:
    """Legacy messages carry an empty read_by; without the migration every one of
    them would light up as unread for everyone the moment the new model went live."""

    async def _run() -> dict:
        team = await mock_db.conversations.insert_one(
            {"user_id": "user-a", "member_ids": ["user-a", "user-b"], "type": "direct"}
        )
        external = await mock_db.conversations.insert_one(
            {"user_id": "user-a", "member_ids": ["user-a"], "platform": "whatsapp"}
        )
        await mock_db.messages.insert_many(
            [
                {"conversation_id": str(team.inserted_id), "sender_user_id": "user-a", "content": "old 1", "read_by": []},
                {"conversation_id": str(team.inserted_id), "sender_user_id": "user-b", "content": "old 2", "read_by": []},
                {"conversation_id": str(external.inserted_id), "content": "customer msg", "unread_count": 1, "read_by": []},
            ]
        )
        result = await backfill(mock_db)
        return {
            "result": result,
            "team_id": str(team.inserted_id),
            "external_id": str(external.inserted_id),
        }

    data = asyncio.run(_run())

    async def _check() -> None:
        # Both members are recorded as having read the whole colleague thread.
        async for message in mock_db.messages.find({"conversation_id": data["team_id"]}):
            assert set(message["read_by"]) >= {"user-a", "user-b"}, message

        # An external-channel inbox is left on the unread_count model, untouched.
        external_message = await mock_db.messages.find_one({"conversation_id": data["external_id"]})
        assert external_message["read_by"] == []
        assert external_message["unread_count"] == 1

    asyncio.run(_check())
    assert data["result"]["conversations_touched"] == 1


def test_backfill_is_safe_to_run_twice(mock_db) -> None:
    async def _run() -> list[str]:
        conversation = await mock_db.conversations.insert_one(
            {"user_id": "owner-1", "member_ids": ["owner-1", "member-2"], "type": "direct"}
        )
        await mock_db.messages.insert_one(
            {"conversation_id": str(conversation.inserted_id), "sender_user_id": "owner-1", "read_by": []}
        )
        await backfill(mock_db)
        await backfill(mock_db)
        message = await mock_db.messages.find_one({"conversation_id": str(conversation.inserted_id)})
        return message["read_by"]

    read_by = asyncio.run(_run())
    assert sorted(read_by) == ["member-2", "owner-1"], f"re-running duplicated entries: {read_by}"
