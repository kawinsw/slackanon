# Anonymous Forum
Slack app allowing workspace admins to configure a channel where users can anonymously ask for advice, submit feedback and post messages, including in-thread responses.

## Data storage

Usage requires implementation of a `database.js` module that exposes `getDatabase()` and `NO_RECORD_FOUND_ERROR`.

`getDatabase()` should return an object with the following methods:
- `getWorkspace(teamId)`
- `addWorkspace(teamId, slackToken, channelId)`

Each of the above methods should return a `Promise` containing an object representing a record of a Slack workspace. It should satisfy an interface (which we will arbitrarily refer to as `WorkspaceRecord`) with the following methods:
- `getTeamId(): string`
- `getSlackToken(): string`
- `getChannelId(): string`
- `getAll()` - returns all fields as an object, only used for debugging
- `updateSlackToken(newSlackToken: string): Promise<WorkspaceRecord>`
- `updateChannelId(newChannelId: string): Promise<WorkspaceRecord>`

`getWorkspace(teamId)` should throw a `NO_RECORD_FOUND_ERROR` when the given `teamId` is not found in the database.

## Environment variables

### Required Slack credentials
The following environment variables are required. They are credentials for accessing the Slack API and are obtained after creating a Slack App.
- `SLACK_SIGNING_SECRET`
- `SLACK_CLIENT_SECRET`

### Other settings (optional)
The `PORT` environment variable can be used to set the port on which the server will listen. If not set, defaults to port 3000.
