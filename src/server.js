require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const db = require('../database/db');
const { dbPath } = db;
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== SEGURANÇA: HEADERS ====================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      upgradeInsecureRequests: null,
    }
  },
  hsts: process.env.NODE_ENV === 'production' ? undefined : false,
}));

// ==================== SESSÃO SEGURA ====================

if (!process.env.SESSION_SECRET) {
  console.error('[SEGURANÇA] SESSION_SECRET não definido no .env — usando valor temporário inseguro!');
}

app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  }
}));

// ==================== PARSERS ====================

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../public'));
app.use(express.static(path.join(__dirname, '../public')));

// ==================== RATE LIMITING ====================

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Muitas tentativas. Tente novamente em 15 minutos.'
});

// ==================== CSRF ====================

function csrfMiddleware(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

const PUBLIC_PATHS = ['/', '/admin-login', '/admin-logout'];
const MULTIPART_PATHS = ['/backup/upload'];

function csrfProtect(req, res, next) {
  if (req.method === 'GET' || PUBLIC_PATHS.includes(req.path) || MULTIPART_PATHS.includes(req.path)) return next();

  const token = req.body._csrf;
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).send('Requisição inválida. Recarregue a página e tente novamente.');
  }
  next();
}

app.use(csrfMiddleware);
app.use(csrfProtect);

// ==================== AUDIT LOG ====================

function audit(acao, detalhes, req) {
  const ip = req ? (req.ip || req.connection.remoteAddress) : 'sistema';
  const logLine = `[AUDIT] ${new Date().toISOString()} | ${acao} | ip=${ip} | ${JSON.stringify(detalhes)}`;
  console.log(logLine);
  db.run('INSERT INTO audit_log (acao, detalhes, ip) VALUES (?, ?, ?)',
    [acao, JSON.stringify(detalhes), ip]);
}

// ==================== VALIDAÇÃO ====================

function sanitizeStr(val, maxLen = 255) {
  if (!val) return null;
  return String(val).trim().substring(0, maxLen);
}

function sanitizeFloat(val) {
  const n = parseFloat(val);
  return isNaN(n) || n < 0 ? null : n;
}

// ==================== HELPERS ====================

const getNav = (active) => ({ dashboard: '', afiliados: '', financeiro: '', relatorios: '', backup: '', [active]: 'active' });

// ==================== ROTAS PÚBLICAS ====================

app.get('/', (req, res) => {
  res.redirect('/admin-login');
});

app.get('/admin-login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/dashboard');
  res.render('welcome', { error: null });
});

app.post('/admin-login', loginRateLimit, (req, res) => {
  const senha = String(req.body.senha || '').trim().substring(0, 128);
  if (!senha || senha !== process.env.ADMIN_PASSWORD) {
    audit('LOGIN_FAIL', { ip: req.ip }, req);
    return res.render('welcome', { error: 'Senha incorreta.' });
  }
  req.session.isAdmin = true;
  req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  audit('LOGIN_OK', {}, req);
  res.redirect('/dashboard');
});

app.get('/admin-logout', (req, res) => {
  audit('LOGOUT', {}, req);
  req.session.destroy(() => res.redirect('/admin-login'));
});

// ==================== MIDDLEWARE DE AUTENTICAÇÃO ====================

function checkAuth(req, res, next) {
  if (PUBLIC_PATHS.includes(req.path)) return next();
  if (req.session.isAdmin) return next();
  res.redirect('/admin-login');
}

app.use(checkAuth);

// ==================== ROTAS ====================

