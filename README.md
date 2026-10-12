# CronCraft

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Single file](https://img.shields.io/badge/files-1-brightgreen.svg)
![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)

A visual cron expression builder and explainer. Pick a schedule with clicks, get the
cron string, read what it means in plain English, and see the next 5 run times —
all in **one HTML file with zero dependencies and no build step**.

## Why

Cron syntax is write-only: everyone can copy `0 9 * * MON-FRI`, few can read it back
a month later. CronCraft makes the round-trip painless in both directions — build an
expression visually *or* paste one in, and always see the human meaning plus exactly
when it will fire next.

## Demo

Open `index.html` in any browser (double-click works — no server needed).

| You do | You get |
|---|---|
| Click "Weekdays at 18:00" | `0 18 * * MON-FRI` → **At 18:00 every weekday.** |
| Type `*/20 9-17 * * 1-5` | **Every 20 minutes** during 9–17, every weekday. |
| Paste `30 14 1,15 * *` | **At 14:30 on the 1st and 15th of every month.** |

Each result is followed by the next 5 actual run times in your local timezone.

## Features

- **Visual builder** — five field inputs with per-field validation and clear error messages
- **Bidirectional** — edit fields *or* paste any expression; both stay in sync
- **Plain-English explainer** — "At 09:00 every weekday", "On the 1st of January"
- **Next 5 run times** — computed locally, standard cron day-of-month / day-of-week OR semantics
- **Full cron syntax** — `*`, steps (`*/15`), ranges (`9-17`), lists (`1,15`), combos (`1-5/2`), names (`MON`, `JAN`); `7` = Sunday
- **One-click copy** of the final expression
- **Zero dependencies, no build step** — a single self-contained `index.html`

## Usage

No install. Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
# or
python3 -m http.server 8000
```

### Running the tests

The core logic (parser, scheduler, explainer) lives in a marked `<script>` block
inside `index.html` and is unit-tested with Node's built-in test runner — no
dependencies to install:

```bash
node --test test/cron.test.js
```

38 tests cover parsing (happy path and edge cases), next-run computation
(including month boundaries and DOM/DOW OR semantics), and the English describer.

## Project structure

```
croncraft/
├── index.html          # the whole app: UI + pure, testable cron logic
├── test/
│   └── cron.test.js    # 38 tests, zero dependencies (node --test)
├── LICENSE
└── README.md
```

The logic block is exported as `window.CronCraft` with a clean API —
`parseExpression`, `nextRuns`, `describe` — so it can be reused or embedded elsewhere.

## License

MIT — see [LICENSE](LICENSE).

## Author

Built by [Krrish](https://github.com/codewithkrrish).
