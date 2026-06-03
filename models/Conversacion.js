const mongoose = require('mongoose');

const MensajeSchema = new mongoose.Schema({
  rol: { type: String, enum: ['user', 'assistant'], required: true },
  contenido: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const ConversacionSchema = new mongoose.Schema({
  titulo: { type: String, default: 'Nueva conversación' },
  mensajes: [MensajeSchema],
  creadaEn: { type: Date, default: Date.now },
  actualizadaEn: { type: Date, default: Date.now }
});

ConversacionSchema.pre('save', function(next) {
  this.actualizadaEn = new Date();
  next();
});

module.exports = mongoose.model('Conversacion', ConversacionSchema);
