const express = require('express');
const router = express.Router();
const Documento = require('../models/Documento');
const { escaparRegex, validarPipeline } = require('../utils/sanitizar');

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const TIMEOUT_AGREGACION_MS = 5000;
const LIMITE_RESULTADOS_CONSULTA = 200;

// GET /api/analisis/resumen - Dashboard general
router.get('/resumen', async (req, res) => {
  try {
    const [total, porCategoria, porTags, recientes, ultimaSemana] = await Promise.all([
      Documento.countDocuments(),
      Documento.aggregate([{ $group: { _id: '$categoria', total: { $sum: 1 } } }, { $sort: { total: -1 } }]),
      Documento.aggregate([{ $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } }, { $group: { _id: '$tags', total: { $sum: 1 } } }, { $sort: { total: -1 } }, { $limit: 8 }]),
      Documento.find().sort({ creadoEn: -1 }).limit(5).select('titulo categoria creadoEn'),
      Documento.countDocuments({ creadoEn: { $gte: new Date(Date.now() - 7 * MS_POR_DIA) } })
    ]);
    res.json({ total, porCategoria, porTags, recientes, ultimaSemana });
  } catch (error) {
    console.error('Error en resumen:', error.message);
    res.status(500).json({ error: 'Error al generar el resumen' });
  }
});

// GET /api/analisis/timeline - Documentos por día (últimos 30 días)
router.get('/timeline', async (req, res) => {
  try {
    const hace30 = new Date(Date.now() - 30 * MS_POR_DIA);
    const data = await Documento.aggregate([
      { $match: { creadoEn: { $gte: hace30 } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$creadoEn' } }, total: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json(data);
  } catch (error) {
    console.error('Error en timeline:', error.message);
    res.status(500).json({ error: 'Error al generar el timeline' });
  }
});

// POST /api/analisis/consulta - Consulta personalizada (aggregation pipeline de solo lectura)
router.post('/consulta', async (req, res) => {
  try {
    const { pipeline } = req.body;
    const validacion = validarPipeline(pipeline);
    if (!validacion.valido) {
      return res.status(400).json({ error: validacion.error });
    }
    const resultado = await Documento.aggregate([...pipeline, { $limit: LIMITE_RESULTADOS_CONSULTA }])
      .option({ maxTimeMS: TIMEOUT_AGREGACION_MS });
    res.json({ resultado, total: resultado.length });
  } catch (error) {
    console.error('Error en consulta personalizada:', error.message);
    res.status(500).json({ error: 'Error al ejecutar la consulta' });
  }
});

// GET /api/analisis/busqueda-avanzada - Búsqueda con múltiples filtros
router.get('/busqueda-avanzada', async (req, res) => {
  try {
    const { texto, categoria, tags, desde, hasta } = req.query;
    const filtro = {};
    if (categoria) filtro.categoria = String(categoria);
    if (tags) filtro.tags = { $in: String(tags).split(',').map(t => t.trim()) };
    if (desde || hasta) {
      filtro.creadoEn = {};
      if (desde) filtro.creadoEn.$gte = new Date(String(desde));
      if (hasta) filtro.creadoEn.$lte = new Date(String(hasta));
    }
    if (texto) {
      const seguro = escaparRegex(texto);
      filtro.$or = [
        { titulo: { $regex: seguro, $options: 'i' } },
        { categoria: { $regex: seguro, $options: 'i' } }
      ];
    }
    const docs = await Documento.find(filtro).sort({ creadoEn: -1 }).limit(50);
    res.json({ total: docs.length, documentos: docs });
  } catch (error) {
    console.error('Error en búsqueda avanzada:', error.message);
    res.status(500).json({ error: 'Error en la búsqueda' });
  }
});

module.exports = router;
