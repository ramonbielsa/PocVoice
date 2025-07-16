const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const cors = require('cors');
const ElevenLabs = require('elevenlabs-node');

dotenv.config(); // Carga las variables de entorno (la API key)

const app = express();
const port = 3000;

// Middlewares
app.use(cors()); // Permite peticiones desde el frontend
app.use(express.json()); // Permite al servidor entender JSON

// Configuración de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const elevenLabs = new ElevenLabs({
    apiKey: process.env.ELEVENLABS_API_KEY,
});

// INSTRUCCIÓN DEL SISTEMA: Aquí le enseñamos a Gemini sus capacidades (Prompt)
const systemInstruction = `
Eres "Guía Web", el asistente interactivo de esta página. Tu misión es ayudar a los usuarios a navegar, ver, leer y explicar el contenido de la página de forma clara y accesible. Tu tono debe ser amable, directo y servicial.
La página está dividida en las siguientes secciones:
Sección uno, con el selector: #seccion-uno
Sección dos, con el selector: #seccion-dos
:cuadrado_amarillo_grande: REGLAS CLARAS:
Si el usuario dice cosas como "muéstrame", "ve a", "enséñame", "quiero ver" una sección:
Interpreta que quiere desplazarse a esa sección y verla.
Responde amablemente con un mensaje como:
 "Claro, aquí tienes la sección de servicios."
Y luego muestra (o simula mostrar) el contenido de esa sección (sin usar JSON).
Si el usuario dice cosas como "léeme", "lee", "quiero escuchar", "dime qué dice" una sección:
Responde con una frase como:
 "Con gusto, este es el contenido de la sección de contacto:"
Y a continuación, muestra el texto real que contiene esa sección.
Si el usuario menciona una sección que no existe:
Respóndele amablemente con algo como:
 "Lo siento, no he encontrado una sección llamada 'preguntas frecuentes'. Puedes pedirme ver Inicio, Servicios o Contacto."
Si el usuario hace una pregunta fuera del contexto de la página (por ejemplo, "¿Qué tiempo hace?" o "¿Quién ganó el partido?"):
Respóndele en texto normal como cualquier otro asistente conversacional.
:círculo_verde_grande: EJEMPLOS
Usuario: “Muéstrame la sección uno”
 Respuesta:
 "Claro, aquí tienes la sección de uno."
 [Mostrar o resaltar el contenido de #seccion-uno]
Usuario: “Léeme el contenido dos”
 Respuesta:
 "Con gusto, este es el contenido de la sección dos:"
 [Aquí muestras el contenido real de #seccion-dos]
Usuario: “Quiero ver la sección de preguntas frecuentes”
 Respuesta:
 "Lo siento, no he encontrado una sección llamada 'preguntas frecuentes'. Puedes pedirme ver Sección uno o sección dos."
`;

//DEBEMOS HACER 2 LLAMADAS PARA OBTENER RESPUESTA DE TEXTO Y AUDIO
// Obtener respuesta de texto de Gemini
// OBTENER RESPUESTA DE TEXTO DE GEMINI (VERSIÓN CON STREAMING)
app.post('/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'El mensaje es requerido.' });
        }

        // 1. Configurar cabeceras para Server-Sent Events (SSE)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Cache-Control', 'no-cache');

        // 2. Iniciar el chat con el historial
        const chat = geminiModel.startChat({
            history: [
                { role: "user", parts: [{ text: systemInstruction }] },
                { role: "model", parts: [{ text: "Entendido. Estoy listo." }] },
                ...history
            ]
        });

        // 3. Obtener el stream de Gemini
        const result = await chat.sendMessageStream(message);

        // 4. Enviar cada fragmento de texto al frontend
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            // Formato SSE: "data: {json}\n\n"
            res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        }

        // 5. Señal de finalización (opcional pero buena práctica)
        res.end();

    } catch (error) {
        console.error('Error en el chat con streaming: ', error);
        res.end(); // Cerramos la conexión si hay un error
    }
});

// Obetener la respuesta de audio de Gemini
app.post('/text-to-speech', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'El texto es requerido.' });
        }

        // Convertir el texto a audio con ElevenLabs
        const audioStream = await elevenLabs.textToSpeechStream({
            textInput: text,
            voiceId: "Nh2zY9kknu6z4pZy6FhD", //Voz de David Martín
            modelId: "eleven_multilingual_v2"
        });

        // Enviar el audio como respuesta al frontend
        res.setHeader('Content-Type', 'audio/mpeg');
        audioStream.pipe(res);

    } catch (error) {
        console.error('Error en /text-to-speech:', error);
        res.status(500).json({ error: 'No se pudo obtener una respuesta de audio.' });
    }
});


app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});