import pandas as pd
import numpy as np
import sqlite3
from datetime import datetime, timedelta

# 1. Generate base hourly timestamps for the last 7 days
end_time = datetime.now().replace(minute=0, second=0, microsecond=0)
start_time = end_time - timedelta(days=7)
timestamps = pd.date_range(start=start_time, end=end_time, freq='1h')

# 2. Create normal baseline data
np.random.seed(42)
df = pd.DataFrame({
    'recorded_at': timestamps,
    'cpu_usage': np.random.normal(45, 5, len(timestamps)),  # Mean 45%, SD 5%
    'memory_usage': np.random.normal(60, 8, len(timestamps)),
    'error_rate': np.random.exponential(0.5, len(timestamps))
})

# 3. Inject Statistical Outliers (Spikes)
outlier_indices = np.random.choice(df.index, size=5, replace=False)
df.loc[outlier_indices, 'cpu_usage'] = [98.5, 99.1, 95.0, 97.2, 99.9]
df.loc[outlier_indices[:3], 'memory_usage'] = [94.0, 96.5, 98.2]

# 4. Inject Chronological Gaps (Simulate server downtime)
# Drop a 4-hour block exactly in the middle of the dataset
drop_start = len(df) // 2
df = df.drop(index=range(drop_start, drop_start + 4))

# 5. Inject Null Values (Simulate corrupted payloads)
null_indices = np.random.choice(df.index, size=8, replace=False)
df.loc[null_indices, 'error_rate'] = np.nan

# 6. Save to SQLite database
db_path = 'telemetry.db'
with sqlite3.connect(db_path) as conn:
    df.to_sql('system_telemetry', conn, index=False, if_exists='replace')

print(f"Generated {len(df)} records with deliberate anomalies.")
print(f"Database saved to ./{db_path}")