# TESTING_SETUP.md — Multi-Node Browser Testing (MinimaNodeManager + Playwright)

> How an agent drives real end-to-end tests: N Minima nodes running locally, the
> MinimaAds MiniDapp installed on each, and a real Chrome browser under agent
> control to click through the UI.

This doc is **operational**, not architectural. It does not belong in
MinimaAds.md (no data model / API / protocol content) — it's a recipe an agent
follows to get from "cold environment" to "5 nodes with MinimaAds open and
ready to click." Read this when the maintainer asks you to run/test the dapp
live instead of just writing code.

---

## 1) Prerequisites

- **MinimaNodeManager** running locally, normally at `http://localhost:3000`.
  This is a separate dashboard app (not part of this repo) that spawns/stops
  Minima node processes and can zip+install this MiniDapp to them. The
  maintainer starts it manually before asking you to test — if you get
  `net::ERR_CONNECTION_REFUSED` on `localhost:3000`, ask the maintainer to
  confirm it's running, don't try to start it yourself.
- Default node RPC/MDS password: **`123`** (set via `-mdspassword 123` in the
  node manager's start command — visible in the "Start Command" textbox per
  node if you need to confirm).

---

## 2) One-time: register the Playwright MCP server

Browser control needs the Playwright MCP server added to this project (local
scope). Check first with `claude mcp list` — if `playwright` is already
listed and connected, skip this step.

```bash
claude mcp add playwright -s local -- npx -y @playwright/mcp@latest --browser chrome
```

- `--browser chrome` launches the **real installed Chrome** (not the Playwright
  bundled Chromium) in headed mode (visible window) by default — the
  maintainer can watch what you're doing live.
- It is a **fresh, temporary Chrome profile**, not the maintainer's personal
  Chrome profile/session (Chrome locks the profile dir if already open
  elsewhere). This is fine — MinimaNodeManager and the node MDS UIs don't need
  a pre-existing login/session.
- **New MCP tools only load at session start.** After adding the server, tell
  the maintainer to restart the Claude Code session (or open a new one in this
  project) before you can call any `mcp__playwright__*` tool. Don't try to use
  them in the same session you registered the server in — they won't be in
  your tool list yet.

---

## 3) Start N nodes via MinimaNodeManager

1. `browser_navigate` to `http://localhost:3000`.
2. `browser_snapshot` to see current node count (a spinbutton labeled
   `Nodes (Max 26):`, default 2).
3. To reach N nodes, click **"+ Add Node"** `(N - current)` times — this is
   more reliable than trying to type into the spinbutton directly (it's driven
   by the button clicks, typing into it directly wasn't confirmed to work).
   Node 1 is always genesis; nodes 2..N auto-fill `-connect 10.0.0.11:9001`.
4. Click **"Start All"**.
5. Wait ~15–20s (`browser_wait_for time: 20`), then verify with
   `browser_find` for text like `"MAXIMA HOST CONNECTED"` or check each node's
   log panel for `"[+] Connected to the blockchain Initial Block Download
   received"`. Nodes get IPs `10.0.0.1{1..N}`, MDS port `9003`.

---

## 4) Install / update the MinimaAds dapp on all running nodes

**Use the Build Pipeline tab → "Zip & Install to Nodes" button.** This is the
correct method for this project — do **not** use "Build & Zip" or "Build All"
(those run `npm run build`, which CLAUDE.md §6 forbids: MinimaAds is a plain
JS MiniDapp with no build step). "Zip & Install to Nodes" packages the raw
source workspace directly and pushes it to every running node in one action.

1. Click nav button **"🛠️ Build Pipeline"**.
2. Confirm "Build Workspace" points at the repo root
   (`/home/joanramon/Minima/MinimaAds`).
3. Click **"Zip & Install to Nodes"**.
4. Wait ~10–15s, then check the Build Output panel for
   `"Node N: Install Success"` / `"Node N: Update (0x...) Success"` per node.

The dApp Manager tab's "Install / Update from Location" (pointing at a
prebuilt `.mds` file) is a fallback for prebuilt packages, not the normal path
for this repo.

