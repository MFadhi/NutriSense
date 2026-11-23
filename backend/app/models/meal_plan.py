from datetime import datetime, timezone
from ..extensions import db


class MealPlanPreference(db.Model):
    __tablename__ = "meal_plan_preferences"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    meals_per_day = db.Column(db.Integer, default=4, nullable=False)
    include_snacks = db.Column(db.Boolean, default=True, nullable=False)
    diet_type = db.Column(db.String(20), nullable=True)
    liked_tags = db.Column(db.JSON, nullable=True, default=list)
    avoided_tags = db.Column(db.JSON, nullable=True, default=list)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = db.relationship("User", backref=db.backref("meal_preference", uselist=False, cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "meals_per_day": self.meals_per_day,
            "include_snacks": self.include_snacks,
            "diet_type": self.diet_type,
            "liked_tags": self.liked_tags or [],
            "avoided_tags": self.avoided_tags or [],
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class MealPlan(db.Model):
    __tablename__ = "meal_plans"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = db.Column(db.String(100), nullable=False)
    plan_type = db.Column(db.String(20), default="weekly", nullable=False)  # daily or weekly
    is_active = db.Column(db.Boolean, default=False, nullable=False)
    total_kcal = db.Column(db.Numeric(8, 2), nullable=True)
    total_protein_g = db.Column(db.Numeric(8, 2), nullable=True)
    total_carbs_g = db.Column(db.Numeric(8, 2), nullable=True)
    total_fat_g = db.Column(db.Numeric(8, 2), nullable=True)
    plan_data = db.Column(db.JSON, nullable=False)  # Snapshot of all days, meals, items, macros
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = db.relationship("User", backref=db.backref("meal_plans", cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "plan_type": self.plan_type,
            "is_active": self.is_active,
            "total_kcal": float(self.total_kcal) if self.total_kcal is not None else None,
            "total_protein_g": float(self.total_protein_g) if self.total_protein_g is not None else None,
            "total_carbs_g": float(self.total_carbs_g) if self.total_carbs_g is not None else None,
            "total_fat_g": float(self.total_fat_g) if self.total_fat_g is not None else None,
            "plan_data": self.plan_data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
