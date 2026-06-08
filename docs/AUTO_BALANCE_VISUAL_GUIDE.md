# Auto-Balance Visual Guide

## 1. Algorithm Overview Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   CAMPAIGN CREATION FORM                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Budget: 5,000 MINIMA                                         │
│  [Auto-balance]  ☑ Enable                                    │
│  Multiplier:     [====●=========] ×2.0  (1.0 – 10.0)        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         ↓ (when auto-balance ON + multiplier changes)
┌─────────────────────────────────────────────────────────────┐
│               AUTOMATIC CALCULATION FLOW                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Step 1: Determine Base Rewards (Budget Tier Lookup)         │
│          Budget 5,000 → [2,000 – 10,000] tier               │
│          R_v_base = 0.05, R_c_base = 0.10                    │
│                                                               │
│  Step 2: Apply Multiplier                                    │
│          CAP_view = (0.05 + 0.10) × 2.0 = 0.30 MINIMA      │
│                                                               │
│  Step 3: Allocate Budget                                     │
│          B_viewer = 5,000 - 500 (pub) = 4,500 MINIMA        │
│                                                               │
│  Step 4: Estimate Reach                                      │
│          max_viewers = floor(4,500 / 0.30) = 15,000         │
│                                                               │
│  Step 5: Calculate Daily Engagement                          │
│          daily = (100 × 0.05) + (100 × 0.10) = 15 MINIMA   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│                   FORM UPDATES (READ-ONLY)                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Reward per view:      0.05 MINIMA (read-only)              │
│  Reward per click:     0.10 MINIMA (read-only)              │
│  Max reward/viewer:    0.30 MINIMA (read-only)              │
│                                                               │
│  ─────────────────────────────────────────────────────────   │
│  METRICS:                                                     │
│  ─────────────────────────────────────────────────────────   │
│  Max viewers reachable:       15,000                          │
│  Daily max per viewer:        15 MINIMA                       │
│  Publisher capacity (est.):   50,000 views @ 0.025/view     │
│  Total cost (incl. 6% fee):   5,300 MINIMA                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Budget Tier Lookup Table (Visual)

```
          Reward Value (MINIMA per event)
                    ↑
         0.20  ├─────────────┬──────────┐
                │ Budget <500  │          │
         0.15  │  R_v=0.10    │          │
                │  R_c=0.20    │          │
         0.10  ├──────────────┼──────────┤──────┐
                │              │ 500-2K   │      │
         0.05  │              │ R_v=0.05 │      │
                │              │ R_c=0.10 │      │
         0.03  ├──────────────┼──────────┼──────┤─────┐
                │              │          │ 2K-10K  │     │
         0.02  │              │          │ R_v=0.02│     │
                │              │          │ R_c=0.04│     │
         0.01  ├──────────────┼──────────┼────────┼─────┤──────┐
                │              │          │        │ 10K+ │      │
                │              │          │        │ R_v= │      │
                │              │          │        │ 0.01 │      │
                ├──────────────┴──────────┴────────┴─────┴──────┤
                 100    500     2K      10K    50K     100K
                         Budget Range (MINIMA)
                               →
```

---

## 3. Multiplier Impact on Reach vs. Incentive

```
REACH (max viewers) ↑
                    │
              150K  │  ×1.0
                    │   ●
              100K  │   │      ×2.0
                    │   │   ●
               50K  │   │   │      ×4.0
                    │   │   │   ●
               25K  │   │   │   │      ×7.0
                    │   │   │   │   ●
              10K  │   │   │   │   │
                    │   │   │   │   │
                 0  └───┴───┴───┴───┴─────────────→  INCENTIVE
                    0.3 0.6 1.2 2.4 4.2  (MINIMA/viewer)

Budget = 10,000, Base reward = 0.06 MINIMA
CAP_view = (0.02 + 0.04) × multiplier

  Multiplier  │ Cap/Viewer │ Max Viewers │ Use Case
  ────────────┼────────────┼─────────────┼──────────────────
  ×1.0        │ 0.06       │ 150,000     │ Max reach
  ×2.0        │ 0.12       │  75,000     │ Balanced (default)
  ×3.0        │ 0.18       │  50,000     │ Good incentive
  ×5.0        │ 0.30       │  30,000     │ Strong incentive
  ×10.0       │ 0.60       │  15,000     │ Very strong
```

