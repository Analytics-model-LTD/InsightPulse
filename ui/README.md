# KPI Insight Studio

React app for setting up KPI alerts and previewing what each person would receive. No REST layer:
the frontend runs **shell commands** on the local machine (backend and frontend share one environment).

```bash
npm install
npm run dev      # http://localhost:5173  (the shell bridge only exists in dev/preview)
npm run build
```

Stack: Vite, React 18, Redux Toolkit. Dark theme in `src/styles/global.css`, wizard + mobile layout in
`src/styles/wizard.css`.

## The setup wizard

"Set up" is a six-slide wizard: **Basics → Numbers → Reasons → Alerts → People → Review**.

- Back / Next buttons (pinned to the bottom on phones), clickable step dots, slide animation.
- The slide list lives in `WIZARD_STEPS` (`src/utils/constants.js`); the current slide is `ui.wizardStep`
  in Redux, so switching to "Insights" and back keeps your place.
- **Review** shows a plain summary and a "things to check" list (`src/utils/validate.js`) with a
  *Fix in …* button that jumps to the right slide. Nothing blocks saving.
- The YAML is collapsed under **Technical definition** (open it to read or copy it).
- A status line next to the KPI set pills shows *Unsaved changes [Save]*, *Saved 10:31*, or an error.

## How the shell layer works

```
React thunk ─ runShell('insights.preview', {set}) ─▶ POST /__shell/run ─▶ shell-bridge/plugin.js
                                                                     │  looks up shell.config.js
                                                                     ▼
                                          your command: stdin = params JSON, stdout = result JSON
```

- **`shell.config.js`**: action name → command. Edit it to point at the real backend CLI. It is
  re-read on every request, so no restart is needed. `python3` falls back to `python` / `py` if it
  isn't installed.
- **`SHELL_COMMANDS.md`**: the contract per action (params in, JSON out). This is what the backend
  developer implements.
- **`backend-stub/cli.py`**: working reference/stub for all three actions, with saved data in
  `backend-stub/.data/`.
- **`shell-bridge/plugin.js`**: the dev-server middleware. A browser cannot spawn processes, so this
  is the one hop between the page and the shell. The browser can only send an action *name*; params go
  to the command on stdin and never onto its command line; localhost + same-origin JSON only.

| Action | When | Params → result |
|---|---|---|
| `kpi_sets.load` | app start | `{}` → `{sets}` |
| `kpi_sets.save` | Save button / "Save & see insights" | `{sets, yaml}` → `{saved, saved_at}` |
| `insights.preview` | opening "Insights" / changing the set | `{set}` → series, bands, anomalies, joint |

No bridge (static hosting, `npm run build` output) or an action missing from `shell.config.js` →
the app falls back to the built-in sample data and says so. A command that fails is shown as an error.

## Structure

```
shell.config.js                     action → command
shell-bridge/plugin.js              Vite plugin that runs the commands
backend-stub/cli.py                 reference backend CLI
src/
  shell/shellClient.js              runShell(), action names, error types
  features/
    kpiSets/                        slice (sets, measures, recipients, sync/dirty), thunks (load/save), defaults
    insights/insightsSlice.js       fetchInsights thunk + result keyed to the set definition
    ui/uiSlice.js                   tab, wizard step, insights viewer/filters
  utils/                            analysis (sample data + fromPayload), yaml, validate, serialize, format, constants
  components/
    layout/Header.jsx
    define/                         DefineView (wizard shell), Stepper, SetBar, DefinitionAccordion,
                                    MeasureCard, RecipientCard, steps/Step*.jsx (one file per slide)
    insights/                       people, filters, alert feed, drill-down, charts
    common/                         Segmented, ToggleCard, TagInput, NumberStepper, NumberField, SaveStatus, Icon
```
