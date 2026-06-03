const mongoose = require('mongoose');

const DocumentoSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  contenido: { type: mongoose.Schema.Types.Mixed, required: true }, // JSON libre
  tags: [{ type: String }],
  categoria: { type: String, default: 'general' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  creadoEn: { type: Date, default: Date.now },
  actualizadoEn: { type: Date, default: Date.now }
});

// Actualizar fecha al modificar
DocumentoSchema.pre('save', function(next) {
  this.actualizadoEn = new Date();
  next();
});

// Índice de texto para búsquedas
DocumentoSchema.index({ titulo: 'text', tags: 'text', categoria: 'text' });

module.exports = mongoose.model('Documento', DocumentoSchema);
