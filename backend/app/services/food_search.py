import unicodedata
from threading import Lock

_cache = None
_cache_lock = Lock()


def normalize_food_text(text: str) -> str:
    """
    ONE normalisation rule everywhere (search, aliases, seed):
    Unicode NFKC, lower-case, split into tokens that keep characters whose
    category starts with L (letter), N (number), or M (mark), join with a single space.
    No \\w is used so combining vowel signs in Indic scripts (Hindi/Kannada) are preserved.
    """
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", str(text)).lower()
    tokens = []
    curr = []
    for ch in text:
        cat = unicodedata.category(ch)
        if cat[0] in ("L", "N", "M"):
            curr.append(ch)
        else:
            if curr:
                tokens.append("".join(curr))
                curr = []
    if curr:
        tokens.append("".join(curr))
    return " ".join(tokens)


# Alias for backward compatibility
_tokenize = normalize_food_text


def _levenshtein(a: str, b: str) -> int:
    """Standard Levenshtein distance."""
    if len(a) < len(b):
        a, b = b, a
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        curr = [i + 1]
        for j, cb in enumerate(b):
            curr.append(
                min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (0 if ca == cb else 1))
            )
        prev = curr
    return prev[-1]


def _score_pair(query_norm: str, candidate_norm: str, is_english: bool = False) -> int:
    """
    Score a normalized query against a normalized candidate string.
    exact 100; prefix 90; word-prefix 80; substring 70;
    token-wise Levenshtein (allowed edits 0 for <=3 chars, 1 for <=5, 2 above;
    also compare with a same-length prefix) = 62 - 5 x total distance; minimum 50.
    English name +2.
    """
    if not candidate_norm or not query_norm:
        return 0

    bonus = 2 if is_english else 0

    # Exact match
    if query_norm == candidate_norm:
        return 100 + bonus

    # Prefix match
    if candidate_norm.startswith(query_norm):
        return 90 + bonus

    # Word-prefix: any word in candidate starts with query
    words = candidate_norm.split()
    if any(w.startswith(query_norm) for w in words):
        return 80 + bonus

    # Substring
    if query_norm in candidate_norm:
        return 70 + bonus

    # Levenshtein (token-wise)
    q_tokens = query_norm.split() or [query_norm]
    c_tokens = candidate_norm.split() or [candidate_norm]

    total_dist = 0
    for qt in q_tokens:
        best = None
        for ct in c_tokens:
            L = len(qt)
            budget = 0 if L <= 3 else (1 if L <= 5 else 2)

            d1 = _levenshtein(qt, ct)
            d2 = _levenshtein(qt, ct[: len(qt)]) if len(ct) >= len(qt) else d1
            d = min(d1, d2)

            if d <= budget:
                if best is None or d < best:
                    best = d
        if best is None:
            return 0  # token could not be matched within budget
        total_dist += best

    score = 62 - 5 * total_dist
    if score < 50:
        return 0
    return score + bonus


def _load_cache():
    from ..models.food import Food
    from sqlalchemy.orm import joinedload, selectinload

    return (
        Food.query.options(
            joinedload(Food.category),
            selectinload(Food.portions),
            selectinload(Food.aliases),
        ).all()
    )


def invalidate_cache():
    global _cache
    with _cache_lock:
        _cache = None


def search_foods(query, category_slug=None, diet=None, limit=20, offset=0, user_id=None):
    """Search foods by query string with fuzzy matching, caching, and custom food isolation."""
    global _cache
    with _cache_lock:
        if _cache is None:
            _cache = _load_cache()
        foods = _cache

    query_norm = normalize_food_text(query or "")

    results = []
    for food in foods:
        # Custom food visibility: only global foods or caller's own custom foods
        if food.owner_user_id is not None and food.owner_user_id != user_id:
            continue

        # Category filter
        if category_slug:
            if not food.category or food.category.slug != category_slug:
                continue
        # Diet filter
        if diet and food.diet != diet:
            continue

        if not query_norm:
            results.append((food, 50))
            continue

        # Score against English, Hindi, Kannada names and aliases
        scores = []
        if food.name_en:
            scores.append(
                _score_pair(query_norm, normalize_food_text(food.name_en), is_english=True)
            )
        if food.name_hi:
            scores.append(_score_pair(query_norm, normalize_food_text(food.name_hi)))
        if food.name_kn:
            scores.append(_score_pair(query_norm, normalize_food_text(food.name_kn)))
        for alias in food.aliases:
            norm_alias = alias.alias_normalized or normalize_food_text(alias.alias)
            scores.append(_score_pair(query_norm, norm_alias))

        best = max(scores) if scores else 0
        if best >= 50:
            results.append((food, best))

    # Sort: score desc, then English name length asc (shorter names win ties)
    results.sort(key=lambda x: (-x[1], len(x[0].name_en or "")))

    total = len(results)
    page = results[offset : offset + limit]
    return [f for f, s in page], total
