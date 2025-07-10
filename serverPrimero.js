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

// Definimos la ruta para el chat
app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body; // Recibimos el mensaje del usuario
        
        if (!message) {
            return res.status(400).json({ error: 'El mensaje es requerido.' });
        }

        const result = await model.generateContent(message);
        const response = await result.response;
        const text = response.text();
        
        res.json({ reply: text }); // Enviamos la respuesta de Gemini al frontend

    } catch (error) {
        console.error('Error al contactar la API de Gemini:', error);
        res.status(500).json({ error: 'No se pudo obtener una respuesta.' });
    }
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});