---

## 4. Daily Budget Consumption Pattern

```
For a Viewer with Daily Limits (100 views, 100 clicks/day):

Budget = 1,000, R_v = 0.10, R_c = 0.20, CAP_view = 0.60

Daily consumption (optimal engagement):
  100 views × 0.10 = 10 MINIMA
  100 clicks × 0.20 = 20 MINIMA
  ──────────────────────────────
  TOTAL/DAY        = 30 MINIMA (well under cap of 0.60)

Days until hitting cap: 0.60 / 30 = 0.02 days (≈ 28 minutes of activity!)

Timeline:
  Day 1: Viewer earns 30 MINIMA (remaining cap = 0.30)
  Day 2: Can earn another 30 MINIMA (but cap only allows 30 more = 0.60 total)
         → Capped after ~14 minutes on Day 2

Insight: With aggressive daily limits + small cap, viewers hit the ceiling
fast. The cap controls TOTAL lifetime earnings, not daily frequency.
Daily limits + cooldown control abuse within the cap.
```

---

## 5. Publisher Budget Allocation

```
Total Campaign Budget = 100%
│
├─ Viewer Rewards            = 80-90% of budget
│  ├─ Base reward calculation (lookup table)
│  └─ Multiplied by creator's chosen multiplier
│
└─ Publisher Rewards (Optional) = 10-20% of budget
   ├─ If disabled: 0 MINIMA
   └─ If enabled:
      ├─ Per-view reward = (R_v + R_c) × 0.5 MINIMA
      └─ Max budget cap  = total budget × 0.10

Example: Budget 10,000
│
├─ Viewer rewards:           80% = 8,000 MINIMA
│  ├─ R_v = 0.02
│  ├─ R_c = 0.04
│  └─ CAP_view (×2.0) = 0.12
│
└─ Publisher rewards:        20% = 2,000 MINIMA (default: 10% = 1,000)
   ├─ P_r = 0.03 per view
   └─ Max publishers supported: 1,000 / 0.03 = 33,333 views

Note: Allocation is NOT automatic in the current form—creator sets
max_publisher_budget manually. Auto-calculation is FUTURE work.
```

---

## 6. Three Budget Scenario Comparison

```
┌──────────────────────────────────────────────────────────────┐
│          SMALL (1K)  |  MEDIUM (10K)  |  LARGE (50K)        │
├──────────────────────────────────────────────────────────────┤
│ R_v:     0.10        │   0.02         │   0.01              │
│ R_c:     0.20        │   0.04         │   0.02              │
│ CAP:     0.60 (×2.0) │   0.12 (×2.0)  │   0.06 (×2.0)      │
├──────────────────────────────────────────────────────────────┤
│ Viewers: 1,500       │   75,000       │   750,000           │
│ Daily:   30 MINIMA   │   6 MINIMA     │   3 MINIMA          │
│ Cost:    1,060       │   10,600       │   53,000            │
│ Reach:   Small local │   Regional     │   Massive           │
└──────────────────────────────────────────────────────────────┘

All at default multiplier ×2.0 (balanced).
Increase multiplier → fewer viewers, higher incentive.
```

---

## 7. Multiplier Slider UI Mockup

