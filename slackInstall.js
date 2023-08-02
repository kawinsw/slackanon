const axios = require('axios');
const querystring = require('querystring');
const { handleError } = require('./general.js');
const { SLACK_API_URL, NO_CHANNEL_SELECTED, checkResponseOk } = require('./slackUtils');
const { NO_RECORD_FOUND_ERROR, getDatabase } = require('./database.js')

const OAUTH_PATH = 'oauth.v2.access';
const SLACK_BASE_URL = 'https://slack.com';
const SLACK_INSTALL_PATH = '/oauth/v2/authorize'
const SLACK_APP_REDIRECT_PATH = '/app_redirect';
const SLACK_CLIENT_ID = '1155829365089.1910353167828';
const SLACK_APP_ID = 'A01SSAD4XQC';

const db = getDatabase();

const SLACK_SCOPES = [
  'chat:write', 'chat:write.public', 
  'commands', 'channels:read', 'users:read'
];
const SLACK_INSTALL_URL = SLACK_BASE_URL + SLACK_INSTALL_PATH + '?' + querystring.stringify({
  client_id: SLACK_CLIENT_ID,
  scope: SLACK_SCOPES.join(','),
  user_scope: ''
});

const redirectInstall = function (res) {
  res.redirect(SLACK_INSTALL_URL);
};

const redirectInstallSuccess = function (res, teamId) {
  res.redirect(
    SLACK_BASE_URL + SLACK_APP_REDIRECT_PATH + '?' + querystring.stringify({
      app: SLACK_APP_ID,
      team: teamId
    })
  );
  // res.send('Successfully installed Anonymous Forum');
};

const slackOAuth = function (req, res) {
  const creds = querystring.stringify({
    client_id: SLACK_CLIENT_ID,
    client_secret: process.env.SLACK_CLIENT_SECRET,
    code: req.query.code
  });

  const redirectInstallFailed = function (err) {
    res.redirect(SLACK_INSTALL_URL);
    // res.send('Problem authenticating with Slack. Please try again.');
    handleError(err);
  };

  axios.post(SLACK_API_URL + OAUTH_PATH, creds, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }).then(checkResponseOk).then(function (response) {
    const data = response.data;
    const teamId = data.team.id;
    const slackToken = data.access_token;

    // verify obtained all permissions
    const allowedScopes = new Set(data.scope.split(','));
    if (!SLACK_SCOPES.every((scope) => allowedScopes.has(scope))){
      redirectInstall(res);
      return;
    }
    
    db.getWorkspace(teamId).then(function (workspaceRecord) {
      // update existing record in db
      workspaceRecord.updateSlackToken(slackToken).then(function (updatedRecord) {
        if (updatedRecord.getSlackToken() === slackToken) {
          redirectInstallSuccess(res, teamId);
        } else {
          console.log(updatedRecord.getAll());
          throw 'token mismatch after update';
        }
      }).catch(redirectInstallFailed);
    }).catch(function (err) {
      if (err === NO_RECORD_FOUND_ERROR) {
        // create new record in db
        db.addWorkspace(teamId, slackToken, NO_CHANNEL_SELECTED).then(function (record) {
          if (
            record.getTeamId() === teamId
            && record.getSlackToken() === slackToken
            && record.getChannelId() === NO_CHANNEL_SELECTED
          ) {
            redirectInstallSuccess(res, teamId);
          } else {
            console.log(record.getAll());
            throw 'record mismatch after creation';
          }
        }).catch(redirectInstallFailed);
      } else {
        return redirectInstallFailed(err);
      }
    });
  }).catch(redirectInstallFailed);
};

exports.redirectInstall = redirectInstall;
exports.slackOAuth = slackOAuth;
