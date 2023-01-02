# Game name to Steam App Id

This provides a utility that attempts to find Steam App Id's for a list of generic game names.

To do this, first a list of all `App Id` <-> `Game name` mappings is fetched from the Steam API.
Then, for each user-provided game name the script first attempts to find an exact match, which indicates with very high probability that the searched for game was found.
Such exact matches are written to a file called `steamAppIds_fullMatch.json`.

Additionally, the script matches all games without an exact match (in the previous step) to the most similar game name in the list of Steam games.
This is not always correct, but it is a good enough approximation that only requires some manual clean-up afterwards.

Note that the script will *always* find a match, even if the provided game name is not a (Steam) game to begin with.
