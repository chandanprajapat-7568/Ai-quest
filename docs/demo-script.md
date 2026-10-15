# AI Quest: 5-minute demo script

Setup before you start: `npm run build && npm run start`, open <http://localhost:3000>, browser zoom about 100 %.

## 1. Introduce (20 sec) : Dashboard
> "AI Quest connects our AI Lab search, game-playing and NLP experiments in one interactive tool. It is classical AI, not a chatbot. Every algorithm shows what it does and how much work it did."

Point at the four cards and the syllabus badges on each.

## 2. Maze (90 sec) : `/maze`
1. Click **Load Demo Maze**. Explain: a wall splits the maze; the only way across is around the bottom.
2. Choose **BFS**, speed medium, press **Run**. Say: "Purple cells are *expanded* nodes in the order the server expanded them, cyan cells are discovered but waiting in the frontier. The yellow path is drawn only after the replay." Read the numbers: **22 moves, 138 expanded, 146 discovered**.
3. Switch to **A\*** and Run: **22 moves, 67 expanded**. Say: "Same shortest path, about half the work, because A* ranks cells by f(n) = g(n) + h(n) with Manhattan distance."
4. Optional: **DFS** (66 moves, not shortest) and **Greedy** (30 moves, not shortest). Say: "Different strategy, different path. Only BFS and A* promise the shortest."
5. Show the **comparison table** under the grid. Say: "Times are tiny and noisy; compare Expanded, not milliseconds."
6. Quick extras: **Pause / Step**, draw a wall by dragging, **Load No-Path Example** → friendly "No path exists" message.

## 3. Water Jug (45 sec) : `/water-jug`
1. Press **Solve** with 4, 3, goal 2 and BFS. It shows **4 actions**.
2. Click **Next** through the steps and watch the jugs. Say: "A state is the pair (A, B). Fill, empty and pour are the edges of the state graph. BFS finds the fewest actions."
3. Load **4 L / 6 L → 3 L (impossible)** and Solve: "3 is not a multiple of gcd(4, 6) = 2, and the search proves it by exhausting all reachable states."

## 4. Tic-Tac-Toe (45 sec) : `/tic-tac-toe`
1. Difficulty **Hard**. Play top-left (X). Then play so that you threaten a line, e.g. two in a row, and show the computer **blocking**. Read the "Last computer move" box.
2. Show the **Minimax score grid**: "Every square gets a score from exploring all future games. Higher is better for O. The highlighted one was chosen."
3. Mention: "Easy = random; Normal = win/block/random; Hard = full Minimax. The server validates every move and decides the winner."

## 5. NLP (60 sec) : `/nlp`
1. Keep the sample **"The cats are running quickly."** with all three operations and press **Analyze**.
2. Show: tokens; stop words removed (*The*, *are*); stems (*running → run*, *quickly → quickli*); POS tags (*cats* = NNS plural noun, *running* = VBG).
3. Say: "Stemming is rule-based and not lemmatization, so *quickli* is not a real word. The tokenizer, stemmer and tagger follow NLTK, and we checked them against real NLTK output."
4. Optional: uncheck operations to show only the requested outputs appear; click **Copy output**.

## 6. Close (20 sec)
> "Limitations: English-only NLP, mazes up to 30×30, everything runs locally and nothing is stored. Timings are for illustration, not benchmarking."

Open **Help & About** if asked how anything works.

---

## Full feature checklist (use this to rehearse)

- [ ] Dashboard loads; all four cards open their modules; nav highlights the current page; mobile menu opens.
- [ ] Maze: draw/erase walls (mouse and touch), move S and G, keyboard arrows + Space, size sliders, algorithm change clears stale colours, Run / Pause / Resume / Step / Reset, speed slider, Load Demo, Load No-Path, Clear Walls, comparison table, metrics explanation.
- [ ] Water Jug: valid solve, BFS vs DFS, unreachable message, validation errors, step controls and Play.
- [ ] Tic-Tac-Toe: all three difficulties, win / draw / loss messages, New game, scoreboard, Minimax scores on Hard.
- [ ] NLP: each operation alone and combined, empty text disabled, over 5000 characters disabled, Copy output.
- [ ] Help & About readable; no horizontal scrolling on a phone-sized window.
