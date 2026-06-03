const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Conversacion = require('../models/Conversacion');
const Documento = require('../models/Documento');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── HERRAMIENTAS QUE EL AGENTE PUEDE USAR ───────────────────────────────────
const tools = [
  {
    functionDeclarations: [
      {
        name: 'buscar_documentos',
        description: 'Busca documentos en MongoDB. Úsala cuando el usuario quiera ver, listar o buscar documentos.',
        parameters: {
          type: 'OBJECT',
          properties: {
            buscar:    { type: 'STRING',  description: 'Texto a buscar (opcional)' },
            categoria: { type: 'STRING',  description: 'Filtrar por categoría (opcional)' },
            limite:    { type: 'NUMBER',  description: 'Máximo de resultados (default 5)' }
          }
        }
      },
      {
        name: 'crear_documento',
        description: 'Crea un nuevo documento JSON en MongoDB. Úsala cuando el usuario quiera guardar o registrar datos.',
        parameters: {
          type: 'OBJECT',
          properties: {
            titulo:    { type: 'STRING',  description: 'Título del documento' },
            contenido: { type: 'STRING',  description: 'Contenido del documento en formato JSON string' },
            categoria: { type: 'STRING',  description: 'Categoría del documento' },
            tags:      { type: 'STRING',  description: 'Tags separados por coma (opcional)' }
          },
          required: ['titulo', 'contenido']
        }
      },
      {
        name: 'analizar_datos',
        description: 'Analiza y genera estadísticas de los documentos en MongoDB. Úsala para preguntas de análisis, totales, agrupaciones.',
        parameters: {
          type: 'OBJECT',
          properties: {
            tipo: {
              type: 'STRING',
              description: 'Tipo de análisis: por_categoria | recientes | total | por_tags'
            }
          },
          required: ['tipo']
        }
      },
      {
        name: 'eliminar_documento',
        description: 'Elimina un documento por su ID. Úsala solo si el usuario confirma querer eliminar.',
        parameters: {
          type: 'OBJECT',
          properties: {
            id: { type: 'STRING', description: 'ID del documento a eliminar' }
          },
          required: ['id']
        }
      }
    ]
  }
];

// ─── EJECUTAR HERRAMIENTA ────────────────────────────────────────────────────
async function ejecutarHerramienta(nombre, input) {
  switch (nombre) {
    case 'buscar_documentos': {
      const filtro = {};
      if (input.categoria) filtro.categoria = input.categoria;
      if (input.buscar) filtro.$or = [
        { titulo:    { $regex: input.buscar, $options: 'i' } },
        { categoria: { $regex: input.buscar, $options: 'i' } },
        { tags:      { $in: [new RegExp(input.buscar, 'i')] } }
      ];
      const docs  = await Documento.find(filtro).limit(input.limite || 5).sort({ actualizadoEn: -1 });
      const total = await Documento.countDocuments(filtro);
      return {
        total,
        documentos: docs.map(d => ({
          id: d._id, titulo: d.titulo, categoria: d.categoria,
          tags: d.tags, contenido: d.contenido, fecha: d.actualizadoEn
        }))
      };
    }
    case 'crear_documento': {
      let contenidoObj;
      try { contenidoObj = typeof input.contenido === 'string' ? JSON.parse(input.contenido) : input.contenido; }
      catch { contenidoObj = { texto: input.contenido }; }

      const tagsArr = input.tags
        ? (Array.isArray(input.tags) ? input.tags : input.tags.split(',').map(t => t.trim()))
        : [];

      const doc = new Documento({
        titulo: input.titulo,
        contenido: contenidoObj,
        categoria: input.categoria || 'general',
        tags: tagsArr
      });
      await doc.save();
      return { exito: true, id: doc._id, mensaje: `Documento "${input.titulo}" creado exitosamente` };
    }
    case 'analizar_datos': {
      if (input.tipo === 'por_categoria') {
        const stats = await Documento.aggregate([
          { $group: { _id: '$categoria', total: { $sum: 1 } } },
          { $sort: { total: -1 } }
        ]);
        return { tipo: 'por_categoria', datos: stats };
      }
      if (input.tipo === 'total') {
        const total = await Documento.countDocuments();
        return { tipo: 'total', total };
      }
      if (input.tipo === 'recientes') {
        const docs = await Documento.find().sort({ creadoEn: -1 }).limit(5).select('titulo categoria creadoEn');
        return { tipo: 'recientes', documentos: docs };
      }
      if (input.tipo === 'por_tags') {
        const stats = await Documento.aggregate([
          { $unwind: '$tags' },
          { $group: { _id: '$tags', total: { $sum: 1 } } },
          { $sort: { total: -1 } },
          { $limit: 10 }
        ]);
        return { tipo: 'por_tags', datos: stats };
      }
      // Cambia esto en tu código:
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      tools: tools // O simplemente pasar: tools: [{ functionDeclarations: tools[0].functionDeclarations }]
    });
      return { exito: true, mensaje: `Documento "${doc.titulo}" eliminado` };
    }
    default:
      return { error: 'Herramienta desconocida' };
  }
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres un agente inteligente experto en gestión y análisis de datos con MongoDB.

