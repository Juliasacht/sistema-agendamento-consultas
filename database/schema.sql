-- Estrutura inicial para uma instalacao nova do sistema.
-- Execute na raiz: mysql -u root -p < database/schema.sql
-- Se DB_NAME for diferente de clinica_db, ajuste CREATE DATABASE e USE.
-- Nao apaga dados nem altera tabelas existentes; nao substitui migracoes.
-- O administrador deve ser cadastrado separadamente: nenhum login padrao e criado.

CREATE DATABASE IF NOT EXISTS clinica_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE clinica_db;

CREATE TABLE IF NOT EXISTS Admins (
  idAdmin INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(150) NOT NULL,
  login VARCHAR(100) NOT NULL,
  senha VARCHAR(255) NOT NULL,
  PRIMARY KEY (idAdmin),
  UNIQUE KEY uq_admins_login (login)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Pacientes (
  idPaciente INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(150) NOT NULL,
  cpf VARCHAR(14) NULL,
  dataNascimento DATE NULL,
  telefone VARCHAR(30) NULL,
  endereco VARCHAR(255) NULL,
  email VARCHAR(254) NULL,
  PRIMARY KEY (idPaciente),
  UNIQUE KEY uq_pacientes_cpf (cpf)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Medicos (
  idMedico INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(150) NOT NULL,
  crm VARCHAR(30) NOT NULL,
  especialidade VARCHAR(150) NOT NULL,
  telefone VARCHAR(30) NULL,
  email VARCHAR(254) NULL,
  disponibilidade TEXT NULL,
  PRIMARY KEY (idMedico),
  UNIQUE KEY uq_medicos_crm (crm)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Consultas (
  idConsulta INT UNSIGNED NOT NULL AUTO_INCREMENT,
  data DATE NOT NULL,
  horario TIME NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'agendada',
  observacoes TEXT NULL,
  idPaciente INT UNSIGNED NOT NULL,
  idMedico INT UNSIGNED NOT NULL,
  PRIMARY KEY (idConsulta),
  KEY idx_consultas_data_horario (data, horario),
  KEY idx_consultas_paciente (idPaciente),
  KEY idx_consultas_medico (idMedico),
  CONSTRAINT fk_consultas_paciente FOREIGN KEY (idPaciente)
    REFERENCES Pacientes (idPaciente) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_consultas_medico FOREIGN KEY (idMedico)
    REFERENCES Medicos (idMedico) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;
