const express = require('express');
const router = express.Router();
const Documento = require('../models/Documento');

// GET /api/documentos - Listar todos con filtros opcionales
router.get('/', async (req, res) => {
  try {
    const { categoria, buscar, limite = 20, pagina = 1 } = req.query;
    const filtro = {};

    if (categoria) filtro.categoria = categoria;
    if (buscar) filtro.$text = { $search: buscar };

    const documentos = await Documento.find(filtro)
      .sort({ actualizadoEn: -1 })
      .limit(Number(limite))
      .skip((Number(pagina) - 1) * Number(limite));

    const total = await Documento.countDocuments(filtro);

    res.json({ documentos, total, pagina: Number(pagina), limite: Number(limite) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/documentos/:id - Obtener uno
router.get('/:id', async (req, res) => {
  try {
    const doc = await Documento.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/documentos - Crear
router.post('/', async (req, res) => {
  try {
    const { titulo, contenido, tags, categoria, metadata } = req.body;
    if (!titulo || !contenido) {
      return res.status(400).json({ error: 'Título y contenido requeridos' });
    }
    const doc = new Documento({ titulo, contenido, tags, categoria, metadata });
    await doc.save();
    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/documentos/:id - Actualizar
router.put('/:id', async (req, res) => {
  try {
    const doc = await Documento.findByIdAndUpdate(
      req.params.id,
      { ...req.body, actualizadoEn: new Date() },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/documentos/:id - Eliminar
router.delete('/:id', async (req, res) => {
  try {
    const doc = await Documento.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json({ mensaje: 'Documento eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/documentos/stats/categorias - Estadísticas por categoría
router.get('/stats/categorias', async (req, res) => {
  try {
    const stats = await Documento.aggregate([
      { $group: { _id: '$categoria', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
