try {
  const app = require('../src/server');
  module.exports = app;
} catch (err) {
  module.exports = (req, res) => {
    res.status(500).json({ error: err.message, stack: err.stack, name: err.name });
  };
}
