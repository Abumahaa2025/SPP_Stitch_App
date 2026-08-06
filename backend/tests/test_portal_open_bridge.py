"""Portal HTTPS bridge must return a real HTML page (not text/plain / JSON)."""

from fastapi.testclient import TestClient

from server import app


client = TestClient(app)


def test_portal_open_returns_html_page():
    res = client.get(
        "/portal/open",
        params={
            "role": "tenant",
            "id": "tenant_demo",
            "t": "tok_demo",
            "n": "سامي",
            "u": "12",
        },
    )
    assert res.status_code == 200
    ctype = (res.headers.get("content-type") or "").lower()
    assert "text/html" in ctype
    assert "text/plain" not in ctype
    body = res.text
    assert "<!DOCTYPE html>" in body or "<html" in body.lower()
    assert "SPP" in body or "بوابة" in body
    assert "jsdelivr" not in body.lower()


def test_portal_open_no_cdn_redirect():
    res = client.get("/portal/open?role=tech&t=abc", follow_redirects=False)
    assert res.status_code == 200
    assert "text/html" in (res.headers.get("content-type") or "").lower()
