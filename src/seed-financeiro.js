const db = require('../database/db');

const mensalidades = [];
const lancamentos = [];

const valoresMensalidade = [89.90, 99.90, 119.90, 149.90, 199.90];
const descricoesLancamentos = [
  'Comissão de vendas',
  'Bônus de indicação',
  'Desconto promocional',
  'Taxa de adesão',
  'Pagamento de taxa',
  'Ajuste de faturamento',
  'Crédito por cancelamento',
  'Reembolso parcial',
  'Cashback mensal',
  'Prêmio de performance'
];

for (let afiliadoId = 3; afiliadoId <= 32; afiliadoId++) {
  const numMensalidades = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < numMensalidades; i++) {
    const valor = valoresMensalidade[Math.floor(Math.random() * valoresMensalidade.length)];
    const dataBase = new Date();
    dataBase.setMonth(dataBase.getMonth() - (numMensalidades - i - 1));
    const dataVencimento = new Date(dataBase);
    dataVencimento.setDate(10 + Math.floor(Math.random() * 15));
    const status = Math.random() > 0.3 ? 'pago' : 'pendente';
    const dataPagamento = status === 'pago'
      ? new Date(dataVencimento.getTime() + Math.random() * 5 * 24 * 60 * 60 * 1000)
      : null;
    mensalidades.push({
      afiliado_id: afiliadoId,
      valor: valor,
      data_vencimento: dataVencimento.toISOString().split('T')[0],
      data_pagamento: dataPagamento ? dataPagamento.toISOString().split('T')[0] : null,
      status: status
    });
  }

  const numLancamentos = 2 + Math.floor(Math.random() * 5);
  for (let i = 0; i < numLancamentos; i++) {
    const tipo = Math.random() > 0.5 ? 'credito' : 'debito';
    const valor = (Math.random() * 500 + 50).toFixed(2);
    const dataLancamento = new Date();
    dataLancamento.setDate(dataLancamento.getDate() - Math.floor(Math.random() * 60));
    lancamentos.push({
      afiliado_id: afiliadoId,
      tipo: tipo,
      valor: parseFloat(valor),
      descricao: descricoesLancamentos[Math.floor(Math.random() * descricoesLancamentos.length)],
      data_lancamento: dataLancamento.toISOString().split('T')[0]
    });
  }
}

let inseridosM = 0;
let inseridosL = 0;

function inserirMensalidades(index) {
  if (index >= mensalidades.length) {
    console.log(`\nMensalidades inseridas: ${inseridosM}`);
    inserirLancamentos(0);
    return;
  }
  const m = mensalidades[index];
  db.run(
    'INSERT INTO mensalidades (afiliado_id, valor, data_vencimento, data_pagamento, status) VALUES (?, ?, ?, ?, ?)',
    [m.afiliado_id, m.valor, m.data_vencimento, m.data_pagamento, m.status],
    function (err) {
      if (err) {
        console.log(`Erro ao inserir mensalidade:`, err.message);
      } else {
        inseridosM++;
        if (inseridosM % 10 === 0) console.log(`Mensalidades inseridas: ${inseridosM}`);
      }
      inserirMensalidades(index + 1);
    }
  );
}

function inserirLancamentos(index) {
  if (index >= lancamentos.length) {
    console.log(`Lançamentos inseridos: ${inseridosL}`);
    console.log('\nConcluído! Dados financeiros fictícios inseridos.');
    db.close();
    return;
  }
  const l = lancamentos[index];
  db.run(
    'INSERT INTO lancamentos (afiliado_id, tipo, valor, descricao, data_lancamento) VALUES (?, ?, ?, ?, ?)',
    [l.afiliado_id, l.tipo, l.valor, l.descricao, l.data_lancamento],
    function (err) {
      if (err) {
        console.log(`Erro ao inserir lançamento:`, err.message);
      } else {
        inseridosL++;
        if (inseridosL % 20 === 0) console.log(`Lançamentos inseridos: ${inseridosL}`);
      }
      inserirLancamentos(index + 1);
    }
  );
}

console.log('Inserindo mensalidades e lançamentos fictícios...');
inserirMensalidades(0);
