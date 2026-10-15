import pandas as pd
import numpy as np
from typing import Dict, Any

class DataDiagnostics:
    @staticmethod
    def audit_dataframe(df: pd.DataFrame, time_col: str = None, freq: str = None) -> Dict[str, Any]:
        """Audits data quality: missing rates, gaps in time series, and statistical outliers."""
        report = {
            "total_rows": len(df),
            "missing_values": df.isnull().sum().to_dict(),
            "data_gaps": {},
            "anomalies": {}
        }

        # 1. Detect Time-Series Gaps
        if time_col and time_col in df.columns:
            df[time_col] = pd.to_datetime(df[time_col])
            df = df.sort_values(by=time_col)
            if freq:
                expected_range = pd.date_range(start=df[time_col].min(), end=df[time_col].max(), freq=freq)
                missing_timestamps = expected_range.difference(df[time_col])
                report["data_gaps"]["missing_timestamp_count"] = len(missing_timestamps)
                report["data_gaps"]["sample_missing"] = [str(ts) for ts in missing_timestamps[:5]]

        # 2. Statistical Outliers (IQR Method)
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            q1 = df[col].quantile(0.25)
            q3 = df[col].quantile(0.75)
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)]
            
            if not outliers.empty:
                report["anomalies"][col] = {
                    "outlier_count": int(len(outliers)),
                    "bounds": {"lower": float(lower_bound), "upper": float(upper_bound)},
                    "sample_outlier_indices": outliers.index.tolist()[:5]
                }

        return report