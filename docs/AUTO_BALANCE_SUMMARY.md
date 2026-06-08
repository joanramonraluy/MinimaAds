# Auto-Balance Algorithm — Quick Reference

## Core Formulas

### 1. Base Reward Per View (Lookup Table)

```javascript
function getAutoBalanceDefaults(budgetTotal) {
  if (budgetTotal < 500) {
    return { reward_view: 0.10, reward_click: 0.20 };
  }
  if (budgetTotal < 2000) {
    return { reward_view: 0.05, reward_click: 0.10 };
  }
  if (budgetTotal < 10000) {
    return { reward_view: 0.02, reward_click: 0.04 };
  }
  return { reward_view: 0.01, reward_click: 0.02 };
}
```

**Rationale**: Larger budgets → more viewers needed → lower per-reward cost.

### 2. Per-Viewer Reward Cap

```javascript
max_viewer_reward = (reward_view + reward_click) × multiplier
```

Where:
- `multiplier` ∈ [1.0, 10.0], default = 2.0
- `multiplier = 1.0` → max reach (minimum incentive)
- `multiplier = 2.0` → balanced (standard)
- `multiplier = 5.0+` → strong incentive (limited reach)

### 3. Estimated Maximum Viewers

```javascript
max_viewers = floor((budget_total - max_publisher_budget) / max_viewer_reward)
```

### 4. Reward Ratio

```
reward_view : reward_click = 1 : 2

Rationale:
- Views are passive (high volume)
- Clicks require action (lower volume but higher intent)
- 2× multiplier incentivizes conversion without breaking budget
```

### 5. Publisher Budget Allocation (Optional Auto-Calculation)

```javascript
// If publishers enabled:
publisher_reward_view = (reward_view + reward_click) × 0.5
max_publisher_budget = budget_total × 0.10

// If publishers disabled:
publisher_reward_view = 0
max_publisher_budget = 0
```

**Rationale**:
- Publishers earn half the per-viewer viewer reward (they have operational costs)
- Reserve 10% of total budget for publisher rewards (can be tuned per campaign)

---

## Three Budget Scenarios

### Scenario 1: Small Campaign (Budget = 1,000 MINIMA)

```
Input:  Budget = 1,000, Multiplier = 2.0, Publisher budget = 100
Output:
  reward_view = 0.10
  reward_click = 0.20
  max_viewer_reward = 0.60
  max_viewers = 1,500
  daily_reward_per_viewer = 30 MINIMA (100 views × 0.10 + 100 clicks × 0.20)
  total_cost = 1,060 MINIMA (+ 6% fee)

Multiplier variants:
  ×1.0 → CAP = 0.30, viewers = 3,000 (max reach)
  ×2.0 → CAP = 0.60, viewers = 1,500 (balanced)
  ×3.0 → CAP = 0.90, viewers = 1,000 (strong incentive)
  ×5.0 → CAP = 1.50, viewers = 600 (very strong)
```

### Scenario 2: Medium Campaign (Budget = 10,000 MINIMA)

```
Input:  Budget = 10,000, Multiplier = 2.0, Publisher budget = 1,000
Output:
  reward_view = 0.02
  reward_click = 0.04
  max_viewer_reward = 0.12
  max_viewers = 75,000
  daily_reward_per_viewer = 6 MINIMA (100 views × 0.02 + 100 clicks × 0.04)
  total_cost = 10,600 MINIMA (+ 6% fee)

Multiplier variants:
  ×1.0 → CAP = 0.06, viewers = 150,000
  ×2.0 → CAP = 0.12, viewers = 75,000
  ×4.0 → CAP = 0.24, viewers = 37,500
```

### Scenario 3: Large Campaign (Budget = 50,000 MINIMA)

