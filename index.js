const express = require('express');

const { ack, handleError } = require('./general.js');
// const slackUtils = require('./slackUtils.js');
const postModal = require('./postModal.js');
const slackInstall = require('./slackInstall.js');
const slackAdmin = require('./slackAdmin.js');
const slackVerify = require('./slackVerify.js');

const SHOW_THREAD_MODAL_CALLBACK_ID = 'show_thread_modal';
const APP_HOME_OPENED_EVENT_NAME = 'app_home_opened';

const LISTENING_PORT = process.env.PORT || 3000;

// Initialize app
const app = express();
app.use(express.urlencoded({
  extended: false,
  // limit: 5000,
  verify: slackVerify
}));
app.use(express.json({ verify: slackVerify }));

// Install app
app.get('/install', function (req, res) {
  slackInstall.redirectInstall(res);
});
app.get('/oauth', slackInstall.slackOAuth);

// Display new post modal from slack command
app.post('/newpostmodal', function (req, res) {
  ack(res);
  postModal.serveNewPostModal(req.body);
});

// Interactivity catch-all
app.post('/interactivity', function (req, res) {
  let payload;
  try {
    payload = JSON.parse(req.body.payload);
  } catch (err) {
    console.log('Error parsing interactivity payload.');
    console.log(err);
    console.log(req.body);
    return;
  }

  // Message shortcut
  if (payload.type === 'message_action') {
    if (payload.callback_id === SHOW_THREAD_MODAL_CALLBACK_ID) {
      // Display thread modal
      ack(res);
      postModal.serveThreadModal(payload);
      return;
    }
  }
  
  // Submission from input block in a view
  if (payload.type === 'view_submission') {
    if (payload.hasOwnProperty('view')) {
      const view = payload.view;
      if (
        view.callback_id === postModal.POST_TO_THREAD_CALLBACK_ID 
        || view.callback_id === postModal.NEW_POST_CALLBACK_ID
      ) {
        // Check and publish anonymous message modal submission
        postModal.processModalSubmission(view, res);
        return;
      } else if (view.callback_id === slackAdmin.CONFIRM_ANON_CHANNEL_CALLBACK_ID) {
        // Set channel (for admins)
        slackAdmin.processChannel(view, res);
        return;
      }
    }
  }

  // Interactions from an 'Actions' block
  if (payload.type === 'block_actions') {
    if (payload.hasOwnProperty('actions')) {
      const action_id = payload.actions[0].action_id;
      if (action_id === postModal.TO_CHANNEL_CHECKBOX_ACTION_ID) {
        ack(res);
        return;
      } else if (action_id === slackAdmin.SELECT_ANON_CHANNEL_ACTION_ID) {
        // Dropdown menu for channel selection was used
        ack(res);
        return;
      } else if (action_id === slackAdmin.SUBMIT_ANON_CHANNEL_ACTION_ID) {
        // Set to selected channel
        ack(res);
        slackAdmin.serveConfirmSetChannelModal(payload);
        return;
      } else if (action_id === slackAdmin.DISABLE_CHANNEL_ACTION_ID) {
        // Disable channel
        ack(res);
        slackAdmin.serveConfirmDisableChannelModal(payload);
        return;
      }
    }

    console.log('Payload did not match any specified form.');
    console.log(payload);
  }
});

// Slack Events API
app.post('/events', function (req, res) {
  const body = req.body;
  if (body.type === 'url_verification') {
    res.send(req.body.challenge);
    return;
  }
  
  if (body.hasOwnProperty('event')) {
    if (body.event.type === APP_HOME_OPENED_EVENT_NAME) {
      ack(res);
      slackAdmin.processHome(body);
      return;
    }
  }
  
  console.log('Event body did not match any specified form.');
  console.log(body);
});

app.get('/', function (req, res) {
  res.send('Hello, World!');
});

// Start server
app.listen(LISTENING_PORT, function (err) {
  if (err === undefined || err === null) {
    console.log(`Listening on port ${LISTENING_PORT}...\n`);
  } else {
    console.log('Something went wrong:\n');
    handleError(err);
  }
});
