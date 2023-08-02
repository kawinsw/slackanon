const { handleError, handlePromise } = require('./general.js');

const {
  NO_CHANNEL_SELECTED, 
  isTrueChannel,
  checkResponseOk, 
  updateResponseModal, 
  getFromSlack, 
  postToSlack, 
  openView, 
  makeClosingModal 
} = require('./slackUtils');

const USER_INFO_PATH = 'users.info';
const PUBLISH_HOME_PATH = 'views.publish';

const SET_ANON_CHANNEL_BLOCK_ID = 'set_anon_channel_block_id';
const SET_ANON_CHANNEL_CALLBACK_ID = 'set_anon_channel_callback_id';
const SUBMIT_ANON_CHANNEL_ACTION_ID = 'submit_anon_channel';
const SELECT_ANON_CHANNEL_ACTION_ID = 'select_anon_channel';
const CONFIRM_ANON_CHANNEL_CALLBACK_ID = 'confirm_anon_channel';
const DISABLE_CHANNEL_BLOCK_ID = 'disable_channel_block_id';
const DISABLE_CHANNEL_ACTION_ID = 'disable_channel_action_id';

const db = require('./database.js').getDatabase();

const checkUserAdmin = function (userId, slackToken) {
  return getFromSlack(
    USER_INFO_PATH, slackToken, { user: userId }
  ).then(checkResponseOk).then(
    (res) => res.data.user.is_admin
  ).catch(handleError);
};

const makeNonAdminHome = (channelId) => ({
  type: 'home',
  title: {
    type: 'plain_text',
    text: 'Anonymous Forum'
  },
  blocks: [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Anonymous Forum'
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: isTrueChannel(channelId) ? 
          `Anonymous Forum is active in <#${channelId}>.` : 
          'Anonymous Forum is disabled.'
      }
    },
    {
      type: 'section',
      text: {
        type: 'plain_text',
        text: 'Only workspace admins are allowed to modify these settings.'
      }
    },
    {
      type: 'divider'
    }
  ]
});

const makeAdminHome = function (channelId) {
  const homeView = {
    type: 'home',
    callback_id: SET_ANON_CHANNEL_CALLBACK_ID,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Anonymous Forum'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          // text: `Anonymous Forum is currently active in <#${channelId}>.`
        }
      },
      {
        type: 'actions',
        block_id: SET_ANON_CHANNEL_BLOCK_ID,
        elements: [
          {
            type: 'channels_select',
            action_id: SELECT_ANON_CHANNEL_ACTION_ID,
            // initial_channel: channelId,
            placeholder: {
              type: 'plain_text',
              text: 'Select a channel'
            }
          },
          {
            type: 'button',
            action_id: SUBMIT_ANON_CHANNEL_ACTION_ID,
            text: {
              type: 'plain_text',
              text: 'Set'
            }
          }
        ]
      },
      {
        type: 'divider'
      },
      {
        type: 'actions',
        block_id: DISABLE_CHANNEL_BLOCK_ID,
        elements: [{
          type: 'button',
          action_id: DISABLE_CHANNEL_ACTION_ID,
          text: {
            type: 'plain_text',
            text: 'Disable'
          },
          style: 'danger'
        }]
      },
      {
        type: 'divider'
      }
    ]
  };

  if (isTrueChannel(channelId)) {
    homeView.blocks[1].text.text = `Anonymous Forum is currently active in <#${channelId}>.`;
    homeView.blocks[2].elements[0].initial_channel = channelId;
  } else {
    homeView.blocks[1].text.text = 'Anonymous Forum is currently disabled. Please select a channel to enable.';
  }
  return homeView;
};

const failureHome = {
  type: 'home',
  title: {
    type: 'plain_text',
    text: 'Anonymous Forum'
  },
  blocks: [{
    type: 'header',
    text: {
      type: 'plain_text',
      text: 'Anonymous Forum'
    }
  }, {
    type: 'section',
    text: {
      type: 'plain_text',
      text: 'Sorry, something went wrong. Please try again :('
    }
  }]
};

const makeConfirmationModal = (channelId, userId) => ({
  type: 'modal',
  callback_id: CONFIRM_ANON_CHANNEL_CALLBACK_ID,
  private_metadata: channelId + ',' + userId,
  title: {
    type: 'plain_text',
    text: 'Anomymous Forum'
  },
  submit: {
    type: 'plain_text',
    text: 'Confirm'
  },
  close: {
    type: 'plain_text',
    text: 'Cancel'
  },
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: isTrueChannel(channelId) ? 
        `Change channel to <#${channelId}>?` :
        'Disable Anonymous Forum?'
      }
    }
  ]
});

const makeNoChangeModal = (channelId) => makeClosingModal(
  isTrueChannel(channelId) ? 
  `Channel is already set to <#${channelId}>.` : 
  'Anonymous Forum is already disabled.' 
);

const makeSuccessModal = (channelId) => makeClosingModal(
  isTrueChannel(channelId) ? 
  `Users can now post anonymously in <#${channelId}>.` :
  'Anonymous Forum is now disabled.'
);

