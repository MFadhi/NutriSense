from datetime import datetime, timezone
from sqlalchemy import Index
from ..extensions import db


class FoodCategory(db.Model):
    __tablename__ = "food_categories"

    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(50), unique=True, nullable=False, index=True)
    label_en = db.Column(db.String(100), nullable=False)

    foods = db.relationship("Food", back_populates="category")

    def to_dict(self):
        return {"id": self.id, "slug": self.slug, "label_en": self.label_en}


class Food(db.Model):
    __tablename__ = "foods"

    id = db.Column(db.Integer, primary_key=True)
    seed_key = db.Column(db.String(100), unique=True, nullable=True, index=True)
    name_en = db.Column(db.String(200), nullable=False)
    name_hi = db.Column(db.String(200), nullable=True)
    name_kn = db.Column(db.String(200), nullable=True)
    category_id = db.Column(
        db.Integer, db.ForeignKey("food_categories.id"), nullable=True
    )
    diet = db.Column(
        db.Enum("vegan", "veg", "egg", "nonveg", name="diet_types"),
        nullable=False,
        default="veg",
    )
    kcal_per_100g = db.Column(db.Numeric(7, 2), nullable=False)
    protein_per_100g = db.Column(db.Numeric(7, 2), nullable=False)
    carbs_per_100g = db.Column(db.Numeric(7, 2), nullable=False)
    fat_per_100g = db.Column(db.Numeric(7, 2), nullable=False)
    fibre_per_100g = db.Column(db.Numeric(7, 2), nullable=True, default=0)
    allergens = db.Column(db.JSON, nullable=True, default=list)
    tags = db.Column(db.JSON, nullable=True, default=list)
    is_sample = db.Column(db.Boolean, default=True, nullable=False)
    source = db.Column(
        db.Enum("sample", "user", "openfoodfacts", "usda", name="food_sources"),
        default="sample",
        nullable=False,
    )
    barcode = db.Column(db.String(50), nullable=True, index=True)
    owner_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    diet_verified = db.Column(db.Boolean, default=True, nullable=False)
    needs_review = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_foods_name_en", "name_en"),
        Index("ix_foods_category_id", "category_id"),
        # FULLTEXT index: mysql_prefix makes it FULLTEXT on MySQL,
        # falls back to a regular composite index on SQLite (fine for tests)
        Index(
            "ix_foods_fulltext",
            "name_en",
            "name_hi",
            "name_kn",
            mysql_prefix="FULLTEXT",
        ),
    )

    category = db.relationship("FoodCategory", back_populates="foods")
    portions = db.relationship(
        "Portion", back_populates="food", cascade="all, delete-orphan"
    )
    aliases = db.relationship(
        "FoodAlias", back_populates="food", cascade="all, delete-orphan"
    )
    logs = db.relationship("FoodLog", back_populates="food")
    owner = db.relationship("User", backref=db.backref("custom_foods", cascade="all, delete-orphan"))

    def default_portion(self):
        for p in self.portions:
            if p.is_default:
                return p
        return self.portions[0] if self.portions else None

    def to_dict(self, include_nutrition=False):
        d = {
            "id": self.id,
            "seed_key": self.seed_key,
            "name_en": self.name_en,
            "name_hi": self.name_hi,
            "name_kn": self.name_kn,
            "category": self.category.to_dict() if self.category else None,
            "diet": self.diet,
            "is_sample": self.is_sample,
            "source": self.source,
            "barcode": self.barcode,
            "owner_user_id": self.owner_user_id,
            "diet_verified": self.diet_verified,
            "needs_review": self.needs_review,
        }
        if include_nutrition:
            d.update(
                {
                    "kcal_per_100g": float(self.kcal_per_100g),
                    "protein_per_100g": float(self.protein_per_100g),
                    "carbs_per_100g": float(self.carbs_per_100g),
                    "fat_per_100g": float(self.fat_per_100g),
                    "fibre_per_100g": float(self.fibre_per_100g)
                    if self.fibre_per_100g is not None
                    else 0,
                    "allergens": self.allergens or [],
                    "tags": self.tags or [],
                    "portions": [p.to_dict() for p in self.portions],
                }
            )
        return d


class FoodAlias(db.Model):
    __tablename__ = "food_aliases"

    id = db.Column(db.Integer, primary_key=True)
    food_id = db.Column(
        db.Integer,
        db.ForeignKey("foods.id", ondelete="CASCADE"),
        nullable=False,
    )
    alias = db.Column(db.String(200), nullable=False)
    alias_normalized = db.Column(db.String(200), nullable=False, index=True)

    food = db.relationship("Food", back_populates="aliases")


class Portion(db.Model):
    __tablename__ = "portions"

    id = db.Column(db.Integer, primary_key=True)
    food_id = db.Column(
        db.Integer,
        db.ForeignKey("foods.id", ondelete="CASCADE"),
        nullable=False,
    )
    label = db.Column(db.String(100), nullable=False)
    grams = db.Column(db.Numeric(7, 2), nullable=False)
    is_default = db.Column(db.Boolean, default=False, nullable=False)

    food = db.relationship("Food", back_populates="portions")

    def to_dict(self):
        return {
            "id": self.id,
            "label": self.label,
            "grams": float(self.grams),
            "is_default": self.is_default,
        }
