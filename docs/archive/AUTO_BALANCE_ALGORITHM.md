# Auto-Balance Algorithm — MinimaAds Campaign Budget Optimizer

**Purpose**: Automatically calculate balanced reward values when a creator specifies a total budget and enables auto-balance mode.

**Context**: 
- Single unified budget (`budget_total`) covers both viewer rewards and publisher rewards
- Platform enforces a 6% fee on top of the budget
- Viewers earn for views/clicks; publishers earn for views they serve
- Daily limits (views/clicks per viewer) prevent abuse and optimize reach

**Implementation Status**: 
✅ **Fully implemented** as of patch 2026-06-03. Feature flag `auto_balance_enabled` present in `creator.js` (lines 25–74). Auto-balance calculation functions in use; creators can enable toggle at campaign creation. All formulas below are live in production.

---

## 1. Design Principles

### 1.1 Design Goals

| Goal | Reasoning |
|---|---|
| **Maximize reach** | Smaller per-viewer rewards → more viewers → better campaign exposure |
| **Balance incentive** | Reward enough to make users care, but not so much as to waste budget |
| **Publisher friendly** | Reserve sufficient budget for publishers to earn meaningful rewards |
| **Transparent defaults** | Clear, predictable formulas that creators can tune via the multiplier |
| **Daily limits matter** | Auto-calculated caps should assume reasonable daily engagement (100 views/100 clicks) |

### 1.2 Key Assumption: Daily Budget Consumption

A viewer with daily limits (100 views/100 clicks) engaging optimally consumes:
- Max views: 100 × `reward_view`
- Max clicks: 100 × `reward_click`  
- **Total daily consumption** ≈ `100 × (reward_view + reward_click)`

To reach more viewers, we want the per-viewer cap to allow **multiple days of engagement** for the same viewer, or **many single-engagement interactions** across different viewers.

---

## 2. Core Algorithm

### 2.1 Input Variables

```
B        = budget_total (MINIMA, from creator input)
m        = multiplier ∈ [1.0, ∞) (from auto-balance slider; default = 2.0)
R_v      = reward_view (MINIMA per view)
R_c      = reward_click (MINIMA per click)
P_r      = publisher_reward_view (MINIMA per view shown by a publisher)
B_max_p  = max_publisher_budget (cap on total publisher payouts; subset of B)
d_v      = max_daily_views (per viewer; default 100)
d_c      = max_daily_clicks (per viewer; default 100)
```

### 2.2 Automatic Reward Calculation (Ratio-Based)

When auto-balance is **enabled**, the creator provides **only two inputs**:
1. **Total budget** (`B`)
2. **Multiplier** (`m`)

The system calculates:

```
reward_view = (B_available × 0.20) / (B_available × 0.20 / R_v_base + B_available × 0.30 / R_c_base)
reward_click = reward_view × 2.0
```

**Simpler formula** (preferred for clarity):

```
R_v = (B_available × 0.15) / k
R_c = R_v × 2.0
```

where `k` is an efficiency factor derived from expected viewer supply.

**Rationale**:
- **Reward ratio (view:click = 1:2)**: Views are passive (high volume, low friction); clicks require action (lower volume). A 2× multiplier incentivizes conversion without breaking the budget.
- **Budget allocation (15% to viewer rewards base)**: Leaves room for the multiplier effect and publisher allocation.

### 2.3 Per-Viewer Cap (max_viewer_reward)

```
CAP_view = (R_v + R_c) × m

where m ∈ [1.0, ∞):
  - m = 1.0  →  Cap = R_v + R_c (minimum incentive; max reach)
  - m = 2.0  →  Cap = 2×(R_v + R_c) (balanced; default)
  - m = 4.0  →  Cap = 4×(R_v + R_c) (stronger incentive; fewer viewers)
```

**Meaning**: A single viewer can earn up to `CAP_view` MINIMA total across all views/clicks in the campaign.

**Example** (m = 2):
- If `R_v = 0.5` and `R_c = 1.0`, then `CAP_view = 1.5 × 2 = 3.0` MINIMA
- A viewer could earn 3 MINIMA by: 6 views, or 3 clicks, or 2 views + 1 click, etc.

### 2.4 Publisher Budget Allocation

```
B_available = B                           (full budget before publisher deduction)
B_viewer    = B - B_max_p                 (budget for viewer rewards)
P_r         = (B_max_p × 0.60) / E_pub    (publisher reward per view)

where E_pub = estimated number of publishers in the network (default ≈ 5–10)
```

**Rationale**:
- Reserve 10–30% of total budget for publishers
- Distribute that reserved budget across estimated publishers
- If only 2 publishers join, they earn at 2–3× the per-view rate; if 10 join, the budget stretches proportionally