app.get('/dashboard', (req, res) => {
  db.get('SELECT COUNT(*) as total FROM afiliados', [], (err, count) => {
    db.get('SELECT SUM(valor) as total_pendente FROM mensalidades WHERE status = "pendente"', [], (err2, pendente) => {
      db.get('SELECT SUM(valor) as total_creditos FROM lancamentos WHERE tipo = "credito"', [], (err3, creditos) => {
        db.get('SELECT SUM(valor) as total_debitos FROM lancamentos WHERE tipo = "debito"', [], (err4, debitos) => {
          db.all(`SELECT strftime('%m/%Y', date(data_vencimento)) as mes,
            SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END) as pago,
            SUM(CASE WHEN status = 'pendente' THEN valor ELSE 0 END) as pendente
            FROM mensalidades
            WHERE data_vencimento >= date('now', '-6 months')
            GROUP BY strftime('%m/%Y', date(data_vencimento))
            ORDER BY data_vencimento`, [], (err5, mensalidadesPorMes) => {
            db.all(`SELECT a.nome,
              (SELECT SUM(valor) FROM mensalidades WHERE afiliado_id = a.id AND status = 'pago') as total_pago
              FROM afiliados a
              ORDER BY total_pago DESC LIMIT 5`, [], (err6, topAfiliados) => {
              res.render('dashboard', {
                nav: getNav('dashboard'),
                totalAfiliados: count ? count.total : 0,
                totalPendente: pendente ? (pendente.total_pendente || 0) : 0,
                totalCreditos: creditos ? (creditos.total_creditos || 0) : 0,
                totalDebitos: debitos ? (debitos.total_debitos || 0) : 0,
                saldo: (((creditos && creditos.total_creditos) || 0) - ((debitos && debitos.total_debitos) || 0)).toFixed(2),
                mensalidadesPorMes: mensalidadesPorMes || [],
                topAfiliados: topAfiliados || []
              });
            });
          });
        });
      });
    });
  });
});

app.get('/afiliados', (req, res) => {
  db.all(`
    SELECT a.*,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM mensalidades
          WHERE afiliado_id = a.id
            AND status = 'pendente'
            AND date(data_vencimento) < date('now')
        ) THEN 'atraso'
        WHEN EXISTS (
          SELECT 1 FROM mensalidades WHERE afiliado_id = a.id
        ) THEN 'em_dia'
        ELSE 'sem_mensalidade'
      END AS situacao_mensalidade
    FROM afiliados a
    ORDER BY a.nome
  `, [], (err, afiliados) => {
    res.render('afiliados', { nav: getNav('afiliados'), afiliados: afiliados || [] });
  });
});

app.get('/afiliados/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.redirect('/afiliados');

  db.get('SELECT * FROM afiliados WHERE id = ?', [id], (err, afiliado) => {
    if (!afiliado) return res.redirect('/afiliados');
    db.all('SELECT * FROM mensalidades WHERE afiliado_id = ? ORDER BY data_vencimento DESC', [id], (err2, mensalidades) => {
      db.all('SELECT * FROM lancamentos WHERE afiliado_id = ? ORDER BY data_lancamento DESC', [id], (err3, lancamentos) => {
        res.render('afiliado_detalhe', { nav: getNav('afiliados'), afiliado, mensalidades: mensalidades || [], lancamentos: lancamentos || [] });
      });
    });
  });
});

app.post('/afiliados', (req, res) => {
  const nome = sanitizeStr(req.body.nome, 255);
  if (!nome) return res.redirect('/afiliados');

  const email = sanitizeStr(req.body.email, 255);
  const telefone = sanitizeStr(req.body.telefone, 20);
  const cpf = sanitizeStr(req.body.cpf, 14);
  const endereco = sanitizeStr(req.body.endereco, 500);
  const valorMensalidade = sanitizeFloat(req.body.valor_mensalidade);

  db.run('INSERT INTO afiliados (nome, email, telefone, cpf, endereco) VALUES (?, ?, ?, ?, ?)',
    [nome, email, telefone, cpf, endereco], function (err) {
      if (err) return res.redirect('/afiliados');
      const afiliadoId = this.lastID;
      audit('AFILIADO_CRIAR', { nome }, req);

      if (!valorMensalidade) return res.redirect('/afiliados');

      // Gera 12 mensalidades a partir do mês atual, vencendo todo dia 10
      const hoje = new Date();
      let inseridos = 0;
      for (let i = 0; i < 12; i++) {
        const venc = new Date(hoje.getFullYear(), hoje.getMonth() + i, 10);
        const dataStr = venc.toISOString().split('T')[0];
        db.run('INSERT INTO mensalidades (afiliado_id, valor, data_vencimento) VALUES (?, ?, ?)',
          [afiliadoId, valorMensalidade, dataStr], function () {
            inseridos++;
            if (inseridos === 12) {
              audit('MENSALIDADES_AUTO', { afiliadoId, valor: valorMensalidade }, req);
            }
          });
      }
      res.redirect('/afiliados');
    });
});

