# Sistema de Agendamento de Consultas

Sistema web para gerenciamento de uma clínica médica, desenvolvido com **Node.js**, **Express**, **EJS** e **MySQL**.

## Sobre o projeto

Projeto desenvolvido no 4º período da faculdade, na disciplina de Back end II, e aprimorado em etapas para apresentação no portfólio.

A aplicação permite administrar pacientes, médicos e consultas em uma área protegida por login. O sistema possui telas para cadastro, listagem, busca, edição e exclusão dos principais registros da clínica.

## Funcionalidades

- Login de administrador
- Dashboard com resumo de pacientes, médicos e consultas
- Cadastro, listagem, busca, edição e exclusão de pacientes
- Cadastro, listagem, busca, edição e exclusão de médicos
- Agendamento, listagem, busca, edição e exclusão de consultas
- Controle de status da consulta
- Layout com páginas EJS
- Configuração por variáveis de ambiente

## Regras da agenda

- Cada consulta ocupa 30 minutos, inclusive quando cruza a meia-noite. O valor está centralizado em `src/config/agenda.js`.
- Agendada e Confirmada reservam o intervalo para médico e paciente. Uma consulta pode começar exatamente ao término da anterior.
- O cadastro e a edição verificam os conflitos dentro de uma transação, com bloqueio dos registros de médico e paciente para proteger reservas simultâneas.
- Cancelar mantém o registro e libera o intervalo. Cancelar novamente não altera o resultado.
- Uma consulta cancelada pode voltar a Agendada ou Confirmada, desde que haja disponibilidade; para finalizá-la, é necessário reativá-la primeiro.
- Realizada e Não Compareceu são estados finais: permitem editar apenas observações e não reservam novos horários.
- Médico ou paciente inexistente impede a gravação. Consultas inexistentes retornam 404 na edição, exclusão e cancelamento.
- Excluir continua sendo uma remoção permanente, distinta do cancelamento.

## Tecnologias utilizadas

- Node.js
- Express
- EJS
- MySQL
- mysql2
- express-session
- dotenv
- HTML
- CSS
- JavaScript

## Pré-requisitos

- Node.js e npm instalados
- MySQL em execução e um usuário com permissão para criar o banco e as tabelas
- Git para clonar o repositório

## Como executar

Clone o repositório:

```bash
git clone https://github.com/Juliasacht/sistema-agendamento-consultas.git
```

Acesse a pasta do projeto:

```bash
cd sistema-agendamento-consultas
```

Instale as dependências:

```bash
npm install
```

Crie um arquivo `.env` na raiz do projeto usando o `.env.example` como base:

```env
APP_PORT=3000
SESSION_SECRET=

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=clinica_db
```

Configure `DB_USER` e `DB_PASS` com suas credenciais locais e escolha um valor próprio para `SESSION_SECRET`. O arquivo `.env` não deve ser enviado ao GitHub.

### Preparar o banco

Na raiz do projeto, abra o cliente MySQL (substitua `root` pelo seu usuário):

```bash
mysql -u root -p
```

No prompt do MySQL, execute:

```sql
SOURCE database/schema.sql;
```

O script cria o banco `clinica_db` e as tabelas `Admins`, `Pacientes`, `Medicos` e `Consultas`, com seus relacionamentos. No MySQL Workbench, também é possível abrir e executar o arquivo [database/schema.sql](database/schema.sql).

Se utilizar outro nome de banco, ajuste `CREATE DATABASE` e `USE` no script e `DB_NAME` no `.env`. O script não apaga registros nem modifica a estrutura de tabelas já existentes; ele se destina à instalação inicial.

### Criar o administrador

Não existe usuário administrador padrão nem tela pública de cadastro. Após preparar o banco, execute em um terminal interativo:

```bash
npm run admin:create
```

Informe nome, login e uma senha de 12 a 128 caracteres. A senha e a confirmação ficam ocultas durante a digitação. O comando armazena apenas o hash scrypt com salt aleatório, sem gravar a senha em texto puro.

Se já existir um administrador cadastrado na versão anterior, redefina sua senha antes de tentar entrar:

```bash
npm run admin:create -- --reset-password
```

Informe o login existente e a nova senha. Senhas antigas em texto puro não são aceitas pelo login; a redefinição preserva os demais dados do administrador. Um login duplicado não é sobrescrito pelo comando de criação.

### Iniciar o servidor

Inicie a aplicação:

```bash
npm start
```

Ou, em modo de desenvolvimento:

```bash
npm run dev
```

Acesse no navegador:

```text
http://localhost:3000
```

Para entrar na área administrativa, acesse `http://localhost:3000/admin/login` e use as credenciais cadastradas.

## Demonstração

Há uma base fictícia com 6 pacientes, 3 médicos e 8 consultas, além de um [roteiro de 90 segundos](docs/DEMONSTRACAO.md) para mostrar cadastro, agendamento e atualização.