### ⚠️ Gotcha: don't let Playwright's own test artifacts into the zip

"Zip & Install to Nodes" zips the **entire workspace directory**, including
anything Playwright just wrote there — `.playwright-mcp/` (snapshots,
screenshots, console logs) and any screenshots you took with
`browser_take_screenshot` into the repo root. `.gitignore` already excludes
`.playwright-mcp/` (added in this doc's session), but:

- Before zipping, check `git status --short` for stray files (screenshots,
  `.playwright-mcp/`) and delete them (`rm -rf`) if present.
- If you must take a screenshot for the maintainer, save it outside the repo
  (e.g. `/tmp/`) or delete it immediately after use.
- If a zip already went out with junk in it, just re-run "Zip & Install to
  Nodes" after cleaning — it's idempotent (shows as "Update" the second time).

---

## 5) Open all nodes in browser tabs and get past onboarding

1. Go back to nav **"🖥️ Nodes"** tab, click **"Open All"**. This opens one
   new browser tab per node (`https://10.0.0.1{1..N}:9003`).
2. **Every tab hits a self-signed cert warning** (`net::ERR_CERT_AUTHORITY_INVALID`,
   Chrome's "La connexió no és privada" / "Your connection isn't private").
   Per tab, in order:
   - `browser_tabs action: select, index: N` to switch to it.
   - `browser_snapshot` (refs are per-tab, don't reuse refs across tabs).
   - Click **"Configuració avançada" / "Advanced"**.
   - Click the **"Continua per accedir a X.X.X.X (no segur)" / "Proceed to
     X.X.X.X (unsafe)"** link that appears.
3. This lands on the MDS **Login** page. Type `123` into the password field
   (`#password`), click **"Log in"**.
4. Login redirects into the MDS home (MiniDapp grid). From here, **three
   sequential "click anywhere" screens** gate every fresh node identity —
   handle them per tab, in order, using `browser_find text: "..."` to locate
   the current one (they don't all appear on the same click):
   1. `"Hello, nice to meet you" / "Click anywhere to continue"`
   2. `"What shall we call you?"` (pre-filled username textbox, e.g. `user1`)
      → `"Click anywhere to continue"` accepts the default name as-is.
   3. `"Welcome to Minima, userN"` → `"Click anywhere to continue"`
   4. `"Before we begin, would you like a quick tour?"` → click **"Skip"**
      (not "Let's go" — the tour isn't useful for automated testing).
5. After all four are dismissed, the tab shows the real MDS MiniDapp grid,
   including **MinimaAds** — but installed in **Read mode** by default (the
   Build Pipeline install path used in §4 doesn't set write permissions,
   unlike the dApp Manager's "Write Mode" checkbox). MinimaAds needs write
   access (transactions, KeyPair storage) to function, so before opening it:
   - **Right-click the MinimaAds icon** in the grid.
   - Select **"Write mode"** from the context menu that appears (same menu
     that showed `Read mode / Write mode / Update / Delete MiniDapp` in the
     accessibility snapshot for every app tile).
   - *(In `browser_snapshot`, this menu is normally hidden/inert until
     hovered/right-clicked — use `browser_click` with `button: "right"` on
     the app tile, then click the "Write mode" option that appears.)*
   - This triggers a confirmation dialog: **"Are you sure you wish to give
     this MiniDAPP WRITE permissions?"** — click **"Confirm"** (not "Close").
     Only after this second click is write mode actually applied; clicking
     "Write mode" in the context menu alone does nothing yet.
6. Only now is the dapp ready to click open, with write access, on this tab.

Do this tab-by-tab for all N nodes; there is no bulk-dismiss action.

---

## 6) Assign the 5 test roles

The standard 5-node test topology maps one role per node. Three roles are
purely emergent from normal dapp usage (nothing to configure); two are tied to
identities the code checks explicitly and **must be re-configured every time
the nodes are recreated**, because the underlying keys/identities regenerate.

| Node | Role | Config needed? |
|---|---|---|
| Node 1 | Campaign creator (advertiser) | No — just use the Creator view to make a campaign |
| Node 2 | Publisher (embeds ads via SDK/Frame in their own dapp) | No — `createFrame()` ties ownership to `MY_MAXIMA_PK` automatically |
| Node 3 | Viewer (watches ads, claims rewards) | No — just open `#viewer` |
| Node 4 | **MinimaAds Creator** (platform identity, owns the built-in Frame) | **Yes — see 6.1** |
| Node 5 | **Minima Foundation** (MLS relay + 3% fee recipient) | **Yes — see 6.2** |

Nodes 4 and 5 are combined into single-purpose test nodes for convenience.
In a real deployment these do **not** need to be the same node — the MLS
relay operator and the fee-collecting wallet are architecturally independent
(`MLS_SERVER_ADDRESS` and `FOUNDATION_KEY` never reference each other in
code) — but modeling both as "the Foundation" on one node simplifies local
testing.

Open `DevTools` on the relevant node with **Ctrl+Shift+D** inside the
MinimaAds tab (needs the dapp open first). Do Node 5 first — Node 4 needs
Node 5's MLS address as an input.

### 6.1 Node 5 — Minima Foundation (MLS + fee)

Two independent actions, both on Node 5:

1. `DevTools §1 "MLS" → 1.1 "Register This Node as MLS Server"`. Runs
   `maxextra action:staticmls host:<this node's p2p identity>` and stores
   `MLS_SERVER_ADDRESS` locally; also flips on `MINIMAADS_ALLOW_RELAY` so this
   node processes other nodes' `REGISTER_PERMANENT_REQUEST`. The keypair
   inspector (bottom of DevTools) now shows the full `Mx...@10.0.0.15:9001`
   address under `MLS_SERVER_ADDRESS` — **copy this**, every other node needs
   it in §6.2/§6.3 below.
2. `DevTools §2 "Minima Foundation Fee Address (3%)" → "Set Self Wallet"`.
   Reads Node 5's own wallet address (`getaddress`) and stores it as
   `FOUNDATION_KEY_OVERRIDE`, which is what actually makes new campaigns'
   escrow route the 3% fee to Node 5 (`campaign.handler.js`,
   `dapp/views/creator.js` V4 escrow branch). **Skip this and `FOUNDATION_KEY`
   stays `null`** (MVP mode, fee disabled) — Node 5 will still relay Maxima as
   the MLS server, it just won't collect anything.

Both are per-node runtime state (keypair storage), not `config.js` constants
— they reset whenever Node 5's data is wiped or the node is recreated, same
as any other node's identity.

### 6.2 Node 4 — MinimaAds Creator

`MINIMAADS_CREATOR_PK` (`config.js`) is a build-time constant, identical on
every node, that identifies who owns the built-in `#viewer` Frame
(MinimaAds.md §4.6.1). **You do not need to edit `config.js` for testing.**
`service.js` has a runtime override baked in (lines ~169–176): at SW boot, if
the local `MINIMAADS_CREATOR_ROUTE` keypair holds a `MAX#<pk>#<mls>` string,
it **overwrites the in-memory `MINIMAADS_CREATOR_PK`** with that route's `pk`.
And critically, `DevTools §3.1`'s "Register as Permanent User" button stores
whatever route it computes into `MINIMAADS_CREATOR_ROUTE` **unconditionally**
— it does not require the node's real key to already match the constant (that
strict equality check only lives in `core/minima.js`'s own internal callers,
not in this DevTools shortcut). So on a fresh node the button "just works":

1. On Node 4, `DevTools §1.2 "Connect to MLS Server"` → paste Node 5's
   `MLS_SERVER_ADDRESS` (copied in §6.1) → **Connect**. Required first:
   `setCreatorMaximaRoute` errors ("Node does not have static MLS configured")
   if `maxima action:info` reports no `mls` host yet.
2. `DevTools §3.1 "MinimaAds Creator" → "Register as Permanent User"`. Wait
   ~2–3s, then check `"Current Route: MAX#0x...#Mx...@10.0.0.15:9001"` appears
   (was `"(not set)"` before). Copy this full route string — it's the same
   string regardless of which button/field on Node 4 you copy it from
   (`§3.1`'s own "Copy" button, or read it back from `browser_find`).

### 6.3 Propagate the creator route to the other nodes

`MINIMAADS_CREATOR_ROUTE` is per-node local storage — Node 4 knowing it's the
creator doesn't make Nodes 1/2/3/5 aware of that fact. Cross-node checks
(`sdk/index.js`'s `_assertCampaignCreatorSender`) and built-in-Frame
publisher-reward routing (`comms.handler.js`, `channel.handler.js`, which read
the *viewer's own* `MINIMAADS_CREATOR_ROUTE` as a fallback for "where do I
send the publisher reward") both need every other node to have it too. For
each of Node 1, 2, 3, 5:

1. `DevTools §3.1` → paste Node 4's full route (from §6.2 step 2) into
   **"Paste Platform Creator Route (MAX#...)"** → **Save**.
2. Verify `"Current Route: MAX#...#Mx...@10.0.0.15:9001"` now shows the same
   string as Node 4's.

Unlike §6.2's "Register" button, this path is a direct `MDS.keypair.set` — no
MLS/maxima info prerequisite, works immediately on any node.

### 6.4 Full propagation for a complete `§4 Database & Storage Console`

§6.1–6.3 above leave `MLS_SERVER_ADDRESS`, `FOUNDATION_KEY_OVERRIDE` and
`MINIMAADS_CREATOR_ROUTE` set only on the nodes that ran the "source of truth"
action (Node 5, Node 5, Node 4 respectively). For every keypair row in
`DevTools §4` to be populated on **every** node, propagate each value the same
way the creator route was propagated in §6.3 — copy from the source node,
paste+Save on the rest:

- **`DevTools §1.2` (MLS)**: paste Node 5's `MLS_SERVER_ADDRESS` → **Connect**
  on Nodes 1, 2, 3 too (Node 4 already done in §6.2 step 1).
- **`DevTools §2` (Foundation)**: paste Node 5's `FOUNDATION_KEY_OVERRIDE`
  value into **"Or paste custom foundation address"** → **Save** on Nodes 1,
  2, 3, 4.
- **`DevTools §3.2` (Platform Key)**: click **"Set Self Wallet"** once (on any
  node, e.g. Node 4) to mint a value, then paste that same value into **"Or
  paste custom platform address"** → **Save** on the other 4 nodes.

⚠️ Multiple **"Save"**-labeled buttons exist on the DevTools panel (Foundation,
Creator Route, Platform Key sections) — if driving this via Playwright, prefer
locating the button through a unique nearby label (e.g. the textbox's
placeholder text) rather than a bare `getByRole('button', {name: 'Save'})`
index; the DOM position of each section is stable but relying on `.nth(N)` is
fragile if the panel markup ever changes order.

**`USER_PERMANENT_ROUTE` is the one field §6.1–6.3 do not populate anywhere
except Node 4** (it's set as a side effect of `§3.1`'s real "Register as
Permanent User" button, which only Node 4 should click — see §6.2). This
field is **not** just cosmetic: `dapp/views/frames.js` hard-redirects the
Publisher Frames view to `#settings/maxima-routes` if it's unset for the
current node — **a publisher node cannot even open its Frames screen without
it.** The page's own copy confirms this: *"Essential for both creators and
publishers."* (`settings-maxima-routes.js`). It's optional-with-fallback for
viewers (`channel.handler.js`/`comms.handler.js` fall back to the node's plain
`Mx...` contact address if unset) but required for:
- **Node 1** (campaign creator) — needed before creating campaigns (escrow
  `STATE(4)`); normally set automatically by the Creator setup wizard on
  first visit, but can be done proactively (see below).
- **Node 2** (publisher) — hard requirement, confirmed above.

To set it **without disturbing `MINIMAADS_CREATOR_ROUTE`** (the real "Register
as Permanent User" DevTools button unconditionally overwrites
`MINIMAADS_CREATOR_ROUTE` too — fine on Node 4, destructive on any node that
already has Node 4's propagated route stored there), use the **real in-app
Settings page**, not DevTools:

1. Navigate to `#settings/maxima-routes` on the node (its MinimaAds tab, not
   MDS home) — either by URL hash edit, or it auto-redirects there the first
   time `#frames` is opened without a route.
2. Close DevTools first if open (`Ctrl+Shift+D`) — its overlay intercepts
   clicks even when visually behind the app content.
3. Click **"Register as Permanent"**. Success redirects to `#campaigns`
   after ~2s (or shows `✓ Registered permanent route: MAX#...`).
4. This calls `core/minima.js`'s `setCreatorMaximaRoute()` directly — it only
   touches `MINIMAADS_CREATOR_ROUTE` if this node's own real PK equals the
   (possibly-overridden) in-memory `MINIMAADS_CREATOR_PK`, which is never true
   for Nodes 1/2/3/5. Safe to run on any non-Node-4 node.

---

## 7) Quick reference (cheat sheet)

```
1. claude mcp add playwright -s local -- npx -y @playwright/mcp@latest --browser chrome
   (restart session)
2. browser_navigate → http://localhost:3000
3. Nodes tab: click "+ Add Node" until spinbutton shows N → "Start All" → wait 20s
4. Build Pipeline tab: clean stray files (git status --short) → "Zip & Install to Nodes"
5. Nodes tab: "Open All"
6. Per tab (1..N): accept cert warning → login "123" →
   click-through x3 ("nice to meet you" / username / "Welcome") → Skip tour
7. Per tab (1..N): right-click MinimaAds icon → "Write mode" → "Confirm".
8. MinimaAds now visible, writable, and clickable on every tab.
9. Role setup (redo every time nodes are recreated — §6; open MinimaAds on
   each tab first, then Ctrl+Shift+D):
   - Node 5: DevTools §1.1 "Register as MLS Server" (copy MLS_SERVER_ADDRESS
     from the keypair inspector) → §2 "Set Self Wallet" (copy resulting
     FOUNDATION_KEY_OVERRIDE value too)
   - Node 4: DevTools §1.2 paste Node 5's MLS address → "Connect" →
     §3.1 "Register as Permanent User" (copy resulting "Current Route") →
     §3.2 "Set Self Wallet" (copy resulting PLATFORM_KEY_OVERRIDE value)
   - Nodes 1, 2, 3 (not 5, already done): DevTools §1.2 paste Node 5's MLS →
     "Connect"
   - Nodes 1, 2, 3, 4 (not 5, already done): DevTools §2 paste Node 5's
     Foundation value → "Save"
   - Nodes 1, 2, 3, 5 (not 4, already done): DevTools §3.1 paste Node 4's
     route → "Save"; DevTools §3.2 paste Node 4's Platform Key → "Save"
   - Node 1 and Node 2 only: close DevTools (Ctrl+Shift+D) → navigate to
     `#settings/maxima-routes` → "Register as Permanent" (sets their own
     USER_PERMANENT_ROUTE; safe, does not touch MINIMAADS_CREATOR_ROUTE —
     see §6.4). Node 2 needs this or its Frames view won't even open.
```

---

## 8) Driving a campaign creation flow (creator role)

MinimaAds has three "roles" (Viewer / Creator / Publisher) selectable from the
sidebar drawer, independent of which node you're on — any node can switch
role at will, it just changes which nav links/views are shown.

1. Click the **"☰ <current role>"** button top-left (e.g. `"☰ Viewer"`) to
   open the drawer if it isn't already open.
2. In the drawer, click **"Role — <current role> ›"** to expand the
   Viewer/Creator/Publisher submenu, then click **"Creator"**.
3. Navigate to `#creator` (nav link **"Create"**, or edit the URL hash
   directly). This is a 4-tab wizard:
   - **Add Content** — title/description/interests/CTA are pre-filled with
     placeholder copy; edit or leave as-is. Click **"Budget →"**.
   - **Budget** — set **Total budget (MINIMA)** (min 100) and **Campaign
     duration (days)**. With "Auto-calculate rewards & limits" checked
     (default), viewer/publisher reward fields fill in automatically. This
     tab live-shows the fee breakdown: **Platform fee (6%)** and **Minima
     Foundation fee (3%)** of the budget, plus **Total cost**. Click
     **"Limits →"**.
   - **Limits** — daily view/click caps and cooldown; defaults are fine.
     Click **"Review →"**.
   - **Review** — final summary + **Cost Breakdown** (budget / platform fee /
     foundation fee / total). Click **"Publish Campaign"**.
4. Success redirects to `#mycampaigns` after a few seconds, showing the new
   campaign card (`Active`, `Escrow Left: <budget>`). No explicit success
   toast — the redirect **is** the success signal, same pattern as §6.2's
   "Register as Permanent" flow.

This funds the escrow in one atomic multi-output transaction: budget → escrow
script address, platform fee → `PLATFORM_KEY` address (Node 4 if §6 was
followed), foundation fee → `FOUNDATION_KEY` address (Node 5) — see
`dapp/views/creator.js` `_fundEscrowWithRoute`. The campaign then propagates
to other nodes via Maxima `CAMPAIGN_ANNOUNCE`; it shows up in their own
`#campaigns` view (viewer/publisher browsing list) within seconds, no manual
refresh needed once received.

---

## 9) Verifying results — where to look

Three different places can answer "did X happen", and they are **not
equally trustworthy** for the same question. Pick the right one:

### 9.1 The dapp's own UI — trust it for "does the feature work as designed"

`#mycampaigns`, `#campaigns`, `#earnings`, the Review tab's cost breakdown,
etc. reflect exactly what a real user would see. This is the right (and
usually only necessary) source for confirming a flow behaves correctly end
to end — e.g. "does Node 2 see the campaign Node 1 published" (§9 test in
this doc's session: yes, confirmed via `#campaigns` showing the card with
correct budget/rewards).

### 9.2 The node's raw log — trust it for "did address X receive exactly Y MINIMA"

Every `"NEW Unspent Coin"` JSON event a node's wallet-relevance scanner has
seen — exact `amount`, `address`, `state` — is **ground truth**, unaffected
by any dapp or Wallet-MiniDapp UI logic. Two ways to read it; **prefer the
first**:

**A. Read the log file directly (fast, cheap, no truncation risk).**
MinimaNodeManager runs locally on the same machine — its nodes' logs are
plain text files on disk, readable with `Bash`/`Read`/`grep` directly,
without going through the browser at all:

```
grep "NEW Unspent Coin" /home/joanramon/Minima/MinimaNodeManager/nodes/node4/startup.log
```

This is dramatically more efficient than the browser path below — no
Playwright round-trip, no risk of hitting the tool's output-size limit (a
`browser_find` on a long-running node's log **did** hit a "144,561
characters exceeds maximum" error this session; the file read did not).
Verified this session: `grep -c` on this file found the exact same 3
`"NEW Unspent Coin"` matches the browser path found.

**B. Read it via the MinimaNodeManager browser UI (only if you don't have
filesystem access to the host, e.g. a remote/sandboxed agent).**
Each node's card in the **Nodes** tab has a large scrolling log panel
mirroring the same file.
1. `browser_tabs` → select the MinimaNodeManager tab (not a node's own tab).
2. `browser_find text: "NEW Unspent Coin"` (or a more specific substring —
   an address prefix, an amount) — the panel is one giant string per node,
   so `browser_find`/grep is required; don't try `browser_snapshot` on it.

Either way, cross-check the `"address"` field of each matching coin against
the `PLATFORM_KEY_OVERRIDE` / `FOUNDATION_KEY_OVERRIDE` values recorded in
§6 to confirm which recipient actually got which coin.

Verified this session: a 1000/60/30 MINIMA campaign funding tx produced
three `"NEW Unspent Coin"` events, each correctly addressed (escrow script /
Node 4's platform key / Node 5's foundation key) — confirming the fee
routing is correct at the chain level, independent of any UI quirk (see
9.3).

### 9.3 The node's own "Wallet" MDS MiniDapp — History tab reliable, Balance tab is not

Every node has a stock **Wallet** MiniDapp on its MDS home grid (open it the
same way as MinimaAds — click the icon). Its **History** tab shows discrete,
correctly-labeled entries (`"Received +60"`) and is safe to trust.

Its **Balance** tab is **not** reliable once a campaign fee/escrow tx is
involved: it showed **1,090 MINIMA** (the campaign's *entire* total cost —
budget + both fees) on **both** Node 4 and Node 5's wallets, not just each
node's actual 60 / 30 share, with an inconsistent Available/Locked split
between the two (Node 4: all "Available"; Node 5: 30 "Available" + 1,060
"Locked"). This is Minima's wallet-relevance scanner marking a coin as
"relevant" to *any* address referenced in its `state` — not just the coin's
own owning `address` — a pattern already logged as `docs/KNOWN_ISSUES.md
#40`. It's cosmetic (the underlying chain data, per §9.2, is correct); don't
use the Balance tab's total as a check for "how much did this node actually
receive" — use History or §9.2 instead.

### 9.4 Raw per-node command terminal — CLI syntax, not MDS action syntax

Each node card in MinimaNodeManager also has a **"> Type command..."** input
that sends directly to the Minima node's own console (bare CLI, not
`MDS.cmd()` / `action:` syntax). `getbalance` (an MDS API action name)
returned `{"status":false,"error":"Command not found"}` here — the raw CLI
verb is different (untested which one works; check `refs/docs-main` or the
node's own `help` command before relying on this path). Given §9.2 and §9.3
already cover balance verification reliably, this path is a low-priority
fallback, not a first choice.

### 9.5 Databases — Minima's own vs. MinimaAds' — don't read the files directly, use the SQL Console

Two separate H2 databases exist per node, both on disk under
`nodes/nodeN/1.0/`:

- **Minima's own** chain/wallet databases (`databases/walletsql/wallet.mv.db`,
  `databases/txpowsql/*.mv.db`, `databases/maximasql/maxima.mv.db`, etc.) —
  H2's binary format, and **locked by the running node process** — a second
  process (e.g. an H2 CLI tool) attempting to open the same file while the
  node is up will conflict. Not practical to read directly while testing.
- **MinimaAds' own** app database — same story:
  `nodes/nodeN/1.0/mds/data/<minimaads-dapp-uid>/sql/sqldb.mv.db`, binary,
  locked while the node runs.

**Don't try to read either `.mv.db` file directly.** Instead, MinimaAds
ships its own **SQL Console** in `DevTools §4`, which queries the live H2
connection through the running node (`MDS.sql`, same mechanism
`core/minima.js`'s `sqlQuery()` uses internally) — no file access, no lock
conflicts:

1. Open MinimaAds on the node → `Ctrl+Shift+D` → scroll to
   **"4. Database & Storage Console" → "SQL Console"**.
2. Type a query into the textarea (placeholder shows the expected shape:
   `SELECT * FROM campaigns LIMIT 5;`) → **"Run Query"**.
3. Results render as JSON in the panel below; **"Copy Result"** copies it.

Verified this session on Node 1: `SELECT ID, STATUS, BUDGET_TOTAL,
CREATOR_ADDRESS FROM CAMPAIGNS LIMIT 5;` returned the exact row for the test
campaign (`STATUS: "active"`, `BUDGET_TOTAL: "1000.000000"`). This is the
right tool for inspecting `CAMPAIGNS`, `CHANNEL_STATE`, `REWARD_EVENTS`,
`FRAMES`, etc. — see `MinimaAds.md §3.5` for the full schema, and remember
column names come back **UPPERCASE** (H2 convention, see `AGENTS.md §3.6`).

There is no equivalent SQL console for Minima's *own* chain/wallet
databases — for those, §9.1 (dapp/Wallet UI) and §9.2 (raw log) are the only
practical read paths while nodes are running.

---

## 10) What's still undocumented (continue here in a future session)

- Viewer flow: opening `#viewer`, watching an ad, claiming a view/click
  reward, and verifying the voucher lands correctly — selectors, expected
  states.
- Multi-viewer / voucher-sync test patterns (N-1 viewers against one
  creator).
- Publisher flow: registering a Frame (`#frames`), embedding it, and
  confirming publisher-side rewards route correctly.
- How to reset state between test runs (Delete Data / Kill All Processes in
  MinimaNodeManager) without re-doing the full onboarding above.