app.post('/afiliados/:id/edit', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.redirect('/afiliados');

  const nome = sanitizeStr(req.body.nome, 255);
  if (!nome) return res.redirect('/afiliados');

  const email = sanitizeStr(req.body.email, 255);
  const telefone = sanitizeStr(req.body.telefone, 20);
  const cpf = sanitizeStr(req.body.cpf, 14);
  const endereco = sanitizeStr(req.body.endereco, 500);
  const status = ['ativo', 'inativo'].includes(req.body.status) ? req.body.status : 'ativo';

  db.run('UPDATE afiliados SET nome = ?, email = ?, telefone = ?, cpf = ?, endereco = ?, status = ? WHERE id = ?',
    [nome, email, telefone, cpf, endereco, status, id], function (err) {
      if (!err) audit('AFILIADO_EDITAR', { id, nome }, req);
      res.redirect('/afiliados');
    });
});

app.post('/afiliados/:id/delete', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.redirect('/afiliados');

  db.run('DELETE FROM mensalidades WHERE afiliado_id = ?', [id], () => {
    db.run('DELETE FROM lancamentos WHERE afiliado_id = ?', [id], () => {
      db.run('DELETE FROM afiliados WHERE id = ?', [id], () => {
        audit('AFILIADO_DELETAR', { id }, req);
        res.redirect('/afiliados');
      });
    });
  });
});

app.get('/financeiro', (req, res) => {
  db.all('SELECT * FROM afiliados ORDER BY nome', [], (err, afiliados) => {
    db.all(`SELECT m.*, a.nome as afiliado_nome FROM mensalidades m
            LEFT JOIN afiliados a ON m.afiliado_id = a.id
            ORDER BY m.data_vencimento DESC`, [], (err2, mensalidades) => {
      db.all(`SELECT l.*, a.nome as afiliado_nome FROM lancamentos l
              LEFT JOIN afiliados a ON l.afiliado_id = a.id
              ORDER BY l.data_lancamento DESC`, [], (err3, lancamentos) => {
        res.render('financeiro', { nav: getNav('financeiro'), afiliados: afiliados || [], mensalidades: mensalidades || [], lancamentos: lancamentos || [] });
      });
    });
  });
});

app.post('/mensalidades', (req, res) => {
  const afiliado_id = parseInt(req.body.afiliado_id);
  const valor = sanitizeFloat(req.body.valor);
  const data_vencimento = sanitizeStr(req.body.data_vencimento, 10);

  if (isNaN(afiliado_id) || !valor || !data_vencimento) return res.redirect('/financeiro');

  db.run('INSERT INTO mensalidades (afiliado_id, valor, data_vencimento) VALUES (?, ?, ?)',
    [afiliado_id, valor, data_vencimento], function (err) {
      if (!err) audit('MENSALIDADE_CRIAR', { afiliado_id, valor }, req);
      res.redirect('/financeiro');
    });
});

app.post('/mensalidades/:id/pagar', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.redirect('/financeiro');

  db.run('UPDATE mensalidades SET status = "pago", data_pagamento = CURRENT_TIMESTAMP WHERE id = ?',
    [id], function (err) {
      if (!err) audit('MENSALIDADE_PAGAR', { id }, req);
      res.redirect('/financeiro');
    });
});

app.post('/mensalidades/:id/edit', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.redirect('/financeiro');

  const valor = sanitizeFloat(req.body.valor);
  const data_vencimento = sanitizeStr(req.body.data_vencimento, 10);
  const redirect_to = sanitizeStr(req.body.redirect_to, 200) || '/financeiro';

  if (!valor || !data_vencimento) return res.redirect(redirect_to);

  db.run('UPDATE mensalidades SET valor = ?, data_vencimento = ? WHERE id = ?',
    [valor, data_vencimento, id], function (err) {
      if (!err) audit('MENSALIDADE_EDITAR', { id, valor, data_vencimento }, req);
      res.redirect(redirect_to);
    });
});

