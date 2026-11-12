export function databaseError(err, duplicateLabel = 'Registro') {
  if (err.code === 'ER_DUP_ENTRY') return { status: 409, message: duplicateLabel + ' já cadastrado.' };
  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return { status: 409, message: 'Este registro possui consultas vinculadas e não pode ser excluído.' };
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return { status: 422, message: 'Um dos registros selecionados não existe mais. Recarregue o formulário.' };
  }
  if (['ER_DATA_TOO_LONG', 'ER_TRUNCATED_WRONG_VALUE', 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', 'ER_BAD_NULL_ERROR', 'ER_WRONG_ARGUMENTS'].includes(err.code)) {
    return { status: 400, message: 'Há dados inválidos no formulário. Confira os campos e tente novamente.' };
  }
  return { status: 500, message: 'Não foi possível concluir a operação. Tente novamente.' };
}
