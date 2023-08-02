const axios = require('axios');

// const { ack, handleError } = require('./general.js');

const SLACK_API_URL = 'https://slack.com/api/';
const POST_MESSAGE_PATH = 'chat.postMessage';
const OPEN_VIEW_PATH = 'views.open';
const CONVO_INFO_PATH = 'conversations.info';
const NO_CHANNEL_SELECTED = 'NO_CHANNEL_SELECTED';

const isTrueChannel = (channelId) => Boolean(channelId) &&channelId !== NO_CHANNEL_SELECTED;

const checkResponseOk = function (res) {
  const data = res.data;
  if (!data.hasOwnProperty('ok')) {
    console.log(data);
    throw 'Response does not have ok field';
  } else if (data.ok !== true) {
    console.log(data);
    throw 'Response not ok';
  }
  return res;
};

const makeSlackRequestConfig = (contentType, slackToken) => ({
  timeout: 5000,
  headers: {
    'Authorization': 'Bearer ' + slackToken,
    'Content-Type': `${contentType}; charset=utf-8`
  },
  maxContentLength: 5000,
  maxBodyLength: 5000,
  maxRedirects: 5
});

const updateResponseModal = function (res, modalView) { 
  res.send({
    response_action: 'update',
    view: modalView
  });
}

const pushResponseModal = function (res, modalView) {
  res.send({
    response_action: 'push',
    view: modalView
  });
};

const getFromSlack = function (slackApiPath, slackToken, params) {
  const config = makeSlackRequestConfig(
    'application/x-www-form-urlencoded', slackToken
  );
  config.params = params;
  return axios.get(SLACK_API_URL + slackApiPath, config);
};

const postToSlack = function (slackApiPath, slackToken, body) {
  return axios.post(
    SLACK_API_URL + slackApiPath,
    body,
    makeSlackRequestConfig('application/json', slackToken)
  );
};

const postMessage = function (body, slackToken) {
  return postToSlack(
    POST_MESSAGE_PATH, slackToken, body
  ).then(checkResponseOk);
};

const openView = function (viewSpec, triggerId, slackToken) {
  const viewPayload = {
    trigger_id: triggerId,
    view: viewSpec
  };

  return postToSlack(
    OPEN_VIEW_PATH, slackToken, viewPayload
  ).then(checkResponseOk);
};

const getChannelName = function (channelId, slackToken) {
  return getFromSlack(
    CONVO_INFO_PATH, slackToken, { channel: channelId }
  ).then(checkResponseOk).then((res) => res.data.channel.name);
};

const checkWebhookResponseOk = function (res) {
  if (res.data !== 'ok') {
    console.log(res.data);
    throw 'Webhook response not ok';
  }
  return res;
};

const makeDeadEndModal = (modalText, ackButtonText) => ({
  type: 'modal',
  title: {
    type: 'plain_text',
    text: 'Anonymous Forum'
  },
  close: {
    type: 'plain_text',
    text: ackButtonText
  },
  blocks: [{
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: modalText
    }
  }]
});

const makeClosingModal = (modalText) => makeDeadEndModal(modalText, 'Close');

exports.SLACK_API_URL = SLACK_API_URL;
exports.NO_CHANNEL_SELECTED = NO_CHANNEL_SELECTED;
exports.isTrueChannel = isTrueChannel;
exports.updateResponseModal = updateResponseModal;
exports.pushResponseModal = pushResponseModal;
exports.getFromSlack = getFromSlack;
exports.postToSlack = postToSlack;
exports.getChannelName = getChannelName;
exports.postMessage = postMessage;
exports.openView = openView;
exports.makeDeadEndModal = makeDeadEndModal;
exports.makeClosingModal = makeClosingModal;