app.post('/mensalidades/bulk-date', (req, res) => {
  const dia = parseInt(req.body.dia);
  const afiliado_id = req.body.afiliado_id ? parseInt(req.body.afiliado_id) : null;
  const redirect_to = sanitizeStr(req.body.redirect_to, 200) || '/financeiro';

  if (isNaN(dia) || dia < 1 || dia > 28) return res.redirect(redirect_to);

  const novaData = `strftime('%Y-%m-', data_vencimento) || printf('%02d', ${dia})`;

  if (afiliado_id && !isNaN(afiliado_id)) {
    db.run(`UPDATE mensalidades SET data_vencimento = ${novaData} WHERE status = 'pendente' AND afiliado_id = ?`,
      [afiliado_id], function (err) {
        if (!err) audit('MENSALIDADE_BULK_DATE', { dia, afiliado_id, alteradas: this.changes }, req);
        res.redirect(redirect_to);
      });
  } else {
    db.run(`UPDATE mensalidades SET data_vencimento = ${novaData} WHERE status = 'pendente'`,
      [], function (err) {
        if (!err) audit('MENSALIDADE_BULK_DATE', { dia, afiliado_id: 'todos', alteradas: this.changes }, req);
        res.redirect(redirect_to);
      });
  }
});

app.post('/lancamentos', (req, res) => {
  const afiliado_id = req.body.afiliado_id ? parseInt(req.body.afiliado_id) : null;
  const tipo = ['credito', 'debito'].includes(req.body.tipo) ? req.body.tipo : null;
  const valor = sanitizeFloat(req.body.valor);
  const descricao = sanitizeStr(req.body.descricao, 500);

  if (!tipo || !valor) return res.redirect('/financeiro');

  db.run('INSERT INTO lancamentos (afiliado_id, tipo, valor, descricao) VALUES (?, ?, ?, ?)',
    [afiliado_id || null, tipo, valor, descricao], function (err) {
      if (!err) audit('LANCAMENTO_CRIAR', { tipo, valor }, req);
      res.redirect('/financeiro');
    });
});

app.post('/lancamentos/:id/edit', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.redirect('/financeiro');

  const afiliado_id = req.body.afiliado_id ? parseInt(req.body.afiliado_id) : null;
  const tipo = ['credito', 'debito'].includes(req.body.tipo) ? req.body.tipo : null;
  const valor = sanitizeFloat(req.body.valor);
  const descricao = sanitizeStr(req.body.descricao, 500);

  if (!tipo || !valor) return res.redirect('/financeiro');

  db.run('UPDATE lancamentos SET afiliado_id = ?, tipo = ?, valor = ?, descricao = ? WHERE id = ?',
    [afiliado_id || null, tipo, valor, descricao, id], function (err) {
      if (!err) audit('LANCAMENTO_EDITAR', { id, tipo, valor }, req);
      res.redirect('/financeiro');
    });
});

app.post('/lancamentos/:id/delete', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.redirect('/financeiro');

  db.run('DELETE FROM lancamentos WHERE id = ?', [id], function (err) {
    if (!err) audit('LANCAMENTO_DELETAR', { id }, req);
    res.redirect('/financeiro');
  });
});

// ==================== HELPERS DE QUERY ====================

const dbGet = (sql, params) => new Promise((resolve, reject) =>
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row || {})));

const dbAll = (sql, params) => new Promise((resolve, reject) =>
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || [])));

// ==================== RELATÓRIOS ====================

app.get('/relatorios', (req, res) => {
  db.all(`SELECT a.nome,
    (SELECT COUNT(*) FROM mensalidades WHERE afiliado_id = a.id) as total_mensalidades,
    (SELECT SUM(valor) FROM mensalidades WHERE afiliado_id = a.id AND status = 'pago') as total_pago,
    (SELECT SUM(valor) FROM mensalidades WHERE afiliado_id = a.id AND status = 'pendente') as total_pendente,
    (SELECT SUM(valor) FROM lancamentos WHERE afiliado_id = a.id AND tipo = 'credito') as creditos,
    (SELECT SUM(valor) FROM lancamentos WHERE afiliado_id = a.id AND tipo = 'debito') as debitos
    FROM afiliados a ORDER BY a.nome`, [], (err, relatorio) => {
    res.render('relatorios', { nav: getNav('relatorios'), relatorio: relatorio || [] });
  });
});

