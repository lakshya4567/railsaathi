"""
Run the assistant question suite against your REAL MongoDB and REAL Gemini model.

    cd backend
    python scripts/run_assistant_eval.py                # all questions
    python scripts/run_assistant_eval.py --only route   # questions whose id contains "route"
    python scripts/run_assistant_eval.py --pause 1.5    # wait between calls (free-tier rate limits)

Uses your API quota (a few model calls per question). Read-only on the database.
Exit code 1 if any question fails, so you can use it before deploying.
"""
import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.database import get_db  # noqa: E402
from app.services import assistant as A  # noqa: E402
from app.services.ai_provider import AIProviderError, build_provider  # noqa: E402
from app.services.eval_runner import run_all  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", help="run only questions whose id contains this text")
    ap.add_argument("--pause", type=float, default=0.0, help="seconds to wait after each turn")
    args = ap.parse_args()
    try:
        provider = build_provider(settings)
    except AIProviderError as exc:
        print("AI not configured:", exc.message)
        return 2
    print(f"Model: {provider.model}\n")
    report = run_all(provider, get_db(), only=args.only, run_tool=A.cached_run_tool, pause=args.pause)
    print("Questions built from real records:", report["samples"], "\n")
    for r in report["results"]:
        print(("PASS  " if r["passed"] else "FAIL  ") + r["id"])
        for f in r["failures"]:
            print("        -", f)
    print(f"\n{report['passed']} of {report['total']} passed")
    return 0 if report["passed"] == report["total"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
