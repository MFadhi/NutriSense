"""Tests for fuzzy food search service."""
import pytest
from app.services.food_search import (
    _tokenize,
    _levenshtein,
    _score_pair,
    search_foods,
    normalize_food_text,
    invalidate_cache,
)


def test_tokenize_basic():
    assert _tokenize("Paneer") == "paneer"


def test_normalization_rule_spaces_and_casing():
    # Exactly checks the prompt example: "cottage cheese" -> "cottage cheese", not "cottagecheese"
    assert normalize_food_text("Cottage Cheese") == "cottage cheese"
    assert normalize_food_text("  cottage - cheese! ") == "cottage cheese"


def test_tokenize_hindi():
    result = _tokenize("पनीर")
    assert len(result) > 0  # Hindi letters kept
    assert normalize_food_text("दाल तड़का") == "दाल तड़का"


def test_tokenize_kannada():
    assert normalize_food_text("ದೋಸೆ") == "ದೋಸೆ"
    assert normalize_food_text("ಇಡ್ಲಿ") == "ಇಡ್ಲಿ"


def test_tokenize_strips_spaces_and_specials():
    # Punctuation dropped, letters kept, joined with single space
    result = _tokenize("dal-tadka!")
    assert "!" not in result
    assert "-" not in result
    assert result == "dal tadka"


def test_levenshtein_same():
    assert _levenshtein("paneer", "paneer") == 0


def test_levenshtein_one_edit():
    assert _levenshtein("paneer", "panee") == 1


def test_score_exact():
    score = _score_pair("paneer", "paneer", is_english=True)
    assert score >= 100


def test_score_prefix():
    score = _score_pair("pan", "paneer")
    assert score >= 80


def test_score_substring():
    score = _score_pair("neer", "paneer")
    assert score >= 70


def test_score_no_match():
    score = _score_pair("xyz", "paneer")
    assert score < 50


def test_search_exact(app):
    with app.app_context():
        invalidate_cache()
        foods, total = search_foods("Paneer")
        assert total >= 1
        names = [f.name_en for f in foods]
        assert "Paneer" in names


def test_search_partial(app):
    with app.app_context():
        invalidate_cache()
        foods, total = search_foods("dal")
        assert total >= 1


def test_search_empty_returns_all(app):
    with app.app_context():
        invalidate_cache()
        foods, total = search_foods("")
        assert total >= 3  # all seeded foods


def test_search_diet_filter(app):
    with app.app_context():
        invalidate_cache()
        foods, total = search_foods("", diet="nonveg")
        for f in foods:
            assert f.diet == "nonveg"


def test_search_no_match(app):
    with app.app_context():
        invalidate_cache()
        foods, total = search_foods("zzzznotafood")
        assert total == 0


def test_search_pagination(app):
    with app.app_context():
        invalidate_cache()
        foods_p1, total = search_foods("", limit=2, offset=0)
        foods_p2, _ = search_foods("", limit=2, offset=2)
        # Pages should not overlap
        ids_p1 = {f.id for f in foods_p1}
        ids_p2 = {f.id for f in foods_p2}
        assert ids_p1.isdisjoint(ids_p2)


def test_search_typos_and_scripts(app):
    with app.app_context():
        invalidate_cache()
        # 'panner' typo should match Paneer
        foods, total = search_foods("panner")
        assert total >= 1
        assert any("paneer" in f.name_en.lower() for f in foods)

        # 'idly' alias should match Idli
        foods, total = search_foods("idly")
        assert total >= 1
        assert any(f.name_en == "Idli" for f in foods)

        # 'chapathi' typo should match Chapati
        foods, total = search_foods("chapathi")
        assert total >= 1
        assert any("chapati" in f.name_en.lower() for f in foods)

        # 'ದೋಸೆ' Kannada script should match Dosa
        foods, total = search_foods("ದೋಸೆ")
        assert total >= 1
        assert any(f.name_en == "Dosa" for f in foods)

