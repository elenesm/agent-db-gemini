const { z } = require('zod');

const LIMITE_MAX_RESULTADOS = 100;

const esquemaDocumentoCrear = z.object({
  titulo: z.string().min(1).max(200),
  contenido: z.union([z.record(z.any()), z.array(z.any()), z.string().min(1)]),
  categoria: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  metadata: z.record(z.any()).optional()
});

// Mismos campos pero todos opcionales; nada fuera de esta lista entra a la BD
const esquemaDocumentoActualizar = esquemaDocumentoCrear.partial();

const esquemaChat = z.object({
  mensaje: z.string().min(1).max(4000),
  conversacionId: z.string().regex(/^[a-f\d]{24}$/i).optional()
});

const esquemaListarDocumentos = z.object({
  categoria: z.string().max(100).optional(),
  buscar: z.string().max(200).optional(),
  limite: z.coerce.number().int().min(1).max(LIMITE_MAX_RESULTADOS).default(20),
  pagina: z.coerce.number().int().min(1).default(1)
});

module.exports = {
  esquemaDocumentoCrear,
  esquemaDocumentoActualizar,
  esquemaChat,
  esquemaListarDocumentos,
  LIMITE_MAX_RESULTADOS
};
