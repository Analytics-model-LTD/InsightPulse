# InsightPulse

InsightPulse is a small anomaly-analysis agent for data exposed by a local
[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server. It
starts the configured server over stdio, discovers and calls one data tool,
then reports numeric outliers using the median absolute deviation (MAD). If
MAD is zero, it uses Tukey's IQR fences. No external LLM or provider key is
required.

## Setup

Use Python 3.10 or newer:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Configure the MCP server executable, its arguments, the MCP tool to call, and
the tool's JSON arguments. Values can be passed as flags or environment
variables:

```powershell
$env:MCP_SERVER_COMMAND = "npx"
$env:MCP_SERVER_ARGS = '["-y", "@example/data-mcp-server"]'
$env:MCP_TOOL_NAME = "query_data"
$env:MCP_TOOL_ARGUMENTS = '{"query":"SELECT date, revenue FROM sales"}'
python -m src.main
```

Equivalent command-line configuration:

```powershell
python -m src.main `
  --command npx `
  --server-args '["-y","@example/data-mcp-server"]' `
  --tool query_data `
  --tool-args '{"query":"SELECT date, revenue FROM sales"}'
```

The MCP tool must return either structured JSON or a single text content item
containing JSON. Data must be a non-empty list of records (objects) or finite
numbers; a `{"rows": [...]}` wrapper is also supported. Results are printed as
JSON, including row indexes, field names, detection scores, and the method used.

The default MAD modified-z-score threshold is `3.5`; tune it with
`--threshold`. Fields with fewer than four finite numeric values are skipped;
the agent reports an error if no fields have enough values to analyze.

## Tests

```powershell
python -m unittest discover -s tests
```
# InsightPulse
