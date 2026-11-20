import os
import uuid
from datetime import datetime, timezone, date
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from ..extensions import db
from ..models import User, LabConsent, LabReport, LabResult, UserProfile
from ..services.lab_rule_engine import get_rule_engine
from ..services.ocr_service import process_report_file

lab_bp = Blueprint("lab", __name__)

ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}
SUPPORTED_PARAMETERS = {
    "fasting_blood_glucose",
    "hba1c",
    "ldl_cholesterol",
    "hdl_cholesterol",
    "triglycerides",
    "haemoglobin",
    "vitamin_d",
    "vitamin_b12",
}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def check_user_consent(user_id: int) -> bool:
    consent = LabConsent.query.filter_by(user_id=user_id, consented=True).first()
    return consent is not None


# ---------------------------------------------------------------------------
# Consent Endpoints
# ---------------------------------------------------------------------------
@lab_bp.route("/lab/consent", methods=["GET"])
@jwt_required()
def get_consent():
    user_id = int(get_jwt_identity())
    consent = LabConsent.query.filter_by(user_id=user_id).first()
    if not consent:
        return jsonify({"consented": False, "consented_at": None, "withdrawn_at": None}), 200
    return jsonify(consent.to_dict()), 200


@lab_bp.route("/lab/consent", methods=["POST"])
@jwt_required()
def set_consent():
    user_id = int(get_jwt_identity())
    body = request.get_json(silent=True) or {}
    consented = body.get("consented", True)

    consent = LabConsent.query.filter_by(user_id=user_id).first()
    now = datetime.now(timezone.utc)

    if not consent:
        consent = LabConsent(
            user_id=user_id,
            consented=consented,
            consented_at=now,
        )
        db.session.add(consent)
    else:
        consent.consented = consented
        if consented:
            consent.consented_at = now
            consent.withdrawn_at = None
        else:
            consent.withdrawn_at = now

    db.session.commit()
    return jsonify(consent.to_dict()), 200


@lab_bp.route("/lab/consent", methods=["DELETE"])
@jwt_required()
def withdraw_consent():
    user_id = int(get_jwt_identity())
    consent = LabConsent.query.filter_by(user_id=user_id).first()
    if consent:
        consent.consented = False
        consent.withdrawn_at = datetime.now(timezone.utc)
        db.session.commit()
    return jsonify({"message": "Consent withdrawn successfully", "consented": False}), 200


# ---------------------------------------------------------------------------
# Report Upload & OCR
# ---------------------------------------------------------------------------
@lab_bp.route("/lab/reports/upload", methods=["POST"])
@jwt_required()
def upload_report():
    user_id = int(get_jwt_identity())
    if not check_user_consent(user_id):
        return jsonify({
            "error": {
                "code": "consent_required",
                "message": "User consent is required before uploading laboratory reports.",
                "details": {},
            }
        }), 403

    if "file" not in request.files:
        return jsonify({
            "error": {
                "code": "missing_file",
                "message": "No file part in the request.",
                "details": {},
            }
        }), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({
            "error": {
                "code": "no_selected_file",
                "message": "No file selected for upload.",
                "details": {},
            }
        }), 400

    if not allowed_file(file.filename):
        return jsonify({
            "error": {
                "code": "unsupported_file_type",
                "message": "Supported formats are PDF, PNG, JPG, and JPEG.",
                "details": {},
            }
        }), 400

    upload_folder = current_app.config.get("UPLOAD_FOLDER", "/tmp/nutrisense_uploads")
    os.makedirs(upload_folder, exist_ok=True)

    original_name = secure_filename(file.filename)
    unique_name = f"{user_id}_{uuid.uuid4().hex}_{original_name}"
    save_path = os.path.join(upload_folder, unique_name)
    file.save(save_path)

    file_size = os.path.getsize(save_path)
    mime_type = file.mimetype or ("application/pdf" if original_name.endswith(".pdf") else "image/jpeg")

    # Perform OCR parsing
    draft_data = process_report_file(save_path, mime_type)

    # Create uncommitted/pending LabReport record
    report = LabReport(
        user_id=user_id,
        report_date=datetime.strptime(draft_data["test_date"], "%Y-%m-%d").date() if draft_data.get("test_date") else date.today(),
        original_filename=original_name,
        file_path=save_path,
        file_size=file_size,
        mime_type=mime_type,
        processing_status="completed",
    )
    db.session.add(report)
    db.session.commit()

    return jsonify({
        "report_id": report.id,
        "filename": original_name,
        "draft": draft_data,
        "message": "Report extracted as editable draft. Confirm parameters to save.",
    }), 201


