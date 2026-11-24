from datetime import datetime, timezone, date
from typing import Tuple, Optional
from ..extensions import db
from ..models import PantryItem, GroceryItem, PurchaseTransaction


def merge_quantities(
    existing_qty: float, existing_unit: str, added_qty: float, added_unit: str
) -> Tuple[float, str]:
    """
    Combines quantities with standard unit normalization.
    Examples:
      500g + 2kg -> 2.5 kg
      2kg + 500g -> 2.5 kg
      200ml + 1L -> 1.2 L
      1L + 200ml -> 1.2 L
      2pcs + 3pcs -> 5 pcs
    """
    u1 = existing_unit.strip().lower()
    u2 = added_unit.strip().lower()

    # Weight: g and kg
    if (u1 == "g" and u2 == "kg") or (u1 == "kg" and u2 == "g"):
        g1 = existing_qty if u1 == "g" else existing_qty * 1000.0
        g2 = added_qty if u2 == "g" else added_qty * 1000.0
        total_g = g1 + g2
        if total_g >= 1000:
            return round(total_g / 1000.0, 2), "kg"
        return round(total_g, 1), "g"

    # Volume: ml and l
    if (u1 == "ml" and u2 in ("l", "litre", "liter")) or (u1 in ("l", "litre", "liter") and u2 == "ml"):
        ml1 = existing_qty if u1 == "ml" else existing_qty * 1000.0
        ml2 = added_qty if u2 == "ml" else added_qty * 1000.0
        total_ml = ml1 + ml2
        if total_ml >= 1000:
            return round(total_ml / 1000.0, 2), "L"
        return round(total_ml, 1), "ml"

    # Exact same unit
    if u1 == u2:
        return round(existing_qty + added_qty, 2), existing_unit

    # Incompatible units fallback: return combined description or default to added unit
    return round(existing_qty + added_qty, 2), added_unit


def sync_grocery_purchase_to_pantry(
    user_id: int,
    grocery_item: GroceryItem,
    purchased_quantity: float,
    unit: str,
    purchase_date: Optional[date] = None,
    expiry_date: Optional[date] = None,
    notes: Optional[str] = None,
) -> Tuple[GroceryItem, PantryItem, PurchaseTransaction]:
    """
    Executes atomic synchronization of a purchased grocery item to the user's pantry.
    Prevents duplicate synchronization if already purchased.
    """
    if grocery_item.user_id != user_id:
        raise PermissionError("Access denied.")

    if grocery_item.is_purchased:
        raise ValueError("Item has already been purchased and synchronized.")

    now = datetime.now(timezone.utc)
    p_date = purchase_date or now.date()

    # Find existing matching pantry item (same user, unconsumed, case-insensitive name)
    existing_pantry = (
        PantryItem.query.filter_by(user_id=user_id, is_consumed=False)
        .filter(db.func.lower(PantryItem.name) == grocery_item.name.strip().lower())
        .order_by(PantryItem.updated_at.desc())
        .first()
    )

    # If user provided a different expiry date and explicitly wants a separate batch:
    if existing_pantry and (expiry_date is None or existing_pantry.expiry_date == expiry_date):
        # Update existing pantry item quantity
        new_qty, new_unit = merge_quantities(
            float(existing_pantry.quantity),
            existing_pantry.unit,
            purchased_quantity,
            unit,
        )
        existing_pantry.quantity = new_qty
        existing_pantry.unit = new_unit
        if notes:
            existing_pantry.notes = f"{existing_pantry.notes or ''}; {notes}".strip("; ")
        if expiry_date:
            existing_pantry.expiry_date = expiry_date
        existing_pantry.updated_at = now
        target_pantry = existing_pantry
    else:
        # Create a new pantry entry (or separate batch with distinct expiry date)
        target_pantry = PantryItem(
            user_id=user_id,
            food_id=grocery_item.food_id,
            name=grocery_item.name,
            category=grocery_item.category,
            quantity=purchased_quantity,
            unit=unit,
            purchase_date=p_date,
            expiry_date=expiry_date,
            notes=notes,
            is_consumed=False,
            created_at=now,
            updated_at=now,
        )
        db.session.add(target_pantry)
        db.session.flush()

    # Update grocery item
    grocery_item.is_purchased = True
    grocery_item.purchased_at = now
    grocery_item.purchased_quantity = purchased_quantity
    grocery_item.unit = unit
    grocery_item.pantry_item_id = target_pantry.id
    grocery_item.updated_at = now

    # Record purchase transaction for traceability
    transaction = PurchaseTransaction(
        user_id=user_id,
        grocery_item_id=grocery_item.id,
        pantry_item_id=target_pantry.id,
        purchased_quantity=purchased_quantity,
        unit=unit,
        purchase_date=p_date,
        expiry_date=expiry_date,
        created_at=now,
    )
    db.session.add(transaction)

    return grocery_item, target_pantry, transaction
