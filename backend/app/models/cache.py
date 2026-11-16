from datetime import datetime, timezone
from ..extensions import db


class ExternalProductCache(db.Model):
    __tablename__ = "external_product_cache"

    barcode = db.Column(db.String(50), primary_key=True)
    source = db.Column(db.String(50), default="openfoodfacts", nullable=False)
    status = db.Column(
        db.Enum("found", "not_found", name="cache_status_enum"),
        nullable=False,
    )
    payload = db.Column(db.JSON, nullable=True)
    fetched_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    expires_at = db.Column(db.DateTime, nullable=False)

    def to_dict(self):
        return {
            "barcode": self.barcode,
            "source": self.source,
            "status": self.status,
            "payload": self.payload,
            "fetched_at": self.fetched_at.isoformat() if self.fetched_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }
