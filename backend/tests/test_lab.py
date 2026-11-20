import io
from unittest.mock import patch
from app.models import LabConsent, LabReport, LabResult
from app.services.encryption import encrypt_lab_value, decrypt_lab_value


def test_encryption_roundtrip():
    original = 142.5
    encrypted = encrypt_lab_value(original)
    assert encrypted != str(original)
    assert isinstance(encrypted, str)
    decrypted = decrypt_lab_value(encrypted)
    assert decrypted == original


def test_consent_endpoints(client, auth_headers):
    # Check initial consent
    res = client.get("/api/v1/lab/consent", headers=auth_headers)
    assert res.status_code == 200
    assert res.get_json()["consented"] is False

    # Grant consent
    res = client.post("/api/v1/lab/consent", headers=auth_headers, json={"consented": True})
    assert res.status_code == 200
    assert res.get_json()["consented"] is True

    # Withdraw consent
    res = client.delete("/api/v1/lab/consent", headers=auth_headers)
    assert res.status_code == 200
    assert res.get_json()["consented"] is False


def test_results_consent_enforcement(client, auth_headers):
    # Attempt to post results without consent -> 403
    payload = {
        "parameter": "fasting_blood_glucose",
        "value": 90,
        "unit": "mg/dL",
        "test_date": "2026-11-15",
    }
    res = client.post("/api/v1/lab/results", headers=auth_headers, json=payload)
    assert res.status_code == 403
    assert res.get_json()["error"]["code"] == "consent_required"


def test_manual_results_crud(client, auth_headers):
    # Grant consent first
    client.post("/api/v1/lab/consent", headers=auth_headers, json={"consented": True})

    # Create result
    payload = {
        "parameter": "fasting_blood_glucose",
        "value": 110,
        "unit": "mg/dL",
        "test_date": "2026-11-15",
        "notes": "Morning checkup",
    }
    res = client.post("/api/v1/lab/results", headers=auth_headers, json=payload)
    assert res.status_code == 201
    data = res.get_json()
    assert len(data) == 1
    item = data[0]
    result_id = item["id"]
    assert item["parameter"] == "fasting_blood_glucose"
    assert item["value"] == 110.0
    assert item["classification"] == "borderline"

    # List results
    res = client.get("/api/v1/lab/results", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.get_json()) == 1

    # Filter by date
    res = client.get("/api/v1/lab/results?date=2026-11-15", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.get_json()) == 1

    # Update result
    patch_res = client.patch(
        f"/api/v1/lab/results/{result_id}",
        headers=auth_headers,
        json={"value": 85},
    )
    assert patch_res.status_code == 200
    updated = patch_res.get_json()
    assert updated["value"] == 85.0
    assert updated["classification"] == "within_reference"

    # Delete result
    del_res = client.delete(f"/api/v1/lab/results/{result_id}", headers=auth_headers)
    assert del_res.status_code == 200
    assert len(client.get("/api/v1/lab/results", headers=auth_headers).get_json()) == 0


def test_user_isolation(client, two_users):
    auth1 = {"Authorization": f"Bearer {two_users['token_a']}"}
    auth2 = {"Authorization": f"Bearer {two_users['token_b']}"}

    # Grant consent for both
    client.post("/api/v1/lab/consent", headers=auth1, json={"consented": True})
    client.post("/api/v1/lab/consent", headers=auth2, json={"consented": True})

    # User 1 creates result
    res1 = client.post(
        "/api/v1/lab/results",
        headers=auth1,
        json={"parameter": "haemoglobin", "value": 14.0, "unit": "g/dL", "test_date": "2026-11-15"},
    )
    result_id = res1.get_json()[0]["id"]

    # User 2 cannot see User 1's result
    list2 = client.get("/api/v1/lab/results", headers=auth2).get_json()
    assert len(list2) == 0

    # User 2 cannot patch or delete User 1's result
    assert client.patch(f"/api/v1/lab/results/{result_id}", headers=auth2, json={"value": 15}).status_code == 404
    assert client.delete(f"/api/v1/lab/results/{result_id}", headers=auth2).status_code == 404


def test_results_history_and_insights(client, auth_headers):
    client.post("/api/v1/lab/consent", headers=auth_headers, json={"consented": True})

    # Add two readings for hemoglobin
    client.post(
        "/api/v1/lab/results",
        headers=auth_headers,
        json={"parameter": "haemoglobin", "value": 11.0, "unit": "g/dL", "test_date": "2026-10-01"},
    )
    client.post(
        "/api/v1/lab/results",
        headers=auth_headers,
        json={"parameter": "haemoglobin", "value": 13.5, "unit": "g/dL", "test_date": "2026-11-01"},
    )

    # History
    res = client.get("/api/v1/lab/results/history", headers=auth_headers)
    assert res.status_code == 200
    hist = res.get_json()
    hb_hist = hist["haemoglobin"]
    assert len(hb_hist["records"]) == 2
    assert hb_hist["previous"]["value"] == 11.0
    assert hb_hist["latest"]["value"] == 13.5
    assert hb_hist["delta"] == 2.5

    # Insights
    ins_res = client.get("/api/v1/lab/insights", headers=auth_headers)
    assert ins_res.status_code == 200
    ins_data = ins_res.get_json()
    assert ins_data["total_parameters_recorded"] == 1
    assert ins_data["normal_count"] == 1


def test_report_upload_ocr_draft(client, auth_headers):
    client.post("/api/v1/lab/consent", headers=auth_headers, json={"consented": True})

    mock_draft = {
        "test_date": "2026-11-18",
        "extracted_parameters": [
            {
                "parameter": "fasting_blood_glucose",
                "display_name": "Fasting Blood Glucose",
                "value": 115.0,
                "unit": "mg/dL",
                "confidence": 0.95,
                "raw_text": "Fasting Blood Glucose : 115 mg/dL",
                "needs_review": False,
            }
        ],
        "total_extracted": 1,
        "is_draft": True,
        "requires_confirmation": True,
    }

    with patch("app.api.lab.process_report_file", return_value=mock_draft):
        data = {
            "file": (io.BytesIO(b"fake pdf content"), "blood_test.pdf")
        }
        res = client.post(
            "/api/v1/lab/reports/upload",
            headers=auth_headers,
            content_type="multipart/form-data",
            data=data,
        )
        assert res.status_code == 201
        body = res.get_json()
        assert "report_id" in body
        assert body["draft"]["total_extracted"] == 1
        assert body["draft"]["is_draft"] is True

        rep_id = body["report_id"]

        # List reports
        reps = client.get("/api/v1/lab/reports", headers=auth_headers).get_json()
        assert len(reps) == 1

        # Delete report
        del_rep = client.delete(f"/api/v1/lab/reports/{rep_id}", headers=auth_headers)
        assert del_rep.status_code == 200
