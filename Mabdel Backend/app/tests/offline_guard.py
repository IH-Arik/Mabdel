"""Opt-in pytest plugin: local acceptance must never reach external services.

Load with ``pytest -p app.tests.offline_guard``. Loopback is permitted for local
test servers; provider calls must use the suite's explicit test doubles.
"""
from __future__ import annotations

import ipaddress
import socket

_originals = {}


def _local(host):
    if host is None:
        return True
    if isinstance(host, bytes):
        host = host.decode("ascii", errors="replace")
    if str(host).lower() == "localhost":
        return True
    try:
        return ipaddress.ip_address(str(host).split("%", 1)[0]).is_loopback
    except ValueError:
        return False


def pytest_sessionstart(session):
    _originals.update(connect=socket.socket.connect, connect_ex=socket.socket.connect_ex,
                      getaddrinfo=socket.getaddrinfo)

    def connect(sock, address):
        if isinstance(address, tuple) and not _local(address[0]):
            raise RuntimeError("Offline acceptance blocks external network connections.")
        return _originals["connect"](sock, address)

    def connect_ex(sock, address):
        if isinstance(address, tuple) and not _local(address[0]):
            raise RuntimeError("Offline acceptance blocks external network connections.")
        return _originals["connect_ex"](sock, address)

    def getaddrinfo(host, *args, **kwargs):
        if not _local(host):
            raise RuntimeError("Offline acceptance blocks external DNS lookup.")
        return _originals["getaddrinfo"](host, *args, **kwargs)

    socket.socket.connect = connect
    socket.socket.connect_ex = connect_ex
    socket.getaddrinfo = getaddrinfo


def pytest_sessionfinish(session, exitstatus):
    if _originals:
        socket.socket.connect = _originals["connect"]
        socket.socket.connect_ex = _originals["connect_ex"]
        socket.getaddrinfo = _originals["getaddrinfo"]
