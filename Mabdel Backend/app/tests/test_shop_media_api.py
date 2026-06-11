from __future__ import annotations

import asyncio
from pathlib import Path

from bson import ObjectId

from app.core.config import settings
from app.core.security import create_access_token
from app.utils.helpers import utc_now


def _admin_headers(mock_db, email: str = "shop-admin@example.com") -> tuple[dict[str, str], str]:
    user_id = str(ObjectId())
    asyncio.run(
        mock_db.users.insert_one(
            {
                "_id": ObjectId(user_id),
                "full_name": "Shop Admin",
                "email": email,
                "role": "admin",
                "status": "active",
                "created_at": utc_now(),
            }
        )
    )
    return {"Authorization": f"Bearer {create_access_token(user_id, email)}"}, user_id


def test_admin_product_multipart_upload_stores_image(client, mock_db, tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(settings, "MEDIA_ROOT", str(tmp_path))
    headers, user_id = _admin_headers(mock_db)

    response = client.post(
        "/api/v1/shop/admin/products",
        headers=headers,
        data={"name": "Chef Apron", "price": "24.50", "isActive": "true"},
        files={"image": ("apron.png", b"\x89PNG\r\n\x1a\nproduct-image", "image/png")},
    )

    assert response.status_code == 200
    product = response.json()["data"]
    assert product["imageUrl"].startswith("http://127.0.0.1:8000/media/shop_products/")
    assert product["imageMeta"]["contentType"] == "image/png"
    assert product["imageMeta"]["sizeBytes"] > 0
    assert list((Path(tmp_path) / "shop_products" / user_id).glob("*.png"))
