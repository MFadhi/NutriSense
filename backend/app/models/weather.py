from datetime import datetime, timezone
from ..extensions import db


class WeatherCache(db.Model):
    __tablename__ = "weather_cache"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    latitude = db.Column(db.Numeric(8, 4), nullable=False)
    longitude = db.Column(db.Numeric(8, 4), nullable=False)
    city = db.Column(db.String(100), nullable=True)
    temperature = db.Column(db.Numeric(5, 2), nullable=False)
    humidity = db.Column(db.Numeric(5, 2), nullable=False)
    apparent_temperature = db.Column(db.Numeric(5, 2), nullable=True)
    weather_code = db.Column(db.Integer, nullable=True)
    condition_text = db.Column(db.String(100), nullable=True)
    fetched_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    expires_at = db.Column(db.DateTime, nullable=False, index=True)

    __table_args__ = (
        db.Index("idx_weather_coords_exp", "latitude", "longitude", "expires_at"),
    )

    def to_dict(self):
        return {
            "latitude": float(self.latitude),
            "longitude": float(self.longitude),
            "city": self.city,
            "temperature": float(self.temperature),
            "humidity": float(self.humidity),
            "apparent_temperature": float(self.apparent_temperature) if self.apparent_temperature is not None else None,
            "weather_code": self.weather_code,
            "condition_text": self.condition_text,
            "fetched_at": self.fetched_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
        }
