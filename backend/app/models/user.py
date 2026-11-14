from datetime import datetime, timezone
from ..extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    profile = db.relationship(
        "UserProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    logs = db.relationship(
        "FoodLog", back_populates="user", cascade="all, delete-orphan"
    )

    def set_password(self, password):
        from werkzeug.security import generate_password_hash
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        from werkzeug.security import check_password_hash
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class UserProfile(db.Model):
    __tablename__ = "user_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    age = db.Column(db.Integer, nullable=True)
    gender = db.Column(db.String(20), nullable=True)  # male/female/other
    height_cm = db.Column(db.Numeric(5, 1), nullable=True)
    weight_kg = db.Column(db.Numeric(5, 1), nullable=True)
    activity_level = db.Column(db.String(30), nullable=True)
    diet_type = db.Column(
        db.String(20), nullable=True
    )  # veg/nonveg/eggetarian/vegan
    goal = db.Column(db.Text, nullable=True)
    allergies = db.Column(db.JSON, nullable=True, default=list)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = db.relationship("User", back_populates="profile")

    def to_dict(self):
        return {
            "age": self.age,
            "gender": self.gender,
            "height_cm": float(self.height_cm) if self.height_cm else None,
            "weight_kg": float(self.weight_kg) if self.weight_kg else None,
            "activity_level": self.activity_level,
            "diet_type": self.diet_type,
            "goal": self.goal,
            "allergies": self.allergies or [],
        }
