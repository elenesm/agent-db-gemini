const TelegramBot = require('node-telegram-bot-api');

// Mapea cada chat de Telegram a su conversación en MongoDB para mantener el historial
const conversaciones = new Map();

function iniciarBotTelegram(puerto) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'tu_token_aqui') {
    console.log('⚠️ TELEGRAM_BOT_TOKEN no configurado — bot de Telegram desactivado');
    return null;
  }

  const bot = new TelegramBot(token, { polling: true });
  const apiUrl = `http://localhost:${puerto}/api/chat`;

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      '👋 ¡Hola! Soy el asistente de la tienda de ropa deportiva.\n\n' +
      'Puedo ayudarte a:\n' +
      '🔍 Buscar productos y documentos\n' +
      '📝 Registrar productos, ventas o inventario\n' +
      '📊 Generar análisis y estadísticas\n\n' +
      'Escríbeme lo que necesites, por ejemplo:\n' +
      '"registra 20 playeras Nike talla M a $350"\n' +
      '"¿cuántos productos hay por categoría?"'
    );
    conversaciones.delete(msg.chat.id);
  });

  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;

    try {
      await bot.sendChatAction(chatId, 'typing');

      const body = { mensaje: msg.text };
      if (conversaciones.has(chatId)) body.conversacionId = conversaciones.get(chatId);

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.detalle || data.error || 'Error desconocido');

      conversaciones.set(chatId, data.conversacionId);

      const respuesta = data.respuesta || 'No obtuve respuesta del agente.';

      await bot.sendMessage(chatId, respuesta, { parse_mode: 'Markdown' })
        .catch(() => bot.sendMessage(chatId, respuesta)); // reintenta sin Markdown si el formato falla
    } catch (err) {
      console.error('❌ Error en bot Telegram:', err.message);
      bot.sendMessage(chatId, '⚠️ Ocurrió un error procesando tu mensaje. Intenta de nuevo.');
    }
  });

  bot.on('polling_error', (err) => console.error('❌ Telegram polling:', err.message));

  console.log('🤖 Bot de Telegram activo');
  return bot;
}

module.exports = { iniciarBotTelegram };
