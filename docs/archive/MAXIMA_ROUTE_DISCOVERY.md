# Maxima Route Discovery Notes

Status: Partially implemented. STATE(4) route in escrow coin DONE (2026-06-03). Route caches, PEER_ROUTE_UPDATE, route-refresh tx still future.
Date: 2026-06-03.

This document captures the routing design discussion for payment channels between MinimaAds users who are not Maxima contacts.

## Problem

MinimaAds payment channels are on-chain objects, but channel coordination is off-chain over Maxima:

- `CHANNEL_OPEN_REQUEST`
- `CHANNEL_OPEN`
- `REWARD_REQUEST`
- `REWARD_VOUCHER`
- `VOUCHER_SYNC_REQUEST`
- liveness and route update messages

The stable identity for a user is the Maxima public key. The routable address is a Maxima contact address (`Mx...`), which can change. If a channel party changes its `Mx...` address and the other party only has the stale route, new off-chain messages can fail even though the channel coin and settlement path remain valid.

The current spec stores `PREVSTATE(4)` as `creator_mx_address`. That is fragile because escrow state is immutable for the current coin and only changes when the creator spends the escrow and creates a new escrow/change coin.

## Key Distinctions

Do not conflate these identifiers:

| Identifier | Example | Stability | Use |
|---|---|---:|---|
| Maxima public key | `0x30819f...` | Stable for the node identity | `CREATOR_ADDRESS`, `USER_PROFILE.ADDRESS`, sender validation |
| Maxima contact address | `Mx...@host:port` or `Mx...` | Mutable | Routing hint for `maxima action:send to:...` |
| Permanent Maxima address | `MAX#<publickey>#<static_mls>` | Stable if static MLS remains available | Resolve current contact address for non-contacts |
| Wallet signing key | `0x...` 64-char key | Stable per generated wallet key | KissVM `SIGNEDBY`, escrow/channel scripts |

## Minima/Maxima Capability

Minima exposes a mechanism for non-contacts through `maxextra` permanent addresses:

```text
MAX#<maxima_public_key>#<static_mls_address>
```

Relevant commands from Minima 1.0.45:

```text
maxextra action:staticmls host:Mx...@host:port
maxextra action:addpermanent publickey:0x3081...
maxextra action:getaddress maxaddress:MAX#0x3081...#Mx...@host:port
```

The `maxima action:send to:<route>` command accepts a `MAX#...` route. In core command handling, if `to:` starts with `MAX#`, Minima resolves the current contact address through the static MLS before sending.

Implication: for campaign discovery, MinimaAds should use a permanent creator route:

- `MAX#<publickey>#<static_mls>` for creators and campaign escrow discovery.
- Direct `Mx...` values remain useful only as short-lived reply routes for viewers/publishers or for local operational fallback.

## Recommended Direction

### 1. Rename route semantics

Treat all current `*_mx` protocol fields as route hints, not identities.

Future field names should prefer:

- `creator_route`
- `viewer_route`
- `publisher_route`
- `sender_route`

During the implementation phase, replace old `*_mx` field names where the field is semantically a route:

- `creator_mx`
- `viewer_mx`
- `publisher_mx`

New creator/campaign discovery fields should require `MAX#...`. Viewer and publisher reply routes may support `Mx...` because those peers can refresh their route by sending a new message to the creator.

### 2. Store creator permanent route on-chain

For campaigns, `PREVSTATE(4)` should become a creator route hint rather than a raw creator Mx address.

Required value before production:

```text
MAX#<creator_maxima_public_key>#<creator_static_mls>
```

This keeps campaign discovery usable for viewers who are not contacts of the creator. If the creator's Mx changes, the static MLS can resolve the current route without requiring an escrow refresh transaction.

No legacy campaign compatibility is required before production. Campaign launch should fail or block submission when the creator does not have a usable static MLS / permanent maxaddress.

### 3. Keep `CREATOR_ADDRESS` as the creator identity

Do not replace `CAMPAIGNS.CREATOR_ADDRESS`.

It must remain the Maxima public key and should be validated against the `MAX#` public key when a permanent route is present:

```text
CREATOR_ADDRESS == publickey part of MAX#<publickey>#<static_mls>
```

### 4. Use passive route refresh on every message

Every off-chain message should carry the sender's current route:

```json
{
  "sender_pk": "0x...",
  "sender_route": "MAX#0x...#Mx...@host:port or Mx...",
  "sender_mx": "Mx... optional current direct reply route"
}
```

On receive, handlers should update local route caches after validating the sender identity.

Suggested caches:

```text
CREATOR_ROUTE_<campaignId>
PEER_ROUTE_<campaignId>_<ROLE>_<peerKey>
```