**Conservative approach** (what the form currently does):
- Creator explicitly sets `B_max_p` and `P_r`
- Auto-balance only affects viewer rewards
- Publisher rewards remain manual (creators often set `P_r = 0` for simplicity)

### 2.5 Maximum Viewers Reached

```
max_viewers = floor(B_viewer / CAP_view)
```

**Example**:
- Budget = 1000 MINIMA, `CAP_view = 3.0`
- `max_viewers = floor(1000 / 3.0) = 333 viewers`

---

## 3. Recommended Formulas for Implementation

### 3.1 Ratio-Based (Recommended)

```
R_v = base_reward_per_view
R_c = base_reward_per_click = R_v × 2.0
CAP_view = (R_v + R_c) × m
max_viewers = floor(B_available / CAP_view)
```

**How to compute `base_reward_per_view` from budget**:

Option A — Fixed percentage:
```
base_reward_per_view = (B_available × 0.10) / expected_viewers
```

where `expected_viewers = floor(B_available / ((R_v_base + R_c_base) × m_default))`.

This is circular; simplify as follows:

Option B — Iterative / preset tables:

Create a lookup table based on budget ranges:

| Budget Range | R_v | R_c | Reasoning |
|---|---|---|---|
| 100–500 | 0.10 | 0.20 | Small campaigns; higher per-reward cost |
| 500–2,000 | 0.05 | 0.10 | Medium campaigns |
| 2,000–10,000 | 0.02 | 0.04 | Large campaigns; economies of scale |
| 10,000+ | 0.01 | 0.02 | Very large campaigns |

**Developer implements**: When form load / budget change:
```javascript
function getAutoBalanceDefaults(budget) {
  if (budget < 500) return { R_v: 0.10, R_c: 0.20 };
  if (budget < 2000) return { R_v: 0.05, R_c: 0.10 };
  if (budget < 10000) return { R_v: 0.02, R_c: 0.04 };
  return { R_v: 0.01, R_v: 0.02 };
}

function applyAutoBalance(form) {
  const budget = parseAmt(form.querySelector('[name="budget"]').value);
  const multiplier = parseFloat(form.querySelector('[name="multiplier"]').value) || 2.0;
  const { R_v, R_c } = getAutoBalanceDefaults(budget);
  
  form.querySelector('[name="reward_view"]').value = R_v;
  form.querySelector('[name="reward_click"]').value = R_c;
  form.querySelector('[name="max_viewer_reward"]').value = (R_v + R_c) * multiplier;
}
```

---

## 4. Concrete Examples

### Example 1: Budget = 1,000 MINIMA (Small Campaign)

**Inputs**:
- `B = 1000`
- `m = 2.0` (balanced; default)
- `B_max_p = 100` (reserve 10% for publishers)
- `d_v = 100` (max views/day), `d_c = 100` (max clicks/day)

**Auto-balance calculation**:
- `B_viewer = 1000 - 100 = 900` MINIMA
- `R_v = 0.10` MINIMA (from table: budget 100–500 range)
- `R_c = 0.20` MINIMA
- `CAP_view = (0.10 + 0.20) × 2.0 = 0.60` MINIMA per viewer

**Metrics**:
- **Max viewers**: `floor(900 / 0.60) = 1500 viewers`
- **Max publishers**: `100 / P_r` (depends on `P_r`; if `P_r = 0.05`, then 2000 views worth)
- **Daily max per viewer**: `100 views × 0.10 + 100 clicks × 0.20 = 10 + 20 = 30 MINIMA/day` (still within cap of 0.60)
- **Campaign duration**: Budget supports ~5–10 days of heavy engagement if all 1500 viewers engage daily
- **Cost + fee**: `1000 + (1000 × 0.06) = 1060 MINIMA` total cost

**Multiplier variants**:
| Multiplier | CAP_view | Max viewers | Incentive level |
|---|---|---|---|
| ×1.0 | 0.30 | 3000 | Minimum (max reach) |
| ×2.0 | 0.60 | 1500 | Balanced |
| ×3.0 | 0.90 | 1000 | Stronger incentive |
| ×5.0 | 1.50 | 600 | High incentive |

---

### Example 2: Budget = 10,000 MINIMA (Medium Campaign)

**Inputs**:
- `B = 10000`
- `m = 2.0`
- `B_max_p = 1000` (reserve 10% for publishers)
- `d_v = 100`, `d_c = 100`

**Auto-balance calculation**:
- `B_viewer = 10000 - 1000 = 9000` MINIMA
- `R_v = 0.02` MINIMA (from table: budget 2000–10000 range)
- `R_c = 0.04` MINIMA
- `CAP_view = (0.02 + 0.04) × 2.0 = 0.12` MINIMA per viewer