@lab_bp.route("/lab/reports", methods=["GET"])
@jwt_required()
def list_reports():
    user_id = int(get_jwt_identity())
    reports = LabReport.query.filter_by(user_id=user_id).order_by(LabReport.created_at.desc()).all()
    return jsonify([r.to_dict() for r in reports]), 200


@lab_bp.route("/lab/reports/<int:report_id>", methods=["GET"])
@jwt_required()
def get_report_detail(report_id: int):
    user_id = int(get_jwt_identity())
    report = LabReport.query.filter_by(id=report_id, user_id=user_id).first()
    if not report:
        return jsonify({
            "error": {
                "code": "not_found",
                "message": "Laboratory report not found.",
                "details": {},
            }
        }), 404

    results = LabResult.query.filter_by(report_id=report.id, user_id=user_id).all()
    rep_dict = report.to_dict()
    rep_dict["results"] = [r.to_dict() for r in results]
    return jsonify(rep_dict), 200


@lab_bp.route("/lab/reports/<int:report_id>", methods=["DELETE"])
@jwt_required()
def delete_report(report_id: int):
    user_id = int(get_jwt_identity())
    report = LabReport.query.filter_by(id=report_id, user_id=user_id).first()
    if not report:
        return jsonify({
            "error": {
                "code": "not_found",
                "message": "Laboratory report not found.",
                "details": {},
            }
        }), 404

    # Remove physical file if exists
    if report.file_path and os.path.exists(report.file_path):
        try:
            os.remove(report.file_path)
        except OSError:
            pass

    db.session.delete(report)
    db.session.commit()
    return jsonify({"message": "Report and associated results deleted successfully."}), 200


# ---------------------------------------------------------------------------
# Results CRUD
# ---------------------------------------------------------------------------
@lab_bp.route("/lab/results", methods=["POST"])
@jwt_required()
def create_results():
    user_id = int(get_jwt_identity())
    if not check_user_consent(user_id):
        return jsonify({
            "error": {
                "code": "consent_required",
                "message": "User consent is required before saving laboratory results.",
                "details": {},
            }
        }), 403

    body = request.get_json(silent=True) or {}
    # Accept either single result object or a batch list under 'results'
    items = body.get("results") if "results" in body else [body]
    if not items or not isinstance(items, list):
        return jsonify({
            "error": {
                "code": "invalid_payload",
                "message": "Expected result object or list of results.",
                "details": {},
            }
        }), 400

    engine = get_rule_engine()
    created_list = []

    for item in items:
        param = item.get("parameter")
        if not param or param not in SUPPORTED_PARAMETERS:
            return jsonify({
                "error": {
                    "code": "invalid_parameter",
                    "message": f"Parameter '{param}' is not one of the 8 supported parameters.",
                    "details": {"supported": sorted(list(SUPPORTED_PARAMETERS))},
                }
            }), 400

        try:
            val = float(item.get("value"))
        except (ValueError, TypeError):
            return jsonify({
                "error": {
                    "code": "invalid_value",
                    "message": "Value must be a valid number.",
                    "details": {},
                }
            }), 400

        unit = item.get("unit", "").strip()
        if not unit:
            return jsonify({
                "error": {
                    "code": "missing_unit",
                    "message": "Unit is required.",
                    "details": {},
                }
            }), 400

        test_date_str = item.get("test_date")
        try:
            t_date = datetime.strptime(test_date_str, "%Y-%m-%d").date() if test_date_str else date.today()
        except ValueError:
            return jsonify({
                "error": {
                    "code": "invalid_date_format",
                    "message": "test_date must be formatted as YYYY-MM-DD.",
                    "details": {},
                }
            }), 400

        # Classify via rule engine
        cls_info = engine.classify_value(param, val, unit)

        result = LabResult(
            user_id=user_id,
            report_id=item.get("report_id"),
            parameter=param,
            unit=unit,
            test_date=t_date,
            classification=cls_info["classification"],
            notes=item.get("notes"),
        )
        result.value = val  # setter handles AES-GCM encryption
        db.session.add(result)
        created_list.append(result)

    db.session.commit()
    return jsonify([r.to_dict() for r in created_list]), 201


