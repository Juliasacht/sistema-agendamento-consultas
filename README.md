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
SESSION_SECRET=troque-este-segredo-em-producao

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

### Preparar o acesso local

Não existe usuário administrador padrão nem tela de cadastro de administradores. Para testar a versão atual localmente, cadastre um usuário no MySQL:

```sql
USE clinica_db;
INSERT INTO Admins (nome, login, senha)
VALUES ('Administrador local', 'admin.local', 'SUBSTITUA_POR_UMA_SENHA_LOCAL');
```

Substitua o valor de exemplo por uma senha de teste antes de executar. A autenticação atual compara senhas em texto puro; este procedimento serve apenas ao ambiente local. O armazenamento com hash precisa ser implementado antes de disponibilizar o login publicamente.

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

## Melhorias futuras

- Implementar armazenamento de senhas com hash e criação segura do administrador
- Criar testes automatizados
- Melhorar validações dos formulários
- Adicionar documentação com prints das telas
- Publicar uma versão online do projeto
