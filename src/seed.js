const db = require('../database/db');

const afiliados = [
  { nome: 'João Silva Santos', email: 'joao.silva@email.com', telefone: '(11) 99999-1111', cpf: '111.444.777-35' },
  { nome: 'Maria Oliveira Costa', email: 'maria.oliveira@email.com', telefone: '(21) 98888-2222', cpf: '222.555.888-46' },
  { nome: 'Pedro Henrique Lima', email: 'pedro.lima@email.com', telefone: '(31) 97777-3333', cpf: '333.666.999-57' },
  { nome: 'Ana Paula Souza', email: 'ana.souza@email.com', telefone: '(41) 96666-4444', cpf: '444.777.111-68' },
  { nome: 'Carlos Eduardo Rocha', email: 'carlos.rocha@email.com', telefone: '(51) 95555-5555', cpf: '555.888.222-79' },
];

let inseridos = 0;

afiliados.forEach((afiliado, index) => {
  db.run(
    'INSERT INTO afiliados (nome, email, telefone, cpf, status) VALUES (?, ?, ?, ?, ?)',
    [afiliado.nome, afiliado.email, afiliado.telefone, afiliado.cpf, Math.random() > 0.2 ? 'ativo' : 'inativo'],
    function (err) {
      if (err) {
        console.log(`Erro ao inserir ${afiliado.nome}:`, err.message);
      } else {
        inseridos++;
        console.log(`[${inseridos}/30] ${afiliado.nome} inserido com ID ${this.lastID}`);
      }

      if (inseridos === afiliados.length) {
        console.log('\nConcluído! 5 afiliados de exemplo inseridos.');
        db.close();
      }
    }
  );
});