const failureModal = makeClosingModal(
  'Sorry, something went wrong :('
);

const setChannelFailureModal = makeClosingModal(
  'Sorry, something went wrong and the channel was not updated.' 
  + ' Please try again.'
);

const setChannelUnsureFailureModal = makeClosingModal(
  'Sorry, something went wrong'
  + ' and the channel may not have been updated.' 
  + ' Please try again.'
);

const notAdminModal = makeClosingModal(
  'Sorry, only workspace admins are allowed to modify these settings.'
);

const publishHome = function (homeView, userId, slackToken) {
  return postToSlack(PUBLISH_HOME_PATH, slackToken, {
    user_id: userId,
    view: homeView
  }).then(checkResponseOk);
};

const processHome = function (body) {
  db.getWorkspace(body.team_id).then(function (workspaceRecord) {
    const slackToken = workspaceRecord.getSlackToken();
    const channelId = workspaceRecord.getChannelId();
    const userId = body.event.user;

    handlePromise(
      async function () {
        const isAdmin = await checkUserAdmin(userId, slackToken);
        if (isAdmin) {
          await publishHome(makeAdminHome(channelId), userId, slackToken);
        } else {
          await publishHome(makeNonAdminHome(channelId), userId, slackToken);
        }
      },

      function (err) {
        publishHome(failureHome, userId, slackToken).catch(handleError);
        handleError(err);
      }
    );
  }).catch(handleError);
};

const serveConfirmChannelModal = function (
  teamId, selectedChannelId, userId, triggerId
) {
  db.getWorkspace(teamId).then(function (workspaceRecord) {
    const slackToken = workspaceRecord.getSlackToken();
    const existingChannelId = workspaceRecord.getChannelId();

    handlePromise(
      async function () {
        const isAdmin = await checkUserAdmin(userId, slackToken);
        if (isAdmin) {
          if (selectedChannelId === existingChannelId) {
            await openView(
              makeNoChangeModal(existingChannelId), 
              triggerId, slackToken
            );
          } else {
            await openView(
              makeConfirmationModal(selectedChannelId, userId), 
              triggerId, slackToken
            );
          }
        } else {
          await openView(notAdminModal, triggerId, slackToken);
        }
      },

      function (err) {
        openView(
          setChannelFailureModal, triggerId, slackToken
        ).catch(handleError);
        handleError(err);
      }
    );
  });
};

const serveConfirmSetChannelModal = function (payload) {
  serveConfirmChannelModal(
    payload.team.id,
    payload.view.state.values[SET_ANON_CHANNEL_BLOCK_ID][SELECT_ANON_CHANNEL_ACTION_ID].selected_channel,
    payload.user.id,
    payload.trigger_id,
  );
};

const serveConfirmDisableChannelModal = function (payload) {
  serveConfirmChannelModal(
    payload.team.id,
    NO_CHANNEL_SELECTED,
    payload.user.id,
    payload.trigger_id,
  );
};

const processChannel = function (modalView, res) {
  handlePromise(
    async function () {
      const workspaceRecord = await db.getWorkspace(modalView.team_id);
      const slackToken = workspaceRecord.getSlackToken();
      const existingChannelId = workspaceRecord.getChannelId();
      const [selectedChannelId, userId] = modalView.private_metadata.split(',');

      const isAdmin = await checkUserAdmin(userId, slackToken);
      if (isAdmin) {
        if (selectedChannelId === existingChannelId) {
          updateResponseModal(res, makeNoChangeModal(existingChannelId));
        } else {
          workspaceRecord.updateChannelId(selectedChannelId).then(function (updatedRecord) {
            const updatedChannelId = updatedRecord.getChannelId();
            if (updatedChannelId === selectedChannelId) {
              publishHome(
                makeAdminHome(updatedChannelId), userId, slackToken
              ).catch(function (err) {
                updateResponseModal(res, makeSuccessModal(updatedChannelId));
                handleError(err);
              })
              updateResponseModal(res, makeSuccessModal(selectedChannelId));
            } else {
              throw 'channelId mismatch after update';
            }
          }).catch(function (err) {
            updateResponseModal(res, setChannelUnsureFailureModal);
            handleError(err);
          });
        }
      } else {
        updateResponseModal(res, notAdminModal);
      }
    },

    function (err) {
      updateResponseModal(res, setChannelFailureModal);
      handleError(err);
    }
  );
};

exports.SELECT_ANON_CHANNEL_ACTION_ID = SELECT_ANON_CHANNEL_ACTION_ID;
exports.SUBMIT_ANON_CHANNEL_ACTION_ID = SUBMIT_ANON_CHANNEL_ACTION_ID;
exports.CONFIRM_ANON_CHANNEL_CALLBACK_ID = CONFIRM_ANON_CHANNEL_CALLBACK_ID;
exports.DISABLE_CHANNEL_ACTION_ID = DISABLE_CHANNEL_ACTION_ID;
exports.processHome = processHome;
exports.serveConfirmSetChannelModal = serveConfirmSetChannelModal;
exports.serveConfirmDisableChannelModal = serveConfirmDisableChannelModal;
exports.processChannel = processChannel;
