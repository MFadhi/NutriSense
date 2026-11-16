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
    "disclaimer": "SAMPLE DATA, approximate, verify against IFCT 2017",
    "foods": [
        {
            "key": "test_idli",
            "name": "Test Idli",
            "hi": "टेस्ट इडली",
            "kn": "ಟೆಸ್ಟ್ ಇಡ್ಲಿ",
            "category": "tiffin",
            "diet": "veg",
            "kcal": 58,
            "protein": 2.0,
            "carbs": 11.5,
            "fat": 0.5,
            "fibre": 0.8,
            "allergens": [],
            "tags": ["south_indian"],
            "aliases": ["idli"],
            "portions": [
                {"label": "1 piece (40g)", "grams": 40, "default": True}
            ],
        }
    ],
}


@pytest.fixture
def seed_app():
    app = create_app("testing")
    with app.app_context():
        _db.create_all()
        yield app
        _db.session.remove()
        _db.drop_all()


def test_seed_foods_creates_entries(seed_app):
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as f:
        json.dump(MINIMAL_SEED, f)
        tmp_path = f.name

    try:
        runner = CliRunner()
        with seed_app.app_context():
            from app.models.food import Food

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
    """Running seed twice with same data should update in ONE transaction, not duplicate."""
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


def test_seed_validation_unknown_diet(seed_app):
    bad_data = {
        "seedVersion": "1.0",
        "foods": [
            {
                "key": "bad_food",
                "name": "Bad Food",
                "category": "snacks",
                "diet": "pescatarian_not_supported",
                "kcal": 100,
                "protein": 5,
                "carbs": 10,
                "fat": 2,
                "portions": [{"label": "1 serving", "grams": 100, "default": True}],
            }
        ],
    }
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(bad_data, f)
        tmp_path = f.name
    try:
        runner = CliRunner()
        with seed_app.app_context():
            result = runner.invoke(seed_app.cli, ["seed-foods", "--file", tmp_path])
            assert "Unknown diet" in result.output
            assert "Seed aborted" in result.output
    finally:
        os.unlink(tmp_path)


def test_seed_validation_unknown_allergen(seed_app):
    bad_data = {
        "seedVersion": "1.0",
        "foods": [
            {
                "key": "bad_allergen",
                "name": "Bad Food",
                "category": "snacks",
                "diet": "veg",
                "kcal": 100,
                "protein": 5,
                "carbs": 10,
                "fat": 2,
                "allergens": ["unknown_allergen_xyz"],
                "portions": [{"label": "1 serving", "grams": 100, "default": True}],
            }
        ],
    }
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(bad_data, f)
        tmp_path = f.name
    try:
        runner = CliRunner()
        with seed_app.app_context():
            result = runner.invoke(seed_app.cli, ["seed-foods", "--file", tmp_path])
            assert "Unknown allergen" in result.output
            assert "Seed aborted" in result.output
    finally:
        os.unlink(tmp_path)


def test_seed_validation_no_default_portion(seed_app):
    bad_data = {
        "seedVersion": "1.0",
        "foods": [
            {
                "key": "no_default",
                "name": "No Default Portion",
                "category": "snacks",
                "diet": "veg",
                "kcal": 100,
                "protein": 5,
                "carbs": 10,
                "fat": 2,
                "portions": [{"label": "1 cup", "grams": 100, "default": False}],
            }
        ],
    }
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(bad_data, f)
        tmp_path = f.name
    try:
        runner = CliRunner()
        with seed_app.app_context():
            result = runner.invoke(seed_app.cli, ["seed-foods", "--file", tmp_path])
            assert "No default portion" in result.output
            assert "Seed aborted" in result.output
    finally:
        os.unlink(tmp_path)


def test_seed_validation_kcal_diff_warning(seed_app):
    diff_data = {
        "seedVersion": "1.0",
        "foods": [
            {
                "key": "diff_kcal",
                "name": "Diff Kcal",
                "category": "snacks",
                "diet": "veg",
                "kcal": 500,  # 4*5 + 4*10 + 9*2 = 20 + 40 + 18 = 78 -> >25% diff
                "protein": 5,
                "carbs": 10,
                "fat": 2,
                "portions": [{"label": "1 cup", "grams": 100, "default": True}],
            }
        ],
    }
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(diff_data, f)
        tmp_path = f.name
    try:
        runner = CliRunner()
        with seed_app.app_context():
            result = runner.invoke(seed_app.cli, ["seed-foods", "--file", tmp_path])
            assert "kcal differs by" in result.output
    finally:
        os.unlink(tmp_path)
