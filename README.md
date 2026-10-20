<div align="center">

<img src="assets/hero.svg" alt="InsightPulse: always-on agents for your data" width="100%">

<br>

**Open-source agents that watch your data around the clock, find what changed, and tell you who and what drove it.**

<br>

![Python](https://img.shields.io/badge/python-3.10%2B-5b9dff?style=flat-square&labelColor=121317&logo=python&logoColor=white)
![Built on LangGraph](https://img.shields.io/badge/built%20on-LangGraph-8ed8c7?style=flat-square&labelColor=121317)
![MCP](https://img.shields.io/badge/data%20via-MCP-a3abff?style=flat-square&labelColor=121317)
![Open source](https://img.shields.io/badge/open%20source-yes-d6f49c?style=flat-square&labelColor=121317)

[Quick start](#quick-start) · [How it works](#how-it-works) · [Configuration](#configuration) · [Detection](#how-detection-works) · [Roadmap](#roadmap) · [Tests](#tests)

</div>

<br>

## Why InsightPulse

Dashboards wait for you to look. Agents do not. InsightPulse connects to your data through any [MCP](https://modelcontextprotocol.io) server, scans it, and reports the values that broke from the usual pattern, so you hear about a surprise before a customer or a manager tells you.

<table>
<tr>
<td width="33%" valign="top">

### 🔎 Detect
Scores every numeric field against its own history and flags the points that do not belong. Robust to outliers, so one bad value does not hide the next one.

</td>
<td width="33%" valign="top">

### 🧭 Explain

Produces a structured root-cause hypothesis, confidence score, and business impact. Slice-level drivers and dollar impact are on the [roadmap](#roadmap).

</td>
<td width="33%" valign="top">

### 📣 Tell

Prints structured JSON and can deliver alerts through Slack or REST webhooks, with scheduled runs and cooldown protection.

</td>
</tr>
</table>

<br>

## How it works

<img src="assets/pipeline.svg" alt="Pipeline: MCP server, tool call, detect. Planned: explain, story, notify." width="100%">

1. **Connect.** Point the agent at any MCP server and tell it which tool to call.
2. **Fetch.** The tool returns your data as JSON.
3. **Detect.** Each numeric field is scored with a MAD-based modified z-score.
4. **Report.** Anomalies are printed as JSON, with row indexes, field names, scores and the method used.

<br>

## Quick start

> **Requires Python 3.10 or newer.**

```powershell
git clone https://github.com/Analytics-model-LTD/InsightPulse.git
cd InsightPulse

python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

<details>
<summary><b>macOS / Linux</b></summary>

```bash
git clone https://github.com/Analytics-model-LTD/InsightPulse.git
cd InsightPulse

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

</details>

### Run it

Configure the MCP server executable, its arguments, the MCP tool to call, and the tool's JSON arguments. Values can be passed as environment variables:

```powershell
$env:MCP_SERVER_COMMAND = "npx"
$env:MCP_SERVER_ARGS = '["-y", "@example/data-mcp-server"]'
$env:MCP_TOOL_NAME = "query_data"
$env:MCP_TOOL_ARGUMENTS = '{"query":"SELECT date, revenue FROM sales"}'
python -m src.main
```

or as command-line flags:

```powershell
python -m src.main `
  --command npx `
  --server-args '["-y","@example/data-mcp-server"]' `
  --tool query_data `
  --tool-args '{"query":"SELECT date, revenue FROM sales"}'
```

<details>
<summary><b>macOS / Linux equivalents</b></summary>

```bash
export MCP_SERVER_COMMAND="npx"
export MCP_SERVER_ARGS='["-y", "@example/data-mcp-server"]'
export MCP_TOOL_NAME="query_data"
export MCP_TOOL_ARGUMENTS='{"query":"SELECT date, revenue FROM sales"}'
python -m src.main
```

```bash
python -m src.main \
  --command npx \
  --server-args '["-y","@example/data-mcp-server"]' \
  --tool query_data \
  --tool-args '{"query":"SELECT date, revenue FROM sales"}'
```

</details>

<br>

## Configuration

| Flag | Environment variable | What it sets |
|---|---|---|
| `--command` | `MCP_SERVER_COMMAND` | Executable that starts the MCP server, for example `npx` |
| `--server-args` | `MCP_SERVER_ARGS` | JSON array of arguments for that executable |
| `--tool` | `MCP_TOOL_NAME` | Name of the MCP tool to call |
| `--tool-args` | `MCP_TOOL_ARGUMENTS` | JSON object passed to the tool as its arguments |
| `--threshold` | none | Modified z-score threshold. Default `3.5` |

### What your tool must return

The MCP tool must return either **structured JSON** or a **single text content item containing JSON**. The data must be a non-empty list of:

- **records** (objects), or
- **finite numbers**.

A `{"rows": [...]}` wrapper is also supported.

> Fields with fewer than four finite numeric values are skipped. The agent reports an error if no field has enough values to analyze.

<br>

## How detection works

<img src="assets/detection.svg" alt="Bell curve: values with an absolute modified z-score above 3.5 are flagged" width="100%">

Each numeric field is scored with the **MAD modified z-score**:

```text
M = 0.6745 × (x − median) ÷ MAD        flag when |M| > 3.5
```

Median and MAD (median absolute deviation) replace the mean and standard deviation, so a few extreme values cannot drag the baseline toward themselves and hide the anomalies. Tune the sensitivity with `--threshold`.

### Example output

Results are printed as JSON, including row indexes, field names, detection scores and the method used. The shape looks like this:

```jsonc
// illustrative: check the exact field names against your own run
{
  "method": "mad_modified_z_score",
  "threshold": 3.5,
  "anomalies": [
    { "row": 41, "field": "revenue", "value": 4150, "score": 6.2 }
  ]
}
```

<br>

## Roadmap

InsightPulse is built on [LangGraph](https://github.com/langchain-ai/langgraph), so the same agent can run on a schedule, survive restarts, and pause for a human. Here is where it stands.

| | Capability | Status |
|---|---|---|
| ✅ | Fetch data from any MCP server and tool | Available |
| ✅ | MAD modified z-score detection, per numeric field | Available |
| ✅ | JSON output with rows, fields, scores and method | Available |
| ✅ | Unit tests | Available |
| ✅ | Time grains: hourly, daily, weekly and monthly aggregation over a configured window | Available |
| ✅ | Seasonal baseline DataFrames and Z-score, MAD and Isolation Forest detectors | Available |
| 🔜 | Drivers: which slice moved, and a revenue split into traffic, conversion and order value | Planned |
| ✅ | Structured anomaly explanations through a LangGraph workflow with timeout/token fallbacks | Available |
| ✅ | Slack and REST webhook delivery, scheduled jobs, and cooldown enforcement | Available |

> **Design rule:** code computes, the model narrates. Supply aggregated facts and metric metadata to the analysis workflow rather than raw rows.

<br>

## KPI anomaly MVP

The first KPI-monitoring step is available as reusable configuration and
detection code. Define a `kpi_sets` list in YAML and load it with
`load_kpi_config`; each set names the timestamp, grain, measures, optional
dimensions, and seasonal detection thresholds. `SeasonalZScore.detect` accepts
a DataFrame that is already aggregated to the configured grain and returns
anomalies for each measure. With no dimensions, it checks the overall series;
with dimensions, it checks each dimension combination separately and does not
synthesize an additional total.

For hourly data, the detector compares the latest point with earlier points at
the same hour and weekday. Daily, weekly, and monthly grains compare matching
weekdays, ISO week numbers, and calendar months respectively. Series with
fewer than `min_n` matching historical values or an absolute baseline median
below `min_volume` are skipped. Constant baselines are skipped because a MAD
score cannot be computed. Adverse changes are marked warning at a score of 5
and critical at 8; favorable changes are informational. This standalone
detector does not generate SQL, schedule runs, or send notifications; use the
KPI engine service modules below for orchestration and delivery.

Configuration accepts either `kpi_sets: [ ... ]` for multiple definitions or
`kpi_set: { ... }` for one definition. KPI definitions support aggregation
types (`sum`, `avg`, `median`, `count`, `count_distinct`, and `ratio`), simple comparison
filters, top-N settings, and typed alert recipients. The local CSV runner
executes the aggregations and filters in Python; it does not use the configured
LLM or detector metadata, generate SQL, or send alerts.

```yaml
kpi_sets:
  - name: telemetry
    time_column: recorded_at
    grain: hour
    timezone: UTC
    measures:
      - id: cpu_usage
        column: cpu_usage
        direction: down_good
    min_n: 7
    min_volume: 20
```

```python
from src.config import load_kpi_config
from src.core.seasonal import SeasonalZScore

kpis = load_kpi_config("kpis.yaml")
anomalies = SeasonalZScore().detect(dataframe, kpis.kpi_sets[0])
```

### Run configured KPI analysis on a CSV

Run the configured analysis from the repository root:

```powershell
python -m src.analysis --config kpis.yaml --data service.csv
```

The runner reads every `kpi_set`/`kpi_sets` and `snapshot_sets` entry and
prints a text report. Use `--format json` for machine-readable output. With a
KPI set, `time_column` and each configured dimension are analyzed separately
as grouping columns, so a cohort such as `MonthsInService` works even when it
is not a timestamp. The configured aggregations are calculated overall and
for each group; small groups are skipped, and up to `top_n` groups are shown.
The `where` option accepts a single safe comparison, such as
`Churn = 'Yes'` or `MonthlyRevenue >= 50`.

In this `service.csv`, `Churn` is missing on every row. The runner reports
churned customers and churn rate as unavailable instead of incorrectly
reporting a zero churn rate. Populate that field with actual outcomes before
using this dataset for churn analysis. The `contribution` top-N strategy needs
a time-series baseline, so the snapshot runner falls back to ranking by group
size and calls out that fallback.

Snapshot configs can also be analyzed by the same runner. For example:

```python
from src.config import load_kpi_config
from src.core.snapshot import CustomerSnapshotAnalyzer

config = load_kpi_config("kpis.yaml")
report = CustomerSnapshotAnalyzer().analyze(dataframe, config.snapshot_sets[0])
print(report)
```

This snapshot analyzer reports the overall mean and median and each configured
group's customer count, mean, median, and difference from the overall mean.
Groups with fewer than `min_customers` usable rows are omitted. These are
descriptive comparisons; they do not establish causes or predict churn.

### KPI engine services

The reusable engine modules provide PostgreSQL configuration/execution
metadata storage, Redis query-result caching and atomic alert cooldowns, an
MCP stdio data connector, time-window aggregation and seasonal baselines,
statistical/ML detectors, structured LangGraph analysis, APScheduler jobs, and
Slack/REST notification delivery. These integrations are opt-in; the local
CSV runner above continues to work independently. Configure database URLs and
webhook endpoints through trusted deployment configuration rather than
committing credentials.

The engine configuration uses the existing KPI schema as a nested config:

```yaml
kpi_config:
  kpi_sets:
    - name: hourly-revenue
      time_column: recorded_at
      grain: hour
      measures:
        - id: revenue
          column: revenue
          agg: sum
data_source:
  command: mcp-server-example
  args: []
  tool_name: query_data
  tool_arguments:
    query: SELECT recorded_at, revenue FROM sales
time_window:
  lookback_days: 30
  baseline_days: 90
  grain: hour
frequency: "cron:0 * * * *"
cooldown_period_minutes: 60
webhooks:
  - name: incident-slack
    kind: slack
    url: https://hooks.slack.com/services/replace-with-deployment-secret
```

Load and validate the configuration with `load_engine_config` from
`src.config`; database connection URLs are read from the `DATABASE_URL` and
`REDIS_URL` environment variables when omitted from YAML. Call
`PostgresStateBackend.ensure_schema()` before saving
configurations or execution records. Pass a `RedisStateBackend` to
`MCPDataConnector` as its query cache and to `NotificationDispatcher` as its
cooldown store. `TimeSeriesCalculator` accepts a validated
`TimeWindowConfig`; detectors are available from
`src.core.detection.create_detector` using `zscore`, `mad`, or
`isolation_forest`. The scheduler accepts `hourly`, `daily`, `weekly`, or a
five-field crontab expression (optionally prefixed with `cron:`).

PostgreSQL, Redis, the configured MCP server, and any LLM provider remain
deployment-managed services; this repository does not start containers or
apply external infrastructure automatically.

## Tests

```powershell
python -m unittest discover -s tests
```

<br>

## Contributing

Issues and pull requests are welcome. If you are adding a detector or a data source, include a unit test next to the code it covers.

<br>

<div align="center">

**InsightPulse** · always-on agents for your data
<br>
Built by [Analytics Model LTD](https://github.com/Analytics-model-LTD)

</div>
