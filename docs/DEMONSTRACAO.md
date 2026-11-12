# Demonstração do sistema

## Preparar

1. Copie `.env.demo.example` para `.env.demo`.
2. Preencha a conexão com o seu MySQL e escolha `DEMO_ADMIN_PASSWORD` (12 a 128 caracteres). Use um banco exclusivo com nome terminado em `_demo`.
3. Com o MySQL em execução, rode `npm run demo:seed`.
4. Inicie com `npm run demo:start` e acesse `http://localhost:3000` (ou a porta de `APP_PORT`).
5. Entre com o login `demo.admin` e a senha definida em `DEMO_ADMIN_PASSWORD`.

A carga cria as tabelas necessárias e adiciona 6 pacientes, 3 médicos e 8 consultas, sendo 6 para hoje e 2 para amanhã, de acordo com a data do MySQL. Todos os nomes têm o sufixo Demo; os e-mails usam example.com. Não são usados CPFs, telefones ou registros profissionais reais.

A carga preserva os registros e as senhas existentes. Repetir no mesmo dia não duplica os exemplos intactos. Se você editar as observações que identificam um exemplo, ele deixa de ser reconhecido pela carga. Ao executar em outro dia, são adicionados exemplos para as novas datas, preservando o histórico. Conflitos de horário existentes são respeitados.

O arquivo `.env.demo` e os arquivos locais de MySQL em `.demo/` não são enviados ao Git. Se a sua cópia já veio com a instância local preparada, basta `npm run demo:start`: o comando inicia o MySQL próprio e a aplicação. Ao encerrar com Ctrl+C, essa instância também é encerrada. Para uma cópia nova do repositório, utilize seu serviço MySQL normal; o campo opcional `DEMO_MYSQL_BIN` pressupõe um diretório `.demo/mysql` já inicializado.

O ambiente de demonstração mostra um aviso de dados fictícios e atende somente no computador local. Ele usa uma configuração própria e não altera o arquivo `.env` da aplicação.

## Roteiro de 90 segundos

Antes de começar, deixe a janela em uma largura confortável, feche outras abas e entre no sistema. Não grave a senha nem o conteúdo do arquivo de configuração.

| Tempo | Mostrar | Ação e resultado |
|---|---|---|
| 0–10 s | Visão geral | Mostrar os totais e os atendimentos do dia. Apontar o aviso de demonstração. |
| 10–30 s | Pacientes → Novo paciente | Cadastrar o paciente fictício abaixo. Mostrar a confirmação de sucesso. |
| 30–55 s | Agenda → Nova consulta | Selecionar o novo paciente, Marina Duarte (Demo), a data de hoje, 14:00 e Agendada. Mostrar o registro na lista. |
| 55–75 s | Editar consulta | Mudar para 14:30 e Confirmada. Salvar e mostrar o novo horário e o status. |
| 75–90 s | Buscar e filtrar | Buscar por Apresentação, selecionar a data e o status Confirmada. Mostrar o resultado e limpar os filtros. |

### Dados do cadastro durante a gravação

| Campo | Valor fictício |
|---|---|
| Nome | Paciente Apresentação (Demo) |
| Data de nascimento | 15/04/1995 |
| E-mail | apresentacao@example.com |
| Endereço | Endereço fictício para demonstração |
| CPF e telefone | Deixar em branco |
| Observações da consulta | Consulta fictícia para apresentação do projeto. |

Os exemplos iniciais deixam 14:00 e 14:30 livres. Se você já ensaiou nesses horários, reutilize a consulta de ensaio, cancele-a antes de gravar novamente ou escolha outro intervalo livre. Consultas duram 30 minutos.

### Cenas opcionais

- Tentar agendar outra consulta no mesmo intervalo para mostrar o aviso de conflito.
- Cancelar a consulta pelo botão Cancelar consulta: o registro permanece e o intervalo fica disponível.
- Mostrar o menu e a agenda no celular. A largura de 390 px é uma boa referência para a captura.

### Fala sugerida

“Este sistema de agendamento foi desenvolvido na disciplina de Back end II, no quarto período da faculdade. Nesta versão, evoluí a organização do código, a segurança, as regras da agenda e a experiência de uso. Aqui cadastro um paciente, agendo uma consulta e atualizo o atendimento. A aplicação também impede conflitos de horário e funciona no celular.”

## Checklist para gravar

- Verificar que o aviso de demonstração está visível.
- Usar somente os dados fictícios da base e do roteiro.
- Conferir o horário livre e fazer um ensaio.
- Gravar o fluxo com o cursor e os textos legíveis.
- Mostrar a mensagem de sucesso e o resultado de cada operação.
