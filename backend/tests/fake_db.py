"""
fake_db.py — a tiny in-memory stand-in for a PyMongo Database, FOR TESTS ONLY.

It implements just the query shapes used by app/services/railway_tools.py
(equality, dotted paths through arrays, $regex/$options, $in, $all, $and, $or)
so the tool logic can be unit-tested without a network connection.

It is never imported by the application. Passing tests here proves the tool
logic; the *_live tests in test_assistant_live.py check the real MongoDB data.
"""
import re


def _values(doc, path):
    """All values reachable via a dotted path, flattening arrays (Mongo semantics)."""
    cur = [doc]
    for part in path.split("."):
        nxt = []
        for item in cur:
            if isinstance(item, list):
                for sub in item:
                    if isinstance(sub, dict) and part in sub:
                        nxt.append(sub[part])
            elif isinstance(item, dict) and part in item:
                nxt.append(item[part])
        cur = nxt
    flat = []
    for v in cur:
        flat.extend(v if isinstance(v, list) else [v])
    return flat


def _cond(values, cond):
    if isinstance(cond, dict) and any(k.startswith("$") for k in cond):
        for op, arg in cond.items():
            if op == "$regex":
                flags = re.I if "i" in cond.get("$options", "") else 0
                if not any(isinstance(v, str) and re.search(arg, v, flags) for v in values):
                    return False
            elif op == "$options":
                continue
            elif op == "$in":
                if not any(v in arg for v in values):
                    return False
            elif op == "$all":
                if not all(any(v == a for v in values) for a in arg):
                    return False
            else:
                raise NotImplementedError(op)
        return True
    return any(v == cond for v in values)


def _matches(doc, query):
    for key, cond in query.items():
        if key == "$and":
            if not all(_matches(doc, q) for q in cond):
                return False
        elif key == "$or":
            if not any(_matches(doc, q) for q in cond):
                return False
        elif not _cond(_values(doc, key), cond):
            return False
    return True


def _project(doc, projection):
    if not projection:
        return dict(doc)
    include = [k for k, v in projection.items() if v and k != "_id"]
    out = {k: doc[k] for k in include if k in doc} if include else dict(doc)
    if projection.get("_id", 1):
        if "_id" in doc:
            out["_id"] = doc["_id"]
    else:
        out.pop("_id", None)
    return out


class FakeCursor(list):
    def limit(self, n):
        return FakeCursor(self[:n]) if n else self

    def skip(self, n):
        return FakeCursor(self[n:])


class FakeCollection:
    def __init__(self, docs):
        self.docs = docs

    def find(self, query=None, projection=None):
        return FakeCursor(_project(d, projection) for d in self.docs if _matches(d, query or {}))

    def find_one(self, query=None, projection=None):
        for d in self.docs:
            if _matches(d, query or {}):
                return _project(d, projection)
        return None

    def count_documents(self, query):
        return sum(1 for d in self.docs if _matches(d, query or {}))


class FakeDB:
    def __init__(self, trains, stations):
        self._c = {"trains": FakeCollection(trains), "stations": FakeCollection(stations)}

    def __getitem__(self, name):
        return self._c[name]


class BrokenDB:
    """Every call fails like an unreachable cluster."""
    def __init__(self, exc):
        self.exc = exc

    def __getitem__(self, name):
        raise self.exc
