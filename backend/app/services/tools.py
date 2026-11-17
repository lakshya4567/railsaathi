"""
tools.py — the single registry the AI can call.

Merges every tool module behind one validated entry point:
  - railway_tools : lookups in the real MongoDB data (read-only)
  - journey_tools : journey planning computed from the real timetable (read-only)
  - demo_tools    : clearly-labelled DEMO features (simulated; never presented as real)

The model can only call names listed here, with exactly the arguments declared here.
"""
from __future__ import annotations

from typing import Any

from . import demo_tools as _demo
from . import journey_tools as _journey
from . import railway_tools as _rt
from .railway_tools import DatabaseUnavailable, ToolInputError  # re-exported for callers

TOOL_SPECS: dict[str, dict] = {**_rt.TOOL_SPECS, **_journey.TOOL_SPECS, **_demo.TOOL_SPECS}
DEMO_TOOLS = frozenset(_demo.TOOL_SPECS)
_ALLOWED_ARGS = {name: set(spec["parameters"]["properties"]) for name, spec in TOOL_SPECS.items()}

__all__ = ["TOOL_SPECS", "DEMO_TOOLS", "run_tool", "declarations", "DatabaseUnavailable", "ToolInputError"]


def run_tool(name: str, args: Any, db=None) -> dict:
    """Validate the tool name/arguments and run it. Raises ToolInputError for bad input
    and DatabaseUnavailable if MongoDB is down."""
    spec = TOOL_SPECS.get(name)
    if spec is None:
        raise ToolInputError(f"Unknown tool '{name}'.")
    if not isinstance(args, dict):
        raise ToolInputError("Tool arguments must be an object.")
    unknown = set(args) - _ALLOWED_ARGS[name]
    if unknown:
        raise ToolInputError(f"Unexpected argument(s): {', '.join(sorted(unknown))}.")
    missing = [r for r in spec["parameters"].get("required", []) if r not in args]
    if missing:
        raise ToolInputError(f"Missing required argument(s): {', '.join(missing)}.")
    if db is None:
        from ..database import get_db  # lazy: keeps this module importable in tests
        db = get_db()
    return spec["fn"](db, **args)


def declarations() -> list[dict]:
    """Function declarations in the neutral JSON-schema form providers translate."""
    return [{"name": n, "description": s["description"], "parameters": s["parameters"]}
            for n, s in TOOL_SPECS.items()]