```
┌─────────────────────────────────────────────────────────────┐
│ VIEWER REWARDS                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ☑ Auto-balance reward cap                                    │
│   Automatically calculate max reward per viewer based on    │
│   budget and multiplier.                                    │
│                                                               │
│ Multiplier:  ×1.0  ×2.0 (default)  ×5.0  ×10.0             │
│              [════●════════════════] 2.5                     │
│                 ↑                                             │
│              Max reach              Max incentive            │
│                                                               │
│ • Reward per view (calculated):     0.05 MINIMA             │
│ • Reward per click (calculated):    0.10 MINIMA             │
│ • Max per viewer (calculated):      0.15 MINIMA ← updates   │
│                                                      with    │
│   Multiplier guide:                                 slider   │
│   ×1.0 = Maximum reach (500K viewers, 1¢/viewer)            │
│   ×2.0 = Balanced (250K viewers, 2¢/viewer) ← CURRENT      │
│   ×5.0 = Strong (100K viewers, 5¢/viewer)                  │
│                                                               │
│ [Next →]                                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Decision Tree

```
Creator fills budget form:
│
├─ Budget: [5,000]
│
├─ Auto-balance: ☐ (unchecked)
│  │
│  └─→ Manual mode (current)
│      ├─ Reward/view: [manual input]
│      ├─ Reward/click: [manual input]
│      ├─ Max/viewer: [manual input]
│      └─ Publisher: [manual input]
│
└─ Auto-balance: ☑ (checked)
   │
   └─→ Automatic mode (new)
       ├─ Lookup table: Budget 5,000 → [2K–10K] tier
       │                            → R_v=0.05, R_c=0.10
       │
       ├─ Multiplier slider: [====●====] 2.5
       │
       ├─ Calculate:
       │  └─ CAP_view = (0.05 + 0.10) × 2.5 = 0.375
       │
       ├─ Display (read-only):
       │  ├─ Reward/view: 0.05 MINIMA (locked)
       │  ├─ Reward/click: 0.10 MINIMA (locked)
       │  ├─ Max/viewer: 0.375 MINIMA (locked)
       │  └─ Est. viewers: 13,333
       │
       └─ Publisher: [creator decides]
          └─ (future: could auto-set to 10% budget)
```

---

## 9. Real-Time Form Updates (Flowchart)

```
User changes budget or multiplier
         ↓
Is auto-balance checkbox ON?
    ├─ NO  → Skip auto-calculation, use manual values
    │
    └─ YES → Proceed with auto-balance
         ↓
    Fetch base rewards from BUDGET_TIERS table
         ↓
    R_v_base, R_c_base determined
         ↓
    Read multiplier from slider
         ↓
    Calculate CAP_view = (R_v_base + R_c_base) × multiplier
         ↓
    Calculate max_viewers = floor((B - B_pub) / CAP_view)
         ↓
    Calculate daily_max = (100 × R_v_base) + (100 × R_c_base)
         ↓
    Update form display:
    ├─ Reward/view field: R_v_base (read-only)
    ├─ Reward/click field: R_c_base (read-only)
    ├─ Max/viewer field: CAP_view (read-only)
    ├─ Hint: "Est. viewers: X"
    ├─ Hint: "Daily max: Y MINIMA"
    └─ Multiplier guide updated
         ↓
    (All other existing validations still apply)
```

---

## 10. Edge Cases & Limits

```
┌────────────────────────────────────────────────────┐
│           VALIDATION RULES (All cases)            │
├────────────────────────────────────────────────────┤
│                                                    │
│ 1. Budget >= MIN_BUDGET (100 MINIMA)             │
│ 2. R_v >= MIN_REWARD_VIEW (0.001)                │
│ 3. R_c >= MIN_REWARD_CLICK (0.005)               │
│ 4. CAP_view >= R_v + R_c                          │
│ 5. CAP_view <= (B - B_pub)  [per-viewer]         │
│ 6. B_viewer + B_pub <= B     [total budget]      │
│ 7. Daily views × R_v <= CAP_view                  │
│ 8. Daily clicks × R_c <= CAP_view                 │
│ 9. Campaign duration × daily_max >= CAP_view     │
│    (optional: warn if viewer hits cap before EOC) │
│                                                    │
└────────────────────────────────────────────────────┘

Example violation:
  Budget = 100, Multiplier = 10.0
  R_v = 0.10, R_c = 0.20 (from budget tier [0, 500])
  CAP_view = 0.30 × 10 = 3.0 MINIMA
  → Can reach 100 / 3.0 = 33 viewers only
  → Form warns: "Very limited reach. Reduce multiplier or increase budget."
```

---

## Version
- v1.0 (2026-06-08): Visual guide + flowcharts for auto-balance algorithm