app.get('/relatorios/financeiro', async (req, res) => {
  try {
    const periodo = req.query.periodo === 'semanal' ? 'semanal' : 'mensal';
    const hoje = new Date();
    let inicio, fim, mesAtual, anoAtual;

    if (periodo === 'semanal') {
      const dow = hoje.getDay();
      const seg = new Date(hoje);
      seg.setDate(hoje.getDate() - (dow === 0 ? 6 : dow - 1));
      const dom = new Date(seg);
      dom.setDate(seg.getDate() + 6);
      inicio = req.query.inicio || seg.toISOString().split('T')[0];
      fim    = req.query.fim    || dom.toISOString().split('T')[0];
    } else {
      anoAtual  = parseInt(req.query.ano)  || hoje.getFullYear();
      mesAtual  = parseInt(req.query.mes)  || (hoje.getMonth() + 1);
      const ultimo = new Date(anoAtual, mesAtual, 0).getDate();
      inicio = `${anoAtual}-${String(mesAtual).padStart(2,'0')}-01`;
      fim    = `${anoAtual}-${String(mesAtual).padStart(2,'0')}-${ultimo}`;
    }

    const [
      pagas, pendentes, atrasadas,
      creditos, debitos,
      mensPerAfiliado, lancPerAfiliado
    ] = await Promise.all([
      dbGet(`SELECT COALESCE(SUM(valor),0) as total, COUNT(*) as qtd
             FROM mensalidades WHERE status='pago'
             AND date(data_pagamento) BETWEEN ? AND ?`, [inicio, fim]),

      dbGet(`SELECT COALESCE(SUM(valor),0) as total, COUNT(*) as qtd
             FROM mensalidades WHERE status='pendente'
             AND date(data_vencimento) BETWEEN ? AND ?`, [inicio, fim]),

      dbGet(`SELECT COALESCE(SUM(valor),0) as total, COUNT(*) as qtd
             FROM mensalidades WHERE status='pendente'
             AND date(data_vencimento) < date('now')`, []),

      dbGet(`SELECT COALESCE(SUM(valor),0) as total, COUNT(*) as qtd
             FROM lancamentos WHERE tipo='credito'
             AND date(data_lancamento) BETWEEN ? AND ?`, [inicio, fim]),

      dbGet(`SELECT COALESCE(SUM(valor),0) as total, COUNT(*) as qtd
             FROM lancamentos WHERE tipo='debito'
             AND date(data_lancamento) BETWEEN ? AND ?`, [inicio, fim]),

      dbAll(`SELECT a.nome,
               COALESCE(SUM(CASE WHEN m.status='pago'     THEN m.valor END),0) as pago,
               COALESCE(SUM(CASE WHEN m.status='pendente' THEN m.valor END),0) as pendente,
               COUNT(CASE WHEN m.status='pago'     THEN 1 END) as qtd_pago,
               COUNT(CASE WHEN m.status='pendente' THEN 1 END) as qtd_pendente
             FROM afiliados a
             LEFT JOIN mensalidades m ON m.afiliado_id = a.id
               AND date(CASE WHEN m.status='pago' THEN m.data_pagamento ELSE m.data_vencimento END) BETWEEN ? AND ?
             GROUP BY a.id, a.nome
             HAVING pago > 0 OR pendente > 0
             ORDER BY pago DESC`, [inicio, fim]),

      dbAll(`SELECT COALESCE(a.nome,'Geral') as nome, l.tipo,
               COALESCE(SUM(l.valor),0) as total, COUNT(*) as qtd
             FROM lancamentos l
             LEFT JOIN afiliados a ON l.afiliado_id = a.id
             WHERE date(l.data_lancamento) BETWEEN ? AND ?
             GROUP BY l.afiliado_id, l.tipo
             ORDER BY total DESC`, [inicio, fim]),
    ]);

    res.render('relatorio_financeiro', {
      nav: getNav('relatorios'),
      periodo, inicio, fim, mesAtual, anoAtual,
      pagas, pendentes, atrasadas, creditos, debitos,
      mensPerAfiliado, lancPerAfiliado,
      saldo: ((pagas.total + creditos.total) - debitos.total).toFixed(2),
    });
  } catch (err) {
    console.error('[RELATORIO]', err.message);
    res.redirect('/relatorios');
  }
});

