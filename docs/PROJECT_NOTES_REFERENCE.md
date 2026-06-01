# MinimaAds Project Notes — Reference

> **Reference material — consult as needed, not mandatory reading.**
> Contains protocol message matrix, FE↔SW signal contract, and source-of-truth rules.
> Must-read sections (project intent, topology, DB schema) live in `docs/PROJECT_NOTES.md`.

Extracted from AGENTS.md during documentation compaction on 2026-05-18. MinimaAds.md remains the highest-authority specification.

---

## 9) Protocol / Message Types

> Authoritative schemas: MinimaAds.md §8. This section mirrors them for agent reference.
> Update BOTH this section AND MinimaAds.md §8 for every new message type.

| Maxima Type | Direction | Handler | DB Impact | FE Signal |
|---|---|---|---|---|
| `CAMPAIGN_ANNOUNCE` | Creator SW → all contacts | `campaign.handler.js` | `MERGE INTO CAMPAIGNS` + `MERGE INTO ADS` | `NEW_CAMPAIGN` | Optional fields `max_viewer_reward`, `publisher_reward_view`, `max_publisher_budget`, `platform_key`. Receiver MUST validate `platform_key` matches local `PLATFORM_KEY` constant AND escrow coin PREVSTATE(5); mismatch → silent drop. When local `PLATFORM_KEY` is null: skip validation (MVP). |
| `CAMPAIGN_PAUSE` | Creator SW → all contacts | `campaign.handler.js` | `UPDATE CAMPAIGNS SET STATUS='paused'` | `CAMPAIGN_UPDATED` | **Fast-path only** — authoritative state is `ESCROW_V3 PREVSTATE(7)`. Handler retained for back-compat. |
| `CAMPAIGN_FINISH` | Creator SW → all contacts | `campaign.handler.js` | `UPDATE CAMPAIGNS SET STATUS='finished'` | `CAMPAIGN_UPDATED` | **Fast-path only** — authoritative state is `ESCROW_V3 PREVSTATE(7)`. Handler retained for back-compat. |
| `CAMPAIGN_RESUME` | Creator SW → all contacts | `campaign.handler.js` | `UPDATE CAMPAIGNS SET STATUS='active'` | `CAMPAIGN_UPDATED` | **DEPRECATED** — resume is on-chain only (offline-creator cannot Maxima). Handler retained for inbound back-compat only. |
| `REQUEST_CAMPAIGN_DATA` | Viewer SW → Creator SW (unicast `to:Mx...`) | `campaign.handler.js` | None (read-only lookup) | None |
| `CAMPAIGN_DATA_RESPONSE` | Creator SW → Viewer SW (unicast `to:Mx...`) | `campaign.handler.js` | `MERGE INTO CAMPAIGNS` + `MERGE INTO ADS` | `NEW_CAMPAIGN` |
| `CHANNEL_OPEN_REQUEST` | Viewer/Publisher FE → Creator FE (unicast, `poll:true`) | `channel.handler.js` | `MERGE INTO CHANNEL_STATE` (creator, incl. `VIEWER_WALLET_ADDR`) | — (triggers coin creation in FE) | + Optional fields `role` (`viewer`\|`publisher`, default `viewer`) and `frame_id` (required when `role='publisher'`). Routes to viewer or publisher channel-open flow. |
| `CHANNEL_OPEN` | Creator FE → Viewer/Publisher FE (unicast, `poll:true`) | `channel.handler.js` | `UPDATE CHANNEL_STATE status='open', ROLE=role` | `CHANNEL_OPENED` | + `role`, `frame_id` echoed back. |
| `REWARD_REQUEST` | Viewer/Publisher FE → Creator FE (unicast, `poll:true`) | `channel.handler.js` | `UPDATE CHANNEL_STATE` (cumulative, tx_hex) | — (sends REWARD_VOUCHER) | + `role`, `frame_id`. Creator queries `CHANNEL_STATE WHERE ROLE=role` to validate cumulative. |
| `REWARD_VOUCHER` | Creator FE → Viewer/Publisher FE (unicast, `poll:true`) | `channel.handler.js` | `UPDATE CHANNEL_STATE` (tx_hex, cumulative) | `VOUCHER_RECEIVED` | + `role`, `frame_id` echoed. Viewer side: standard VOUCHER_RECEIVED. Publisher side: SDK writes `publisher_view` REWARD_EVENT + signals PUBLISHER_REWARD_CONFIRMED. |
| `VOUCHER_SYNC_REQUEST` | Viewer FE → Creator FE (unicast, `poll:true`) | `channel.handler.js` | None (read-only) | — (sends REWARD_VOUCHER or CHANNEL_OPEN) | `role` included to disambiguate which channel to sync. |

> **Reward accounting is FE-owned** — `core/rewards.js` writes REWARD_EVENTS, CAMPAIGNS, USER_PROFILE. See MinimaAds.md §8.4.
> **Channel coin creation and settlement tx signing are FE-owned** — require pending approval flow; cannot run in SW.

**Application name**: `application:minima-ads` — defined as `APP_NAME` constant in `main.js`. Never hardcode the literal string in `MDS.cmd` calls.

**Rule**: Every new message type added to the SW must also be added to this table. If a type is handled somewhere and not listed here, future agents will implement duplicate handlers.

---

## 10) FE ↔ SW Signal Contract

> Authoritative signal contract: MinimaAds.md §8.13. This section mirrors it for agent reference.
> Update BOTH this section AND MinimaAds.md §8.13 whenever a new signal is added.

