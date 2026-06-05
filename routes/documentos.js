const express = require('express');
const router = express.Router();
const Documento = require('../models/Documento');
const { esquemaDocumentoCrear, esquemaDocumentoActualizar, esquemaListarDocumentos } = require('../utils/esquemas');

// GET /api/documentos - Listar todos con filtros opcionales
router.get('/', async (req, res) => {
  try {
    const validacion = esquemaListarDocumentos.safeParse(req.query);
    if (!validacion.success) {
      return res.status(400).json({ error: 'Parámetros inválidos', detalles: validacion.error.issues.map(i => i.message) });
    }
    const { categoria, buscar, limite, pagina } = validacion.data;
    const filtro = {};

    if (categoria) filtro.categoria = categoria;
    if (buscar) filtro.$text = { $search: buscar };

    const documentos = await Documento.find(filtro)
      .sort({ actualizadoEn: -1 })
      .limit(limite)
      .skip((pagina - 1) * limite);

    const total = await Documento.countDocuments(filtro);

    res.json({ documentos, total, pagina, limite });
  } catch (error) {
    console.error('Error listando documentos:', error.message);
    res.status(500).json({ error: 'Error al listar documentos' });
  }
});

// GET /api/documentos/:id - Obtener uno
router.get('/:id', async (req, res) => {
  try {
    const doc = await Documento.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json(doc);
  } catch (error) {
    console.error('Error obteniendo documento:', error.message);
    res.status(500).json({ error: 'Error al obtener el documento' });
  }
});

// POST /api/documentos - Crear
router.post('/', async (req, res) => {
  try {
    const validacion = esquemaDocumentoCrear.safeParse(req.body);
    if (!validacion.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: validacion.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) });
    }
    const doc = new Documento(validacion.data);
    await doc.save();
    res.status(201).json(doc);
  } catch (error) {
    console.error('Error creando documento:', error.message);
    res.status(500).json({ error: 'Error al crear el documento' });
  }
});

// PUT /api/documentos/:id - Actualizar (solo campos permitidos por el esquema)
router.put('/:id', async (req, res) => {
  try {
    const validacion = esquemaDocumentoActualizar.safeParse(req.body);
    if (!validacion.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: validacion.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) });
    }
    const doc = await Documento.findByIdAndUpdate(
      req.params.id,
      { ...validacion.data, actualizadoEn: new Date() },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json(doc);
  } catch (error) {
    console.error('Error actualizando documento:', error.message);
    res.status(500).json({ error: 'Error al actualizar el documento' });
  }
});

// DELETE /api/documentos/:id - Eliminar
router.delete('/:id', async (req, res) => {
  try {
    const doc = await Documento.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json({ mensaje: 'Documento eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando documento:', error.message);
    res.status(500).json({ error: 'Error al eliminar el documento' });
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
    console.error('Error en estadísticas:', error.message);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

module.exports = router;
