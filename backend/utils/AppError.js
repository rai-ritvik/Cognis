// A small error class so controllers can say: throw new AppError(404, 'Not found')
// The central error handler (middleware/errorHandler.js) turns it into a clean JSON reply.
class AppError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
module.exports = AppError;
