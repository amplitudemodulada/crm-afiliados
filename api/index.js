let app;
try {
  app = require('../src/server');
} catch (err) {
  app = require('express')();
  app.use('*', (req, res) => res.status(500).json({
    error: 'Module load failed',
    message: err.message,
    stack: err.stack
  }));
}

module.exports = (req, res) => {
  try {
    app(req, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Unhandled exception',
        message: err.message,
        stack: err.stack
      });
    }
  }
};
