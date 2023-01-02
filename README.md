# Game name to Steam App Id

Do you have a list of game names and want to know which Steam App ID's they correspond to? Then this is the utility for you!

## Setup

Run `npm install` to install the required dependencies first.

Following this, create a `config.json` file in the root directory of the project and fill it with your desired [configuration](#configuration).

## Usage

After providing the `config.json` [configuration](#configuration) file and the file with your games' names, you can run the script using

```bash
node index.js
```

The script will then find the Steam App ID's for all provided game names, starting with those that have an exact match in the Steam database.
If no exact match is found, the script will match the resulting game names to the Steam App ID' of the game with the highest similarity score.

Note that the script will *always* find a match, even if the provided game name is not a (Steam) game to begin with.

### Results

You will find the resulting data in the created `output` folder.

For full matches, the results will be saved in a file called `steamAppIds_fullMatches.json`, with the games' names as keys and their corresponding Steam App ID's as values.

For partial matches, the results will be saved in a file called `steamAppIds_partialMatches.json`, with the games' names as keys and the name and Steam App ID of the most similar game name as well as the similarity score as value.
Find some examples below:

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

## Configuration

### Schema validation

The project provides a JSON validation schema for the required configuration file, which allows you to tell the script how your input data is formatted as well as some other properties.

The schema can be found in the `config.schema.json` file and used within your `config.json` by adding the following property:

```json
"$schema": "./config.schema.json"
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
| `string` | `,` | Any valid delimiter | Yes, if the file type requires it |
</details>


<details>
<summary><code>onlyFullMatches</code></summary>

Whether to only get Steam App ID's for full matches or also for partial matches. If set to false, partial matches will be saved to a different output file.

| Type | Default value | Possible values | Required |
| --- | --- | --- | --- |
| `boolean` | `false` | `true`, `false` | No |
</details>