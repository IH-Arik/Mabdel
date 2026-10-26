"""Pytest guard used by verify_receptionist_local.py to forbid external sockets."""
import ipaddress
import socket

import pytest


def _is_loopback(address):
    if not isinstance(address, tuple):
        return True  # UNIX socket / asyncio socketpair
    host = str(address[0]).split("%", 1)[0]
    if host.lower() == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


@pytest.fixture(autouse=True)
def _forbid_external_network(monkeypatch):
    original_connect = socket.socket.connect
    original_connect_ex = socket.socket.connect_ex
    def connect(sock, address):
        if not _is_loopback(address):
            raise AssertionError("External network is disabled during local acceptance tests")
        return original_connect(sock, address)
    def connect_ex(sock, address):
        if not _is_loopback(address):
            raise AssertionError("External network is disabled during local acceptance tests")
        return original_connect_ex(sock, address)
    monkeypatch.setattr(socket.socket, "connect", connect)
    monkeypatch.setattr(socket.socket, "connect_ex", connect_ex)
