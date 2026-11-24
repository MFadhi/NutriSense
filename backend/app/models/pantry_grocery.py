from datetime import datetime, timezone
from ..extensions import db


class PantryItem(db.Model):
    __tablename__ = "pantry_items"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    food_id = db.Column(
        db.Integer,
        db.ForeignKey("foods.id", ondelete="SET NULL"),
        nullable=True,
    )
    name = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(50), default="Others", nullable=False)
    quantity = db.Column(db.Numeric(8, 2), default=1.0, nullable=False)
    unit = db.Column(db.String(20), default="pcs", nullable=False)
    purchase_date = db.Column(db.Date, nullable=True)
    expiry_date = db.Column(db.Date, nullable=True, index=True)
    notes = db.Column(db.Text, nullable=True)
    is_consumed = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = db.relationship("User", backref=db.backref("pantry_items", cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "food_id": self.food_id,
            "name": self.name,
            "category": self.category,
            "quantity": float(self.quantity),
            "unit": self.unit,
            "purchase_date": self.purchase_date.isoformat() if self.purchase_date else None,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "notes": self.notes,
            "is_consumed": self.is_consumed,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class GroceryItem(db.Model):
    __tablename__ = "grocery_items"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    food_id = db.Column(
        db.Integer,
        db.ForeignKey("foods.id", ondelete="SET NULL"),
        nullable=True,
    )
    name = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(50), default="Others", nullable=False)
    quantity = db.Column(db.Numeric(8, 2), default=1.0, nullable=False)
    unit = db.Column(db.String(20), default="pcs", nullable=False)
    notes = db.Column(db.Text, nullable=True)
    is_purchased = db.Column(db.Boolean, default=False, nullable=False, index=True)
    purchased_at = db.Column(db.DateTime, nullable=True)
    purchased_quantity = db.Column(db.Numeric(8, 2), nullable=True)
    pantry_item_id = db.Column(
        db.Integer,
        db.ForeignKey("pantry_items.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = db.relationship("User", backref=db.backref("grocery_items", cascade="all, delete-orphan"))
    pantry_item = db.relationship("PantryItem", backref=db.backref("linked_grocery_items", lazy="dynamic"))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "food_id": self.food_id,
            "name": self.name,
            "category": self.category,
            "quantity": float(self.quantity),
            "unit": self.unit,
            "notes": self.notes,
            "is_purchased": self.is_purchased,
            "purchased_at": self.purchased_at.isoformat() if self.purchased_at else None,
            "purchased_quantity": float(self.purchased_quantity) if self.purchased_quantity is not None else None,
            "pantry_item_id": self.pantry_item_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class PurchaseTransaction(db.Model):
    __tablename__ = "purchase_transactions"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    grocery_item_id = db.Column(
        db.Integer,
        db.ForeignKey("grocery_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pantry_item_id = db.Column(
        db.Integer,
        db.ForeignKey("pantry_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    purchased_quantity = db.Column(db.Numeric(8, 2), nullable=False)
    unit = db.Column(db.String(20), nullable=False)
    purchase_date = db.Column(db.Date, nullable=False)
    expiry_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user = db.relationship("User")
    grocery_item = db.relationship("GroceryItem", backref=db.backref("purchase_records", cascade="all, delete-orphan"))
    pantry_item = db.relationship("PantryItem", backref=db.backref("purchase_records", cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "grocery_item_id": self.grocery_item_id,
            "pantry_item_id": self.pantry_item_id,
            "purchased_quantity": float(self.purchased_quantity),
            "unit": self.unit,
            "purchase_date": self.purchase_date.isoformat(),
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "created_at": self.created_at.isoformat(),
        }
