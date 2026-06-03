const express = require('express');
const router = express.Router();
const Documento = require('../models/Documento');

// GET /api/analisis/resumen - Dashboard general
router.get('/resumen', async (req, res) => {
  try {
    const [total, porCategoria, porTags, recientes, ultimaSemana] = await Promise.all([
      Documento.countDocuments(),
      Documento.aggregate([{ $group: { _id: '$categoria', total: { $sum: 1 } } }, { $sort: { total: -1 } }]),
      Documento.aggregate([{ $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } }, { $group: { _id: '$tags', total: { $sum: 1 } } }, { $sort: { total: -1 } }, { $limit: 8 }]),
      Documento.find().sort({ creadoEn: -1 }).limit(5).select('titulo categoria creadoEn'),
      Documento.countDocuments({ creadoEn: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })
    ]);
    res.json({ total, porCategoria, porTags, recientes, ultimaSemana });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analisis/timeline - Documentos por día (últimos 30 días)
router.get('/timeline', async (req, res) => {
  try {
    const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const data = await Documento.aggregate([
      { $match: { creadoEn: { $gte: hace30 } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$creadoEn' } }, total: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/analisis/consulta - Consulta personalizada (aggregation pipeline)
router.post('/consulta', async (req, res) => {
  try {
    const { pipeline } = req.body;
    if (!Array.isArray(pipeline)) return res.status(400).json({ error: 'pipeline debe ser un array' });
    // Solo permitir operaciones de lectura seguras
    const opsPermitidas = ['$match', '$group', '$sort', '$limit', '$project', '$unwind', '$count', '$addFields', '$replaceRoot', '$skip'];
    for (const etapa of pipeline) {
      const op = Object.keys(etapa)[0];
      if (!opsPermitidas.includes(op)) return res.status(400).json({ error: `Operación no permitida: ${op}` });
    }
    const resultado = await Documento.aggregate(pipeline);
    res.json({ resultado, total: resultado.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analisis/busqueda-avanzada - Búsqueda con múltiples filtros
router.get('/busqueda-avanzada', async (req, res) => {
  try {
    const { texto, categoria, tags, desde, hasta, campo, valor } = req.query;
    const filtro = {};
    if (categoria) filtro.categoria = categoria;
    if (tags) filtro.tags = { $in: tags.split(',').map(t => t.trim()) };
    if (desde || hasta) {
      filtro.creadoEn = {};
      if (desde) filtro.creadoEn.$gte = new Date(desde);
      if (hasta) filtro.creadoEn.$lte = new Date(hasta);
    }
    if (texto) filtro.$or = [
      { titulo: { $regex: texto, $options: 'i' } },
      { categoria: { $regex: texto, $options: 'i' } }
    ];
    const docs = await Documento.find(filtro).sort({ creadoEn: -1 }).limit(50);
    res.json({ total: docs.length, documentos: docs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
