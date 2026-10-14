const AppError = require('../utils/AppError');

function validate(schema, target = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(target === 'params' ? req.params : req.body);

    if (!result.success) {
      const err = new AppError(400, 'Validation failed', 'VALIDATION_ERROR');
      err.details = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
      }));
      return next(err);
    }

    req.valid ||= {};
    req.valid[target] = result.data;
    next();
  };
}

module.exports = validate;
