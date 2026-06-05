# 🤖 Sistema Agentes IA + MongoDB Atlas

Sistema completo con **Agentes Inteligentes (Google Gemini)**, **MongoDB Atlas (NoSQL)**, **documentos JSON** e interfaz conversacional web.

---

## 📁 Estructura del Proyecto

```
proyecto/
├── server.js               ← Servidor Express principal
├── package.json
├── .env                    ← Variables de entorno (TÚ lo creas)
├── .env.example            ← Ejemplo de variables
├── models/
│   ├── Documento.js        ← Modelo MongoDB para documentos JSON
│   └── Conversacion.js     ← Modelo MongoDB para historial de chat
├── routes/
│   ├── chat.js             ← Ruta del agente IA (Claude)
│   └── documentos.js       ← CRUD de documentos JSON
└── public/
    └── index.html          ← Interfaz web (Chat + Gestión documentos)
```

---

## ⚡ Instalación Paso a Paso

### 1. Requisitos previos
- [Node.js](https://nodejs.org) v18 o superior
- Cuenta en [MongoDB Atlas](https://www.mongodb.com/atlas)
- API Key de [Google AI Studio](https://aistudio.google.com/apikey)

### 2. Abrir en VS Code
```bash
cd proyecto
code .
```

### 3. Instalar dependencias
```bash
npm install
```

### 4. Crear archivo `.env`
Copia `.env.example` como `.env` y llena tus datos:
```
MONGODB_URI=mongodb+srv://usuario:contraseña@cluster0.xxxxx.mongodb.net/sistema_agentes?retryWrites=true&w=majority
GEMINI_API_KEY=AIzaXXXXXXXXXXXXXXXX
PORT=3000
```

### 5. Obtener tu MongoDB Atlas URI
1. Ve a [mongodb.com/atlas](https://www.mongodb.com/atlas) → Inicia sesión
2. Crea un cluster gratuito (M0 - Free)
3. Ve a **Database Access** → Crea un usuario con contraseña
4. Ve a **Network Access** → Agrega **solo tu IP actual** (botón "Add Current IP Address"). Evita `0.0.0.0/0`: expone tu cluster a todo internet
5. Ve a **Connect** → **Drivers** → Copia la URI y reemplaza `<password>`

### 6. Ejecutar el proyecto
```bash
# Desarrollo (reinicia automáticamente al guardar)
npm run dev

# Producción
npm start
```

### 7. Abrir en el navegador
```
http://localhost:3000
```

---

## 🚀 Funcionalidades

| Módulo | Descripción |
|--------|------------|
| 💬 **Chat IA** | Chatbot con Google Gemini, historial persistente en MongoDB |
| 📄 **Documentos** | CRUD completo de documentos JSON en MongoDB |
| 🔍 **Búsqueda** | Filtros por categoría y búsqueda de texto |
| 📊 **Agente** | El agente puede analizar y ayudar con tus datos |

---

## 🛠️ API Endpoints

### Chat
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/chat` | Enviar mensaje al agente |
| GET | `/api/chat/historial` | Listar conversaciones |
| GET | `/api/chat/historial/:id` | Ver conversación |
| DELETE | `/api/chat/:id` | Eliminar conversación |

### Documentos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/documentos` | Listar documentos |
| GET | `/api/documentos/:id` | Obtener uno |
| POST | `/api/documentos` | Crear documento |
| PUT | `/api/documentos/:id` | Actualizar |
| DELETE | `/api/documentos/:id` | Eliminar |
| GET | `/api/documentos/stats/categorias` | Estadísticas |

---

## 💡 Ejemplo de documento JSON

```json
{
  "titulo": "Producto de ejemplo",
  "categoria": "producto",
  "tags": ["electrónica", "nuevo"],
  "contenido": {
    "nombre": "Laptop ProMax",
    "precio": 25000,
    "stock": 15,
    "especificaciones": {
      "ram": "16GB",
      "procesador": "i7"
    }
  }
}
```

---

## ⚠️ Solución de Problemas

**Error de conexión MongoDB:**
- Verifica que tu IP esté en la whitelist de Atlas
- Revisa usuario y contraseña en la URI

**Error de API Key:**
- Verifica que tu `GEMINI_API_KEY` sea válida en [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
