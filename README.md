# Steam App ID Finder

![Steam Banner](./images/SteamAppIdFinderBanner.png)

[![npm version](https://img.shields.io/npm/v/steam-app-id-finder)](https://www.npmjs.com/package/steam-app-id-finder)
[![Tests](https://github.com/NikkelM/Steam-App-ID-Finder/actions/workflows/test.yml/badge.svg)](https://github.com/NikkelM/Steam-App-ID-Finder/actions/workflows/test.yml)
<!-- [![npm downloads](https://img.shields.io/npm/dt/steam-app-id-finder)](https://www.npmjs.com/package/steam-app-id-finder) -->

Find Steam App IDs from game names or a Steam account, and export owned-game lists from GOG and Epic Games accounts.

## Table of contents

- [Installation](#installation)
- [Usage](#usage)
- [Output](#output)
- [Modes](#modes)
	- [Mode: `gameNames`](#mode-gamenames)
	- [Mode: `steamAccount`](#mode-steamaccount)
	- [Mode: `gogAccount`](#mode-gogaccount)
	- [Mode: `epicGamesAccount`](#mode-epicgamesaccount)
- [Security](#security)
- [Related projects](#related-projects)
- [Feedback](#feedback)

## Installation

Run it on demand without installing anything (requires [Node.js](https://nodejs.org) 22.13 or newer):

```bash
npx steam-app-id-finder <command> [options]
```

Or install it globally to get a persistent `steam-app-id-finder` command:

```bash
npm install -g steam-app-id-finder
```

## Usage

Each [mode](#modes) is a command.
There are three ways to provide a mode's options:

1. **Command-line flags** - the quickest way, documented for each mode below. For example:
   ```bash
   npx steam-app-id-finder gameNames --input games --steam-api-key <yourKey>
   ```
   Add `--save-config` to a flag-driven run to also write the assembled configuration to a `config.json` (or `--save-config <path>`), so you can reuse or edit it later. Credentials are never stored.
2. **The interactive wizard** - `steam-app-id-finder init` asks you a few questions, writes a `config.json`, and offers to run it right away. Running `steam-app-id-finder` with no arguments and no `config.json` present starts this wizard automatically. Pass `-o, --output <path>` to write the configuration file somewhere other than `config.json`.
3. **A configuration file** - `steam-app-id-finder run` (or just `steam-app-id-finder`) runs a `config.json` from the current directory (or pass `--config <path>`). This is handy for a setup you reuse often; the wizard can create the file for you, or you can write it by hand. Running a mode command with no flags (for example `steam-app-id-finder gameNames`) also falls back to this `config.json`, as long as its `mode` matches the command.

List every command and its flags with:

```bash
steam-app-id-finder --help
steam-app-id-finder <command> --help
```

Credentials are read from an environment variable (`STEAM_API_KEY`, `GOG_REFRESH_TOKEN` or `EPIC_COOKIE`), from the matching flag, or - if neither is set and the terminal is interactive - you are prompted for them when the command runs.
They are never written to your `config.json`.
See [Security](#security) for details.

> Configuration files are validated against a JSON schema (`config.schema.json`, shipped with the package).
If you keep a copy of the schema next to your `config.json`, add `"$schema": "config.schema.json"` to it and your editor will flag mistakes as you type.

## Output

Every mode writes its results to an `output/<mode>/` folder in the current working directory.
Use `-o, --out <dir>` (or the `outputDirectory` config key) to write to a different base directory instead of `output`; the `<mode>` subfolder is always created inside it.
See each mode's section for the exact files it produces.

## Modes

- [`gameNames`](#mode-gamenames): Do you have a list of game names and want to know which Steam App IDs they correspond to? This mode finds the Steam App IDs for any number of provided game names, even if a name is not an exact match to the game in the Steam database.
- [`steamAccount`](#mode-steamaccount): Fetch all apps (this includes games, but also e.g. soundtracks or movies) from a given Steam account and save them to a file. The account's game library must be public.
- [`gogAccount`](#mode-gogaccount): Get the names of all games in your GOG account. You can then feed this output into the [`gameNames`](#mode-gamenames) mode to find their Steam App IDs.
- [`epicGamesAccount`](#mode-epicgamesaccount): Get a list of all games you have ever purchased (excluding refunds) on the Epic Games Store, including the weekly free giveaways. You can then feed this output into the [`gameNames`](#mode-gamenames) mode to find their Steam App IDs.

## Mode: `gameNames`

> This mode requires a free Steam Web API key.
> Get one at [https://steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey).
> The tool runs locally and does not send your key anywhere; keep it secret.
> You can also supply it via the `STEAM_API_KEY` environment variable instead of `--steam-api-key`.

This mode finds the Steam App IDs for all game names in an input file, starting with those that have an exact match in the Steam database.
If no exact match is found, it matches the name to the Steam App ID of the game with the highest similarity score.

Note that the mode will *always* find a match, even if the provided game name is not on Steam.
Use `--threshold` to control false positives: a threshold of `0.65` finds almost all correct matches (games scoring lower are probably not on Steam) without too much clutter.

### Usage

```bash
steam-app-id-finder gameNames --input <fileName> --steam-api-key <yourKey> [options]
```

The input is a plain-text or CSV file of game names in the current directory.
For example, with a `games.txt` next to you:

```bash
steam-app-id-finder gameNames --input games --steam-api-key <yourKey> --threshold 0.7
```

### Options

| Flag | Config key | Description | Required |
| --- | --- | --- | --- |
| `-i, --input <name>` | `inputFile.fileName` | Input file name, without the extension. | Yes |
| `-k, --steam-api-key <key>` | `steamAPIKey` | Your Steam Web API key (or the `STEAM_API_KEY` env var). | Yes |
| `-t, --type <type>` | `inputFile.fileType` | Input file type: `txt` or `csv`. Default `txt`. | No |
| `-d, --delimiter <char>` | `inputFile.delimiter` | Delimiter between game names. Defaults to a newline for `txt` and a comma for `csv`. | No |
| `--only-full-matches` | `onlyFullMatches` | Only output full matches; skip partial matches. Default `false`. | No |
| `--threshold <number>` | `partialMatchThreshold` | Minimum similarity (`0`-`1`) for a partial match. `0` matches everything, `1` only full (case-insensitive) matches. Default `0.65`. | No |
| `--refresh-cache` | `refreshCache` | Refetch the Steam app list even if a fresh cache exists. | No |
| `--cache-hours <number>` | `appListCacheHours` | How long the cached Steam app list stays fresh, in hours. `0` disables caching. Default `24`. | No |
| `-o, --out <dir>` | `outputDirectory` | Base directory for output files. Default `output`. | No |
| `--save-config [path]` | - | Also write the assembled configuration to a file for reuse. Default `config.json`. | No |

> The full Steam app list is large and slow to download, so it is cached in your system's temp directory and reused for up to `appListCacheHours` (24 by default).
> Pass `--refresh-cache` to refetch it, or set the duration to `0` to disable caching.

### Output

You will find the resulting data in the created `output/gameNames` folder.

For games with a single full match, the results are saved in `steamAppIds_fullMatches.json`, with the games' names as keys and their corresponding Steam App IDs as values.

For games with multiple full matches, the results are saved in `steamAppIds_multipleFullMatches.json`, with the games' names as keys and an array of the corresponding Steam App IDs as values.
You can use tools such as [steamDB](https://steamdb.info/) to find out which App ID is the correct one.

For partial matches, the results are saved in `steamAppIds_bestMatch.json`, with the games' names as keys and the name, Steam App ID and similarity score of the most similar game as the value.

Games for which no satisfying match was found (similarity below `--threshold`) are saved in `steamAppIds_noMatch.json`.

Some examples of the output format for a partial match:

```json
{
  "Fallout Tactics: Brotherhood of Steel": {
    "appId": 38420,
    "similarity": 0.5777777777777777,
    "steamName": "Fallout Tactics"
  },
}
```

In this case the matched game was correct, but this is not always the case:

```json
{
  "Control": {
    "appId": 508460,
    "similarity": 0.8,
    "steamName": "MAXCONTROL"
  },
}
```

Such a mismatch can have a number of reasons; in the case of `Control` it is that Steam does not list the base `Control` game (only `Control Ultimate Edition`), so no full match is found.
The short search term then ends up more similar to unrelated games such as `MAXCONTROL` (similarity `0.8`) than to the actual `Control Ultimate Edition` (which only scores `0.44`), leading to the wrong game being matched.

These examples also show well how a higher similarity score does not necessarily mean a better match.

#### Matches with a similarity score of 1

It is possible for a game to have a partial match with a similarity score of 1.
This can happen because the search for full matches is case-sensitive, while the search for partial matches is not, meaning the following two game names would *not* be considered a full match, but their similarity score would be 1:

- `My Time at Portia`
- `My Time At Portia`

## Mode: `steamAccount`

> This mode requires a free Steam Web API key.
> Get one at [https://steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey).
> The tool runs locally and does not send your key anywhere; keep it secret.
> You can also supply it via the `STEAM_API_KEY` environment variable instead of `--steam-api-key`.

This mode fetches all apps (this includes games, but also e.g. soundtracks or movies) from a given Steam account and saves them to a file.
The account's game library must be public if it is not your own, otherwise the tool cannot access it.
You can check whether a library is public by opening [https://steamcommunity.com/id/accountName/games](https://steamcommunity.com/id/accountName/games) in a private browsing session.

### Usage

```bash
steam-app-id-finder steamAccount --steam-id <steamID64> --steam-api-key <yourKey> [--props <list>]
```

### Options

| Flag | Config key | Description | Required |
| --- | --- | --- | --- |
| `-s, --steam-id <id>` | `steamId` | The account's SteamID64 (17-digit number). Find it under your account name at [store.steampowered.com/account](https://store.steampowered.com/account/), in a profile URL (`.../profiles/<id>/`), or via [steamid.io](https://steamid.io). | Yes |
| `-k, --steam-api-key <key>` | `steamAPIKey` | Your Steam Web API key (or the `STEAM_API_KEY` env var). | Yes |
| `-p, --props <list>` | `outputProperties` | Comma-separated list of properties to include. Default `appID,name`. | No |
| `-o, --out <dir>` | `outputDirectory` | Base directory for output files. Default `output`. | No |
| `--save-config [path]` | - | Also write the assembled configuration to a file for reuse. Default `config.json`. | No |

The available `--props` values are: `appID` (the game's App ID), `name` (its name), `logo` (URL to the logo), `storeLink` (URL to the store page), `statsLink` (URL to this user's stats page for the game), and `globalStatsLink` (URL to the global stats page).
Properties that are not available for an app are omitted from the output.

### Output

You will find the resulting data in the created `output/steamAccount` folder, in a file named after the account's Steam ID.

## Mode: `gogAccount`

Get the names of all games in your GOG account.
You can then feed the output into the [`gameNames`](#mode-gamenames) mode to find their Steam App IDs.

Because of limitations of the GOG API, this mode needs a one-time login to obtain an access token.

### Getting a login code

1. Open the official [GOG login page](https://auth.gog.com/auth?client_id=46899977096215655&redirect_uri=https%3A%2F%2Fembed.gog.com%2Fon_login_success%3Forigin%3Dclient&response_type=code&layout=client2) and log in.
2. You will be redirected to a blank page with a URL like `https://embed.gog.com/on_login_success?origin=client&code=1234567890abcdef`.
3. Copy the value of the `code` parameter.

### Usage

Run the mode with the login code **immediately** - it is only valid for about 60 seconds:

```bash
steam-app-id-finder gogAccount --gog-login-code <code>
```

On success, the tool prints your long-lived GOG refresh token. Set it as the `GOG_REFRESH_TOKEN` environment variable, or pass it with `--refresh-token`, to skip the login step on future runs:

```bash
steam-app-id-finder gogAccount --refresh-token <token>
```

### Options

| Flag | Config key | Description | Required |
| --- | --- | --- | --- |
| `--gog-login-code <code>` | `gogLoginCode` | A fresh GOG login code (valid ~60 seconds). Ignored if a refresh token is given. | One of the two |
| `-r, --refresh-token <token>` | `refreshToken` | A GOG refresh token from a previous run (or the `GOG_REFRESH_TOKEN` env var). | One of the two |
| `-o, --out <dir>` | `outputDirectory` | Base directory for output files. Default `output`. | No |
| `--save-config [path]` | - | Also write the assembled configuration to a file for reuse. Default `config.json`. | No |

### Output

The list of games is written to `output/gogAccount/gogGameNames.txt`. The refresh token is shown once in the console so you can set it as `GOG_REFRESH_TOKEN` for reuse.

The file is newline-separated, which is the default for `txt` input, so you can feed it straight into the [`gameNames`](#mode-gamenames) mode:

```bash
steam-app-id-finder gameNames --input output/gogAccount/gogGameNames --steam-api-key <yourKey>
```

## Mode: `epicGamesAccount`

> This mode reads your purchase history from Epic's account API (`accounts.epicgames.com`) using a browser cookie (see below).
> If Epic changes their access protection and the tool can no longer reach your account, use the [workaround](#workaround-if-the-tool-throws-an-error).

Get a list of all games you have ever purchased (excluding refunds) on the Epic Games Store, including the weekly free giveaways.
You can then feed the output into the [`gameNames`](#mode-gamenames) mode to find their Steam App IDs.

### Getting the cookie

Epic does not provide a public API for this, so you need to supply the value of your `EPIC_BEARER_TOKEN` cookie:

1. Open [https://accounts.epicgames.com/account/transactions/purchases](https://accounts.epicgames.com/account/transactions/purchases) in your browser, logging in if necessary.
2. Open your browser's developer tools (usually `F12` or `Ctrl+Shift+I`) and go to the `Application` tab (Chrome/Edge) or the `Storage` tab (Firefox).
3. Expand `Cookies`, select `https://accounts.epicgames.com`, and find the `EPIC_BEARER_TOKEN` cookie. It is valid for about 8 hours, after which you repeat these steps.
4. Copy the `Value` of that cookie. The tool runs locally and does not send your cookie anywhere; keep it secret.

### Usage

Pass the cookie's **value** through `--epic-cookie` (you can also use the `EPIC_COOKIE` environment variable):

```bash
steam-app-id-finder epicGamesAccount --epic-cookie <yourCopiedCookieValue>
```

The number of games may be shorter than your library, as items such as beta branches and DLCs are sometimes not included in the purchase history.

### Options

| Flag | Config key | Description | Required |
| --- | --- | --- | --- |
| `-e, --epic-cookie <value>` | `epicGamesCookie` | The value of your `EPIC_BEARER_TOKEN` cookie (or the `EPIC_COOKIE` env var). | Yes |
| `-o, --out <dir>` | `outputDirectory` | Base directory for output files. Default `output`. | No |
| `--save-config [path]` | - | Also write the assembled configuration to a file for reuse. Default `config.json`. | No |

### Output

The list of games is written to `output/epicGamesAccount/epicGamesGameNames.txt`.
It is newline-separated, which is the default for `txt` input, so you can feed it straight into the [`gameNames`](#mode-gamenames) mode:

```bash
steam-app-id-finder gameNames --input output/epicGamesAccount/epicGamesGameNames --steam-api-key <yourKey>
```

### Workaround if the tool throws an error

If the tool throws an error when trying to fetch games from your Epic Games account, it is possible that its access is being blocked by an additional security check run by Epic Games.
As a workaround, you can fetch the list manually from your browser:

1. Log in to your account and go to [https://accounts.epicgames.com/account/transactions/purchases](https://accounts.epicgames.com/account/transactions/purchases).
2. Open the developer console of your browser (usually by pressing `F12` or `Ctrl+Shift+I`).
3. Go to the `Console` tab. This is usually the default tab when opening the developer view.
4. Paste the following code snippet into the console and press `Enter`. This fetches the list of purchased games using the same method as the tool.

```javascript
const fetchGamesList = async (pageToken = '', existingList = []) => { 
  const data = await (await fetch(`https://accounts.epicgames.com/account/v2/payment/ajaxGetOrderHistory?sortDir=DESC&sortBy=DATE&nextPageToken=${pageToken}&locale=en-US`)).json(); 
  const gamesList = data.orders.reduce((acc, value) => [...acc, ...value.items.map(v => v.description)], []);
  console.log(`Games on this page: ${gamesList.length}, Next page starts from date: ${data.nextPageToken}`);
  const newList = [...existingList, ...gamesList];
  if (!data.nextPageToken) return newList; 
  return await fetchGamesList(data.nextPageToken, newList);
}
fetchGamesList().then(console.log);
```

5. The console will output the list of games you have purchased on the Epic Games Store.
6. Right-click on the output (the list of game names) and select `Copy object`.
7. Create a new text (`.txt`) file (e.g. through Notepad), paste the copied object into the file and save it.

You can now use the saved file as input for the [`gameNames`](#mode-gamenames) mode.
Due to the formatting of the copied output, set `--delimiter` to `\",\r\n    \"` for the best results, and remove the leading `[` and trailing `]` from the file first.

## Security

Your Steam, GOG and Epic credentials are secrets, so this tool never writes them to disk.

- They are read from an environment variable (`STEAM_API_KEY`, `GOG_REFRESH_TOKEN` or `EPIC_COOKIE`), from the matching flag, or you are prompted for them interactively when a command runs.
- They are never written to `config.json` or any other file, and are never logged.
- For backwards compatibility the schema still allows the credential fields, but if a credential is found in `config.json` the tool refuses to run and asks you to move it to the matching environment variable instead.
- The GOG refresh token obtained by `gogAccount` mode is displayed once in the console and is not saved to any file.

Provide a credential inline for a single run, for example `STEAM_API_KEY=xxxx steam-app-id-finder run`, or export it in your shell profile.
Grant API keys only the access they need, and rotate them if they may have been exposed.

## Related projects

Wondering what to do with the Steam App IDs you just found?
You could try organizing all of your Steam games in Notion using the [Notion Steam API integration](https://github.com/NikkelM/Notion-Steam-API-Integration).

Would you like to know what games are currently available on Game Pass for your platform?
Check out the [Game Pass API](https://github.com/NikkelM/Game-Pass-API) project.

## Feedback

If you have any question, feedback or feature requests, feel free to open an [issue](https://github.com/NikkelM/Steam-App-ID-Finder/issues/new).
