# Steam App ID Finder

![Steam Banner](./images/SteamAppIdFinderBanner.png)

Do you have a list of game names and want to know which Steam App ID's they correspond to?
This utility is able to find the Steam App ID's for any number of provided game names, even if the provided name is not an exact match to the game in the Steam database.

## Setup

Run `npm install` to install the required dependencies first.

Following this, create a `config.json` file in the root directory of the project and fill it with your desired [configuration](#configuration).
Use the `config.default.json` file as a template if you wish.

## Usage

After providing the `config.json` [configuration](#configuration) file and the file with your games' names is ready, you can run the script using

```bash
node index.js
```

The script will then find the Steam App ID's for all provided game names, starting with those that have an exact match in the Steam database.
If no exact match is found, the script will match the resulting game names to the Steam App ID of the game with the highest similarity score.

Note that the script will *always* find a match, even if the provided game name is not on Steam.
You can correct the number of false positives this may produce by providing a `partialMatchThreshold` in the [configuration](#configuration) file.
Through testing, I found that a similarity score of 0.65 finds almost all correct matches (i.e. games with a lower score are probably not on Steam) without too much clutter, but you can adjust this depending on your list of games.

## Results

You will find the resulting data in the created `output` folder.

For games with a single full match, the results will be saved in a file called `steamAppIds_fullMatches.json`, with the games' names as keys and their corresponding Steam App ID's as values.

For games with multiple full matches, the results will be saved in a file called `steamAppIds_multipleFullMatches.json`, with the games' names as keys and an array of the corresponding Steam App ID's as values.
You can use tools such as [steamDB](https://steamdb.info/) to find out which of the found Steam App ID's is the correct one for your game.

For partial matches, the results will be saved in a file called `steamAppIds_partialMatches.json`, with the games' names as keys and the name and Steam App ID of the most similar game name as well as the similarity score as value.

Games for which no satisfying match was found (due to the similarity score being below the `partialMatchThreshold`) will be saved in a file called `steamAppIds_noMatch.json` for your convenience.

### Examples

```json
{
  "Fallout Tactics: Brotherhood of Steel": {
    "appId": 38420,
    "similarity": 0.5777777777777777,
    "steamName": "Fallout Tactics"
  },
}
```

In this case, the matched game was correct, but this is not always the case:

```json
{
  "DEATH STRANDING": {
    "appId": 1507790,
    "similarity": 0.6666666666666666,
    "steamName": "Witch Strandings"
  },
}
```

Such a mismatch can have a number of reasons, in the case of `DEATH STRANDING` it is that Steam only has the `DEATH STRANDING DIRECTOR'S CUT` in its database, but not the original game, which leads to `Witch Strandings` being the closest match.

**For this reason, you should always verify that the Steam App ID's for these partial matches are correct, which may require manual cleaning of the data.**

### Matches with a similarity score of `1`

It is possible for a game to have a match with a similarity score of 1.
This can happen as the search for full matches is case sensitive, but the search for partial matches is not, meaning that the following two game names would not be considered a full match, but their similarity score would be `1`:

- `My Time at Portia`
- `My Time At Portia`

## Configuration

### Schema validation

The project provides a JSON validation schema for the required configuration file, which allows you to tell the script how your input data is formatted as well as some other properties.

The schema can be found in the `config.schema.json` file and used within your `config.json` by adding the following property:

```json
"$schema": "config.schema.json"
```

*NOTE: The script will test your provided `config.json` against this schema, so make sure your configuration is valid.*

### Properties

The following is a list of all configuration items, their defaults and the values they can take.

If a given property is not present in the configuration file, it will automatically be assumed to have a value of `false` (or equivalent, depending on the property type).

<details>
<summary><code>inputFile</code></summary>

The file to read the game names from.

| Type | Default value | Possible values | Required |
| --- | --- | --- | --- |
| `object` | See item below | See sections below | Yes |

```json
"inputFile": {
  "fileName": "gameNames",
  "fileType": "txt",
  "delimiter": ","
}
```

<h3>Possible values</h3>

<h4><code>fileName</code></h4>

The name of the file to read the game names from.

Note: Do *not* provide the file's type/extension here.

| Type | Default value | Possible values | Required |
| --- | --- | --- | --- |
| `string` | `gameNames` | Any valid file name | Yes |

<h4><code>fileType</code></h4>

The file type of the input file. Choose from any of the supported file types listed.

| Type | Default value | Possible values | Required |
| --- | --- | --- | --- |
| `string` | `txt` | `txt`, `csv` | Yes |

<h4><code>delimiter</code></h4>

The delimiter to use when parsing the input file.

| Type | Default value | Possible values | Required |
| --- | --- | --- | --- |
| `string` | `,` | Any valid delimiter | Yes, if the file type requires it. (true for all currently supported file types) |
</details>


<details>
<summary><code>onlyFullMatches</code></summary>

Whether to only get Steam App ID's for full matches or also for partial matches. If set to false, partial matches will be saved to a different output file.

| Type | Default value | Possible values | Required |
| --- | --- | --- | --- |
| `boolean` | `false` | `true`, `false` | No |
</details>

<details>
<summary><code>partialMatchThreshold</code></summary>

The threshold for partial matches.
This means that the most similar game name must have a similarity score of at least this threshold to be added to the output.
The threshold must be between 0 and 1.
Use 0 to get a match for every game and 1 to only get full matches.
If the value is omitted, a match will be found for every game.

| Type | Default value | Possible values | Required |
| --- | --- | --- | --- |
| `number` | `0.8` | Number between `0` and `1` | No |
</details>

## Related projects

Wondering what to do with the Steam App ID's you just found? You could try organizing all of your Steam games in Notion using the [Notion Steam API integration](https://github.com/NikkelM/Notion-Steam-API-Integration).

Would you like to know what games are currently available on Game Pass for your platform? Check out the [Game Pass API](https://github.com/NikkelM/Game-Pass-API) project.

## Feedback

If you have any question, feedback or feature requests, feel free to open an [issue](https://github.com/NikkelM/Steam-App-ID-Finder/issues/new).