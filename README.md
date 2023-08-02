# Anonymous Forum
Slack app allowing workspace admins to configure a channel where users can anonymously ask for advice, submit feedback and post messages, including in-thread responses.

Usage requires a `database.js` module that provides `getDatabase()` and `NO_RECORD_FOUND_ERROR`.

`getDatabase()` should return an object with the following methods:
- `getWorkspace(teamId)`
- `addWorkspace(teamId, slackToken, channelId)`
