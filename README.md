# AI Quest: Interactive AI Search & Puzzle Lab

**BCA Semester V AI Lab (CCBCA521)**. A locally runnable educational web app that demonstrates the syllabus algorithms with visible, truthful, step-by-step behaviour.

| Module | Syllabus topics |
|---|---|
| **Maze Navigator** | BFS, DFS, Greedy Best-First Search, A* |
| **Water Jug Challenge** | State-space search with BFS / DFS |
| **Tic-Tac-Toe** | Game playing, Minimax |
| **NLP Analyzer** | Stop-word removal, Porter stemming, POS tagging (English) |

No database, no login, no external APIs, no personal data saved. Every request is stateless.

---

## 1. Important: how this build differs from the original Flask brief

The brief describes Python + Flask + NLTK. **This project was built on the workspace it was given, which is Next.js (TypeScript) + Node.js**, so the stack is different but the *architecture and contracts are the same*:

| Brief (Flask) | This project (Next.js) |
|---|---|
| `app.py`, `aiquest/routes.py` | `src/app/api/**/route.ts` (thin route handlers) |
| `aiquest/validation.py` | `src/lib/validation.ts` |
| `aiquest/maze_search.py` | `src/lib/algorithms/maze-search.ts` |
| `aiquest/water_jug.py` | `src/lib/algorithms/water-jug.ts` |
| `aiquest/tic_tac_toe.py` | `src/lib/algorithms/tic-tac-toe.ts` |
| `aiquest/nlp_service.py` | `src/lib/nlp/*.ts` + `data/nltk/*.json` |
| `templates/index.html`, `static/js/*.js` | `src/app/**/page.tsx`, `src/components/**` (React) |
| `docs/*.md` | `docs/*.md` (same three files) |