// ==================== BACKUP ====================

function isSQLiteFile(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    return buf.toString('utf8', 0, 15) === 'SQLite format 3';
  } catch (e) {
    return false;
  }
}

const upload = multer({
  dest: path.join(__dirname, '../temp'),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.db' && ext !== '.sqlite') {
      return cb(new Error('Apenas arquivos .db ou .sqlite são aceitos'));
    }
    cb(null, true);
  }
});

const backupsDir = path.join(__dirname, '..', 'database', 'backups');
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

function listarBackups() {
  try {
    return fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const fullPath = path.join(backupsDir, f);
        const stats = fs.statSync(fullPath);
        return { nome: f, tamanhoMB: (stats.size / (1024 * 1024)).toFixed(2), data: stats.mtime };
      })
      .sort((a, b) => b.data - a.data);
  } catch (e) { return []; }
}

app.get('/backup', (req, res) => {
  let tamanhoMB = '0.00';
  try { tamanhoMB = (fs.statSync(dbPath).size / (1024 * 1024)).toFixed(2); } catch (e) {}
  const historico = listarBackups();
  const success = req.query.success || null;
  res.render('backup', { nav: getNav('backup'), tamanhoMB, historico, error: null, success });
});

app.get('/backup/download', (req, res) => {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dataStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const nomeArquivo = `crm-pro-backup-${dataStr}.db`;
  const arquivoHistorico = path.join(backupsDir, nomeArquivo);
  try { fs.copyFileSync(dbPath, arquivoHistorico); } catch (e) { console.error('[BACKUP] Erro ao salvar histórico:', e.message); }
  audit('BACKUP_DOWNLOAD', { arquivo: nomeArquivo }, req);
  res.download(dbPath, nomeArquivo);
});

app.post('/backup/restore/:filename', (req, res) => {
  const nome = path.basename(req.params.filename);
  if (!/^crm-pro-backup-[\w\-]+\.db$/.test(nome)) {
    const historico = listarBackups();
    let tamanhoMB = '0.00';
    try { tamanhoMB = (fs.statSync(dbPath).size / (1024 * 1024)).toFixed(2); } catch (e) {}
    return res.render('backup', { nav: getNav('backup'), tamanhoMB, historico, error: 'Nome de arquivo inválido.', success: null });
  }
  const origemPath = path.join(backupsDir, nome);
  if (!fs.existsSync(origemPath)) {
    const historico = listarBackups();
    let tamanhoMB = '0.00';
    try { tamanhoMB = (fs.statSync(dbPath).size / (1024 * 1024)).toFixed(2); } catch (e) {}
    return res.render('backup', { nav: getNav('backup'), tamanhoMB, historico, error: 'Arquivo de backup não encontrado.', success: null });
  }
  const preRestorePath = dbPath + '.backup';
  try {
    if (fs.existsSync(preRestorePath)) fs.unlinkSync(preRestorePath);
    fs.copyFileSync(dbPath, preRestorePath);
    db.close(() => {
      try {
        fs.copyFileSync(origemPath, dbPath);
        db.reopen();
        audit('BACKUP_RESTORE_HISTORICO', { arquivo: nome }, req);
        let tamanhoMB = '0.00';
        try { tamanhoMB = (fs.statSync(dbPath).size / (1024 * 1024)).toFixed(2); } catch (e) {}
        res.render('backup', { nav: getNav('backup'), tamanhoMB, historico: listarBackups(), success: `Backup "${nome}" restaurado com sucesso!`, error: null });
      } catch (err) {
        console.error('[BACKUP] Erro ao restaurar histórico:', err.message);
        try { fs.copyFileSync(preRestorePath, dbPath); } catch (e) {}
        db.reopen();
        let tamanhoMB = '0.00';
        try { tamanhoMB = (fs.statSync(dbPath).size / (1024 * 1024)).toFixed(2); } catch (e) {}
        res.render('backup', { nav: getNav('backup'), tamanhoMB, historico: listarBackups(), error: 'Erro ao restaurar. Dados originais mantidos.', success: null });
      }
    });
  } catch (err) {
    let tamanhoMB = '0.00';
    try { tamanhoMB = (fs.statSync(dbPath).size / (1024 * 1024)).toFixed(2); } catch (e) {}
    res.render('backup', { nav: getNav('backup'), tamanhoMB, historico: listarBackups(), error: 'Erro ao preparar restauração.', success: null });
  }
});

