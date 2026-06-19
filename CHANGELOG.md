# Changelog — MinimaAds

All notable changes to this project will be documented in this file.

## [0.26.6.5] - 2026-06-19

### ✨ Major Features

**Issue 1: On-Chain Campaign Settlement**
- Campaign finish now posts real L1 settlement transactions that spend channel coins to counterparties
- Viewer and publisher nodes detect coin spend and confirm settlement independently
- Replaced local-only settlement with proper MULTISIG(2) on-chain flow
- Files: `channel.handler.js`, `app.js`

**Issue 3: Viewer State Refresh**
- Removed liveness-ping exclusion for viewers with open channels
- Viewers now receive status updates even while channel is open
- Fixed `campaign-detail` route not triggering refresh on CAMPAIGN_UPDATED
- Viewers immediately see when campaign finishes (status: finished)
- Files: `campaign.handler.js`, `app.js`

**Issue 2: UI Warnings & Closing Flow**
- Reorganized finish confirmation (warning + buttons) from action container to dedicated warnings panel
- Eliminated message duplication in close campaign flow
- Added progress indicator during settlement: "Closing channels… (X/Y)"
- Settlement confirmations now display with amounts: "Channel settled: X MINIMA"
- Files: `mycampaigns.js`, `app.js`

### 🐛 Bug Fixes

- Fixed V3/V4 escrow address detection in status-update transactions (was only checking V3)
- Fixed mobile layout: close campaign buttons now stack vertically on small screens
- Fixed NodeManager `.mds.zip` bloat: excluded self-references to prevent 360MB recursive packing

### 📚 Infrastructure

- Cleaned up git history: removed 361MB `MinimaAds.mds.zip` build artifact from tracking
- Improved NodeManager zip exclusion: only excludes `*.git*` (clean, maintainable approach)
- Added `.gitignore` entries for build outputs

### 🧪 Verification

Tested with 3-node setup (creator user1, viewer user3, publisher user4):
- ✅ Settlement txs post to L1 and spend coins
- ✅ Viewers see status change in real-time
- ✅ UI warnings display without duplication
- ✅ Mobile layout adapts correctly
- ✅ Campaign state syncs across all participants

---

## [0.26.6.4] - 2026-06-16

### 🔧 Maintenance
- Budget handling: fixed decimal truncation in updateBudget (was using parseInt, now uses parseFloat)
- Prevented premature 'finished' status on campaigns with small decimal budgets (0.5 MINIMA, etc)

---

## [0.26.6.3] and earlier

See git history for details.
