const AppError = require('./AppError');

// Supabase returns { data, error }. unwrap() gives you `data` or throws a safe 500.
// The real database message is logged on the server, never sent to the browser.
function unwrap(result, publicMessage = 'Database error') {
  if (result.error) {
    console.error(`[db] ${publicMessage}:`, result.error.message);
    throw new AppError(500, publicMessage);
  }
  return result.data;
}

module.exports = { unwrap };
