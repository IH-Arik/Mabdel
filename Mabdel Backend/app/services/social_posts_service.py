from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.crypto import decrypt_value
from app.core.exceptions import AppException
from app.utils.helpers import resolve_team_user_ids, serialize_mongo_document, utc_now

META_GRAPH_VERSION = "v19.0"
META_GRAPH_BASE = f"https://graph.facebook.com/{META_GRAPH_VERSION}"
THREADS_API_BASE = "https://graph.threads.net/v1.0"
LINKEDIN_API_BASE = "https://api.linkedin.com/v2"


class SocialPostsService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def create_post(self, user_id: str, payload: dict) -> dict:
        platforms: list[str] = payload["platforms"]
        content: str = payload["content"]
        media_url: str | None = payload.get("media_url")
        scheduled_at: datetime | None = payload.get("scheduled_at")

        results: list[dict] = []
        team_ids = await resolve_team_user_ids(self.db, user_id)

        for platform in platforms:
            if scheduled_at and scheduled_at > utc_now():
                results.append({"platform": platform, "status": "scheduled", "post_id": None, "error": None})
                continue

            integration = await self.db.social_integrations.find_one(
                {"user_id": user_id, "platform": platform, "status": "connected"}
            ) or await self.db.social_integrations.find_one(
                {"user_id": {"$in": team_ids}, "platform": platform, "status": "connected"}
            )
            if not integration:
                results.append({"platform": platform, "status": "not_connected", "post_id": None, "error": f"No connected {platform} account."})
                continue

            access_token = self._decrypt_token(integration)
            if not access_token:
                results.append({"platform": platform, "status": "failed", "post_id": None, "error": "Access token unavailable."})
                continue

            try:
                if platform == "facebook":
                    post_id = await self._post_to_facebook(integration, access_token, content, media_url)
                elif platform == "instagram":
                    post_id = await self._post_to_instagram(integration, access_token, content, media_url)
                elif platform == "linkedin":
                    post_id = await self._post_to_linkedin(integration, access_token, content, media_url)
                elif platform == "x":
                    post_id = await self._post_to_x(integration, access_token, content, media_url)
                elif platform == "threads":
                    post_id = await self._post_to_threads(integration, access_token, content, media_url)
                else:
                    results.append({"platform": platform, "status": "failed", "post_id": None, "error": "Unsupported platform."})
                    continue
                results.append({"platform": platform, "status": "published", "post_id": post_id, "error": None})
            except AppException as exc:
                results.append({"platform": platform, "status": "failed", "post_id": None, "error": exc.message})
            except Exception as exc:
                results.append({"platform": platform, "status": "failed", "post_id": None, "error": str(exc)})

        now = utc_now()
        doc = {
            "user_id": user_id,
            "content": content,
            "platforms": platforms,
            "media_url": media_url,
            "scheduled_at": scheduled_at,
            "results": results,
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.social_posts.insert_one(doc)
        doc["_id"] = result.inserted_id
        return serialize_mongo_document(doc)

    async def list_posts(self, user_id: str, page: int = 1, page_size: int = 20) -> dict:
        team_ids = await resolve_team_user_ids(self.db, user_id)
        skip = (page - 1) * page_size
        total = await self.db.social_posts.count_documents({"user_id": {"$in": team_ids}})
        docs = await self.db.social_posts.find({"user_id": {"$in": team_ids}}).sort("created_at", -1).skip(skip).limit(page_size).to_list(length=page_size)
        return {
            "items": [serialize_mongo_document(d) for d in docs],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def get_post(self, user_id: str, post_id: str) -> dict:
        try:
            oid = ObjectId(post_id)
        except Exception:
            raise AppException(status_code=400, code="INVALID_POST_ID", message="Invalid post ID.")
        team_ids = await resolve_team_user_ids(self.db, user_id)
        doc = await self.db.social_posts.find_one({"_id": oid, "user_id": {"$in": team_ids}})
        if not doc:
            raise AppException(status_code=404, code="POST_NOT_FOUND", message="Social post not found.")
        return serialize_mongo_document(doc)

    # ------------------------------------------------------------------
    # Platform publishers
    # ------------------------------------------------------------------

    async def _post_to_facebook(self, integration: dict, access_token: str, content: str, media_url: str | None) -> str:
        page_id = (
            integration.get("external_account_id")
            or (integration.get("provider_metadata") or {}).get("page_id")
        )
        if not page_id:
            raise AppException(status_code=409, code="FB_PAGE_ID_MISSING", message="Facebook Page ID not found. Reconnect your Facebook account.")

        params: dict[str, Any] = {"message": content, "access_token": access_token}
        if media_url:
            params["link"] = media_url

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{META_GRAPH_BASE}/{page_id}/feed", json=params)

        data = response.json()
        if response.status_code >= 400 or "error" in data:
            error_msg = (data.get("error") or {}).get("message", "Facebook post failed.")
            raise AppException(status_code=502, code="FB_POST_FAILED", message=error_msg)

        return data.get("id", "")

    async def _post_to_instagram(self, integration: dict, access_token: str, content: str, media_url: str | None) -> str:
        meta = integration.get("provider_metadata") or {}
        ig_user_id = meta.get("ig_user_id") or integration.get("external_account_id")
        if not ig_user_id:
            raise AppException(status_code=409, code="IG_USER_ID_MISSING", message="Instagram Business Account ID not found. Reconnect your Instagram account.")

        async with httpx.AsyncClient(timeout=30.0) as client:
            # Step 1 – create media container
            container_params: dict[str, Any] = {"caption": content, "access_token": access_token}
            if media_url:
                container_params["image_url"] = media_url
            else:
                # Instagram requires media; fall back to a text-only note when no image
                container_params["media_type"] = "REELS" if not media_url else "IMAGE"

            container_resp = await client.post(f"{META_GRAPH_BASE}/{ig_user_id}/media", json=container_params)
            container_data = container_resp.json()
            if container_resp.status_code >= 400 or "error" in container_data:
                error_msg = (container_data.get("error") or {}).get("message", "Instagram media container creation failed.")
                raise AppException(status_code=502, code="IG_CONTAINER_FAILED", message=error_msg)

            creation_id = container_data.get("id")
            if not creation_id:
                raise AppException(status_code=502, code="IG_CONTAINER_FAILED", message="Instagram did not return a creation ID.")

            # Step 2 – publish
            publish_resp = await client.post(
                f"{META_GRAPH_BASE}/{ig_user_id}/media_publish",
                json={"creation_id": creation_id, "access_token": access_token},
            )
            publish_data = publish_resp.json()
            if publish_resp.status_code >= 400 or "error" in publish_data:
                error_msg = (publish_data.get("error") or {}).get("message", "Instagram publish failed.")
                raise AppException(status_code=502, code="IG_PUBLISH_FAILED", message=error_msg)

        return publish_data.get("id", "")

    async def _post_to_linkedin(self, integration: dict, access_token: str, content: str, media_url: str | None) -> str:
        meta = integration.get("provider_metadata") or {}
        person_urn = meta.get("linkedin_person_urn") or integration.get("external_account_id")
        if not person_urn:
            raise AppException(status_code=409, code="LI_URN_MISSING", message="LinkedIn Person URN not found. Reconnect your LinkedIn account.")

        author = person_urn if person_urn.startswith("urn:") else f"urn:li:person:{person_urn}"
        body: dict[str, Any] = {
            "author": author,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": content},
                    "shareMediaCategory": "NONE" if not media_url else "ARTICLE",
                    **({"media": [{"status": "READY", "originalUrl": media_url}]} if media_url else {}),
                }
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{LINKEDIN_API_BASE}/ugcPosts",
                json=body,
                headers={"Authorization": f"Bearer {access_token}", "X-Restli-Protocol-Version": "2.0.0"},
            )

        if response.status_code >= 400:
            raise AppException(status_code=502, code="LI_POST_FAILED", message=f"LinkedIn post failed: {response.text[:300]}")

        post_id = response.headers.get("x-restli-id") or response.json().get("id", "")
        return str(post_id)

    async def _post_to_x(self, integration: dict, access_token: str, content: str, media_url: str | None) -> str:
        # X (Twitter) v2 API requires OAuth 2.0 PKCE token
        body: dict[str, Any] = {"text": content[:280]}

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.twitter.com/2/tweets",
                json=body,
                headers={"Authorization": f"Bearer {access_token}"},
            )

        data = response.json()
        if response.status_code >= 400:
            detail = data.get("detail") or data.get("title") or "X post failed."
            raise AppException(status_code=502, code="X_POST_FAILED", message=detail)

        return data.get("data", {}).get("id", "")

    async def _post_to_threads(self, integration: dict, access_token: str, content: str, media_url: str | None) -> str:
        meta = integration.get("provider_metadata") or {}
        threads_user_id = meta.get("threads_user_id") or integration.get("external_account_id")
        if not threads_user_id:
            raise AppException(status_code=409, code="THREADS_USER_ID_MISSING", message="Threads User ID not found. Reconnect your Threads account.")

        async with httpx.AsyncClient(timeout=30.0) as client:
            # Step 1 — create media container
            container_params: dict[str, Any] = {
                "text": content,
                "access_token": access_token,
            }
            if media_url:
                container_params["media_type"] = "IMAGE"
                container_params["image_url"] = media_url
            else:
                container_params["media_type"] = "TEXT"

            container_resp = await client.post(f"{THREADS_API_BASE}/{threads_user_id}/threads", params=container_params)
            container_data = container_resp.json()
            if container_resp.status_code >= 400 or "error" in container_data:
                error_msg = (container_data.get("error") or {}).get("message", "Threads container creation failed.")
                raise AppException(status_code=502, code="THREADS_CONTAINER_FAILED", message=error_msg)

            creation_id = container_data.get("id")
            if not creation_id:
                raise AppException(status_code=502, code="THREADS_CONTAINER_FAILED", message="Threads did not return a creation ID.")

            # Step 2 — publish
            publish_resp = await client.post(
                f"{THREADS_API_BASE}/{threads_user_id}/threads_publish",
                params={"creation_id": creation_id, "access_token": access_token},
            )
            publish_data = publish_resp.json()
            if publish_resp.status_code >= 400 or "error" in publish_data:
                error_msg = (publish_data.get("error") or {}).get("message", "Threads publish failed.")
                raise AppException(status_code=502, code="THREADS_PUBLISH_FAILED", message=error_msg)

        return publish_data.get("id", "")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _decrypt_token(integration: dict) -> str | None:
        encrypted = integration.get("access_token_encrypted")
        return decrypt_value(encrypted) if encrypted else None
