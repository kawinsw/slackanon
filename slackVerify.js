const crypto = require('crypto');
const VERSION = 'v0';

const SLACK_SIGNING_SECRET = Buffer.from(
  process.env.SLACK_SIGNING_SECRET
).toString('utf8');

// Verify that a request was signed by Slack
const slackVerify = function (req, res, buf, encoding) {
  const signature = req.get('HTTP_X_SLACK_SIGNATURE');
  if (signature === undefined) {
    return false;
  }
  const timestamp = req.get('HTTP_X_SLACK_REQUEST_TIMESTAMP');
  const timeVal = Number(timestamp);
  if (!Number.isInteger(timeVal)) {
    return false;
  }
  const secondsAgo = Date.now() / 1000 - timeVal;
  if (secondsAgo < -1 || secondsAgo > 5) {
    return false;
  }

  const basestring = [VERSION, timestamp, buf.toString(encoding)].join(':');
  const hmac = crypto.createHmac('sha256', SLACK_SIGNING_SECRET);
  hmac.update(basestring);
  return crypto.timingSafeEqual(
    Buffer.from(VERSION + '=' + hmac.digest('hex')), 
    Buffer.from(signature)
  );
};

module.exports = slackVerify;
