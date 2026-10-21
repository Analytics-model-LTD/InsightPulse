# Shell command contract (frontend ⇄ backend)

The frontend does not call REST. It asks the local shell bridge to run a command; the bridge
(`shell-bridge/plugin.js`, inside the Vite dev server) looks the action up in `shell.config.js`.

```
browser ──POST /__shell/run {action, params}──▶ Vite dev server ──spawn──▶ your command
                                                  (shell.config.js)        stdin = params JSON
browser ◀────────────── {ok, data | error} ◀──── stdout = result JSON, exit 0
```

Rules for every command:

- **stdin**: the params below as one JSON document. Params are never put on the command line.
- **stdout**: exactly one JSON document, nothing else (log to stderr).
- **exit code**: 0 = success. Non-zero = failure; the last 4 KB of stderr is shown in the UI.
- Time limit: 60 s per call (`timeoutMs` in `shell.config.js`).

To point an action at the real backend, edit its entry in `shell.config.js`, e.g.
`'insights.preview': { command: 'python', args: ['backend/cli.py', 'insights', 'preview'], cwd: '..' }`.
`backend-stub/cli.py` is a working reference for all three.

## `kpi_sets.load`

Called once when the app opens.

- stdin: `{}`
- stdout: `{ "sets": [ <KpiSet>, ... ] }`. Return `[]` if nothing is saved yet (the UI keeps its example).

## `kpi_sets.save`

Called by the **Save** button.

- stdin: `{ "sets": [ <KpiSet>, ... ], "yaml": "<all sets rendered as kpi_set YAML, separated by ---->" }`
- stdout: `{ "saved": <int>, "saved_at": "<ISO-8601>" }`

## `insights.preview`

Called when the "See insights" tab opens, and again when the set definition changes.

- stdin: `{ "set": <KpiSet> }`
- stdout:

```jsonc
{
  "series":  { "<measure_id>": [24 numbers] },            // one value per month, oldest first
  "bands":   { "<measure_id>": [null | {"lo":n,"hi":n,"med":n}, ...] },   // expected range; null = not enough history
  "anomalies": [{
    "measure_id": "revenue_lost",
    "t": 23,                       // 0-based month index into series
    "value": 15300, "expected": 9000, "z": 7.4, "pct": 0.7,
    "abs": 6300,                   // optional (default value - expected)
    "up": true,                    // optional (default value >= expected)
    "favourable": false,
    "severity": "critical",        // "info" | "warning" | "critical"
    "narrative": "…",              // optional; LLM text, shown instead of the built-in sentence
    "segments": [{                 // optional; "Where it came from" panel
      "dimension": "CreditRating",
      "rows": [{ "name": "High", "share": 0.55 }, { "name": "All others", "share": 0.09, "other": true }]
    }]
  }],
  "joint": [{ "score": null | number, "flag": true }, ...],   // one per month
  "joint_flagged": 1, "joint_scored": 17,                     // optional (derived from joint if omitted)
  "min_n": 7                                                  // optional
}
```

The UI filters anomalies to each recipient (severity, measures) and to the last 6 months itself, so
return all anomalies you detect.

## `<KpiSet>` (same as the YAML, as JSON)

```jsonc
{
  "name": "Retention effectiveness", "llm": "claude-sonnet-5-5",
  "detector": "iforest",            // iforest | zscore | mad | stl
  "contamination": 0.03,
  "source": "service", "time_column": "MonthsInService",
  "grain": "month",                 // day | week | month | quarter
  "measures": [{
    "id": "acceptance_rate",
    "agg": "ratio",                 // sum | avg | count | min | max | ratio
    "column": "",                   // for non-ratio
    "numerator": "offers_accepted", "denominator": "retention_calls",   // for ratio
    "where": "Churn = 'Yes'",       // optional SQL filter, "" if none
    "direction": "up_good",         // up_good | down_good | neutral
    "priority": 1                   // 1 high, 2 medium, 3 low
  }],
  "dimensions": "MadeCallToRetentionTeam, CreditRating, Occupation",   // comma separated string
  "top_n": 3,
  "top_n_strategy": "manual",       // manual | by_volume | by_impact
  "top_n_values": "MadeCallToRetentionTeam: Yes, No",                  // one "Column: A, B" per line
  "alerting": {
    "z_threshold": 3.0, "min_abs_change": 500, "min_pct_change": 0.1,
    "ch_email": true, "ch_webhook": true,
    "recipients": [{
      "kind": "employee",           // employee | team
      "target": "retention.lead@company.com",   // email, or team name
      "ch_email": true, "ch_webhook": false,
      "min_severity": "info",       // info | warning | critical
      "measures": ""                // comma separated measure ids, "" = all
    }]
  },
  "min_n": 7
}
```

## Errors the UI understands

| Situation | What the user sees |
|---|---|
| App not run with `npm run dev` (no bridge) | Falls back to sample data; Save shows "Shell bridge not available" |
| Action missing from `shell.config.js` | Same fallback for that action |
| Command exits non-zero | Error text from stderr, with a retry button on insights |
| stdout is not valid JSON, or timeout | Error with the first 300 chars / the timeout |

Security: the browser can only name an action; it cannot choose the command or its arguments. The
bridge answers only on `localhost`, only same-origin JSON POSTs, and only in the dev/preview server.
Don't run `vite --host` on a shared network; the bridge refuses non-localhost hosts, but the point
of it is to stay local.
