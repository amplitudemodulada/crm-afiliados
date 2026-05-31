let loaded = false;
let loadError = null;

try {
  const app = require('../src/server');
  loaded = true;
  module.exports = app;
} catch (err) {
  loadError = { message: err.message, stack: err.stack, code: err.code };
  module.exports = (req, res) => {
    res.status(500).json({ error: 'require failed', details: loadError });
  };
}
