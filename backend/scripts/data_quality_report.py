"""
Read-only data quality report for the railway database.

    cd backend
    python scripts/data_quality_report.py                 # writes data_quality_report.md/.json here
    python scripts/data_quality_report.py --out reports   # choose an output folder
    python scripts/data_quality_report.py --explain       # also ask the AI to summarise (uses your Gemini key)

It only READS (find with projections). Nothing in MongoDB is changed. Findings are hints to review,
not automatic fixes.
"""
import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.database import get_db  # noqa: E402
from app.services import data_quality as dq  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=".", help="output folder (default: current folder)")
    ap.add_argument("--explain", action="store_true", help="add a plain-language AI summary of the aggregate numbers")
    args = ap.parse_args()

    db = get_db()
    proj = {"_id": 0, "trainNumber": 1, "trainName": 1, "source": 1, "destination": 1, "runningDays": 1, "completeOrderedRoute": 1}
    print("Reading trains and stations (read-only)...")
    report = dq.build_report(db["trains"].find({}, proj), db["stations"].find({}, {"_id": 0}))
    md = dq.to_markdown(report)

    if args.explain:
        from app.services.ai_provider import AIProviderError, build_provider
        try:
            provider = build_provider(settings)
            brief = {k: report[k] for k in ("trainsChecked", "trainsWithIssues", "issuesBySeverity", "issuesByKind")}
            brief["stations"] = report["stations"]
            out = provider.generate(
                "You help a developer clean a railway timetable database. Explain these data-quality numbers in plain language, "
                "say which issues most likely come from the import script and which matter most to users, and suggest an order to fix them. "
                "Use only the numbers given. Plain text, under 250 words.",
                [{"role": "user", "parts": [{"text": json.dumps(brief)}]}], [])
            summary = "".join(p.get("text", "") for p in out["content"]["parts"] if isinstance(p.get("text"), str)).strip()
            md += "\n## AI summary\n\n" + summary + "\n"
        except AIProviderError as exc:
            md += f"\n## AI summary\n\nNot available: {exc.message}\n"

    folder = pathlib.Path(args.out)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "data_quality_report.json").write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    (folder / "data_quality_report.md").write_text(md, encoding="utf-8")
    print(md.split("## Worst trains")[0])
    print(f"Saved: {folder / 'data_quality_report.md'} and .json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
