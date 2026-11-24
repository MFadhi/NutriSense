from datetime import datetime, timezone, date, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models import PantryItem, GroceryItem, PurchaseTransaction, Food
from ..services.pantry_sync_service import sync_grocery_purchase_to_pantry, merge_quantities

pantry_grocery_bp = Blueprint("pantry_grocery", __name__)


# ---------------------------------------------------------------------------
# PANTRY ENDPOINTS
# ---------------------------------------------------------------------------
@pantry_grocery_bp.route("/pantry", methods=["GET"])
@jwt_required()
def list_pantry_items():
    user_id = int(get_jwt_identity())
    query = PantryItem.query.filter_by(user_id=user_id, is_consumed=False)

    category = request.args.get("category")
    if category and category.lower() != "all":
        query = query.filter_by(category=category)

    search = request.args.get("search")
    if search:
        query = query.filter(PantryItem.name.ilike(f"%{search.strip()}%"))

    # Sorting
    sort_by = request.args.get("sort", "created_desc")
    if sort_by == "expiry":
        query = query.order_by(PantryItem.expiry_date.asc().nullslast())
    elif sort_by == "name":
        query = query.order_by(PantryItem.name.asc())
    else:
        query = query.order_by(PantryItem.created_at.desc())

    items = query.all()
    return jsonify([i.to_dict() for i in items]), 200


@pantry_grocery_bp.route("/pantry/dashboard", methods=["GET"])
@jwt_required()
def pantry_dashboard():
    user_id = int(get_jwt_identity())
    active_items = PantryItem.query.filter_by(user_id=user_id, is_consumed=False).all()
    today = date.today()
    expiring_threshold = today + timedelta(days=3)

    total_items = len(active_items)
    expired_count = 0
    expiring_soon_count = 0
    recently_added = []

    for item in active_items:
        if item.expiry_date:
            if item.expiry_date < today:
                expired_count += 1
            elif item.expiry_date <= expiring_threshold:
                expiring_soon_count += 1

    sorted_recent = sorted(active_items, key=lambda x: x.created_at, reverse=True)
    recently_added = [i.to_dict() for i in sorted_recent[:5]]

    return jsonify({
        "total_items": total_items,
        "expiring_soon": expiring_soon_count,
        "expired": expired_count,
        "recently_added": recently_added,
    }), 200


