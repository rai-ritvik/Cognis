// validate(schema, 'body' | 'params' | 'query') -> checks input with zod and stores the clean result in req.valid[source]
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  req.valid = req.valid || {};
  req.valid[source] = result.data;
  next();
};
module.exports = validate;
