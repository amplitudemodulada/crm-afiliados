const db = require('../database/db');

const afiliados = [
  { nome: 'João Silva Santos', email: 'joao.silva@email.com', telefone: '(11) 99999-1111', cpf: '111.444.777-35', endereco: 'Rua das Flores, 123 - São Paulo, SP' },
  { nome: 'Maria Oliveira Costa', email: 'maria.oliveira@email.com', telefone: '(21) 98888-2222', cpf: '222.555.888-46', endereco: 'Av. Copacabana, 456 - Rio de Janeiro, RJ' },
  { nome: 'Pedro Henrique Lima', email: 'pedro.lima@email.com', telefone: '(31) 97777-3333', cpf: '333.666.999-57', endereco: 'Rua da Praia, 789 - Belo Horizonte, MG' },
  { nome: 'Ana Paula Souza', email: 'ana.souza@email.com', telefone: '(41) 96666-4444', cpf: '444.777.111-68', endereco: 'Av. das Cataratas, 101 - Foz do Iguaçu, PR' },
  { nome: 'Carlos Eduardo Rocha', email: 'carlos.rocha@email.com', telefone: '(51) 95555-5555', cpf: '555.888.222-79', endereco: 'Rua dos Andradas, 202 - Porto Alegre, RS' },
  { nome: 'Fernanda Lima Gomes', email: 'fernanda.gomes@email.com', telefone: '(61) 94444-6666', cpf: '666.999.333-80', endereco: 'SQS 308, Bloco B, Apt 101 - Brasília, DF' },
  { nome: 'Ricardo Alves Dias', email: 'ricardo.dias@email.com', telefone: '(71) 93333-7777', cpf: '777.111.444-91', endereco: 'Rua da Paz, 303 - Salvador, BA' },
  { nome: 'Juliana Castro Melo', email: 'juliana.melo@email.com', telefone: '(81) 92222-8888', cpf: '888.222.555-02', endereco: 'Av. Boa Viagem, 404 - Recife, PE' },
  { nome: 'Marcos Vinicius Reis', email: 'marcos.reis@email.com', telefone: '(91) 91111-9999', cpf: '999.333.666-13', endereco: 'Rua 9 de Janeiro, 505 - Belém, PA' },
  { nome: 'Patrícia Nunes Ferreira', email: 'patricia.ferreira@email.com', telefone: '(11) 90000-1010', cpf: '123.456.789-00', endereco: 'Rua Augusta, 606 - São Paulo, SP' },
  { nome: 'Bruno Mendes Cardoso', email: 'bruno.cardoso@email.com', telefone: '(12) 99999-1111', cpf: '234.567.890-11', endereco: 'Av. dos Astronautas, 707 - São José dos Campos, SP' },
  { nome: 'Camila Ribeiro Neves', email: 'camila.neves@email.com', telefone: '(13) 98888-2222', cpf: '345.678.901-22', endereco: 'Rua da Praia, 808 - Santos, SP' },
  { nome: 'Diego Martins Franco', email: 'diego.franco@email.com', telefone: '(14) 97777-3333', cpf: '456.789.012-33', endereco: 'Rua Azem Attux, 909 - Bauru, SP' },
  { nome: 'Evelyn Araújo Torres', email: 'evelyn.torres@email.com', telefone: '(15) 96666-4444', cpf: '567.890.123-44', endereco: 'Av. Washington Luís, 1010 - Sorocaba, SP' },
  { nome: 'Felipe Gomes Barros', email: 'felipe.barros@email.com', telefone: '(16) 95555-5555', cpf: '678.901.234-55', endereco: 'Rua Santa Luzia, 111 - Ribeirão Preto, SP' },
  { nome: 'Gabriela Dias Nogueira', email: 'gabriela.nogueira@email.com', telefone: '(17) 94444-6666', cpf: '789.012.345-66', endereco: 'Av. Brigadeiro Faria Lima, 1212 - São José do Rio Preto, SP' },
  { nome: 'Henrique Pires Duarte', email: 'henrique.duarte@email.com', telefone: '(18) 93333-7777', cpf: '890.123.456-77', endereco: 'Rua Marechal Deodoro, 1313 - Araçatuba, SP' },
  { nome: 'Isabela Borges Lopes', email: 'isabela.lopes@email.com', telefone: '(19) 92222-8888', cpf: '901.234.567-88', endereco: 'Rua Conceição, 1414 - Campinas, SP' },
  { nome: 'Jorge Henrique Vale', email: 'jorge.vale@email.com', telefone: '(21) 91111-9999', cpf: '012.345.678-99', endereco: 'Rua da Lapa, 1515 - Rio de Janeiro, RJ' },
  { nome: 'Karen Cristina Moura', email: 'karen.moura@email.com', telefone: '(22) 90000-1010', cpf: '112.233.445-50', endereco: 'Av. Amaral Peixoto, 1616 - Niterói, RJ' },
  { nome: 'Leonardo Freitas Almeida', email: 'leonardo.almeida@email.com', telefone: '(23) 99999-1111', cpf: '223.344.556-61', endereco: 'Rua 15 de Novembro, 1717 - Juiz de Fora, MG' },
  { nome: 'Márcia Regina Campos', email: 'marcia.campos@email.com', telefone: '(24) 98888-2222', cpf: '334.455.667-72', endereco: 'Av. dos Andradas, 1818 - Poços de Caldas, MG' },
  { nome: 'Nelson Gonçalves Prieto', email: 'nelson.prieto@email.com', telefone: '(25) 97777-3333', cpf: '445.566.778-83', endereco: 'Rua Direita, 1919 - Ouro Preto, MG' },
  { nome: 'Olívia Martins Carvalho', email: 'olivia.carvalho@email.com', telefone: '(26) 96666-4444', cpf: '556.677.889-94', endereco: 'Av. Afonso Pena, 2020 - Belo Horizonte, MG' },
  { nome: 'Paulo Roberto Siqueira', email: 'paulo.siqueira@email.com', telefone: '(27) 95555-5555', cpf: '667.788.990-05', endereco: 'Rua da Quitanda, 2121 - Vitória, ES' },
  { nome: 'Renata Vieira Cardoso', email: 'renata.cardoso@email.com', telefone: '(28) 94444-6666', cpf: '778.899.001-16', endereco: 'Av. Rio Branco, 2222 - Vitória, ES' },
  { nome: 'Sérgio Augusto Tavares', email: 'sergio.tavares@email.com', telefone: '(29) 93333-7777', cpf: '889.900.112-27', endereco: 'Rua da Alfândega, 2323 - Recife, PE' },
  { nome: 'Tatiane Santos Xavier', email: 'tatiane.xavier@email.com', telefone: '(31) 92222-8888', cpf: '990.011.223-38', endereco: 'Rua do Hospício, 2424 - Recife, PE' },
  { nome: 'Umberto Junior Lacerda', email: 'umberto.lacerda@email.com', telefone: '(32) 91111-9999', cpf: '001.122.334-49', endereco: 'Av. Sérgio Carneiro, 2525 - Fortaleza, CE' },
  { nome: 'Vanessa Miranda Cunha', email: 'vanessa.cunha@email.com', telefone: '(33) 90000-1010', cpf: '110.223.445-50', endereco: 'Rua Barbosa de Freitas, 2626 - Fortaleza, CE' }
];

console.log('Limpando tabelas afiliados, mensalidades e lançamentos...');
db.serialize(() => {
  db.run('DELETE FROM lancamentos');
  db.run('DELETE FROM mensalidades');
  db.run('DELETE FROM afiliados', [], function() {
    console.log('Tabelas limpas. Inserindo afiliados com endereços...');
    let inseridos = 0;

    afiliados.forEach((afiliado, index) => {
      db.run(
        'INSERT INTO afiliados (nome, email, telefone, cpf, endereco, status) VALUES (?, ?, ?, ?, ?, ?)',
        [afiliado.nome, afiliado.email, afiliado.telefone, afiliado.cpf, afiliado.endereco, Math.random() > 0.2 ? 'ativo' : 'inativo'],
        function (err) {
          if (err) {
            console.log(`Erro ao inserir ${afiliado.nome}:`, err.message);
          } else {
            inseridos++;
            console.log(`[${inseridos}/30] ${afiliado.nome} inserido com ID ${this.lastID}`);
          }

          if (inseridos === afiliados.length) {
            console.log('\nConcluído! 30 afiliados com endereços inseridos.');
            db.close();
          }
        }
      );
    });
  });
});
