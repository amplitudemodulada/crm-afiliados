const db = require('../database/db');

module.exports = async (req, res) => {
  try {
    await db.ready;
    const app = require('../src/server');
    app(req, res);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack, name: err.name });
  }
};
