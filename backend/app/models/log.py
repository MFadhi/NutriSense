from datetime import datetime, timezone
from sqlalchemy import Index
from ..extensions import db


class FoodLog(db.Model):
    __tablename__ = "food_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    food_id = db.Column(
        db.Integer,
        db.ForeignKey("foods.id", ondelete="SET NULL"),
        nullable=True,
    )
    food_name = db.Column(db.String(200), nullable=False)
    meal = db.Column(db.String(20), nullable=False)  # breakfast/lunch/snack/dinner
    logged_at = db.Column(db.DateTime, nullable=False)
    log_date = db.Column(db.Date, nullable=False)
    quantity = db.Column(db.Numeric(8, 2), nullable=False)
    portion_label = db.Column(db.String(100), nullable=True)
    portion_grams = db.Column(db.Numeric(7, 2), nullable=True)
    kcal = db.Column(db.Numeric(8, 2), nullable=False)
    protein_g = db.Column(db.Numeric(8, 2), nullable=False)
    carbs_g = db.Column(db.Numeric(8, 2), nullable=False)
    fat_g = db.Column(db.Numeric(8, 2), nullable=False)
    fibre_g = db.Column(db.Numeric(8, 2), nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_food_logs_user_date", "user_id", "log_date"),
        Index("ix_food_logs_user_logged_at", "user_id", "logged_at"),
    )

    user = db.relationship("User", back_populates="logs")
    food = db.relationship("Food", back_populates="logs")

    def to_dict(self):
        return {
            "id": self.id,
            "food_id": self.food_id,
            "food_name": self.food_name,
            "meal": self.meal,
            "logged_at": self.logged_at.isoformat() + "Z" if self.logged_at else None,
            "log_date": self.log_date.isoformat() if self.log_date else None,
            "quantity": float(self.quantity),
            "portion_label": self.portion_label,
            "portion_grams": float(self.portion_grams) if self.portion_grams else None,
            "kcal": float(self.kcal),
            "protein_g": float(self.protein_g),
            "carbs_g": float(self.carbs_g),
            "fat_g": float(self.fat_g),
            "fibre_g": float(self.fibre_g),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
