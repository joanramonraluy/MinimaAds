# Changelog — MinimaAds

All notable changes to this project will be documented in this file.

## [0.26.6.6] - 2026-06-19

### 🎨 UI Polish

**Campaign Finish Confirmation Layout**
- Fixed button overflow on campaign close confirmation dialog
- Buttons now render symmetrically side-by-side on desktop (width: auto override)
- Mobile responsive: buttons scale to 50% width each, stack cleanly on narrow screens
- Fixed button duplication by hiding action header during confirmation
- Files: `dapp/views/mycampaigns.js`

### 📖 Documentation

**Comprehensive Documentation Audit & Refresh**
- Rewrote README.md (320 lines, complete architecture + SDK API update)
- CLAUDE.md: Added `channels.js` and `frames.js` to Stable Core API
- KNOWN_ISSUES.md: Renumbered fragility points (1–50, eliminated duplicates)
- MinimaAds.md: Updated timestamp, corrected Appendix B.5 `txnpost` templates (bare for imports), added `CAMPAIGN_AUTOSETTLE_REQUEST` signal
- AGENTS.md: Fixed cross-references to CLAUDE.md section numbers (§4→§5, etc.), renumbered duplicate §3
- DOCUMENTATION_INDEX.md: Added `docs/HISTORY.md` entry
- TASKS.md: Compacted from 2037 to 150 lines (92% reduction)
- Memory system: Added 3 critical patterns (`txnpost bare`, `STATE ports`, `getaddress`), consolidated 7 publisher routing files into 1 architectural memory

### 🧹 Project Hygiene

- Cleaned up documentation structure for future agent efficiency
- Improved cross-reference consistency across docs
- Documented critical patterns in memory system for preservation across sessions

---

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
