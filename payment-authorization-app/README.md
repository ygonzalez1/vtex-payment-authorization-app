# Paguelofacil 3DS Payment App (VTEX IO)

VTEX Payment App that hosts the **3DS2 challenge iframe** for Paguelofacil card payments. Adapted from
[vtex-apps/example-payment-authorization-app](https://github.com/vtex-apps/example-payment-authorization-app).

**App identifier:** `vtexpaguelofacil.three-ds-app` (`vendor` + `name` in `manifest.json`)

This app is **WP-2** of the VTEX 3DS integration. The middle connector (`paguelofacil-integrator`, WP-1) returns
`paymentAppData` with `url3DSRef`; this app renders the challenge iframe and closes checkout when the challenge
completes.

## Contract with the integrator

When PF Core requires 3DS, the VTEX connector responds:

```json
{
  "status": "undefined",
  "paymentAppData": {
    "appName": "vtexpaguelofacil.three-ds-app",
    "payload": "{\"url3DSRef\":\"https://...\"}"
  }
}
```

| Field | Usage in this app |
|-------|-------------------|
| `appPayload` (prop) | Serialized JSON string; parse and read `url3DSRef` |
| `url3DSRef` | Loaded as `iframe` `src` for the 3DS challenge |

Configure the integrator with `vtex.payment.app.name=vtexpaguelofacil.three-ds-app` (Spring Cloud Config).

## Checkout closure mechanism

After the ACS challenge, PF Core redirects the browser to the middle return endpoint
(`GET /vtex/api/v1/payment-provider/3ds/return/{token}?codOper=...`). That page:

1. Validates the `codOper` against the ESB and Mongo transaction.
2. Serves a static HTML page that sends `postMessage({ type: 'transactionValidation.vtex', dispatch: true }, '*')`
   to the parent frame.

This app listens for that `postMessage` (origin-checked against `https://vtex.paguelofacil.com`) and fires the
same-origin VTEX event:

```javascript
window.$(window).trigger('transactionValidation.vtex', [status])
```

VTEX Checkout receives the event, re-queries the Gateway for the final payment status, and redirects to
*Order Placed* (approved) or shows a decline prompt.

The `status` boolean passed to the trigger reflects `e.data.dispatch`:
- `true` (or absent) -- challenge finished; Gateway decides approve/deny from its own state.
- `false` -- middle validation failed; checkout unblocks with a decline signal.

## What this app does NOT do

- Does **not** call approve/deny URLs or authorize/capture payments
- Does **not** interpret 3DS challenge outcome directly (Gateway re-queries the connector)

## Development

### Prerequisites

- [VTEX Toolbelt](https://developers.vtex.com/docs/guides/vtex-io-documentation-vtex-io-cli-installation-and-command-reference)
- Access to a VTEX account with Paguelofacil payment provider configured

### Link locally

```shell
vtex login {account}
vtex use {workspace}
cd example-payment-authorization-app
vtex link
```

### Workspace checkout test

Open checkout in the workspace and set the Payment App name (if required by your test setup):

```javascript
window.transactionAppName = 'three-ds-app'
```

For E2E 3DS testing you need WP-1 deployed and a card that triggers `url3DSRef` from PF Core.

## Deploy

1. Bump `version` in `manifest.json`
2. Publish:

```shell
vtex publish
vtex install vtexpaguelofacil.three-ds-app@{version} -w master
```

3. Register the app in VTEX Gateway / payment provider settings so `appName` matches `vtexpaguelofacil.three-ds-app`

## File map

| File | Purpose |
|------|---------|
| `manifest.json` | `vendor`: `vtexpaguelofacil`, `name`: `three-ds-app` |
| `pages/pages.json` | Extension `checkout/transactions/three-ds-app` |
| `react/index.tsx` | Parse `appPayload`, render 3DS iframe, relay `postMessage` to VTEX event |

## Reference

- Design: `paguelofacil-integrator/docs/tasks/vtex-3ds.md` (WP-2)
- [VTEX Payment App guide](https://developers.vtex.com/docs/guides/payments-integration-payment-app)
