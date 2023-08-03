const axios = require('axios');

const { ack, handleError, handlePromise } = require('./general.js');

const {
  isTrueChannel,
  pushResponseModal, 
  getChannelName, 
  postMessage, 
  openView, 
  makeClosingModal 
} = require('./slackUtils.js');

const db = require('./db.js').getDatabase();

const NEW_POST_CALLBACK_ID = 'new_post';
const POST_TO_THREAD_CALLBACK_ID = 'post_to_thread';
const ANON_INPUT_MODAL_BLOCK_ID = 'anon_input_modal_block_id';
const ANON_INPUT_MODAL_ACTION_ID = 'anon_input_modal_action_id';
const TO_CHANNEL_CHECKBOX_BLOCK_ID = 'to_channel_checkbox_block_id';
const TO_CHANNEL_CHECKBOX_ACTION_ID = 'to_channel_checkbox_action_id';
const TO_CHANNEL_VALUE = 'also_send_to_channel';

const NEW_POST_PLACEHOLDER = 'Your message here';
const POST_TO_THREAD_PLACEHOLDER = 'Your anonymous follow-up here';

const makeAnonInputModal = (
  callbackId,
  privateMetadata,
  inputTextPlaceholder,
  inputTextLabel
) => ({
  type: 'modal',
  callback_id: callbackId,
  private_metadata: privateMetadata,
  title: {
    type: 'plain_text',
    text: 'Anonymous Forum'
  },
  submit: {
    type: 'plain_text',
    text: 'Send'
  },
  // submit_disabled: true,
  close: {
    type: 'plain_text',
    text: 'Cancel'
  },
  blocks: [
    {
      type: 'input',
      block_id: ANON_INPUT_MODAL_BLOCK_ID,
      element: {
        type: 'plain_text_input',
        action_id: ANON_INPUT_MODAL_ACTION_ID,
        multiline: true,
        placeholder: {
          type: 'plain_text',
          text: inputTextPlaceholder
        }
      },
      label: {
        type: 'plain_text',
        text: inputTextLabel
      },
      optional: false,
      dispatch_action: false
    }
  ]
});

const makeToChannelCheckbox = (channelId) => ({
  type: 'actions',
  block_id: TO_CHANNEL_CHECKBOX_BLOCK_ID,
  elements: [{
    type: 'checkboxes',
    action_id: TO_CHANNEL_CHECKBOX_ACTION_ID,
    options: [{
      text: {
        type: 'mrkdwn',
        text: `Also send to <#${channelId}>`
      },
      value: TO_CHANNEL_VALUE
    }]
  }]
});

const makeNewPostModal = function (msg, channelName, channelId) {
  const modal = makeAnonInputModal(
    NEW_POST_CALLBACK_ID,
    Array.prototype.slice.call(arguments, 2).join(','),
    NEW_POST_PLACEHOLDER,
    `Anonymous new post in #${channelName}`
  );
  if (Boolean(msg)) {
    modal.blocks[0].element.initial_value = msg;
  }
  return modal;
};

const makeThreadModal = function (channelName, channelId, parentTs) {
  const threadModal = makeAnonInputModal(
    POST_TO_THREAD_CALLBACK_ID,
    Array.prototype.slice.call(arguments, 1).join(','),
    POST_TO_THREAD_PLACEHOLDER,
    `Anonymously post to thread in #${channelName}`
  );
  threadModal.blocks.push(makeToChannelCheckbox(channelId));
  return threadModal;
};

const makeInvalidChannelModal = (invalidChannelId) => ({
  type: 'modal',
  title: {
    type: 'plain_text',
    text: 'Anonymous Forum'
  },
  close: {
    type: 'plain_text',
    text: 'Close'
  },
  blocks: [{
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `Anonymous Forum is not active in <#${invalidChannelId}>.`
    }
  }]
});

const disabledModal = makeClosingModal('Anonymous Forum is disabled.');

const postFailureModal = makeClosingModal('Sorry, something went wrong and message posting may have failed. Please try again.');