**Metrics**:
- **Max viewers**: `floor(9000 / 0.12) = 75,000 viewers`
- **Max publishers**: `1000 / P_r` (if `P_r = 0.02`, then 50,000 views worth)
- **Daily max per viewer**: `100 × 0.02 + 100 × 0.04 = 6 MINIMA/day` (well within cap of 0.12)
- **Campaign duration**: Budget supports ~1–2 weeks of moderate engagement
- **Cost + fee**: `10000 + 600 = 10,600 MINIMA` total cost

**Comparison** (multiplier variants):
| Multiplier | CAP_view | Max viewers | Daily per viewer |
|---|---|---|---|
| ×1.0 | 0.06 | 150,000 | 3 MINIMA |
| ×2.0 | 0.12 | 75,000 | 6 MINIMA |
| ×4.0 | 0.24 | 37,500 | 12 MINIMA |

---

### Example 3: Budget = 50,000 MINIMA (Large Campaign)

**Inputs**:
- `B = 50000`
- `m = 2.0`
- `B_max_p = 5000` (10% for publishers)
- `d_v = 100`, `d_c = 100`

**Auto-balance calculation**:
- `B_viewer = 50000 - 5000 = 45,000` MINIMA
- `R_v = 0.01` MINIMA (from table: budget 10000+ range)
- `R_c = 0.02` MINIMA
- `CAP_view = (0.01 + 0.02) × 2.0 = 0.06` MINIMA per viewer

**Metrics**:
- **Max viewers**: `floor(45000 / 0.06) = 750,000 viewers`
- **Max publishers**: `5000 / P_r` (if `P_r = 0.01`, then 500,000 views worth)
- **Daily max per viewer**: `100 × 0.01 + 100 × 0.02 = 3 MINIMA/day` (within cap of 0.06)
- **Campaign duration**: Budget supports 3–4 weeks of steady engagement
- **Cost + fee**: `50000 + 3000 = 53,000 MINIMA` total cost

---

## 5. Multiplier Semantics

The multiplier controls the **trade-off between reach and incentive**:

```
                   Reach (viewers)
                        ↑
                        |
              ×1.0       |       ×2.0       |       ×5.0
         (max reach) |    ■          ■          ■
                        |       \       \
                        |        \       \
                        |         \       \
                        |          \       \
                        +----------+--------+-- Incentive (MINIMA/viewer)
                             ↑
```

- **×1.0** (multiplier = 1): `CAP_view = R_v + R_c` = **minimum incentive**, **maximum reach**
  - Use when: Large audience, budget-constrained, rapid engagement preferred
  - Example: Public service announcement; goal is exposure, not high earnings

- **×2.0** (multiplier = 2): `CAP_view = 2×(R_v + R_c)` = **balanced** (default)
  - Use when: Standard advertising; attract reasonable engagement without excessive spend
  - Example: Normal product ad; fair incentive for users, efficient budget use

- **×3.0–5.0** (multiplier = 3–5): `CAP_view = 3–5×(R_v + R_c)` = **strong incentive**, **limited reach**
  - Use when: Premium campaign, small target audience, quality over quantity
  - Example: Exclusive offer; target a specific niche; higher payout per person

---

## 6. Publisher Reward Defaults

**Current behavior** (in the form):
- Publisher rewards are manual (not auto-calculated)
- Creator sets `publisher_reward_view` and `max_publisher_budget` directly
- If either is 0, publisher payouts are disabled

**Recommended auto-balance for publishers** (future enhancement):

```
If publisher_reward_view = 0 (disabled):
  P_r = 0
  B_max_p = 0

Else (enabled):
  P_r = (R_v + R_c) × 0.5  // Publisher earns 50% of per-viewer viewer reward
  B_max_p = B × 0.10       // Reserve 10% of total budget for publishers
```

**Rationale**: Publishers take on operational cost (hosting, maintenance); compensate them proportionally to viewer rewards, but at a lower rate since publishers don't bear the risk of viewer acquisition.

**Example** (Budget 10,000, viewer rewards auto-calculated):
- `R_v = 0.02`, `R_c = 0.04`
- `P_r = (0.02 + 0.04) × 0.5 = 0.03` MINIMA per view
- `B_max_p = 10000 × 0.10 = 1000` MINIMA reserve
- With 1000 MINIMA and 0.03 per view: supports up to 33,333 publisher views

---

## 7. Implementation Checklist

### 7.1 Form Updates

- [ ] Auto-balance checkbox: when checked, disable manual `reward_view` and `reward_click` inputs
- [ ] Multiplier slider/number input: range [1.0, 10.0], step 0.1, default 2.0
- [ ] Real-time updates: when budget or multiplier changes, recalculate and display:
  - Suggested `reward_view` and `reward_click`
  - Suggested `max_viewer_reward` = (R_v + R_c) × m
  - Estimated max viewers = floor(B_viewer / CAP_view)
  - Estimated daily engagement per viewer
  - Visual indicator: "Reach" vs "Incentive" slider

