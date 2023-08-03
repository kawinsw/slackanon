/* General utils */

// Acknowledge request with a blank 200 response
const ack = function (res) {
  res.status(200).end();
};

// Error handler
const handleError = function (err) {
  console.log(err);
};

// Wrapper for async function that catches the resulting promise
const handlePromise = function (asyncFunc, errorHandler) {
  asyncFunc().catch(errorHandler);
};

exports.ack = ack;
exports.handleError = handleError;
exports.handlePromise = handlePromise;
