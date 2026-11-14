"""Tests for auth endpoints."""
import pytest


def test_register_success(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "new@example.com", "password": "securepassword"},
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert "user" in data
    assert data["user"]["email"] == "new@example.com"


def test_register_duplicate_email(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "dup@example.com", "password": "password123"},
    )
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "dup@example.com", "password": "password123"},
    )
    assert resp.status_code == 409
    assert resp.get_json()["error"]["code"] == "conflict"


def test_register_invalid_email(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "not-an-email", "password": "password123"},
    )
    assert resp.status_code == 422


def test_register_short_password(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "short@example.com", "password": "short"},
    )
    assert resp.status_code == 422


def test_login_success(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "login@example.com", "password": "mypassword"},
    )
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "login@example.com", "password": "mypassword"},
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_wrong_password(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "badpw@example.com", "password": "rightpassword"},
    )
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "badpw@example.com", "password": "wrongpassword"},
    )
    assert resp.status_code == 401
    assert resp.get_json()["error"]["code"] == "invalid_credentials"


def test_login_nonexistent_user(client):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "password"},
    )
    assert resp.status_code == 401


def test_me_requires_auth(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_me_returns_user_and_profile(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "me@example.com", "password": "password123"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "me@example.com", "password": "password123"},
    )
    token = login.get_json()["access_token"]

    resp = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["email"] == "me@example.com"
    assert "profile" in data


def test_patch_me_diet_type(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "patchme@example.com", "password": "password123"},
    )
    token = client.post(
        "/api/v1/auth/login",
        json={"email": "patchme@example.com", "password": "password123"},
    ).get_json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.patch(
        "/api/v1/auth/me",
        json={"diet_type": "veg", "age": 28, "allergies": ["milk"]},
        headers=headers,
    )
    assert resp.status_code == 200
    profile = resp.get_json()["profile"]
    assert profile["diet_type"] == "veg"
    assert profile["age"] == 28
    assert "milk" in profile["allergies"]


def test_patch_me_invalid_diet(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "baddiet@example.com", "password": "password123"},
    )
    token = client.post(
        "/api/v1/auth/login",
        json={"email": "baddiet@example.com", "password": "password123"},
    ).get_json()["access_token"]

    resp = client.patch(
        "/api/v1/auth/me",
        json={"diet_type": "paleo"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


def test_delete_my_data(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "deletedata@example.com", "password": "password123"},
    )
    token = client.post(
        "/api/v1/auth/login",
        json={"email": "deletedata@example.com", "password": "password123"},
    ).get_json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.delete("/api/v1/auth/me/data", headers=headers)
    assert resp.status_code == 200
    assert "deleted" in resp.get_json()["message"]


def test_refresh_token(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "refresh@example.com", "password": "password123"},
    )
    tokens = client.post(
        "/api/v1/auth/login",
        json={"email": "refresh@example.com", "password": "password123"},
    ).get_json()
    refresh_token = tokens["refresh_token"]

    resp = client.post(
        "/api/v1/auth/refresh",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.get_json()
