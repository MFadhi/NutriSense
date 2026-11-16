from datetime import datetime, timezone
from sqlalchemy import Index
from ..extensions import db


class WaterLog(db.Model):
    __tablename__ = "water_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    log_date = db.Column(db.Date, nullable=False)
    amount_ml = db.Column(db.Integer, nullable=False)
    logged_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_water_logs_user_date", "user_id", "log_date"),
    )

    user = db.relationship("User", backref=db.backref("water_logs", cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "log_date": self.log_date.isoformat() if self.log_date else None,
            "amount_ml": self.amount_ml,
            "logged_at": self.logged_at.isoformat() + "Z" if self.logged_at else None,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }
