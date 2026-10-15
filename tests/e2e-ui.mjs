/**
 * OPTIONAL end-to-end browser check for AI Quest (drives the real UI with Chromium).
 *
 * It is not needed to run the app. To use it:
 *   1. Start the app:          npm run build && npm run start          (serves http://127.0.0.1:3000)
 *   2. Install Playwright without touching package.json:
 *                              npm install --no-save playwright && npx playwright install chromium
 *   3. Run:                    node tests/e2e-ui.mjs
 * Screenshots are written to ./e2e-screenshots/.
 *
 * Expected numbers (22 moves, 138/67 expanded ...) belong to the built-in demo maze.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.AIQUEST_URL || "http://127.0.0.1:3000";
const SHOTS = "e2e-screenshots";
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const consoleErrors = [];

async function test(name, fn) {
  try {
    await fn();
    results.push(["ok", name]);
    console.log("  ok  ", name);
  } catch (e) {
    results.push(["FAIL", name]);
    console.log("  FAIL", name, "\n      ", String(e.message).split("\n")[0]);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push("PAGEERROR " + e.message));

const cellBox = async (r, c) => await page.locator(`[data-r="${r}"][data-c="${c}"]`).boundingBox();
const wallCount = () => page.locator('.maze-cell[data-kind="wall"]').count();

console.log("Home");
await test("home renders hero, 4 module cards, start-exploring link", async () => {
  await page.goto(BASE + "/");
  await page.getByRole("heading", { level: 1 }).waitFor();
  expect((await page.getByRole("heading", { level: 1 }).innerText()).replace(/\s+/g, " ").includes("AI QUEST"), "title");
  expect((await page.locator("#modules ul > li > a").count()) === 4, "4 cards");
  await page.screenshot({ path: `${SHOTS}/home.png` });
  await page.getByRole("link", { name: "Start exploring" }).click();
});
await test("nav links navigate", async () => {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Maze" }).click();
  await page.waitForURL("**/maze");
});

console.log("Maze");
await test("maze grid renders 15x15 demo with start and goal", async () => {
  await page.waitForSelector(".maze-cell");
  expect((await page.locator(".maze-cell").count()) === 225, "225 cells");
  expect((await page.locator('.maze-cell[data-role="start"]').innerText()) === "S", "start S");
  expect((await page.locator('.maze-cell[data-role="goal"]').innerText()) === "G", "goal G");
});

await test("BFS run: replay finishes, metrics match server (22 moves, 138 expanded)", async () => {
  await page.locator("#maze-speed").fill("10");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.getByText(/Done\. Breadth-First Search \(BFS\) found a path of 22 moves/).waitFor({ timeout: 20000 });
  const visited = await page.locator('.maze-cell[data-kind="visited"]').count();
  const path = await page.locator('.maze-cell[data-kind="path"]').count();
  expect(visited > 100, `visited cells ${visited}`);
  expect(path >= 20, `path cells ${path}`);
  const text = (await page.locator("aside").innerText()).replace(/\n+/g, " ");
  expect(/Expanded nodes\s*138/i.test(text), "expanded 138 in: " + text.slice(0, 400));
  await page.screenshot({ path: `${SHOTS}/maze-bfs.png`, fullPage: true });
});

await test("A* run on same maze, comparison table shows both", async () => {
  await page.locator("#maze-algorithm").selectOption("astar");
  expect((await page.locator('.maze-cell[data-kind="visited"]').count()) === 0, "algorithm change clears stale cells");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.getByText(/Done\. A\* Search found a path of 22 moves/).waitFor({ timeout: 20000 });
  const rows = await page.locator("table.data tbody tr").count();
  expect(rows === 2, "comparison rows " + rows);
  const t = (await page.locator("table.data").innerText()).replace(/\s+/g, " ");
  expect(/A\* Search Path found 22 67 83/i.test(t), "A* row: " + t);
});

await test("DFS and Greedy give different (longer) paths", async () => {
  for (const [alg, moves] of [["dfs", 66], ["greedy", 30]]) {
    await page.locator("#maze-algorithm").selectOption(alg);
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await page.getByText(new RegExp(`found a path of ${moves} moves`)).waitFor({ timeout: 20000 });
  }
});

