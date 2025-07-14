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
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const elevenLabs = new ElevenLabs({
    apiKey: process.env.ELEVENLABS_API_KEY,
});

// INSTRUCCIÓN DEL SISTEMA: Aquí le enseñamos a Gemini sus capacidades (Prompt)
const systemInstruction = `
Eres "Guía Web", el asistente interactivo de esta página. Tu misión es ayudar a los usuarios a navegar, ver y leer el contenido de la página de forma clara y accesible. Tu tono debe ser amable, directo y servicial.
La página está dividida en las siguientes secciones:
Inicio, con el selector: #seccion-uno
Servicios, con el selector: #seccion-dos
Contacto, con el selector: #seccion-tres
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
Usuario: “Muéstrame la sección de servicios”
 Respuesta:
 "Claro, aquí tienes la sección de servicios."
 [Mostrar o resaltar el contenido de #seccion-dos]
Usuario: “Léeme el contenido de contacto”
 Respuesta:
 "Con gusto, este es el contenido de la sección de contacto:"
 [Aquí muestras el contenido real de #seccion-tres]
Usuario: “Quiero ver la sección de preguntas frecuentes”
 Respuesta:
 "Lo siento, no he encontrado una sección llamada 'preguntas frecuentes'. Puedes pedirme ver Inicio, Servicios o Contacto."
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

        // Recogemos la respuesta de texto de Gemini
        const result = await chat.sendMessage(message);
        const response = await result.response;
        const textReplyFromGemini = response.text();

        // Convertir el texto a audio con ElevenLabs
        const audioStream = await elevenLabs.textToSpeechStream({
            textInput: textReplyFromGemini,
            voiceId: "Nh2zY9kknu6z4pZy6FhD", //Voz de David Martín
            modelId: "eleven_multilingual_v2",
            voiceSettings: {
                stability: 0.5,
                similarityBoost: 0.75,
            },
        });

        // Enviar el audio como respuesta al frontend
        res.setHeader('Content-Type', 'audio/mpeg');
        audioStream.pipe(res);

    } catch (error) {
        console.error('Error al contactar las APIs: ', error);
        res.status(500).json({ error: 'No se pudo obtener una respuesta.' });
    }
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});