Legacy caches such as `CREATOR_MX_<campaignId>` should be replaced before production by route caches.

### 5. Add explicit viewer/publisher route updates

When a viewer or publisher detects that its route changed, it should proactively notify creators for all local open/pending channels:

```json
{
  "type": "PEER_ROUTE_UPDATE",
  "campaign_id": "...",
  "role": "viewer",
  "viewer_key": "0x...",
  "viewer_route": "MAX#... or Mx...",
  "viewer_mx": "Mx...",
  "updated_at": 1234567890
}
```

Creator-side validation:

- `campaign_id` exists.
- `(campaign_id, viewer_key, role)` identifies a channel row.
- Maxima sender public key (`msg.data.from`) matches the expected viewer/publisher identity where available.
- Route value is syntactically acceptable (`Mx...` or `MAX#...`).

If valid, update the route cache for that channel. This avoids publishing viewer routes on-chain and avoids requiring viewers to have static MLS, while still recovering most route changes.

### 6. Creator route refresh transaction remains optional

If a creator ever needs to rotate the permanent route itself, it can refresh the route by spending the escrow coin and creating a new escrow/change coin with the same state except `STATE(4)=new_route`.

This must be treated as a real on-chain transaction, not a metadata mutation.

Risks:

- competes with channel-open/status/refund transactions because they all spend the current escrow coin;
- requires pending approval if write protection is enabled;
- must be serialized with the existing escrow spend queue.

Using `MAX#...` in `PREVSTATE(4)` is the required design for campaign discovery. Route-refresh transactions should be rare and reserved for static MLS changes, not ordinary Mx address changes.

## Send Strategy

The send helper should eventually support this order:

1. Try `publickey:<pk>` when a stable public key is known.
2. If that fails or no contact exists, try cached permanent route (`MAX#...`).
3. For viewer/publisher replies only, try cached direct route (`Mx...`) when no permanent route is available.
4. If route fails, attempt discovery:
   - resolve `PREVSTATE(4)` route;
   - send directly with `to:<MAX#...>` or call `maxextra action:getaddress`.

All MinimaAds Maxima sends should remain `poll:false` except documented exceptions such as `sendall`.

## Channel Safety

Route loss does not by itself lose funds.

- A viewer/publisher with a valid latest `REWARD_VOUCHER` can settle on-chain.
- Channel scripts depend on wallet signing keys, not Maxima routes.
- The creator cannot change an existing channel coin route because routes are not part of the channel security boundary.

Route loss can block:

- new reward requests;
- voucher re-send/sync;
- channel-open notifications;
- liveness checks;
- UX refresh after reconnect.

Therefore route recovery is an availability requirement, not the trust boundary.

## Implementation Sketch

Suggested future task sequence:

1. Add helpers:
   - `getMyMaximaRoute(cb)` returns `MAX#pk#mls` when `maxima action:info` reports `staticmls=true` and `mls`, else direct contact address.
   - `parseMaximaRoute(route)` validates `Mx...` and `MAX#...`.
   - `sendMaximaRoute(publicKey, route, payload, cb)` with publickey then `to:<route>` fallback.
2. Extend campaign creation:
   - put creator route in escrow port 4;
   - require `MAX#<creator_pk>#<static_mls>` before allowing campaign launch.
3. Update discovery:
   - read port 4 as `creator_route`;
   - store `CREATOR_ROUTE_<campaignId>`;
   - use `to:<route>` for `REQUEST_CAMPAIGN_DATA`.
4. Extend channel payloads:
   - include `viewer_route` / `publisher_route` in open, reward, sync, and liveness messages;
   - include direct `viewer_mx` / `publisher_mx` only as short-lived reply-route hints if needed.
5. Add `PEER_ROUTE_UPDATE` Maxima message and handler.
6. On service init or Maxima info refresh:
   - detect local route changes;
   - notify creators for local open/pending viewer and publisher channels.
7. Update docs/spec:
   - rename `PREVSTATE(4)` meaning to creator route hint;
   - add `MAX#...` permanent address support to protocol schemas;
   - document fallback behavior and route cache keys.

## Open Questions

- How reliably does `maxima action:info` expose `staticmls` and `mls` in all target Minima versions?
- Does `maxima action:send to:MAX#...` work from MDS in the same way as terminal command execution in all supported versions?
- What UI/setup flow should help creators configure static MLS before launching campaigns?
- Should route update messages be rate-limited to prevent route-spam if the node repeatedly reports contact changes?
- Which channel rows should receive proactive route updates: `open`, `pending`, or also recently `settled` rows for history/sync?