Tienes acceso a herramientas reales para interactuar con la base de datos:
- buscar_documentos: busca y lista documentos
- crear_documento: guarda nuevos datos
- analizar_datos: genera estadísticas y análisis
- eliminar_documento: elimina documentos (pide confirmación antes)

COMPORTAMIENTO:
- Si el usuario pide ver datos → usa buscar_documentos
- Si pide estadísticas, análisis, cuántos hay, tendencias → usa analizar_datos
- Si quiere guardar algo → usa crear_documento con los datos que te dé
- Sé proactivo: si el usuario dice "analiza mis datos" usa múltiples herramientas
- Responde siempre en español, de forma clara y estructurada
- Muestra los resultados de forma legible, nunca como JSON crudo`;

// ─── POST /api/chat ───────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { mensaje, conversacionId } = req.body;
    if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

    // Cargar o crear conversación
    let conversacion;
    if (conversacionId) conversacion = await Conversacion.findById(conversacionId);
    if (!conversacion)  conversacion = new Conversacion({ titulo: mensaje.substring(0, 50) });

    conversacion.mensajes.push({ rol: 'user', contenido: mensaje });

    // Construir historial en formato Gemini
    const historial = conversacion.mensajes.slice(0, -1).map(m => ({
      role:  m.rol === 'user' ? 'user' : 'model',
      parts: [{ text: m.contenido }]
    }));

   const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: tools[0].functionDeclarations }]
    });

    const chat = model.startChat({ history: historial });

    // ─── Agentic loop ────────────────────────────────────────────────────────
    let textoFinal = '';
    const accionesEjecutadas = [];
    let iteraciones = 0;
    let inputActual = mensaje;

    while (iteraciones < 5) {
      iteraciones++;
      const resultado = await chat.sendMessage(inputActual);
      const response  = resultado.response;

      // ¿Hay function calls?
      const calls = response.functionCalls();

      if (!calls || calls.length === 0) {
        // Sin herramientas → respuesta final
        textoFinal = response.text();
        break;
      }

      // Ejecutar cada herramienta y acumular resultados
      const functionResponses = [];
      for (const call of calls) {
        const resultadoHerramienta = await ejecutarHerramienta(call.name, call.args);
        accionesEjecutadas.push({
          herramienta: call.name,
          input:       call.args,
          resultado:   resultadoHerramienta
        });
        functionResponses.push({
          functionResponse: {
            name:     call.name,
            response: resultadoHerramienta
          }
        });
      }

      // Devolver resultados a Gemini y continuar el loop
      const siguienteRespuesta = await chat.sendMessage(functionResponses);
      const siguienteCalls     = siguienteRespuesta.response.functionCalls();

      if (!siguienteCalls || siguienteCalls.length === 0) {
        textoFinal = siguienteRespuesta.response.text();
        break;
      }

      // Si sigue llamando herramientas, preparar para la siguiente iteración
      inputActual = functionResponses;
    }

    // Guardar respuesta en historial
    conversacion.mensajes.push({ rol: 'assistant', contenido: textoFinal });
    await conversacion.save();

    res.json({
      respuesta:       textoFinal,
      conversacionId:  conversacion._id,
      titulo:          conversacion.titulo,
      acciones:        accionesEjecutadas
    });

  } catch (error) {
    console.error('Error en chat DETALLE:', error.message, error.stack);
    res.status(500).json({ error: 'Error procesando el mensaje', detalle: error.message });
  }
});

// ─── GET historial ────────────────────────────────────────────────────────────
router.get('/historial', async (req, res) => {
  try {
    const convs = await Conversacion.find()
      .select('titulo creadaEn actualizadaEn')
      .sort({ actualizadaEn: -1 })
      .limit(20);
    res.json(convs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/historial/:id', async (req, res) => {
  try {
    const c = await Conversacion.findById(req.params.id);
    if (!c) return res.status(404).json({ error: 'No encontrada' });
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await Conversacion.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Eliminada' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;