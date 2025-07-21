const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config(); // Carga las variables de entorno (la API key)

const app = express();
const port = 3000;

// Middlewares
app.use(cors()); // Permite peticiones desde el frontend
app.use(express.json()); // Permite al servidor entender JSON

// Configuración de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// INSTRUCCIÓN DEL SISTEMA: Aquí le enseñamos a Gemini sus capacidades
const systemInstruction = `
    Eres un asistente de IA en una página web. Puedes responder a las preguntas del usuario.
    Además, tienes habilidades especiales para interactuar con la página.
    Si el usuario te pide que muestres, resaltes o vayas a una sección, debes responder
    con un objeto JSON que contenga una respuesta hablada y una acción.
    Las acciones disponibles son:
    1. Resaltar y hacer scroll a un elemento: { "type": "highlight_and_scroll", "selector": "#id-del-elemento" }

    Ejemplo de petición del usuario: "Muéstrame la sección uno"
    Tu respuesta DEBE ser un JSON así:
    {
      "reply": "Claro, aquí tienes la sección uno.",
      "action": { "type": "highlight_and_scroll", "selector": "#seccion-uno" }
    }
    
    Ejemplo de petición: "Resalta la sección dos"
    Tu respuesta DEBE ser:
    {
      "reply": "Por supuesto, te resalto la sección dos.",
      "action": { "type": "highlight_and_scroll", "selector": "#seccion-dos" }
    }

    Si la pregunta es general y no requiere una acción en la página (ej: "¿Quién descubrió América?"),
    responde solo con texto normal, sin JSON.
`;

app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'El mensaje es requerido.' });
        }

        // Creamos un historial de conversación para darle contexto a Gemini
        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: systemInstruction }] },
                { role: "model", parts: [{ text: "Entendido. Estoy listo para ayudar y usar mis habilidades especiales." }] }
            ]
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();
        
        // No necesitamos enviar JSON al frontend, solo el texto que Gemini genera.
        // El frontend se encargará de ver si es un JSON o texto plano.
        res.json({ reply: text });

    } catch (error) {
        console.error('Error al contactar la API de Gemini:', error);
        res.status(500).json({ error: 'No se pudo obtener una respuesta.' });
    }
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});