Copie `.env.demo.example` para `.env.demo`, preencha as credenciais do MySQL e a senha do administrador de demonstração. Com o MySQL em execução:

```bash
npm run demo:seed
npm run demo:start
```

Use o login `demo.admin` e a senha definida em `DEMO_ADMIN_PASSWORD`. A carga aceita somente bancos com nome terminado em `_demo`; os registros e as senhas existentes são preservados.

## Interface

A interface usa uma identidade visual com azul profundo, verde e fundos claros, fontes do sistema e componentes padronizados. No computador, a navegação fica na lateral; em telas menores, o menu pode ser aberto pelo botão Menu, fechado pelo fundo ou pela tecla Escape.

O painel mostra os totais reais de pacientes, médicos e consultas do dia, além dos seis primeiros registros da agenda de hoje. Os formulários usam duas colunas no computador e uma no celular; as tabelas se transformam em cartões em telas pequenas. Há indicação de foco, atalho para pular ao conteúdo e rótulos associados aos campos.

## Experiência de uso

- Mensagens de sucesso após cadastrar, editar, excluir ou cancelar. Elas aparecem na próxima página renderizada e não se repetem ao atualizar.
- Confirmações de exclusão identificam o registro e informam que a remoção é permanente. O cancelamento de consulta explica que o histórico será mantido.
- Buscas por nome e dados de contato, com limite de 120 caracteres, contador de resultados e opção de limpar os filtros. Os caracteres `%` e `_` são pesquisados literalmente.
- Na agenda, os filtros de texto, data e status podem ser combinados.
- Listas vazias orientam o primeiro cadastro; buscas sem resultado sugerem revisar ou limpar os filtros.
- Falhas de exclusão ou cancelamento apresentam um caminho para voltar à lista.

## Proteções de segurança

- Exclusões, cancelamento e logout são feitos por POST. Links GET não executam essas ações.
- Todos os formulários POST, inclusive o login, exigem um token CSRF vinculado à sessão. Se a sessão expirar, recarregue o formulário.
- O login permite até 10 tentativas por IP a cada 15 minutos, incluindo acessos bem-sucedidos. O bloqueio responde com HTTP 429 e `Retry-After`.
- Cookies de sessão têm duração de duas horas, `HttpOnly`, `SameSite=Lax` e `Secure` em produção. As páginas dinâmicas não devem ser armazenadas em cache.
- Falhas de banco retornam mensagens sem SQL ou detalhes internos; duplicidade e registros vinculados recebem mensagens específicas. Erros assíncronos e JSON inválido são tratados centralmente.
- Em desenvolvimento, se `SESSION_SECRET` estiver vazio, um segredo temporário é gerado. Em produção, é obrigatório configurar um segredo próprio com pelo menos 32 caracteres. Para gerar um valor, execute `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` e copie o resultado para o `.env`.

As sessões e os contadores de tentativas usam memória do processo. Antes de hospedar várias instâncias, configure armazenamento compartilhado para ambos e ajuste o proxy confiável conforme a infraestrutura. As verificações de integração incluem rejeição de CSRF inválido, bloqueio de ações via GET e limite de login.

## Testes

Execute `npm test` para verificar o hash de senhas, o fluxo de autenticação e a validação das consultas. Esses testes não precisam de MySQL; o teste de integração fica desativado por padrão.

### Integração com MySQL real

O arquivo `test/integration.test.js` inicia um servidor temporário e testa requisições HTTP reais, incluindo login, proteção das rotas, cadastro, busca, edição e exclusão de pacientes, médicos e consultas, atualização de status e logout. As gravações são conferidas diretamente no banco.

Com o MySQL em execução, configure no PowerShell:

```powershell
$env:RUN_INTEGRATION = "1"
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3306"
$env:DB_USER = "seu_usuario_de_testes"
$env:DB_PASS = "sua_senha_de_testes"
$env:DB_NAME = "clinica_integration_test"
node --test test/integration.test.js
Remove-Item Env:RUN_INTEGRATION
```

Use um banco exclusivo de testes: o comando exige um nome terminado em `_test` e um usuário com permissão para criar esse banco e suas tabelas. Os dados fictícios recebem identificadores aleatórios e são removidos ao final; o banco permanece disponível. O teste não usa o banco definido no `.env` quando as variáveis acima estão configuradas.

A porta HTTP padrão é `33318` e pode ser alterada pela variável `INTEGRATION_PORT`. Não execute duas instâncias do teste na mesma porta. Os testes validam o funcionamento por HTTP; a avaliação visual e a responsividade são uma etapa separada.

## Melhorias futuras

- Melhorar validações dos formulários
- Adicionar documentação com prints das telas
- Publicar uma versão online do projeto