The rules from the brief still hold: algorithms are pure modules with no framework code; search logic is **never** in browser code (the browser only draws, sends requests and animates the server's answer); the server validates everything; errors are JSON, never stack traces.

### NLTK, honestly
Node.js cannot import Python's NLTK. So AI Quest uses **NLTK's own data plus TypeScript ports of its algorithms**:

| Step | What is used | Verified against real NLTK 3.10.3 |
|---|---|---|
| Stop words | NLTK `stopwords/english` list (198 words), exported to `data/nltk/stopwords.english.json` | list size + membership |
| Tokenizing | Port of `nltk.word_tokenize` regex rules; **simplified** sentence splitter instead of the trained Punkt model | identical tokens on 18 sample texts |
| Stemming | Port of `nltk.stem.PorterStemmer` (NLTK_EXTENSIONS mode) | identical stems on 12,201 words |
| POS tagging | NLTK's trained `averaged_perceptron_tagger_eng` model (exported JSON) run by a port of the tagger | identical tags on 18 sample texts |

The exported data is already in `data/nltk/`. Missing data produces an error that names the resource and the fix; output is never faked. To regenerate the data from a real NLTK install (optional, needs Python):

```bash
pip install nltk
python scripts/export_nltk_data.py          # rewrites data/nltk/*
python scripts/make_nltk_reference.py       # rewrites tests/fixtures/nltk_reference.json
```

---

## 2. Run it (Windows PowerShell first)

Prerequisite: **Node.js 20 or newer** (`node --version`).

```powershell
# From the project folder
npm install
npm run build
npm run start
```

Open <http://localhost:3000>. Press `Ctrl+C` in the terminal to stop.

For development with hot reload use `npm run dev` instead of build/start.

macOS / Linux: the same commands work in any terminal.

If port 3000 is busy: `npm run start -- -p 3001` (PowerShell and bash).

> You do **not** need Python, NLTK, a virtual environment or a database to run the app. `.env` contains a database URL left over from the starter template; AI Quest never uses it.

---

## 3. Project structure

```text
src/
├── app/
│   ├── page.tsx                  Dashboard (4 module cards)
│   ├── maze/ water-jug/ tic-tac-toe/ nlp/ about/   One page each (about = Help & About)
│   ├── layout.tsx, globals.css   Shell, navigation, design system
│   └── api/
│       ├── health/route.ts       GET  /api/health
│       ├── maze/solve/route.ts   POST /api/maze/solve
│       ├── water-jug/solve/route.ts
│       ├── tictactoe/move/route.ts
│       ├── nlp/analyze/route.ts
│       └── [...slug]/route.ts    JSON 404 for unknown /api paths
├── components/                   Browser code: drawing, requests, animation only
│   ├── maze/MazeNavigator.tsx
│   ├── water-jug/WaterJugSolver.tsx
│   ├── tic-tac-toe/TicTacToeGame.tsx
│   └── nlp/NlpAnalyzer.tsx
└── lib/
    ├── algorithms/               PURE algorithm modules (no framework imports)
    │   ├── maze-search.ts        BFS, DFS, Greedy, A*
    │   ├── water-jug.ts
    │   └── tic-tac-toe.ts        rules, Minimax, difficulty policies
    ├── nlp/                      tokenizer, Porter stemmer, perceptron tagger, service
    ├── validation.ts             all request validation + limits
    ├── api-utils.ts, errors.ts   JSON error handling
    └── maze-presets.ts           demo and no-path mazes
data/nltk/                        NLTK stop words + POS model (JSON)
scripts/                          Optional Python scripts to (re)export NLTK data
tests/verify.ts                   Algorithm + NLP verification suite (see §6)
tests/e2e-ui.mjs                  Optional Playwright browser test
docs/                             demo-script.md
```

---

## 4. API reference

All bodies are JSON. **Errors** always look like `{"error": {"code": "...", "message": "..."}}`:
`400 INVALID_REQUEST` (bad input), `404 NOT_FOUND` (unknown `/api/...` path), `503 NLP_RESOURCE_MISSING` (NLTK data file missing), `500 INTERNAL_ERROR` (generic; details only in the server log).

### `GET /api/health`
```json
{"ok": true, "app": "AI Quest"}
```

### `POST /api/maze/solve`
Request (`0` = open, `1` = wall, coordinates are `[row, col]`, grid 1–30 × 1–30, must be rectangular, start and goal must be open cells inside the grid):
```json
{"grid": [[0,0,1],[1,0,0],[0,0,0]], "start": [0,0], "goal": [2,2], "algorithm": "astar"}
```
`algorithm` is one of `bfs`, `dfs`, `greedy`, `astar`. Response:
```json
{
  "found": true,
  "algorithm": "astar",
  "path": [[0,0],[0,1],[1,1],[1,2],[2,2]],
  "visited_order": [[0,0],[0,1],[1,1],[1,2],[2,2]],
  "events": [{"cell": [0,0], "discovered": [[0,1]]}, "..."],
  "metrics": {"path_length": 4, "expanded_nodes": 5, "discovered_nodes": 6, "elapsed_ms": 0.29}
}
```
* `visited_order`: expanded nodes in expansion order (the goal is last). `events` adds, for each expansion, the nodes it *first* added to the frontier; the UI uses it to draw the frontier.
* `expanded_nodes`: nodes removed from the frontier and processed. `discovered_nodes`: unique open nodes ever added to the frontier, start included. `path_length`: number of **moves**.
* `elapsed_ms`: `performance.now()` around the search and path rebuild only. Not a benchmark.
* No path: `found:false`, `path:[]`, `path_length:null`, other metrics valid. Start = goal: path `[start]`, 0 moves.
* Neighbour order is UP, RIGHT, DOWN, LEFT everywhere.

### `POST /api/water-jug/solve`
```json
{"capacity_a": 4, "capacity_b": 3, "goal": 2, "algorithm": "bfs"}
```
Capacities 1–20, `0 ≤ goal ≤ max(capacity_a, capacity_b)`, algorithm `bfs` or `dfs`. Response:
```json
{
  "found": true, "algorithm": "bfs",
  "steps": [{"state": [0,0], "action": "start"}, {"state": [0,3], "action": "fill B"}, "..."],
  "explored": [[0,0],[4,0],"..."],
  "metrics": {"actions": 4, "explored_states": 10, "discovered_states": 11, "elapsed_ms": 0.09},
  "analysis": {"gcd": 1, "reachable_by_theory": true, "note": "Goal reached: ..."}
}
```
Actions: `fill A`, `fill B`, `empty A`, `empty B`, `pour A to B`, `pour B to A`. The goal is met when **either** jug holds exactly `goal`. If unreachable: `found:false`, `steps:[]`, `actions:null`, and `analysis.note` explains why.

### `POST /api/tictactoe/move`
```json
{"board": ["X..", ".O.", "..."], "human_move": [0, 1], "difficulty": "hard"}
```
`board` = 3 strings of `X`, `O`, `.` (empty). The human is X and moves first, so before the human's move X and O counts must be equal. The server rejects: bad shapes, unknown symbols, unequal counts, finished games, out-of-range or occupied squares, unknown difficulty. Response:
```json
{
  "board": ["XXO", ".O.", "..."], "human_move": [0,1], "ai_move": [0,2],
  "outcome": "in_progress", "difficulty": "hard",
  "move_reason": "Hard (Minimax): blocked X's immediate win, the best-scoring move.",
  "winning_line": null,
  "analysis": {"nodes_evaluated": 934, "best_score": 0, "move_scores": [{"move": [0,2], "score": 0}, "..."]}
}
```
`outcome`: `human_win`, `ai_win`, `draw`, `in_progress`. `analysis` is present only on Hard. The client never sends a winner.

**Difficulty policies (exactly what the code does):** *easy* = random legal square. *normal* = win if possible, else block, else random legal square (one-move look-ahead only). *hard* = full Minimax (O maximises; O wins = 10 − depth, X wins = depth − 10, draw = 0; ties → lowest square index).

### `POST /api/nlp/analyze`
```json
{"text": "The cats are running quickly.", "operations": ["remove_stopwords", "stemming", "pos_tag"]}
```
Text: 1–5000 characters, English. Operations: non-empty subset of `remove_stopwords`, `stemming`, `pos_tag`. Response always has `tokens`; the other fields appear **only if requested**:
```json
{
  "language": "english",
  "operations": ["remove_stopwords", "stemming", "pos_tag"],
  "tokens": ["The","cats","are","running","quickly","."],
  "filtered_tokens": ["cats","running","quickly"],
  "removed_stopwords": ["The","are"],
  "stems": [{"token":"cats","stem":"cat"}, {"token":"running","stem":"run"}, {"token":"quickly","stem":"quickli"}],
  "pos_tags": [{"token":"cats","tag":"NNS","description":"plural noun"}, "..."],
  "engine": {"nltk_data_version": "3.10.3", "notes": "..."}
}
```
Pipeline order: POS tagging runs on **all** tokens (a tagger needs context); stop-word removal is case-insensitive and also drops punctuation-only tokens; stemming runs on the filtered tokens if stop-word removal was chosen, otherwise on all word tokens. **Stemming is not lemmatization.**

---

## 5. Using the app

* **Maze**: click/drag to draw or erase walls; drag the **S**/**G** markers (or use the *Place start/goal* tools); keyboard: arrow keys move, Space/Enter applies the tool. Choose an algorithm and speed, then **Run** (replay), **Pause/Resume**, **Step** (one expansion at a time), **Reset** (keeps walls). *Load Demo Maze*, *Load No-Path Example* and *Clear Walls* are provided; rows/columns are 5–30. The table under the grid compares the runs you made on the current maze. Editing the maze clears stale results.
* **Water Jug**: enter capacities and goal, choose BFS or DFS, press Solve, then step through the states with the animated jugs.
* **Tic-Tac-Toe**: pick a difficulty, click a square. After a Hard move the app shows Minimax's score for every candidate square.
* **NLP**: choose operations, press Analyze, copy the output as text.
* **Help & About** explains every algorithm, metric and limitation.

---

## 6. Verification (what was actually run)

```bash
npx tsx tests/verify.ts            # algorithms + validation + NLP vs real NLTK (no server needed)
```
Checks include: BFS/A* shortest on hand-made and **400 random mazes** compared with an independent reference BFS; metric definitions; start = goal; no-path; all validation errors; Water Jug for **every capacity pair 1–20 and every goal** (agrees with gcd theory, BFS optimal, every transition legal); **hard Tic-Tac-Toe never loses across all 569 possible games**; NLP compared with NLTK reference output (`tests/fixtures/nltk_reference.json`).

Optional browser test (real Chromium, all controls): see the header of `tests/e2e-ui.mjs`.

Manual checklist: [`docs/demo-script.md`](docs/demo-script.md) doubles as a walkthrough of every feature.

**Not verified / known limits:** only tested in headless Chromium and by API calls, not in Firefox/Safari; the sentence splitter is simplified (not NLTK Punkt); timings are for illustration only.

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `npm` / `node` not recognised | Install Node.js LTS from nodejs.org, reopen PowerShell |
| Port 3000 in use | `npm run start -- -p 3001` |
| NLP shows *"NLTK resource ... could not be loaded"* | Make sure the `data/nltk` folder is present; regenerate with `python scripts/export_nltk_data.py` (needs `pip install nltk`) |
| Page looks stale after code changes | Stop the server, run `npm run build` again, then `npm run start` |
| PowerShell blocks `npm` scripts | Run `powershell -ExecutionPolicy Bypass -Command "npm run build"` for that one command; do not change machine-wide policy |

---

## 8. Documentation

* [`docs/demo-script.md`](docs/demo-script.md): 5-minute demo flow

