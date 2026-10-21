# src/cli.py  (run as: python src/cli.py <group> <action>, from the repo root)
import contextlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Separate file on purpose: kpis.yaml uses a different schema, so don't overwrite it yet.
STORE = ROOT / "data" / "ui_kpi_sets.json"


def load_sets(params):
    if not STORE.exists():
        return {"sets": []}
    return {"sets": json.loads(STORE.read_text(encoding="utf-8"))}


def save_sets(params):
    sets = params.get("sets")
    if not isinstance(sets, list) or not sets:
        raise ValueError("params.sets must be a non-empty list")
    STORE.parent.mkdir(parents=True, exist_ok=True)
    STORE.write_text(json.dumps(sets, indent=2), encoding="utf-8")
    STORE.with_suffix(".yaml").write_text(params.get("yaml", ""), encoding="utf-8")
    return {"saved": len(sets), "saved_at": datetime.now(timezone.utc).isoformat()}


def preview(params):
    # TODO: call analysis.py here and return series, bands, anomalies, joint (see SHELL_COMMANDS.md).
    raise NotImplementedError("insights.preview is not connected to analysis.py yet")


HANDLERS = {
    ("kpi-sets", "load"): load_sets,
    ("kpi-sets", "save"): save_sets,
    ("insights", "preview"): preview,
}

if __name__ == "__main__":
    key = tuple(sys.argv[1:3])
    if key not in HANDLERS:
        sys.exit("Unknown command %r. Known: %s" % (" ".join(key), ", ".join(" ".join(k) for k in HANDLERS)))
    params = json.loads(sys.stdin.read() or "{}")
    with contextlib.redirect_stdout(sys.stderr):  # stray print() calls must not corrupt the JSON
        result = HANDLERS[key](params)
    sys.stdout.write(json.dumps(result))