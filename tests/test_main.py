import argparse
import unittest

from src.core.anomaly import analyze_data
from src.main import _json_array, _json_object, build_parser


class AnalyzeDataTests(unittest.TestCase):
    def test_flags_high_outlier_in_record_data(self) -> None:
        report = analyze_data(
            [
                {"revenue": 10},
                {"revenue": 11},
                {"revenue": 10},
                {"revenue": 9},
                {"revenue": 100},
            ]
        )

        self.assertEqual(report.rows_analyzed, 5)
        self.assertEqual(report.numeric_fields, ["revenue"])
        self.assertEqual(len(report.anomalies), 1)
        self.assertEqual(report.anomalies[0].row_index, 4)
        self.assertEqual(report.anomalies[0].field, "revenue")
        self.assertEqual(report.anomalies[0].method, "mad")

    def test_falls_back_to_iqr_when_mad_is_zero(self) -> None:
        report = analyze_data([0, 0, 0, 0, 50])

        self.assertEqual(len(report.anomalies), 1)
        self.assertEqual(report.anomalies[0].method, "iqr")
        self.assertIsNone(report.anomalies[0].score)

    def test_accepts_rows_wrapper_and_ignores_non_numeric_values(self) -> None:
        report = analyze_data(
            {
                "rows": [
                    {"amount": 5, "label": "a"},
                    {"amount": 5, "label": "b"},
                    {"amount": 5, "label": "c"},
                    {"amount": 5, "label": "d"},
                    {"amount": 90, "label": "e"},
                ]
            }
        )

        self.assertEqual(report.numeric_fields, ["amount"])
        self.assertEqual(report.anomalies[0].row_index, 4)

    def test_rejects_empty_or_malformed_data(self) -> None:
        for data in ([], "not rows", [1, "mixed"]):
            with self.subTest(data=data):
                with self.assertRaises(ValueError):
                    analyze_data(data)

    def test_rejects_invalid_threshold(self) -> None:
        with self.assertRaises(ValueError):
            analyze_data([1, 2, 3, 4], threshold=0)

    def test_rejects_data_without_analyzable_numeric_fields(self) -> None:
        with self.assertRaisesRegex(ValueError, "at least four finite values"):
            analyze_data([{"label": "a"}, {"label": "b"}, {"label": "c"}])


class CliConfigurationTests(unittest.TestCase):
    def test_parser_accepts_environment_configuration(self) -> None:
        parser = build_parser()
        args = parser.parse_args(
            [
                "--command",
                "node",
                "--server-args",
                '["server.js"]',
                "--tool",
                "query_data",
                "--tool-args",
                '{"table":"sales"}',
            ]
        )

        self.assertEqual(args.command, "node")
        self.assertEqual(args.tool, "query_data")
        self.assertEqual(_json_array(args.server_args, "--server-args"), ["server.js"])
        self.assertEqual(
            _json_object(args.tool_args, "--tool-args"), {"table": "sales"}
        )

    def test_json_parsers_reject_wrong_shapes(self) -> None:
        with self.assertRaises(argparse.ArgumentTypeError):
            _json_array("{}", "--server-args")
        with self.assertRaises(argparse.ArgumentTypeError):
            _json_object("[]", "--tool-args")


if __name__ == "__main__":
    unittest.main()