const failureModal = makeClosingModal('Sorry, something went wrong. Please try again.');

const serveNewPostModal = function (body) {
  handlePromise(
    async function () {
      const workspaceRecord = await db.getWorkspace(body.team_id);
      const slackToken = workspaceRecord.getSlackToken();
      const channelId = workspaceRecord.getChannelId();
      const triggerId = body.trigger_id;

      if (isTrueChannel(channelId)) {
        const channelName = await getChannelName(channelId, slackToken);
        await openView(
          makeNewPostModal(body.text, channelName, channelId),
          triggerId,
          slackToken
        );
      } else {
        await openView(disabledModal, triggerId, slackToken);
      }
    },
    
    function (err) {
      axios.post(body.response_url, {
        response_type: 'ephemeral',
        text: 'Sorry, something went wrong. Please try again.'
      }).catch(handleError);
      handleError(err);
    }
  );
};

const serveThreadModal = function (payload) {
  db.getWorkspace(payload.team.id).then(function (workspaceRecord) {
    const slackToken = workspaceRecord.getSlackToken();
    const anonChannelId = workspaceRecord.getChannelId();
    const payloadChannelId = payload.channel.id;

    handlePromise(
      async function () {
        if (anonChannelId === payloadChannelId) {
          await openView(
            makeThreadModal(
              payload.channel.name,
              payloadChannelId,
              payload.message.thread_ts || payload.message_ts
            ), 
            payload.trigger_id, 
            slackToken
          );
        } else if (isTrueChannel(anonChannelId)) {
          await openView(
            makeInvalidChannelModal(payloadChannelId),
            payload.trigger_id,
            slackToken
          );
        } else {
          await openView(disabledModal, payload.trigger_id, slackToken);
        }
      },

      function (err) {
        openView(
          failureModal, payload.trigger_id, slackToken
        ).catch(handleError);
        handleError(err);
      }
    );
  }).catch(handleError);
};

const isToChannel = (checkboxState) => checkboxState.value === TO_CHANNEL_VALUE;

// Validate and publish modal submission
const processModalSubmission = function (modalView, res) {
  handlePromise(
    async function () {
      const workspaceRecord = await db.getWorkspace(modalView.team_id);
      const channelId = workspaceRecord.getChannelId();
      const dest = modalView.private_metadata.split(',');

      // Verify requested channelId
      if (!isTrueChannel(channelId)) {
        pushResponseModal(res, disabledModal);
        return;
      } else if (dest[0] !== channelId) {
        pushResponseModal(res, makeInvalidChannelModal(dest[0]));
        return;
      }

      const inputs = modalView.state.values;
      const msg = inputs[ANON_INPUT_MODAL_BLOCK_ID][ANON_INPUT_MODAL_ACTION_ID].value;
      
      const outputPayload = {
        channel: channelId, // channelId
        text: msg,
        link_names: true
      };
      if (dest.length > 1) {
        outputPayload.thread_ts = dest[1]; // parentTs
      }
      if (modalView.callback_id === POST_TO_THREAD_CALLBACK_ID) {
        outputPayload.reply_broadcast = inputs[TO_CHANNEL_CHECKBOX_BLOCK_ID][TO_CHANNEL_CHECKBOX_ACTION_ID].selected_options.some(isToChannel);
      }

      await postMessage(outputPayload, workspaceRecord.getSlackToken());
      ack(res);
    },
    
    function (err) {
      pushResponseModal(res, postFailureModal);
      handleError(err);
    }
  );
};

exports.NEW_POST_CALLBACK_ID = NEW_POST_CALLBACK_ID;
exports.POST_TO_THREAD_CALLBACK_ID = POST_TO_THREAD_CALLBACK_ID;
exports.TO_CHANNEL_CHECKBOX_ACTION_ID = TO_CHANNEL_CHECKBOX_ACTION_ID;

exports.serveNewPostModal = serveNewPostModal;
exports.serveThreadModal = serveThreadModal;
exports.processModalSubmission = processModalSubmission;
