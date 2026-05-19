# MinimaAds Verification Notes

Extracted from AGENTS.md during documentation compaction on 2026-05-18. MinimaAds.md remains the highest-authority specification.

## 17) Node Verification Workflow

The maintainer has access to one or more active Minima nodes at any time. Any number of nodes can run simultaneously — typically one as **creator** and one or more as **viewer** nodes.

### How verification works

The agent cannot access the nodes directly. The workflow is:

1. **Agent implements** a feature and provides the handoff note with verification steps.
2. **Maintainer installs / reloads** the MiniDapp on the relevant nodes (reinstall clears the H2 DB; reload without reinstall preserves it).
3. **Maintainer triggers** the action described in the verification step (e.g. creates a campaign, sends a Maxima message, clicks an ad).
4. **Maintainer copies** the relevant `MDS.log` output from the node debug panel and pastes it into the conversation.
5. **Agent reads the logs** and confirms the expected log lines are present, or diagnoses any errors.

### What to look for in logs

Each module uses a bracketed prefix in `MDS.log` calls. Use these to filter:

| Prefix | Module |
|---|---|
| `[ADS]` | `main.js` — bootstrap, Maxima PK, escrow registration |
| `[DB]` | `db-init.js` — table creation |
| `[SQL]` | `core/minima.js` — sqlQuery errors |
| `[MAXIMA]` | `maxima.handler.js` — inbound Maxima routing |
| `[CAMPAIGN]` | `campaign.handler.js` — campaign persist, status change, discovery |
| `[CHANNEL]` | `channel.handler.js` — channel open, reward request, voucher |
| `[DISCOVERY]` | `campaign.handler.js` — escrow coin scan |
| `[PENDING]` | `campaign.handler.js` — MDS_PENDING approval flow |
| `[TIMER]` | `main.js` — timer ticks |
| `[VALIDATION]` | `core/validation.js` — isDuplicate errors |

### Verification steps for T-CH3 (channel.handler.js)

To verify `handleChannelOpenRequest`:
- Node A (creator) must have an active campaign in DB.
- Send a `CHANNEL_OPEN_REQUEST` Maxima message from Node B to Node A.
- Expected in Node A logs: `[CHANNEL] CHANNEL_OPEN_REQUEST: channel pending. campaign: <id>`
- If budget insufficient: `[CHANNEL] CHANNEL_OPEN_REQUEST: insufficient budget`
- If campaign inactive: `[CHANNEL] CHANNEL_OPEN_REQUEST: campaign not active`

To verify `handleRewardRequest` duplicate rejection:
- Send the same `REWARD_REQUEST` twice (same `event_id`).
- Second time: `[CHANNEL] REWARD_REQUEST: duplicate event_id: <id>`

To verify `handleRewardVoucher` DEDUP_LOG write:
- After receiving a `REWARD_VOUCHER`, query `SELECT * FROM DEDUP_LOG` from the node SQL console.
- The `event_id` from the voucher should appear as a row.

### T-CH3 Verification Result (2026-04-24)

Two-node test (creator = node1 `10.0.0.11:9001`, viewer = node2):

- ✅ Both nodes boot without Rhino errors — `channel.handler.js` loads cleanly
- ✅ Both nodes reach `[DB] initDB: all tables ready` (CHANNEL_STATE table present)
- ✅ Maxima messaging functional: viewer discovers escrow coin on-chain → sends `REQUEST_CAMPAIGN_DATA` → creator replies → viewer persists campaign `19dbe586589-e7bfa9c1`
- ⏳ `[CHANNEL]` handler functions not yet triggered — expected, as `CHANNEL_OPEN_REQUEST` is only sent by T-CH5 (SDK), not yet implemented

Full per-handler verification (handleChannelOpenRequest, handleRewardRequest, handleRewardVoucher) pending T-CH4 + T-CH5.

---

