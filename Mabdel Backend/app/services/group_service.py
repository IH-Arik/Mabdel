from __future__ import annotations


class GroupService:
    def create_group(self, name: str, members: list[str]) -> dict:
        return {
            "name": name,
            "members": members,
            "member_count": len(members),
            "status": "created",
        }