| Signal Type | Payload | Fired By | FE Reaction |
|---|---|---|---|
| `DB_READY` | `{}` | `db-init.js` (SW) | Unlock FE routing — only render DB-backed views once seen |
| `REWARD_CONFIRMED` | `{ event_id, amount, reward_type }` | `core/rewards.js` (FE) | Update reward display, balance indicator |
| `CAMPAIGN_UPDATED` | `{ campaign_id, status, budget_remaining }` | `campaign.handler.js` (SW) | Refresh campaign card status |
| `NEW_CAMPAIGN` | `{ campaign_id }` | `campaign.handler.js` (SW) | Reload available campaigns list |
| `CAMPAIGN_PENDING_DENIED` | `{ uid }` | `campaign.handler.js` (SW) | Show "Transaction denied" in creator form |
| `CHANNEL_OPENED` | `{ campaign_id, channel_coinid, max_amount }` | `channel.handler.js` (SW) | Clear "Opening channel…" message; flush pending rewards |
| `VOUCHER_RECEIVED` | `{ campaign_id, cumulative }` | `channel.handler.js` (SW) | Update viewer earned balance display |
| `AUTO_SETTLE` | `{ campaign_id, viewer_key, tx_hex }` | `channel.handler.js` (SW) | Prompt viewer to settle or auto-settle (txnimport → txnsign → txnpost) |
| `SETTLE_CONFIRMED` | `{ campaign_id, amount }` | `channel.handler.js` (FE) | Show settlement confirmation; update channel status |
| `DO_CHANNEL_OPEN` | `{ campaign_id, viewer_key, viewer_mx, max_amount }` | `channel.handler.js` (SW) | Creator FE creates channel coin (txncreate/txninput/txnoutput/txnpost) |
| `DO_REWARD_VOUCHER` | `{ campaign_id, viewer_key, viewer_mx, event_id, cumulative }` | `channel.handler.js` (SW) | Creator FE builds partial tx and sends REWARD_VOUCHER to viewer |
| `DO_SEND_VOUCHER` | `{ campaign_id, viewer_key, viewer_mx, cumulative, tx_hex }` | `channel.handler.js` (SW) | Creator FE re-sends REWARD_VOUCHER with stored tx_hex (reconnect sync) |
| `DO_RESEND_CHANNEL_OPEN` | `{ campaign_id, viewer_key, viewer_mx, channel_coinid, max_amount }` | `channel.handler.js` (SW) | Creator FE re-sends CHANNEL_OPEN when viewer syncs but no voucher exists yet |
| `FRAME_READY` | `{ frame_id, is_builtin }` | `service.js` (SW) | Built-in frame ensured at init; SDK can resolve default frameId |
| `FRAME_CREATED` | `{ frame_id, label }` | `dapp/views/frames.js` (FE) | New frame persisted; refresh frame list |
| `PUBLISHER_REWARD_CONFIRMED` | `{ event_id, amount, frame_id, campaign_id }` | `core/rewards.js` (FE) | Publisher reward persisted; update Frame earnings display |
| `DO_PUBLISHER_CHANNEL_OPEN` | `{ campaign_id, publisher_key, publisher_mx, frame_id, max_amount }` | `channel.handler.js` (SW) | Creator FE creates publisher channel coin (same tx structure as viewer channel) |
| `DO_PUBLISHER_REWARD_VOUCHER` | `{ campaign_id, publisher_key, publisher_mx, frame_id, event_id, cumulative }` | `channel.handler.js` (SW) | Creator FE builds publisher partial tx and sends REWARD_VOUCHER with role='publisher' |
| `STATUS_TX_PENDING` | `{ campaign_id, status, pending_uid }` | `dapp/app.js` (FE, self-route via `MDS.comms.solo`) | mycampaigns.js shows "(awaiting on-chain confirm: \<status\>)" on campaign row; cleared on next CAMPAIGN_UPDATED |

**Rule**: Every new signal type fired by SW must be registered in the FE `MDSCOMMS` handler (`dapp/app.js`). Missing registrations cause silent UI failures. The payload is at `event.data.message` (not `event.data`) — see section 5.1.

---

## 11) Source of Truth Rules

> For document-level source of truth, see section 0.5.
> This section covers runtime state ownership.

| State | Owner | Details |
|---|---|---|
| Inbound Maxima event persistence | **SW** | `campaign.handler.js` only — reward processing is FE-owned |
| DB schema initialization | **Both** | SW `db-init.js` + FE init — both must be identical |
| UI state and rendering | **FE** | `dapp/views/*.js` |
| LIMITS constant | **SW** | Single `LIMITS` object in `main.js`. FE reads limits from DB if needed — never redefines them |
| Campaign availability (what to display) | **FE** | Reads from local DB via `getCampaigns()` |
| Budget tracking | **FE** | `updateBudget()` called by `core/rewards.js` in FE callback chain |
| Anti-abuse enforcement | **FE** | `validateView/Click()` in `validation.js` — FE writes directly to shared H2 DB |
| Token payment / escrow | **KissVM** | On-chain — authoritative. Client-side is performance optimization only |
| Reward event deduplication | **FE** | `isDuplicate(eventId)` called by `core/rewards.js` before any DB write |

**Creator cannot earn from own campaigns** — enforced in both `selectAd()` (FE, filters candidates) and `validateView/Click()` (SW, rejects events). Both checks must always be present.

---
