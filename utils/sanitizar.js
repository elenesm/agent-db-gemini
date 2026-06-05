// Utilidades de sanitización para entradas de usuario

// Escapa caracteres especiales de regex para prevenir ReDoS e inyección de regex
function escaparRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Operadores de agregación permitidos (solo lectura)
const ETAPAS_PERMITIDAS = ['$match', '$group', '$sort', '$limit', '$project', '$unwind', '$count', '$addFields', '$replaceRoot', '$skip'];

// Operadores peligrosos bloqueados en cualquier nivel del pipeline
const OPERADORES_BLOQUEADOS = ['$function', '$accumulator', '$where', '$lookup', '$merge', '$out', '$graphLookup', '$unionWith', '$facet'];

// Valida recursivamente que el pipeline no contenga operadores peligrosos
function validarPipeline(pipeline) {
  if (!Array.isArray(pipeline)) {
    return { valido: false, error: 'pipeline debe ser un array' };
  }
  if (pipeline.length > 10) {
    return { valido: false, error: 'pipeline excede el máximo de 10 etapas' };
  }
  for (const etapa of pipeline) {
    const claves = Object.keys(etapa);
    if (claves.length !== 1 || !ETAPAS_PERMITIDAS.includes(claves[0])) {
      return { valido: false, error: `Operación no permitida: ${claves[0] || '(vacía)'}` };
    }
  }
  const bloqueado = buscarOperadorBloqueado(pipeline);
  if (bloqueado) {
    return { valido: false, error: `Operador bloqueado: ${bloqueado}` };
  }
  return { valido: true };
}

// Recorre el objeto en profundidad buscando operadores bloqueados
function buscarOperadorBloqueado(valor) {
  if (Array.isArray(valor)) {
    for (const item of valor) {
      const encontrado = buscarOperadorBloqueado(item);
      if (encontrado) return encontrado;
    }
    return null;
  }
  if (valor && typeof valor === 'object') {
    for (const clave of Object.keys(valor)) {
      if (OPERADORES_BLOQUEADOS.includes(clave)) return clave;
      const encontrado = buscarOperadorBloqueado(valor[clave]);
      if (encontrado) return encontrado;
    }
  }
  return null;
}

module.exports = { escaparRegex, validarPipeline };