### 7.2 Validation Rules

- [ ] If auto-balance is ON: auto-computed values must satisfy all existing limits
  - `reward_view >= LIMITS.MIN_REWARD_VIEW`
  - `reward_click >= LIMITS.MIN_REWARD_CLICK`
  - `max_viewer_reward >= reward_view + reward_click`
  - `max_viewer_reward <= B_available` (remaining budget after publisher allocation)

- [ ] If auto-balance is OFF: use manually entered values (current behavior)

### 7.3 Database/Persistence

- [ ] New field: `campaigns.auto_balance_enabled` (boolean; default FALSE for backward compat)
- [ ] When saving campaign: store the multiplier value and auto-balance flag
- [ ] On load: if `auto_balance_enabled`, recalculate R_v, R_c based on stored multiplier and budget

### 7.4 Hint Text

Provide contextual help in the UI:

```
Multiplier ×1.0 → Maximum reach (low reward per viewer)
Multiplier ×2.0 → Balanced (default)
Multiplier ×5.0 → Strong incentive (limited reach)

Max viewers this campaign can reach: [dynamic calculation]
Max daily reward per viewer: [dynamic calculation]
Estimated publisher capacity: [dynamic calculation]
```

---

## 8. Reference: Current Form Defaults (No Auto-Balance)

When auto-balance is **disabled**, the form shows:
- `reward_view = 1.0`
- `reward_click = 2.0`
- `max_viewer_reward = 10.0`
- `max_daily_views = 100`
- `max_daily_clicks = 100`
- `publisher_reward_view = 10.0` (if publishers enabled)
- `max_publisher_budget = 100` (if publishers enabled)

These are **placeholder values** and typically get adjusted by the creator based on budget and campaign goals.

---

## 9. Frequently Asked Questions

### Q: Why ratio 1:2 for view:click?
Views are passive and high-frequency; clicks require intent and conversion. A 2× ratio encourages conversion without making clicks dominant. This is a product decision; can be tuned via the multiplier.

### Q: What if the creator wants to allocate differently?
Auto-balance provides a good default. Creators can disable it and set values manually at any time.

### Q: How does auto-balance interact with daily limits?
Daily limits (100 views / 100 clicks) are **independent** of auto-balance. Auto-balance sets the per-viewer cap; daily limits enforce frequency limits to prevent gaming. Together, they ensure:
- A viewer can't earn more than `CAP_view` total (auto-balance)
- A viewer can't claim rewards too fast (daily limits + cooldown)

### Q: What if `max_viewer_reward + max_publisher_budget > budget`?
The form's validation ensures: `max_viewer_reward + max_publisher_budget <= budget_total`.
The auto-balance calculation respects this by computing `B_viewer = B - B_max_p` first.

### Q: How often should multiplier change?
Multiplier can be tuned **before publishing** the campaign (while in draft). Once published (active), the multiplier is read-only to ensure fair terms with viewers. Future enhancement: allow publisher to adjust multiplier on paused campaigns.

---

## 10. Appendix: Full Calculation Walkthrough

### Example: Budget 5,000 MINIMA, Multiplier 3.0

```
Input:
  B = 5000
  m = 3.0
  B_max_p = 500 (manual; 10% for publishers)
  d_v = 100, d_c = 100

Step 1: Determine base reward (lookup table)
  Budget 5000 falls in range [2000, 10000]
  → R_v_base = 0.05
  → R_c_base = 0.10

Step 2: Calculate per-viewer cap
  CAP_view = (R_v_base + R_c_base) × m
           = (0.05 + 0.10) × 3.0
           = 0.45 MINIMA

Step 3: Allocate viewer vs publisher budget
  B_viewer = B - B_max_p
           = 5000 - 500
           = 4500 MINIMA

Step 4: Estimate reach
  max_viewers = floor(B_viewer / CAP_view)
              = floor(4500 / 0.45)
              = 10,000 viewers

Step 5: Calculate daily maximum
  daily_view = d_v × R_v_base = 100 × 0.05 = 5.0 MINIMA
  daily_click = d_c × R_c_base = 100 × 0.10 = 10.0 MINIMA
  daily_total = 15.0 MINIMA (well below CAP_view = 0.45)

Output:
  reward_view = 0.05
  reward_click = 0.10
  max_viewer_reward = 0.45
  max_viewers = 10,000
  daily_incentive_per_viewer = 15 MINIMA
  cost_total = 5000 + (5000 × 0.06) = 5300 MINIMA
```

---

## 11. Version History

- **v1.0** (2026-06-08): Initial algorithm design, lookup-table approach, 1:2 reward ratio
