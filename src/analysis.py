import argparse
import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

import pandas as pd

from src.config import load_kpi_config
from src.core.kpi_analysis import KpiAnalysis, KpiAnalyzer
from src.core.snapshot import CustomerSnapshotAnalyzer


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Analyze a CSV dataset using KPI definitions from YAML."
    )
    parser.add_argument("--config", default="kpis.yaml", help="KPI YAML path")
    parser.add_argument("--data", default="service.csv", help="Input CSV path")
    parser.add_argument(
        "--format",
        choices=("text", "json"),
        default="text",
        help="Report format (default: text)",
    )
    return parser


def _jsonable(value: Any) -> Any:
    if hasattr(value, "__dataclass_fields__"):
        return {
            key: _jsonable(item) for key, item in asdict(value).items()
        }
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    return value


def _format_measure(value: Any) -> str:
    if value.value is None:
        return f"unavailable ({value.status})"
    if isinstance(value.value, float):
        return f"{value.value:,.2f}"
    return f"{value.value:,}"


def _print_kpi_report(report: KpiAnalysis) -> None:
    print(f"KPI analysis: {report.name}")
    print(f"Rows analyzed: {report.rows_analyzed:,}")
    print("Overall:")
    for measure, result in report.overall.items():
        print(f"  {measure}: {_format_measure(result)}")

    for dimension in report.dimensions:
        print(f"\nTop {len(dimension.segments)} groups by {dimension.dimension}:")
        if not dimension.segments:
            print("  No groups meet the configured minimum row count.")
        for segment in dimension.segments:
            print(f"  {segment.value} (rows={segment.row_count:,})")
            for measure, result in segment.measures.items():
                print(f"    {measure}: {_format_measure(result)}")
        if dimension.omitted_small_groups:
            print(
                f"  Omitted {dimension.omitted_small_groups} groups with fewer "
                "than the configured minimum rows."
            )

    for warning in report.warnings:
        print(f"\nWarning: {warning}")


def _print_snapshot_report(report: Any) -> None:
    print(f"Snapshot analysis: {report.name}")
    print(f"Rows with usable {report.measure}: {report.customers_analyzed:,}")
    print(
        f"Overall mean: {report.overall_mean:,.2f}; "
        f"median: {report.overall_median:,.2f}"
    )
    for segment in report.segments:
        pct = (
            "n/a"
            if segment.percent_difference_from_overall is None
            else f"{segment.percent_difference_from_overall:+.1f}%"
        )
        print(
            f"{segment.dimension}={segment.value}: "
            f"n={segment.customer_count:,}, mean={segment.mean:,.2f}, "
            f"median={segment.median:,.2f}, vs overall={pct}"
        )


def main() -> int:
    args = build_parser().parse_args()
    config_path = Path(args.config)
    data_path = Path(args.data)
    config = load_kpi_config(config_path)
    data = pd.read_csv(data_path)
    reports = [
        KpiAnalyzer().analyze(data, kpi)
        for kpi in config.kpi_sets
    ]
    snapshot_reports = [
        CustomerSnapshotAnalyzer().analyze(data, snapshot)
        for snapshot in config.snapshot_sets
    ]

    if args.format == "json":
        print(
            json.dumps(
                {
                    "kpi_reports": [_jsonable(report) for report in reports],
                    "snapshot_reports": [
                        _jsonable(report) for report in snapshot_reports
                    ],
                },
                indent=2,
            )
        )
    else:
        for report in reports:
            _print_kpi_report(report)
        for report in snapshot_reports:
            _print_snapshot_report(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