app.post('/backup/delete/:filename', (req, res) => {
  const nome = path.basename(req.params.filename);
  if (!/^crm-pro-backup-[\w\-]+\.db$/.test(nome)) {
    return res.redirect('/backup');
  }
  const alvoPath = path.join(backupsDir, nome);
  try { if (fs.existsSync(alvoPath)) fs.unlinkSync(alvoPath); } catch (e) {}
  audit('BACKUP_DELETE_HISTORICO', { arquivo: nome }, req);
  res.redirect('/backup?success=Backup+excluído+com+sucesso');
});

app.post('/backup/upload', upload.single('backupfile'), (req, res) => {
  const getMB = () => { try { return (fs.statSync(dbPath).size / (1024 * 1024)).toFixed(2); } catch (e) { return '0.00'; } };
  const renderErr = (msg) => {
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) {} }
    return res.render('backup', { nav: getNav('backup'), error: msg, success: null, tamanhoMB: getMB(), historico: listarBackups() });
  };
  if (!req.body._csrf || req.body._csrf !== req.session.csrfToken) {
    return renderErr('Requisição inválida. Recarregue a página e tente novamente.');
  }
  if (!req.file) {
    return res.render('backup', { nav: getNav('backup'), error: 'Nenhum arquivo selecionado.', success: null, tamanhoMB: getMB(), historico: listarBackups() });
  }

  const tempPath = req.file.path;

  if (!isSQLiteFile(tempPath)) {
    try { fs.unlinkSync(tempPath); } catch (e) {}
    return res.render('backup', { nav: getNav('backup'), error: 'Arquivo inválido: não é um banco SQLite.', success: null, tamanhoMB: getMB(), historico: listarBackups() });
  }

  const backupPath = dbPath + '.backup';

  try {
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    fs.copyFileSync(dbPath, backupPath);

    db.close(() => {
      try {
        fs.copyFileSync(tempPath, dbPath);
        try { fs.unlinkSync(tempPath); } catch (e) {}
        db.reopen();
        audit('BACKUP_RESTORE', { sucesso: true }, req);
        res.render('backup', { nav: getNav('backup'), success: 'Backup restaurado com sucesso!', error: null, tamanhoMB: getMB(), historico: listarBackups() });
      } catch (err) {
        console.error('[BACKUP] Erro ao restaurar:', err.message);
        try { fs.copyFileSync(backupPath, dbPath); } catch (e) {}
        try { fs.unlinkSync(tempPath); } catch (e) {}
        db.reopen();
        res.render('backup', { nav: getNav('backup'), error: 'Erro ao restaurar backup. O arquivo original foi mantido.', success: null, tamanhoMB: getMB(), historico: listarBackups() });
      }
    });
  } catch (err) {
    console.error('[BACKUP] Erro na preparação:', err.message);
    try { fs.unlinkSync(tempPath); } catch (e) {}
    res.render('backup', { nav: getNav('backup'), error: 'Erro ao preparar restauração.', success: null, tamanhoMB: getMB(), historico: listarBackups() });
  }
});

// ==================== ERROR HANDLER ====================

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).send('Ocorreu um erro interno. Tente novamente.');
});

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => console.log(`CRM Pro rodando em http://localhost:${PORT}`));
}

module.exports = app;
