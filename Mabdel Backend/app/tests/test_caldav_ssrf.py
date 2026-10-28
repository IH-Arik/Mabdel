from __future__ import annotations

import asyncio

import pytest

from app.core.exceptions import AppException
from app.services.smartflow.caldav_service import CalDAVService, _assert_safe_caldav_destination

# Regression for B04: CalDAV discovery accepted any server_url, followed any
# redirect, and fetched any href the remote server's own response pointed at -
# an attacker-controlled or compromised CalDAV server could aim any of those
# at an internal/loopback service reachable from this backend (cloud metadata
# endpoints included). _assert_safe_caldav_destination is now the single
# chokepoint every outbound request passes through.


@pytest.mark.parametrize("url", [
    "http://caldav.icloud.com/",  # not https
    "https://127.0.0.1/",
    "https://localhost/",
    "https://169.254.169.254/latest/meta-data/",  # cloud metadata endpoint
    "https://10.0.0.5/",
    "https://192.168.1.1/",
])
def test_unsafe_destinations_are_rejected(url):
    with pytest.raises(AppException):
        _assert_safe_caldav_destination(url)


def test_a_real_public_https_host_is_allowed():
    _assert_safe_caldav_destination("https://caldav.icloud.com/")  # does not raise


def test_connect_rejects_a_malicious_server_url(mock_db):
    service = CalDAVService(mock_db)

    with pytest.raises(AppException):
        asyncio.run(service.connect("user-1", "someone@example.com", "app-password", server_url="https://169.254.169.254/"))
