const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// ─── Validar variables de entorno requeridas (fail fast) ─────────────────────
const ENV_REQUERIDAS = ['MONGODB_URI', 'GEMINI_API_KEY'];
const faltantes = ENV_REQUERIDAS.filter(v => !process.env[v]);
if (faltantes.length > 0) {
  console.error(`❌ Faltan variables de entorno: ${faltantes.join(', ')}. Revisa tu archivo .env`);
  process.exit(1);
}

const app = express();

// ─── Seguridad ────────────────────────────────────────────────────────────────
// CSP deshabilitado porque el frontend usa scripts inline; el resto de headers de helmet aplican
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: restringido a orígenes definidos en .env (CORS_ORIGINS, separados por coma).
// Sin configurar, solo permite el mismo origen (peticiones del propio frontend).
const origenesPermitidos = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : [];
app.use(cors({ origin: origenesPermitidos.length > 0 ? origenesPermitidos : false }));

// Rate limiting: límite general + límite estricto para el chat (cada mensaje cuesta tokens de Gemini)
const limiteGeneral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones, intenta más tarde' }
});
const limiteChat = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados mensajes por minuto, espera un momento' }
});

app.use('/api', limiteGeneral);
app.use('/api/chat', limiteChat);

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Base de datos ────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => {
    console.error('❌ Error MongoDB:', err.message);
    process.exit(1);
  });

// ─── Rutas ────────────────────────────────────────────────────────────────────
app.use('/api/chat', require('./routes/chat'));
app.use('/api/documentos', require('./routes/documentos'));
app.use('/api/analisis', require('./routes/analisis'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));
