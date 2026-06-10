const express = require('express');
const router = express.Router();
const Conversacion = require('../models/Conversacion');
const Documento = require('../models/Documento');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ─── HERRAMIENTAS QUE EL AGENTE PUEDE USAR ───────────────────────────────────
const tools = [
  {
    type: 'function',
    function: {
      name: 'buscar_documentos',
      description: 'Busca documentos en MongoDB. Úsala cuando el usuario quiera ver, listar o buscar documentos o productos. Por defecto excluye registros de ventas; si el usuario pregunta por ventas, pasa categoria "ventas".',
      parameters: {
        type: 'object',
        properties: {
          buscar:    { type: 'string', description: 'Palabras clave a buscar, ej: "playera negra" (opcional)' },
          categoria: { type: 'string', description: 'Filtrar por categoría exacta, ej: inventario, ventas (opcional)' },
          limite:    { type: 'number', description: 'Máximo de resultados (default 10)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'crear_documento',
      description: 'Crea un nuevo documento JSON en MongoDB. Úsala cuando el usuario quiera guardar o registrar datos.',
      parameters: {
        type: 'object',
        properties: {
          titulo:    { type: 'string', description: 'Título del documento' },
          contenido: { type: 'string', description: 'Contenido del documento en formato JSON string' },
          categoria: { type: 'string', description: 'Categoría del documento (inventario, ventas, clientes, proveedores)' },
          tags:      { type: 'string', description: 'Tags separados por coma (opcional)' }
        },
        required: ['titulo', 'contenido']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analizar_datos',
      description: 'Analiza y genera estadísticas de los documentos en MongoDB. Úsala para preguntas de análisis, totales, agrupaciones.',
      parameters: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            enum: ['por_categoria', 'recientes', 'total', 'por_tags'],
            description: 'Tipo de análisis'
          }
        },
        required: ['tipo']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'eliminar_documento',
      description: 'Elimina un documento por su ID. Úsala solo si el usuario confirma querer eliminar.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID del documento a eliminar' }
        },
        required: ['id']
      }
    }
  }
];

// ─── EJECUTAR HERRAMIENTA ────────────────────────────────────────────────────
async function ejecutarHerramienta(nombre, input) {
  switch (nombre) {
    case 'buscar_documentos': {
      const filtro = {};
      // Sin categoría explícita, excluye ventas: las búsquedas de productos son sobre el catálogo
      filtro.categoria = input.categoria ? input.categoria : { $ne: 'ventas' };
      if (input.buscar) {
        // Busca por palabras sueltas: basta con que alguna coincida en algún campo
        const stopwords = new Set(['para', 'con', 'sin', 'una', 'uno', 'unas', 'unos', 'las', 'los', 'del', 'que', 'por', 'tipo', 'quiero', 'busco', 'tienes', 'hay']);
        const palabras = input.buscar.trim().toLowerCase().split(/\s+/)
          .filter(p => p.length >= 3 && !stopwords.has(p));
        const condiciones = palabras.map(p => {
          // tolera diferencias de género/número al final de la palabra (negra/negro/negras)
          const raiz = p.length > 4 ? p.slice(0, -2) : p;
          const rx = new RegExp(raiz.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          return [
            { titulo:    rx },
            { categoria: rx },
            { tags:      { $in: [rx] } },
            { 'contenido.producto': rx },
            { 'contenido.marca':    rx },
            { 'contenido.color':    rx },
            { 'contenido.modelo':   rx }
          ];
        }).flat();
        if (condiciones.length > 0) filtro.$or = condiciones;
      }
      const docs  = await Documento.find(filtro).limit(input.limite || 10).sort({ actualizadoEn: -1 });
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
      return { error: 'Tipo de análisis desconocido' };
    }
    case 'eliminar_documento': {
      const doc = await Documento.findByIdAndDelete(input.id);
      if (!doc) return { error: 'Documento no encontrado' };
      return { exito: true, mensaje: `Documento "${doc.titulo}" eliminado` };
    }
    default:
      return { error: 'Herramienta desconocida' };
  }
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres el asistente inteligente de una tienda de ropa deportiva. Gestionas su información (productos, inventario, ventas, clientes) almacenada en MongoDB.

Tienes acceso a herramientas reales para interactuar con la base de datos:
- buscar_documentos: busca y lista documentos
- crear_documento: guarda nuevos datos
- analizar_datos: genera estadísticas y análisis
- eliminar_documento: elimina documentos (pide confirmación antes)

CONTEXTO DEL NEGOCIO:
- Es una tienda de ropa deportiva: maneja productos (playeras, shorts, tenis, sudaderas, etc.), tallas, marcas, precios, inventario y ventas
- Al registrar productos usa categorías útiles como: inventario, ventas, clientes, proveedores
- Incluye en el contenido datos relevantes: producto, marca, talla, color, cantidad, precio

COMPORTAMIENTO:
- Si el usuario pide ver datos → usa buscar_documentos
- Si pide estadísticas, análisis, cuántos hay, tendencias → usa analizar_datos
- Si quiere guardar algo → usa crear_documento con los datos que te dé
- Sé proactivo: si el usuario dice "analiza mis datos" usa múltiples herramientas
- Responde siempre en español, de forma clara y estructurada
- Muestra los resultados de forma legible, nunca como JSON crudo`;

// ─── LLAMADA A GROQ (con reintento ante errores temporales) ──────────────────
async function llamarGroq(messages, intentos = 3) {
  for (let i = 0; i < intentos; i++) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.3
      })
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices[0].message;
    }

    const errorTexto = await res.text();
    if ((res.status === 429 || res.status === 503) && i < intentos - 1) {
      const espera = 5000 * (i + 1);
      console.log(`⏳ Groq saturado (${res.status}), reintentando en ${espera / 1000}s...`);
      await new Promise(r => setTimeout(r, espera));
      continue;
    }
    throw new Error(`Groq ${res.status}: ${errorTexto.slice(0, 300)}`);
  }
}

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

    // Construir historial en formato OpenAI/Groq
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversacion.mensajes.map(m => ({
        role: m.rol === 'user' ? 'user' : 'assistant',
        content: m.contenido
      }))
    ];

    // ─── Agentic loop ────────────────────────────────────────────────────────
    let textoFinal = '';
    const accionesEjecutadas = [];

    for (let i = 0; i < 5; i++) {
      const respuesta = await llamarGroq(messages);

      if (!respuesta.tool_calls || respuesta.tool_calls.length === 0) {
        textoFinal = respuesta.content || '';
        break;
      }

      // Ejecutar cada herramienta y devolver los resultados al modelo
      messages.push(respuesta);
      for (const call of respuesta.tool_calls) {
        let args = {};
        try { args = JSON.parse(call.function.arguments); } catch {}
        const resultadoHerramienta = await ejecutarHerramienta(call.function.name, args);
        accionesEjecutadas.push({
          herramienta: call.function.name,
          input:       args,
          resultado:   resultadoHerramienta
        });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(resultadoHerramienta)
        });
      }
    }

    if (!textoFinal) textoFinal = 'No pude generar una respuesta, intenta de nuevo.';

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
