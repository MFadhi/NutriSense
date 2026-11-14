"""Tests for seed CLI command."""
import json
import os
import tempfile
import pytest
from click.testing import CliRunner
from app import create_app
from app.extensions import db as _db


MINIMAL_SEED = {
    "seedVersion": "test-1.0",
    "foods": [
        {
            "key": "test_idli",
            "name": "Test Idli",
            "hi": "टेस्ट इडली",
            "kn": "ಟೆಸ್ಟ್ ಇಡ್ಲಿ",
            "category": "breakfast",
            "diet": "veg",
            "kcal": 58,
            "protein": 2.0,
            "carbs": 11.5,
            "fat": 0.5,
            "fibre": 0.8,
            "allergens": [],
            "tags": ["south-indian"],
            "aliases": ["idli"],
            "portions": [
                {"label": "1 piece (40g)", "grams": 40, "default": True}
            ],
        }
    ],
}


@pytest.fixture(scope="module")
def seed_app():
    app = create_app("testing")
    with app.app_context():
        _db.create_all()
        yield app
        _db.session.remove()
        _db.drop_all()


def test_seed_foods_creates_entries(seed_app):
    from app.cli import register_cli

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as f:
        json.dump(MINIMAL_SEED, f)
        tmp_path = f.name

    try:
        runner = CliRunner()
        with seed_app.app_context():
            from app.extensions import db
            from app.models.food import Food, FoodCategory

            result = runner.invoke(
                seed_app.cli,
                ["seed-foods", "--file", tmp_path],
            )
            assert result.exit_code == 0, result.output
            assert "created" in result.output or "updated" in result.output

            food = Food.query.filter_by(seed_key="test_idli").first()
            assert food is not None
            assert food.name_en == "Test Idli"
            assert len(food.portions) == 1
            assert food.portions[0].is_default is True
    finally:
        os.unlink(tmp_path)


def test_seed_foods_idempotent(seed_app):
    """Running seed twice with same data should update, not duplicate."""
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as f:
        json.dump(MINIMAL_SEED, f)
        tmp_path = f.name

    try:
        runner = CliRunner()
        with seed_app.app_context():
            from app.models.food import Food

            runner.invoke(seed_app.cli, ["seed-foods", "--file", tmp_path])
            runner.invoke(seed_app.cli, ["seed-foods", "--file", tmp_path])

            count = Food.query.filter_by(seed_key="test_idli").count()
            assert count == 1
    finally:
        os.unlink(tmp_path)


def test_seed_foods_reset_flag(seed_app):
    """--reset should remove existing sample foods before importing."""
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as f:
        json.dump(MINIMAL_SEED, f)
        tmp_path = f.name

    try:
        runner = CliRunner()
        with seed_app.app_context():
            result = runner.invoke(
                seed_app.cli, ["seed-foods", "--file", tmp_path, "--reset"]
            )
            assert result.exit_code == 0
            assert "Reset" in result.output
    finally:
        os.unlink(tmp_path)