await test("Pause / Resume / Step / Reset controls", async () => {
  await page.locator("#maze-algorithm").selectOption("bfs");
  await page.locator("#maze-speed").fill("1");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.getByText(/Replaying exploration/).waitFor();
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByText(/\(paused\)/).waitFor();
  const before = await page.getByText(/Replaying exploration: \d+ of/).innerText();
  await page.waitForTimeout(1200);
  const after = await page.getByText(/Replaying exploration: \d+ of/).innerText();
  expect(before === after, "paused replay must not advance: " + before + " vs " + after);
  await page.getByRole("button", { name: "Step" }).click();
  const stepped = await page.getByText(/Replaying exploration: \d+ of/).innerText();
  expect(stepped !== after, "Step advances by one");
  await page.getByRole("button", { name: "Resume" }).click();
  await page.waitForTimeout(1600);
  const resumed = await page.getByText(/Replaying exploration: \d+ of/).innerText();
  expect(resumed !== stepped, "Resume advances again");
  await page.getByRole("button", { name: "Reset" }).click();
  expect((await page.locator('.maze-cell[data-kind="visited"]').count()) === 0, "reset clears visited");
  await page.getByText(/Ready\./).waitFor();
  await page.getByRole("button", { name: "Step" }).click();
  await page.getByText(/Replaying exploration: 1 of/).waitFor();
  await page.getByRole("button", { name: "Reset" }).click();
});

await test("drag to draw walls, drag start marker, edits clear results", async () => {
  await page.locator("#maze-speed").fill("10");
  await page.getByRole("button", { name: "Clear Walls" }).click();
  expect((await wallCount()) === 0, "clear walls");
  const a = await cellBox(2, 2);
  const b = await cellBox(2, 8);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
  const walls = await wallCount();
  expect(walls === 7, "drew 7 walls across row 2, got " + walls);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
  expect((await wallCount()) === 0, "erased");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.getByText(/Done\./).waitFor({ timeout: 20000 });
  await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
  expect((await page.locator('.maze-cell[data-kind="visited"]').count()) === 0, "editing clears stale replay");
  const s = await page.locator('.maze-cell[data-role="start"]').boundingBox();
  const t = await cellBox(10, 10);
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 10 });
  await page.mouse.up();
  const startAt = await page.locator('.maze-cell[data-role="start"]').getAttribute("data-r");
  expect(startAt === "10", "start moved to row 10, got " + startAt);
});

await test("keyboard: arrow keys move focus, Space toggles a wall", async () => {
  await page.getByRole("button", { name: "Clear Walls" }).click();
  await page.locator('[data-r="0"][data-c="0"]').focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  const kind = await page.locator('[data-r="1"][data-c="1"]').getAttribute("data-kind");
  expect(kind === "wall", "cell (1,1) should be a wall, is " + kind);
  await page.keyboard.press("Space");
  expect((await page.locator('[data-r="1"][data-c="1"]').getAttribute("data-kind")) === "empty", "toggled back");
});

await test("resize sliders keep the maze valid (5x5 and 30x30)", async () => {
  await page.locator("#maze-rows").fill("5");
  await page.locator("#maze-cols").fill("5");
  expect((await page.locator(".maze-cell").count()) === 25, "5x5");
  expect((await page.locator('.maze-cell[data-role="start"]').count()) === 1 && (await page.locator('.maze-cell[data-role="goal"]').count()) === 1, "one start and one goal");
  await page.locator("#maze-rows").fill("30");
  await page.locator("#maze-cols").fill("30");
  expect((await page.locator(".maze-cell").count()) === 900, "30x30");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.getByText(/Done\./).waitFor({ timeout: 30000 });
});

