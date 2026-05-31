# Manual do CRM Pro - Sistema de Afiliados

## Requisitos Mínimos
- **SO**: Windows 7 ou superior
- **Node.js**: Versão 18+ (baixar em [nodejs.org](https://nodejs.org))
- **Espaço em disco**: 50MB livres
- **Navegador**: Chrome, Firefox ou Edge atualizados

## Como Iniciar o Sistema
1. **Instalar dependências** (apenas 1ª vez):
   Abra o prompt de comando na pasta do projeto e execute:
   ```bash
   npm install
   ```
2. **Iniciar o servidor**:
   - **Para clientes**: Dê dois cliques no arquivo `iniciar.bat`
   - **Manual**: Execute `npm start` no prompt de comando
3. **Acessar**: Abra o navegador e vá para `http://localhost:3000`

## Ativação da Licença
O sistema bloqueia o acesso sem licença válida. Siga os passos:

### 1. Gerar Chave
- Acesse `http://localhost:3000/generate-license` (disponível mesmo sem licença)
- Selecione a validade (7, 15 ou 30 dias)
- Clique em **Gerar Licença**
- Copie a chave exibida (formato: `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`)

### 2. Ativar Sistema
- Volte para a página inicial (`http://localhost:3000`)
- Cole a chave no campo "Chave de Licença"
- Clique em **Ativar** → Você será redirecionado ao Dashboard

### 3. Validade
- A data de expiração aparece no **topo direito** de todas as páginas
- Faltando 7 dias ou menos, o contador fica em amarelo
- Após expirar, o sistema pedirá uma nova chave automaticamente

## Observações
- O banco de dados fica em `database/crm.db` (não exclua este arquivo)
- Se a porta 3000 estiver em uso, altere a variável `PORT` no arquivo `src/server.js`
- Para suporte: suporte@msdosinformatica.com.br
