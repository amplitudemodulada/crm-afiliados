const path = require('path');
const fs = require('fs');
const os = require('os');

const dbPath = process.env.VERCEL === '1'
  ? path.join(os.tmpdir(), 'crm.db')
  : path.join(__dirname, 'crm.db');

let _db = null;
let _SQL = null;
let _ready = false;
let _readyPromise = null;

const TABLES = [
  `CREATE TABLE IF NOT EXISTS afiliados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    cpf TEXT,
    endereco TEXT,
    data_cadastro TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'ativo'
  )`,
  `CREATE TABLE IF NOT EXISTS mensalidades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    afiliado_id INTEGER,
    valor REAL NOT NULL,
    data_vencimento TEXT NOT NULL,
    data_pagamento TEXT,
    status TEXT DEFAULT 'pendente',
    FOREIGN KEY (afiliado_id) REFERENCES afiliados(id)
  )`,
  `CREATE TABLE IF NOT EXISTS lancamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    afiliado_id INTEGER,
    tipo TEXT NOT NULL,
    valor REAL NOT NULL,
    descricao TEXT,
    data_lancamento TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (afiliado_id) REFERENCES afiliados(id)
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    acao TEXT NOT NULL,
    detalhes TEXT,
    ip TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`
];

function saveToDisk() {
  try {
    if (_db) {
      fs.writeFileSync(dbPath, Buffer.from(_db.export()));
    }
  } catch (e) {
    console.error('[DB] Save error:', e.message);
  }
}

function createTables() {
  _db.run('BEGIN TRANSACTION');
  try {
    for (const sql of TABLES) _db.run(sql);
    _db.run('COMMIT');
  } catch (e) {
    _db.run('ROLLBACK');
    throw e;
  }
}

function initDb() {
  if (fs.existsSync(dbPath)) {
    _db = new _SQL.Database(fs.readFileSync(dbPath));
  } else {
    _db = new _SQL.Database();
  }
  createTables();
  saveToDisk();
}

function toObject(stmt) {
  const cols = stmt.getColumnNames();
  const vals = stmt.get();
  if (!vals) return null;
  const obj = {};
  for (let i = 0; i < cols.length; i++) obj[cols[i]] = vals[i];
  return obj;
}

function exec(method, sql, params, callback) {
  if (typeof params === 'function') { callback = params; params = []; }
  if (!params) params = [];

  function doExec() {
    try {
      if (method === 'run') {
        _db.run(sql, params);
        saveToDisk();
        callback.call({ lastID: 0, changes: _db.getRowsModified() }, null);
      } else if (method === 'get') {
        const stmt = _db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(toObject(stmt));
        stmt.free();
        callback(null, rows.length > 0 ? rows[0] : null);
      } else if (method === 'all') {
        const stmt = _db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(toObject(stmt));
        stmt.free();
        callback(null, rows);
      }
    } catch (err) { callback(err); }
  }

  if (_ready) { doExec(); return; }
  _readyPromise.then(doExec).catch(err => {
    console.error('[DB] Exec error:', err.message);
    if (callback) callback(err);
  });
}

_readyPromise = require('sql.js/dist/sql-asm.js')().then(SQL => {
  _SQL = SQL;
  initDb();
  _ready = true;
}).catch(err => {
  console.error('[DB] Init failed:', err.message);
  throw err;
});

const db = {
  run: (...args) => exec('run', ...args),
  get: (...args) => exec('get', ...args),
  all: (...args) => exec('all', ...args),
  close: function (cb) {
    if (_ready) {
      try { saveToDisk(); if (_db) _db.close(); _db = null; _ready = false; } catch (e) {}
    }
    if (cb) cb();
  },
  serialize: function (cb) { if (cb) cb(); },
  reopen: function () {
    if (_db) _db.close();
    _db = null; _ready = false;
    _readyPromise = require('sql.js/dist/sql-asm.js')().then(SQL => {
      _SQL = SQL;
      initDb();
      _ready = true;
    });
  }
};

module.exports = db;
module.exports.dbPath = dbPath;
module.exports.ready = _readyPromise;