await test("no-path example shows friendly message and no path cells", async () => {
  await page.getByRole("button", { name: "Load No-Path Example" }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.getByText("No path exists.").waitFor({ timeout: 20000 });
  await page.getByText(/found no path/).waitFor({ timeout: 20000 });
  expect((await page.locator('.maze-cell[data-kind="path"]').count()) === 0, "no fake path");
  await page.screenshot({ path: `${SHOTS}/maze-nopath.png`, fullPage: true });
});

await test("demo maze mid-replay screenshot (Greedy)", async () => {
  await page.getByRole("button", { name: "Load Demo Maze" }).click();
  await page.locator("#maze-algorithm").selectOption("greedy");
  await page.locator("#maze-speed").fill("6");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/maze-midreplay.png`, fullPage: true });
});

console.log("Water Jug");
await page.goto(BASE + "/water-jug");
await test("classic 4/3/2 BFS solves in 4 actions and stepping updates the jugs", async () => {
  await page.getByRole("button", { name: "Solve" }).click();
  await page.getByRole("heading", { name: "Solution found" }).waitFor();
  const t = (await page.locator("dl").first().innerText()).replace(/\s+/g, " ");
  expect(/Actions 4/i.test(t), "4 actions: " + t);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByText("state = (0, 3)").waitFor();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByText("state = (3, 0)").waitFor();
  await page.screenshot({ path: `${SHOTS}/jug.png`, fullPage: true });
});
await test("DFS also solves it", async () => {
  await page.getByText("DFS (stack)").click();
  await page.getByRole("button", { name: "Solve" }).click();
  await page.getByText(/DFS on jugs 4 L and 3 L/).waitFor();
});
await test("unreachable preset explains gcd; invalid input shows error", async () => {
  await page.getByRole("button", { name: /impossible/ }).click();
  await page.getByRole("button", { name: "Solve" }).click();
  await page.getByRole("heading", { name: "No solution" }).waitFor();
  await page.getByText(/gcd\(4, 6\) = 2/).first().waitFor();
  await page.locator("#jug-goal").fill("99");
  await page.getByRole("button", { name: "Solve" }).click();
  await page.locator('.alert-error').waitFor();
});

console.log("Tic-Tac-Toe");
await page.goto(BASE + "/tic-tac-toe");
await test("hard AI: play a full game, human never wins, status + new game work", async () => {
  await page.getByText("Your turn").waitFor();
  let guard = 0;
  while (guard++ < 6) {
    const over = await page.getByText(/You win|The computer \(O\) wins|It's a draw/).count();
    if (over) break;
    const empty = page.locator('button[role="gridcell"]:not([disabled])');
    if ((await empty.count()) === 0) break;
    await empty.first().click();
    await page.waitForFunction(() => !document.body.innerText.includes("thinking"));
  }
  const body = await page.locator("body").innerText();
  expect(!/You win/.test(body), "human must not beat Hard");
  expect(/The computer \(O\) wins|It's a draw/.test(body), "game should end");
  expect(/Minimax score per candidate move/.test(body) || /Hard \(Minimax\)/.test(body), "analysis shown");
  await page.screenshot({ path: `${SHOTS}/ttt.png`, fullPage: true });
  await page.getByRole("button", { name: "New game" }).click();
  await page.getByText("Your turn").waitFor();
  expect((await page.locator('button[role="gridcell"]:not([disabled])').count()) === 9, "board reset");
});
await test("easy difficulty description switches", async () => {
  await page.getByText("Easy", { exact: true }).click();
  await page.getByText(/random legal square/).first().waitFor();
});

console.log("NLP");
await page.goto(BASE + "/nlp");
await test("analyze sample: tokens, stop words, stems, POS", async () => {
  await page.getByRole("button", { name: "Analyze" }).click();
  await page.getByRole("heading", { name: "3. Stemming (Porter)" }).waitFor();
  const body = (await page.locator("section").last().innerText()).replace(/\s+/g, " ");
  expect(/quickli/.test(body), "stem quickli");
  expect(/plural noun/.test(body), "POS description");
  expect(/Removed stop words/i.test(body), "removed stop words heading");
  await page.screenshot({ path: `${SHOTS}/nlp.png`, fullPage: true });
});
await test("only selected operations are shown", async () => {
  await page.getByLabel("Stemming").uncheck();
  await page.getByLabel("POS tagging").uncheck();
  await page.getByRole("button", { name: "Analyze" }).click();
  await page.getByRole("heading", { name: "2. Stop-word removal" }).waitFor();
  await page.waitForTimeout(300);
  expect((await page.getByRole("heading", { name: /Stemming \(Porter\)/ }).count()) === 0, "no stemming section");
  expect((await page.getByRole("heading", { name: /POS tags/ }).count()) === 0, "no POS section");
});
await test("empty text disables Analyze; over-limit disables Analyze", async () => {
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  expect(await page.getByRole("button", { name: "Analyze" }).isDisabled(), "disabled when empty");
  await page.locator("#nlp-text").fill("a ".repeat(2600));
  expect(await page.getByRole("button", { name: "Analyze" }).isDisabled(), "disabled when too long");
});
await test("copy output works", async () => {
  await page.getByRole("button", { name: "Short sample" }).click();
  await page.getByLabel("Stemming").check();
  await page.getByLabel("POS tagging").check();
  await page.getByRole("button", { name: "Analyze" }).click();
  await page.getByRole("button", { name: "Copy output" }).click();
  await page.getByRole("button", { name: /Copied/ }).waitFor();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(/quickly -> quickli/.test(clip), "clipboard content: " + clip.slice(0, 80));
});

console.log("About + mobile");
await test("about page renders sections", async () => {
  await page.goto(BASE + "/about");
  await page.getByRole("heading", { name: "Maze search algorithms" }).waitFor();
});
await test("mobile layout: menu toggles, no horizontal overflow on all pages", async () => {
  const m = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true });
  const mp = await m.newPage();
  for (const p of ["/", "/maze", "/water-jug", "/tic-tac-toe", "/nlp", "/about"]) {
    await mp.goto(BASE + p);
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow <= 1, `horizontal overflow ${overflow}px on ${p}`);
  }
  await mp.goto(BASE + "/");
  await mp.getByRole("button", { name: "Menu" }).click();
  await mp.getByRole("link", { name: "NLP", exact: true }).click();
  await mp.waitForURL("**/nlp");
  await mp.goto(BASE + "/maze");
  await mp.screenshot({ path: `${SHOTS}/maze-mobile.png`, fullPage: true });
  await m.close();
});

console.log("\nConsole errors:", consoleErrors.length ? consoleErrors : "none");
const failed = results.filter((r) => r[0] === "FAIL");
console.log(`${results.length - failed.length}/${results.length} UI checks passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
