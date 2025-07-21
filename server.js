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
app.use(express.json({ limit: '50mb' }));; // Permite al servidor entender JSON y aceptar paquetes más grandes

// Configuración de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const elevenLabs = new ElevenLabs({
    apiKey: process.env.ELEVENLABS_API_KEY,
});

// INSTRUCCIÓN DEL SISTEMA: Aquí le enseñamos a Gemini sus capacidades (Prompt)
const systemInstruction = `
Eres "Álex", un asistente web diseñado para ayudar a los usuarios a navegar e interactuar con la aplicación de GrantsWin. Tu tono es amable y eficiente.

**CAPACIDADES:**
1.  **Visión de Pantalla:** Puedo ver capturas de pantalla que el usuario comparte contigo. Úsalas para entender el contexto visual de la página.
2.  **Acción en la Página:** Puedes solicitar acciones como hacer clic en elementos.

**REGLAS DE ACCIÓN:**
Cuando un usuario te pida realizar una acción (ej: "haz clic en...", "llévame a...", "pulsa el botón..."), debes:
1.  Primero, responder con una frase corta y natural confirmando la acción.
2.  Inmediatamente después, en la misma respuesta, añade un bloque de código JSON con el comando a ejecutar.

**FORMATO DEL COMANDO JSON:**
El JSON debe tener dos claves: "action" y "selector".
-   "action": Por ahora, solo puedes usar "click".
-   "selector": Debe ser un selector CSS válido (como "#id" o ".clase") para el elemento con el que interactuar.

**EJEMPLOS:**
---
**EJEMPLO 1: El usuario pide hacer clic en un botón.**
*Usuario dice:* "Álex, por favor, haz clic en el botón de la sección uno."
*Tú (analizando la imagen y viendo el botón con id="seccion-uno") respondes:*
"Claro, haciendo clic en la sección uno.
\`\`\`json
{
  "action": "click",
  "selector": "#seccion-uno"
}
\`\`\`"
---
**EJEMPLO 2: El usuario pide ir a un lugar sin un comando claro.**
*Usuario dice:* "Quiero ver la sección dos."
*Tú (analizando la imagen y viendo el elemento con id="seccion-dos") respondes:*
"Por supuesto, te llevo a la sección dos.
\`\`\`json
{
  "action": "click",
  "selector": "#seccion-dos"
}
\`\`\`"
---

Si el usuario solo conversa, responde normalmente sin el bloque JSON. Usa tu capacidad de visión para responder preguntas sobre lo que se ve en la pantalla.
Debes dar respuestas breves, sin extenderte demasido.
`;

//DEBEMOS HACER 2 LLAMADAS PARA OBTENER RESPUESTA DE TEXTO Y AUDIO
// Obtener respuesta de texto de Gemini
// OBTENER RESPUESTA DE TEXTO DE GEMINI (VERSIÓN CON STREAMING)
app.post('/chat', async (req, res) => {
    try {
        const { message, history, image_data } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'El mensaje es requerido.' });
        }

        // Construimos las partes del mensaje para Gemini
        const parts = [{ text: message }];
        if (image_data) {
            parts.push({
                inline_data: {
                    mime_type: 'image/jpeg',
                    data: image_data,
                },
            });
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