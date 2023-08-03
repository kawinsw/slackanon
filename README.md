# Anonymous Forum
Slack app allowing workspace admins to configure a channel where users can anonymously ask for advice, submit feedback and post messages, including in-thread responses.

Usage requires a `database.js` module that exposes `getDatabase()` and `NO_RECORD_FOUND_ERROR`.

`getDatabase()` should return an object with the following methods:
- `getWorkspace(teamId)`
- `addWorkspace(teamId, slackToken, channelId)`

Each of the above methods should return a `Promise` containing an object representing a record of a Slack workspace, with the following methods:
- `getAll()` - returns all fields
- `getTeamId()`
- `getSlackToken()`
- `getChannelId()`

`getWorkspace(teamId)` should throw a `NO_RECORD_FOUND_ERROR` when the given `teamId` is not found in the database.