@lab_bp.route("/lab/results", methods=["GET"])
@jwt_required()
def list_results():
    user_id = int(get_jwt_identity())
    query = LabResult.query.filter_by(user_id=user_id)

    filter_date = request.args.get("date")
    if filter_date:
        try:
            d = datetime.strptime(filter_date, "%Y-%m-%d").date()
            query = query.filter_by(test_date=d)
        except ValueError:
            pass

    report_id = request.args.get("report_id")
    if report_id:
        try:
            query = query.filter_by(report_id=int(report_id))
        except ValueError:
            pass

    results = query.order_by(LabResult.test_date.desc(), LabResult.id.desc()).all()
    return jsonify([r.to_dict() for r in results]), 200


@lab_bp.route("/lab/results/history", methods=["GET"])
@jwt_required()
def get_results_history():
    """
    Returns results grouped by parameter in chronological order with trends.
    """
    user_id = int(get_jwt_identity())
    all_results = (
        LabResult.query.filter_by(user_id=user_id)
        .order_by(LabResult.parameter, LabResult.test_date.asc())
        .all()
    )

    engine = get_rule_engine()
    history = {}

    for param in SUPPORTED_PARAMETERS:
        param_def = engine.parameters.get(param, {})
        history[param] = {
            "parameter": param,
            "display_name": param_def.get("display_name", param),
            "standard_unit": param_def.get("standard_unit", ""),
            "records": [],
            "latest": None,
            "previous": None,
            "delta": None,
        }

    for r in all_results:
        p = r.parameter
        if p in history:
            d = r.to_dict()
            history[p]["records"].append(d)

    for p, data in history.items():
        recs = data["records"]
        if recs:
            data["latest"] = recs[-1]
            if len(recs) > 1:
                data["previous"] = recs[-2]
                try:
                    data["delta"] = round(recs[-1]["value"] - recs[-2]["value"], 2)
                except Exception:
                    pass

    return jsonify(history), 200


@lab_bp.route("/lab/results/<int:result_id>", methods=["PATCH"])
@jwt_required()
def update_result(result_id: int):
    user_id = int(get_jwt_identity())
    result = LabResult.query.filter_by(id=result_id, user_id=user_id).first()
    if not result:
        return jsonify({
            "error": {
                "code": "not_found",
                "message": "Laboratory result not found.",
                "details": {},
            }
        }), 404

    body = request.get_json(silent=True) or {}
    engine = get_rule_engine()

    if "value" in body:
        try:
            val = float(body["value"])
            result.value = val
        except (ValueError, TypeError):
            return jsonify({
                "error": {
                    "code": "invalid_value",
                    "message": "Value must be a valid number.",
                    "details": {},
                }
            }), 400

    if "unit" in body:
        result.unit = body["unit"].strip()

    if "test_date" in body:
        try:
            result.test_date = datetime.strptime(body["test_date"], "%Y-%m-%d").date()
        except ValueError:
            return jsonify({
                "error": {
                    "code": "invalid_date_format",
                    "message": "test_date must be formatted as YYYY-MM-DD.",
                    "details": {},
                }
            }), 400

    if "notes" in body:
        result.notes = body["notes"]

    # Reclassify
    cls_info = engine.classify_value(result.parameter, result.value, result.unit)
    result.classification = cls_info["classification"]

    db.session.commit()
    return jsonify(result.to_dict()), 200


