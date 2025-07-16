document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const micBtn = document.getElementById('mic-btn'); // Botón del micrófono
    const backendUrl = 'http://localhost:3000/chat';
    const asistenteAlex = document.getElementById('asistente-alex');
    const chatWrapper = document.getElementById('chat-wrapper');
    const inputContainer = document.getElementById('input-container');

    let conversationHistory = []; //Historial de la conversación (Da contexto a Gemini)

    // ---- Función de voz (SALIDA) ----
    function leerTexto(texto) {
        window.speechSynthesis.cancel();  //Cancela la voz anterior y evita que las voces se superpongan
        if ('speechSynthesis' in window) { // Comprobamos si el navegador soporta la síntesis de voz
            const utterance = new SpeechSynthesisUtterance(texto); 
            utterance.lang = 'es-ES';
            window.speechSynthesis.speak(utterance); // Da la orden al navegador para que lea el texto en voz alta
        } else {
            console.log('Tu navegador no soporta la síntesis de voz.');
        }
    }
    
    const mensajeInicial = document.querySelector('.bot-message p').textContent;
    leerTexto(mensajeInicial);

    // ---- Lógica de Reconocimiento de Voz (ENTRADA) ----
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.continuous = false;
        recognition.interimResults = false;

        // Mostrar error en consola en caso de no reconocer la voz
        recognition.onerror = (event) => {
            console.error('Error en el reconocimiento de voz:', event.error);
            alert(`Error de reconocimiento: ${event.error}`); // Añadimos un alert para que sea más visible
        };

        micBtn.addEventListener('click', () => {
            recognition.start();
        });

        recognition.addEventListener('start', () => {
            micBtn.classList.add('is-listening');
            micBtn.textContent = '...';
        });

        recognition.addEventListener('end', () => {
            micBtn.classList.remove('is-listening');
            micBtn.textContent = '🎤';
        });

        recognition.addEventListener('result', (event) => {
            const transcript = event.results[0][0].transcript;
            chatInput.value = transcript;
            // Opcional: enviar automáticamente al recibir el resultado
            setTimeout(() => {
                sendMessage();
            }, 500);
        });

    } else {
        console.log('Tu navegador no soporta el reconocimiento de voz.');
        micBtn.style.display = 'none'; // Oculta el botón si no es compatible
    }

    // ---- Lógica del Chat ----
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    async function sendMessage() {
        const userMessage = chatInput.value.trim();
        if (userMessage === '') return;
    
        appendMessage(userMessage, 'user-message');
        // Añadimos el mensaje al historial para que Gemini tenga contexto
        conversationHistory.push({ role: 'user', parts: [{ text: userMessage }] });
        chatInput.value = '';
    
        // 1. Añadimos el mensaje de "pensando..." que se irá actualizando
        const botMessageElement = appendMessage("...", 'bot-message');
        let fullBotResponse = ""; // Aquí guardaremos la respuesta completa
    
        try {
            // 2. Hacemos la petición POST al endpoint de chat (que ahora es un stream)
            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message: userMessage, 
                    // Enviamos el historial SIN el último mensaje del usuario para no duplicarlo
                    history: conversationHistory.slice(0, -1) 
                }),
            });
    
            // 3. Leemos el stream que nos llega del servidor
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
    
            // Función recursiva para procesar el stream
            function processStream() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        // El stream ha terminado, ahora generamos el audio
                        console.log("Stream de texto finalizado.");
                        conversationHistory.push({ role: 'model', parts: [{ text: fullBotResponse }] });
                        playElevenLabsAudio(fullBotResponse); // Llamamos a la función de audio
                        return;
                    }
    
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n\n').filter(line => line.trim() !== '');
    
                    lines.forEach(line => {
                        if (line.startsWith('data:')) {
                            const data = JSON.parse(line.substring(5));
                            fullBotResponse += data.text;
                            // Actualizamos el contenido del párrafo en tiempo real
                            botMessageElement.querySelector('p').textContent = fullBotResponse;
                            chatBox.scrollTop = chatBox.scrollHeight;
                        }
                    });
                    
                    // Continuamos leyendo el siguiente fragmento
                    processStream();
                }).catch(error => {
                    console.error('Error leyendo el stream:', error);
                    botMessageElement.querySelector('p').textContent = "Hubo un error al recibir la respuesta.";
                });
            }
            
            processStream();
    
        } catch (error) {
            console.error('Error en sendMessage:', error);
            botMessageElement.querySelector('p').textContent = 'Lo siento, algo salió mal.';
        }
    }
    
    async function playElevenLabsAudio(text) {
        if (!text) return;
    
        try {
            const audioResponse = await fetch('http://localhost:3000/text-to-speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text }),
            });
    
            if (!audioResponse.ok) throw new Error('Error al obtener la respuesta de audio.');
    
            const audioBlob = await audioResponse.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
    
            asistenteAlex.classList.add('is-speaking');
            audio.play();
            
            audio.onended = () => {
                asistenteAlex.classList.remove('is-speaking');
            };
    
        } catch (error) {
            console.error('Error al reproducir audio de ElevenLabs:', error);
        }
    }

    // Desplegar el chat al hacer click en el asistente Alex
    asistenteAlex.addEventListener('click', () => {
        chatWrapper.classList.toggle('visible');

        if (chatWrapper.classList.contains('visible')){
            chatInput.focus(); 
        }

    });

    function appendMessage(message, className) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', className);
        const p = document.createElement('p');
        p.textContent = message;
        messageElement.appendChild(p);
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
        return messageElement; // Se devuelve el elemento para poder actualizarlo
    }

    function ejecutarAccion(action) {
        if (action.type === 'highlight_and_scroll') {
            const selector = action.selector;
            const elemento = document.querySelector(selector);
            
            if (elemento) {
                // Quita resaltados anteriores
                document.querySelectorAll('.resaltado-gemini').forEach(el => el.classList.remove('resaltado-gemini'));
                
                // Añade la clase para resaltar
                elemento.classList.add('resaltado-gemini');
                
                // Haz scroll hasta el elemento
                elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                console.warn('Acción no ejecutable: selector no encontrado', selector);
            }
        }
    }
});