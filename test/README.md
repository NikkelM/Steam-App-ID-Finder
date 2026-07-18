# Tests

Offline unit tests plus integration tests that verify the upstream Steam/GOG/Epic endpoints are still alive and run each mode end to end against real credentials.

## Files

| File | What it covers |
| --- | --- |
| `cli.test.mjs` | The CLI command wrappers and config-loading guards (version, help, missing/malformed/unknown-key config, BOM), run as subprocesses |
| `cliConfig.test.mjs` | The flag -> config builders, the config-field help text, and `saveConfigToFile` |
| `validation.test.mjs` | Schema accept/reject cases across the four per-mode schemas |
| `secrets.test.mjs` | Runtime secret resolution (flag/env/config precedence) and the per-mode wiring |
| `format.test.mjs` | The game-name matching helpers (exact-match classification and similarity ranking) |
| `modes.test.mjs` | Endpoint liveness (no credentials) and the credential-gated live smoke tests |

The offline files (`cli`, `cliConfig`, `validation`, `secrets`, `format`) need no network and always run. `modes.test.mjs` is described below.

## Running

```bash
npm test
```

- **Endpoint-liveness** tests need no credentials and always run.
- **Per-mode** tests run only when their credential is set, otherwise they skip. A credential that is set but expired/invalid also skips (it does not fail the run).

## Credentials

Set as CI **secrets** (repo -> Settings -> Secrets and variables -> Actions), or as env vars for local runs.

| Env var | Mode(s) | CI type | Notes |
| --- | --- | --- | --- |
| `STEAM_API_KEY` | `gameNames`, `steamAccount` | secret | A [Steam Web API key](https://steamcommunity.com/dev/apikey) |
| `GOG_REFRESH_TOKEN` | `gogAccount` | secret | See below |
| `EPIC_COOKIE` | `epicGamesAccount` | secret | The `EPIC_BEARER_TOKEN` cookie value (the `EPIC_BEARER_TOKEN=` prefix is optional); see below |
| `STEAM_TEST_STEAMID` | `steamAccount` | **variable** | A public SteamID64 whose library is public |

### Local run (PowerShell)

```powershell
$env:STEAM_API_KEY = "..."
$env:GOG_REFRESH_TOKEN = "..."
$env:EPIC_COOKIE = "..."
$env:STEAM_TEST_STEAMID = "7656119..."
npm test
```

## Getting a GOG refresh token

The CI needs a **refresh token**, not a login code - login codes are single-use and expire in 60 seconds, so they cannot be stored.

1. Open the [GOG login link](https://auth.gog.com/auth?client_id=46899977096215655&redirect_uri=https%3A%2F%2Fembed.gog.com%2Fon_login_success%3Forigin%3Dclient&response_type=code&layout=client2), log in, and copy the `code=` value from the blank redirect page's URL.
2. Within **60 seconds**, exchange it for a token (the `client_secret` is GOG's public Galaxy value):

```powershell
curl.exe -s "https://auth.gog.com/token" `
  --data-urlencode "client_id=46899977096215655" `
  --data-urlencode "client_secret=9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9" `
  --data-urlencode "grant_type=authorization_code" `
  --data-urlencode "code=YOUR_LOGIN_CODE" `
  --data-urlencode "redirect_uri=https://embed.gog.com/on_login_success?origin=client"
```

3. Copy the `refresh_token` from the JSON response (ignore `access_token`, it is short-lived). It is long-lived; regenerate if it ever stops working.

Alternatively, run the tool once with `gogLoginCode` set - it prints the refresh token to the console once so you can set it as `GOG_REFRESH_TOKEN`.

## Getting an Epic cookie

1. Open the [Epic order history](https://accounts.epicgames.com/account/transactions/purchases) page and log in.
2. Open DevTools (F12) -> **Application** -> **Cookies** -> `https://accounts.epicgames.com` -> copy the `EPIC_BEARER_TOKEN` value.
3. Set the secret to that value (the tool adds the `EPIC_BEARER_TOKEN=` prefix; including it yourself also works). The cookie is valid for ~**8 hours**, after which you repeat these steps.

> A cookie minted in your browser may be rejected from a CI runner's IP (the test then skips as expired). It is most reliable for local runs.
