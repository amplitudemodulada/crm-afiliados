const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

const dbPath = process.env.VERCEL === '1'
  ? path.join(os.tmpdir(), 'crm.db')
  : path.join(__dirname, 'crm.db');
let _db = new sqlite3.Database(dbPath);

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

function createTables(database) {
  database.serialize(() => {
    TABLES.forEach(sql => database.run(sql));
  });
}

createTables(_db);

// Proxy wrapper: always delegates to the current _db instance.
// Fixes the original bug where reopen() reassigned a local variable
// that didn't update the already-exported reference.
const db = {
  run: (...args) => _db.run(...args),
  get: (...args) => _db.get(...args),
  all: (...args) => _db.all(...args),
  close: (cb) => _db.close(cb),
  serialize: (cb) => _db.serialize(cb),
  reopen: () => {
    _db.close(() => {
      _db = new sqlite3.Database(dbPath);
      createTables(_db);
    });
  }
};

module.exports = db;
module.exports.dbPath = dbPath;