```
Input:  Budget = 50,000, Multiplier = 2.0, Publisher budget = 5,000
Output:
  reward_view = 0.01
  reward_click = 0.02
  max_viewer_reward = 0.06
  max_viewers = 750,000
  daily_reward_per_viewer = 3 MINIMA (100 views × 0.01 + 100 clicks × 0.02)
  total_cost = 53,000 MINIMA (+ 6% fee)

Multiplier variants:
  ×1.0 → CAP = 0.03, viewers = 1,500,000
  ×2.0 → CAP = 0.06, viewers = 750,000
  ×5.0 → CAP = 0.15, viewers = 300,000
```

---

## Decision Table: Multiplier Recommendation

| Campaign Type | Goal | Suggested Multiplier | Rationale |
|---|---|---|---|
| Public service / Awareness | Max reach | 1.0–1.5 | Broad exposure, minimal incentive |
| Standard product ad | Balanced | 2.0 (default) | Fair engagement, efficient spend |
| Premium / Exclusive offer | Quality engagement | 3.0–4.0 | Stronger incentive, niche audience |
| High-value product | Conversion focus | 5.0+ | Maximum incentive, limited reach |

---

## Implementation Notes

### Form Integration

1. **When auto-balance is OFF** (default):
   - Show manual input fields: `reward_view`, `reward_click`, `max_viewer_reward`
   - Creator enters values directly
   - Current behavior (no change)

2. **When auto-balance is ON**:
   - Hide manual input fields
   - Show multiplier slider (1.0–10.0, step 0.1)
   - **On any change to budget or multiplier:**
     - Fetch base rewards from lookup table
     - Calculate `max_viewer_reward = (R_v + R_c) × multiplier`
     - Display estimated `max_viewers`
     - Update daily engagement estimate
     - Show "reach vs. incentive" comparison for different multipliers

### Validation

All auto-calculated values must pass existing validation:
```
reward_view >= LIMITS.MIN_REWARD_VIEW (0.001)
reward_click >= LIMITS.MIN_REWARD_CLICK (0.005)
max_viewer_reward >= reward_view + reward_click
max_viewer_reward <= (budget - max_publisher_budget)
max_viewer_reward * estimated_viewers <= budget
```

### UI Hints

```
Multiplier Guide:
  ×1.0 = Maximum reach (lowest per-viewer reward)
  ×2.0 = Balanced engagement (recommended)
  ×5.0 = Strong incentive (limited audience)

Campaign Metrics:
  Max viewers: [calculated]
  Max daily reward/viewer: [calculated]
  Publisher capacity: [calculated]
  Total cost (incl. 6% fee): [calculated]
```

---

## Backward Compatibility

- **New field**: `campaigns.auto_balance_enabled` (boolean; default = FALSE)
- **Existing campaigns**: Unaffected (auto-balance disabled by default)
- **Migration**: None required; feature is opt-in
- **API**: No changes to core reward functions; auto-balance is purely UI/form logic

---

## Tuning Parameters

These can be adjusted if needed (NOT exposed to UI):

```javascript
const AUTO_BALANCE_CONFIG = {
  REWARD_RATIO_CLICK_TO_VIEW: 2.0,        // reward_click = reward_view × 2.0
  PUBLISHER_REWARD_RATIO: 0.5,             // P_r = (R_v + R_c) × 0.5
  PUBLISHER_BUDGET_RATIO: 0.10,            // B_max_p = B × 0.10
  MULTIPLIER_MIN: 1.0,
  MULTIPLIER_MAX: 10.0,
  MULTIPLIER_DEFAULT: 2.0,
  
  // Budget tiers for base reward lookup
  BUDGET_TIERS: [
    { max: 500, reward_view: 0.10, reward_click: 0.20 },
    { max: 2000, reward_view: 0.05, reward_click: 0.10 },
    { max: 10000, reward_view: 0.02, reward_click: 0.04 },
    { max: Infinity, reward_view: 0.01, reward_click: 0.02 }
  ]
};
```

---

## Version
- v1.0 (2026-06-08): Initial release
- Lookup table approach with 1:2 ratio
- Default multiplier: 2.0 (balanced)