@lab_bp.route("/lab/results/<int:result_id>", methods=["DELETE"])
@jwt_required()
def delete_result(result_id: int):
    user_id = int(get_jwt_identity())
    result = LabResult.query.filter_by(id=result_id, user_id=user_id).first()
    if not result:
        return jsonify({
            "error": {
                "code": "not_found",
                "message": "Laboratory result not found.",
                "details": {},
            }
        }), 404

    db.session.delete(result)
    db.session.commit()
    return jsonify({"message": "Laboratory result deleted successfully."}), 200


# ---------------------------------------------------------------------------
# Insights Endpoints
# ---------------------------------------------------------------------------
@lab_bp.route("/lab/insights", methods=["GET"])
@jwt_required()
def get_lab_insights():
    """
    Evaluates the user's latest recorded laboratory results against configured rules.
    """
    user_id = int(get_jwt_identity())
    profile = UserProfile.query.filter_by(user_id=user_id).first()
    diet_type = profile.diet_type if profile else None
    allergens = profile.allergies if profile and profile.allergies else []

    engine = get_rule_engine()

    # Get most recent result for each parameter
    all_results = (
        LabResult.query.filter_by(user_id=user_id)
        .order_by(LabResult.test_date.desc(), LabResult.id.desc())
        .all()
    )

    latest_by_param = {}
    for r in all_results:
        if r.parameter not in latest_by_param:
            latest_by_param[r.parameter] = r

    insights = []
    normal_count = 0
    attention_count = 0

    for param, res in latest_by_param.items():
        eval_dict = engine.evaluate_result(
            param_key=param,
            value=res.value,
            unit=res.unit,
            user_diet=diet_type,
            user_allergens=allergens,
        )
        eval_dict["result_id"] = res.id
        eval_dict["test_date"] = res.test_date.isoformat()
        insights.append(eval_dict)

        if eval_dict["classification"] in ("within_reference", "optimal"):
            normal_count += 1
        elif eval_dict["classification"] in ("borderline", "above_reference", "below_reference"):
            attention_count += 1

    return jsonify({
        "total_parameters_recorded": len(latest_by_param),
        "normal_count": normal_count,
        "attention_count": attention_count,
        "latest_test_date": max([r.test_date.isoformat() for r in latest_by_param.values()]) if latest_by_param else None,
        "insights": insights,
        "disclaimer": "These dietary suggestions represent educational guidance and are not a substitute for professional healthcare consultation.",
    }), 200


@lab_bp.route("/lab/insights/evaluate", methods=["POST"])
@jwt_required()
def evaluate_ad_hoc():
    """
    Evaluates ad-hoc laboratory values without storing them.
    """
    user_id = int(get_jwt_identity())
    profile = UserProfile.query.filter_by(user_id=user_id).first()
    diet_type = profile.diet_type if profile else None
    allergens = profile.allergies if profile and profile.allergies else []

    body = request.get_json(silent=True) or {}
    param = body.get("parameter")
    if not param or param not in SUPPORTED_PARAMETERS:
        return jsonify({
            "error": {
                "code": "invalid_parameter",
                "message": f"Parameter '{param}' is not supported.",
                "details": {},
            }
        }), 400

    try:
        val = float(body.get("value"))
    except (ValueError, TypeError):
        return jsonify({
            "error": {
                "code": "invalid_value",
                "message": "Value must be a valid number.",
                "details": {},
            }
        }), 400

    unit = body.get("unit", "").strip()
    engine = get_rule_engine()
    eval_dict = engine.evaluate_result(
        param_key=param,
        value=val,
        unit=unit,
        user_diet=diet_type,
        user_allergens=allergens,
    )
    return jsonify(eval_dict), 200
