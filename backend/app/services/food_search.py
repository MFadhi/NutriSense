import unicodedata
from threading import Lock

_cache = None
_cache_lock = Lock()


def _tokenize(text):
    """Keep chars whose Unicode category starts with L (letter), N (number), or M (mark)."""
    if not text:
        return ""
    return "".join(
        ch for ch in text if unicodedata.category(ch)[0] in ("L", "N", "M")
    ).lower()


def _levenshtein(a, b):
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


def _score_pair(query_norm, candidate_norm, is_english=False):
    """Score a normalized query against a normalized candidate string."""
    if not candidate_norm or not query_norm:
        return 0

    # Exact match
    if query_norm == candidate_norm:
        return 100 + (2 if is_english else 0)

    # Prefix match
    if candidate_norm.startswith(query_norm):
        return 90 + (2 if is_english else 0)

    # Word-prefix: any word in candidate starts with query
    words = candidate_norm.split()
    if any(w.startswith(query_norm) for w in words):
        return 80 + (2 if is_english else 0)

    # Substring
    if query_norm in candidate_norm:
        return 70 + (2 if is_english else 0)

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
        total_dist += best if best is not None else 999

    score = 62 - 5 * total_dist
    if score < 50:
        return 0
    return score + (2 if is_english else 0)


def _load_cache():
    from ..models.food import Food

    return Food.query.all()


def invalidate_cache():
    global _cache
    with _cache_lock:
        _cache = None


def search_foods(query, category_slug=None, diet=None, limit=20, offset=0):
    """Search foods by query string with fuzzy matching."""
    global _cache
    with _cache_lock:
        if _cache is None:
            _cache = _load_cache()
        foods = _cache

    query_norm = _tokenize(query or "")

    results = []
    for food in foods:
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

        # Score against all names
        scores = []
        if food.name_en:
            scores.append(
                _score_pair(query_norm, _tokenize(food.name_en), is_english=True)
            )
        if food.name_hi:
            scores.append(_score_pair(query_norm, _tokenize(food.name_hi)))
        if food.name_kn:
            scores.append(_score_pair(query_norm, _tokenize(food.name_kn)))
        for alias in food.aliases:
            scores.append(_score_pair(query_norm, _tokenize(alias.alias)))

        best = max(scores) if scores else 0
        if best >= 50:
            results.append((food, best))

    # Sort: score desc, then English name length asc (shorter wins ties)
    results.sort(key=lambda x: (-x[1], len(x[0].name_en or "")))

    total = len(results)
    page = results[offset : offset + limit]
    return [f for f, s in page], total
