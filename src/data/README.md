# Data architecture

Three categories, kept separate per `CLAUDE.md`:

- `raw/` — the raw College Scorecard API responses `npm run data:import` fetched on its last run. Gitignored (regenerable cache, not source of truth); `.gitkeep` only in git.
- `generated/colleges.json` — normalized, validated output of the import pipeline (`scripts/import-college-scorecard.ts`), matching the internal `College` schema (`src/lib/types.ts`). **Committed to git** so static builds don't need network access or an API key on every build — regenerate it with `npm run data:import` when you want fresher official data. `generated/import-report.txt` (also committed) documents the most recent run's coverage/validation results.
- `curated/` — hand-verified editorial data (campus tour points, featured-flag overrides, editorial summaries). Committed to git, edited directly as code. Never merged into `generated/colleges.json` — official numbers and curated campus-experience data stay in separate files, joined only at render time via `getCuratedDataByUnitId`.

All of it is accessed through `src/lib/colleges.ts`, the only import surface UI code should use.
