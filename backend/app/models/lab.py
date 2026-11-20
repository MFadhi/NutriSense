from datetime import datetime, timezone
from ..extensions import db
from ..services.encryption import encrypt_lab_value, decrypt_lab_value


class LabConsent(db.Model):
    __tablename__ = "lab_consents"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    consented = db.Column(db.Boolean, default=True, nullable=False)
    consented_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    withdrawn_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = db.relationship("User", backref=db.backref("lab_consent", uselist=False, cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "consented": self.consented,
            "consented_at": self.consented_at.isoformat() if self.consented_at else None,
            "withdrawn_at": self.withdrawn_at.isoformat() if self.withdrawn_at else None,
        }


class LabReport(db.Model):
    __tablename__ = "lab_reports"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    report_date = db.Column(db.Date, nullable=True)
    original_filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=True)
    file_size = db.Column(db.Integer, nullable=True)
    mime_type = db.Column(db.String(100), nullable=True)
    processing_status = db.Column(db.String(50), default="completed", nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = db.relationship("User", backref=db.backref("lab_reports", cascade="all, delete-orphan"))
    results = db.relationship("LabResult", back_populates="report", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "report_date": self.report_date.isoformat() if self.report_date else None,
            "original_filename": self.original_filename,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "processing_status": self.processing_status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "result_count": len(self.results) if self.results else 0,
        }


class LabResult(db.Model):
    __tablename__ = "lab_results"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    report_id = db.Column(
        db.Integer,
        db.ForeignKey("lab_reports.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    parameter = db.Column(db.String(50), nullable=False, index=True)
    encrypted_value = db.Column(db.Text, nullable=False)
    unit = db.Column(db.String(30), nullable=False)
    test_date = db.Column(db.Date, nullable=False, index=True)
    classification = db.Column(db.String(50), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = db.relationship("User", backref=db.backref("lab_results", cascade="all, delete-orphan"))
    report = db.relationship("LabReport", back_populates="results")

    @property
    def value(self) -> float:
        return decrypt_lab_value(self.encrypted_value)

    @value.setter
    def value(self, val: float | int | str):
        self.encrypted_value = encrypt_lab_value(val)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "report_id": self.report_id,
            "parameter": self.parameter,
            "value": self.value,
            "unit": self.unit,
            "test_date": self.test_date.isoformat() if self.test_date else None,
            "classification": self.classification,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