@pantry_grocery_bp.route("/pantry", methods=["POST"])
@jwt_required()
def add_pantry_item():
    user_id = int(get_jwt_identity())
    body = request.get_json(silent=True) or {}

    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": {"code": "missing_name", "message": "Ingredient name is required."}}), 400

    try:
        qty = float(body.get("quantity", 1.0))
        if qty <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": {"code": "invalid_quantity", "message": "Quantity must be a positive number."}}), 400

    p_date = None
    if body.get("purchase_date"):
        try:
            p_date = datetime.strptime(str(body["purchase_date"])[:10], "%Y-%m-%d").date()
        except ValueError:
            pass

    exp_date = None
    if body.get("expiry_date"):
        try:
            exp_date = datetime.strptime(str(body["expiry_date"])[:10], "%Y-%m-%d").date()
        except ValueError:
            pass

    item = PantryItem(
        user_id=user_id,
        food_id=body.get("food_id"),
        name=name,
        category=body.get("category", "Others"),
        quantity=qty,
        unit=body.get("unit", "pcs"),
        purchase_date=p_date,
        expiry_date=exp_date,
        notes=body.get("notes"),
        is_consumed=False,
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@pantry_grocery_bp.route("/pantry/<int:item_id>", methods=["PATCH"])
@jwt_required()
def update_pantry_item(item_id: int):
    user_id = int(get_jwt_identity())
    item = PantryItem.query.filter_by(id=item_id, user_id=user_id).first()
    if not item:
        return jsonify({"error": {"code": "not_found", "message": "Pantry item not found."}}), 404

    body = request.get_json(silent=True) or {}
    if "name" in body:
        item.name = body["name"].strip()
    if "category" in body:
        item.category = body["category"]
    if "quantity" in body:
        try:
            item.quantity = float(body["quantity"])
        except (ValueError, TypeError):
            return jsonify({"error": {"code": "invalid_quantity", "message": "Invalid quantity value."}}), 400
    if "unit" in body:
        item.unit = body["unit"].strip()
    if "expiry_date" in body:
        if body["expiry_date"]:
            try:
                item.expiry_date = datetime.strptime(str(body["expiry_date"])[:10], "%Y-%m-%d").date()
            except ValueError:
                pass
        else:
            item.expiry_date = None
    if "purchase_date" in body:
        if body["purchase_date"]:
            try:
                item.purchase_date = datetime.strptime(str(body["purchase_date"])[:10], "%Y-%m-%d").date()
            except ValueError:
                pass
        else:
            item.purchase_date = None
    if "notes" in body:
        item.notes = body["notes"]

    item.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(item.to_dict()), 200


@pantry_grocery_bp.route("/pantry/<int:item_id>/consume", methods=["POST"])
@jwt_required()
def consume_pantry_item(item_id: int):
    user_id = int(get_jwt_identity())
    item = PantryItem.query.filter_by(id=item_id, user_id=user_id).first()
    if not item:
        return jsonify({"error": {"code": "not_found", "message": "Pantry item not found."}}), 404

    body = request.get_json(silent=True) or {}
    deduct_qty = body.get("amount")

    if deduct_qty is not None:
        try:
            d_val = float(deduct_qty)
            rem = float(item.quantity) - d_val
            if rem <= 0:
                item.quantity = 0
                item.is_consumed = True
            else:
                item.quantity = rem
        except (ValueError, TypeError):
            item.is_consumed = True
    else:
        item.is_consumed = True

    item.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(item.to_dict()), 200


@pantry_grocery_bp.route("/pantry/<int:item_id>", methods=["DELETE"])
@jwt_required()
def delete_pantry_item(item_id: int):
    user_id = int(get_jwt_identity())
    item = PantryItem.query.filter_by(id=item_id, user_id=user_id).first()
    if not item:
        return jsonify({"error": {"code": "not_found", "message": "Pantry item not found."}}), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify({"message": "Pantry item deleted successfully."}), 200


# ---------------------------------------------------------------------------
# GROCERY LIST ENDPOINTS
# ---------------------------------------------------------------------------
@pantry_grocery_bp.route("/grocery", methods=["GET"])
@jwt_required()
def list_grocery_items():
    user_id = int(get_jwt_identity())
    items = GroceryItem.query.filter_by(user_id=user_id).order_by(GroceryItem.is_purchased.asc(), GroceryItem.created_at.desc()).all()
    return jsonify([i.to_dict() for i in items]), 200


@pantry_grocery_bp.route("/grocery", methods=["POST"])
@jwt_required()
def add_grocery_item():
    user_id = int(get_jwt_identity())
    body = request.get_json(silent=True) or {}

    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": {"code": "missing_name", "message": "Item name is required."}}), 400

    try:
        qty = float(body.get("quantity", 1.0))
    except (ValueError, TypeError):
        qty = 1.0

    item = GroceryItem(
        user_id=user_id,
        food_id=body.get("food_id"),
        name=name,
        category=body.get("category", "Others"),
        quantity=qty,
        unit=body.get("unit", "pcs"),
        notes=body.get("notes"),
        is_purchased=False,
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@pantry_grocery_bp.route("/grocery/batch", methods=["POST"])
@jwt_required()
def add_grocery_batch():
    user_id = int(get_jwt_identity())
    body = request.get_json(silent=True) or {}
    items_data = body.get("items", [])
    if not isinstance(items_data, list):
        return jsonify({"error": {"code": "invalid_payload", "message": "Expected list of items."}}), 400

    created = []
    for it in items_data:
        name = (it.get("name") or "").strip()
        if not name:
            continue
        try:
            qty = float(it.get("quantity", 1.0))
        except (ValueError, TypeError):
            qty = 1.0

        item = GroceryItem(
            user_id=user_id,
            food_id=it.get("food_id"),
            name=name,
            category=it.get("category", "Others"),
            quantity=qty,
            unit=it.get("unit", "pcs"),
            notes=it.get("notes") or body.get("source"),
            is_purchased=False,
        )
        db.session.add(item)
        created.append(item)

    db.session.commit()
    return jsonify([c.to_dict() for c in created]), 201


@pantry_grocery_bp.route("/grocery/<int:item_id>", methods=["PATCH"])
@jwt_required()
def update_grocery_item(item_id: int):
    user_id = int(get_jwt_identity())
    item = GroceryItem.query.filter_by(id=item_id, user_id=user_id).first()
    if not item:
        return jsonify({"error": {"code": "not_found", "message": "Grocery item not found."}}), 404

    body = request.get_json(silent=True) or {}
    if "name" in body:
        item.name = body["name"].strip()
    if "category" in body:
        item.category = body["category"]
    if "quantity" in body:
        try:
            item.quantity = float(body["quantity"])
        except (ValueError, TypeError):
            pass
    if "unit" in body:
        item.unit = body["unit"].strip()
    if "notes" in body:
        item.notes = body["notes"]

    item.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(item.to_dict()), 200


@pantry_grocery_bp.route("/grocery/<int:item_id>", methods=["DELETE"])
@jwt_required()
def delete_grocery_item(item_id: int):
    user_id = int(get_jwt_identity())
    item = GroceryItem.query.filter_by(id=item_id, user_id=user_id).first()
    if not item:
        return jsonify({"error": {"code": "not_found", "message": "Grocery item not found."}}), 404

    # Notice: per specs, deleting grocery item does not remove pantry quantities!
    db.session.delete(item)
    db.session.commit()
    return jsonify({"message": "Grocery item deleted."}), 200


@pantry_grocery_bp.route("/grocery/purchased", methods=["DELETE"])
@jwt_required()
def clear_purchased_grocery():
    user_id = int(get_jwt_identity())
    GroceryItem.query.filter_by(user_id=user_id, is_purchased=True).delete()
    db.session.commit()
    return jsonify({"message": "Purchased items cleared."}), 200


# ---------------------------------------------------------------------------
# CORE FEATURE: AUTOMATIC GROCERY-TO-PANTRY SYNCHRONIZATION
# ---------------------------------------------------------------------------
@pantry_grocery_bp.route("/grocery/<int:item_id>/purchase", methods=["POST"])
@jwt_required()
def purchase_and_sync_to_pantry(item_id: int):
    """
    Confirms grocery purchase and atomically synchronizes inventory to pantry.
    Protected by database transaction rollback on any failure.
    """
    user_id = int(get_jwt_identity())
    item = GroceryItem.query.filter_by(id=item_id, user_id=user_id).first()
    if not item:
        return jsonify({"error": {"code": "not_found", "message": "Grocery item not found."}}), 404

    body = request.get_json(silent=True) or {}
    try:
        # Support partial purchase
        purchased_qty = float(body.get("purchased_quantity", item.quantity))
        if purchased_qty <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": {"code": "invalid_quantity", "message": "Purchased quantity must be positive."}}), 400

    unit = body.get("unit") or item.unit
    p_date = None
    if body.get("purchase_date"):
        try:
            p_date = datetime.strptime(str(body["purchase_date"])[:10], "%Y-%m-%d").date()
        except ValueError:
            pass

    exp_date = None
    if body.get("expiry_date"):
        try:
            exp_date = datetime.strptime(str(body["expiry_date"])[:10], "%Y-%m-%d").date()
        except ValueError:
            pass

    notes = body.get("notes")

    # Transaction execution
    try:
        # Atomic synchronization
        g_item, p_item, tx = sync_grocery_purchase_to_pantry(
            user_id=user_id,
            grocery_item=item,
            purchased_quantity=purchased_qty,
            unit=unit,
            purchase_date=p_date,
            expiry_date=exp_date,
            notes=notes,
        )
        db.session.commit()
        return jsonify({
            "message": "Purchase confirmed and synchronized to pantry.",
            "grocery_item": g_item.to_dict(),
            "pantry_item": p_item.to_dict(),
            "transaction": tx.to_dict(),
        }), 200
    except ValueError as val_err:
        db.session.rollback()
        return jsonify({"error": {"code": "duplicate_purchase", "message": str(val_err)}}), 400
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": {"code": "sync_failed", "message": f"Synchronization failed: {str(exc)}"}}), 500


@pantry_grocery_bp.route("/grocery/<int:item_id>/unpurchase", methods=["POST"])
@jwt_required()
def unpurchase_grocery_item(item_id: int):
    """
    Marks an item as unpurchased.
    Per requirements: does not add to pantry; pantry records remain independent.
    """
    user_id = int(get_jwt_identity())
    item = GroceryItem.query.filter_by(id=item_id, user_id=user_id).first()
    if not item:
        return jsonify({"error": {"code": "not_found", "message": "Grocery item not found."}}), 404

    item.is_purchased = False
    item.purchased_at = None
    item.purchased_quantity = None
    item.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(item.to_dict()), 200


@pantry_grocery_bp.route("/grocery/<int:item_id>/purchase-correction", methods=["PATCH"])
@jwt_required()
def correct_purchase_quantity(item_id: int):
    """
    Allows correcting a purchase quantity on a linked grocery and pantry item
    without duplicating the pantry addition.
    """
    user_id = int(get_jwt_identity())
    item = GroceryItem.query.filter_by(id=item_id, user_id=user_id).first()
    if not item:
        return jsonify({"error": {"code": "not_found", "message": "Grocery item not found."}}), 404

    body = request.get_json(silent=True) or {}
    try:
        new_qty = float(body.get("purchased_quantity"))
        if new_qty <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": {"code": "invalid_quantity", "message": "New quantity must be positive."}}), 400

    old_qty = float(item.purchased_quantity or item.quantity)
    diff = new_qty - old_qty

    item.purchased_quantity = new_qty
    if item.pantry_item_id:
        pantry_item = db.session.get(PantryItem, item.pantry_item_id)
        if pantry_item and pantry_item.user_id == user_id:
            # Adjust pantry quantity by delta
            pantry_item.quantity = max(0.1, float(pantry_item.quantity) + diff)
            pantry_item.updated_at = datetime.now(timezone.utc)

    # Update transaction record if exists
    tx = PurchaseTransaction.query.filter_by(grocery_item_id=item.id, user_id=user_id).order_by(PurchaseTransaction.created_at.desc()).first()
    if tx:
        tx.purchased_quantity = new_qty

    db.session.commit()
    return jsonify({
        "message": "Purchase quantity corrected successfully.",
        "grocery_item": item.to_dict(),
        "pantry_item": pantry_item.to_dict() if (item.pantry_item_id and pantry_item) else None,
    }), 200
