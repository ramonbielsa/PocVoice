document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const micBtn = document.getElementById('mic-btn'); // Botón del micrófono
    const screenShareBtn = document.getElementById('screen-share-btn'); // Botón compartir pantalla
    const backendUrl = 'http://localhost:3000/chat';
    const asistenteAlex = document.getElementById('asistente-alex');
    const chatWrapper = document.getElementById('chat-wrapper');
    const inputContainer = document.getElementById('input-container');

    let isMicActive = false; // Controlar micro activado/desactivado
    let conversationHistory = []; //Historial de la conversación (Da contexto a Gemini)

    // Variables para compartir pantalla
    let screenStream = null;
    const videoElement = document.createElement('video');
    videoElement.style.display = 'none'; // El video no necesita ser visible
    document.body.appendChild(videoElement);

    // ---- Función de voz (SALIDA) ----
    /*function leerTexto(texto) {
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
    leerTexto(mensajeInicial);*/



    // ---- Lógica de Reconocimiento de Voz (ENTRADA) ----
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.continuous = true;
        recognition.interimResults = true;

    // Evento que se dispara cuando el micro capta una frase final
    let finalTranscript = ''; // Añade esta variable antes de la función

    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
    
        chatInput.value = finalTranscript + interimTranscript;
    
        if (finalTranscript.trim()) {
            sendMessage();
            finalTranscript = ''; 
        }
    };

    // Evento que crea la conversación continua
    recognition.onend = () => {
        isMicActive = false;
        micBtn.classList.remove('active');
        micBtn.textContent = '🎤';
        console.log("Reconocimiento de voz detenido.");
    };

    // Evento para manejar errores
    recognition.onerror = (event) => {
        console.error("Error en reconocimiento de voz:", event.error);
        isMicActive = false; // Desactiva en caso de error
        micBtn.classList.remove('active');
        micBtn.textContent = '🎤';
    };
    
    // Evento cuando empieza a escuchar
    recognition.onstart = () => {
        micBtn.classList.add('active');
        micBtn.textContent = '...';
    };

    // El listener del botón ahora solo actúa como un interruptor
    micBtn.addEventListener('click', () => {
        if (isMicActive) {
            // Si está activo, lo paramos llamando a .stop()
            recognition.stop();
        } else {
            // Si está inactivo, lo iniciamos con .start()
            try {
                finalTranscript = '';
                chatInput.value = '';
                recognition.start();
                isMicActive = true;
            } catch (error) {
                console.error("Error al iniciar el reconocimiento:", error);
                isMicActive = false;
            }
        }
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


    // Evento para controlar el Click para compartir pantalla
    screenShareBtn.addEventListener('click', async () => {
        if (screenStream) {
            // Si ya se está compartiendo, detenerlo
            screenStream.getTracks().forEach(track => track.stop());
            screenStream = null;
            videoElement.srcObject = null;
            screenShareBtn.classList.remove('active');
        } else {
            // Si no se está compartiendo, iniciarlo
            try {
                screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                videoElement.srcObject = screenStream;
                videoElement.play();
                screenShareBtn.classList.add('active');
    
                // Escuchar si el usuario detiene la compartición desde el control del navegador
                screenStream.getVideoTracks()[0].addEventListener('ended', () => {
                    screenStream = null;
                    videoElement.srcObject = null;
                    screenShareBtn.classList.remove('active');
                });
            } catch (error) {
                console.error("Error al compartir pantalla:", error);
            }
        }
    });


    // Función para capturar el fotograma para compartir pantalla
    function captureScreenFrame() {
        if (!screenStream || videoElement.readyState < videoElement.HAVE_METADATA) {
            return null;
        }
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        // Devuelve solo los datos Base64, sin el prefijo 'data:image/jpeg;base64,'
        return canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
    }


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

        const screenFrameData = captureScreenFrame();
    
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
                    history: conversationHistory.slice(0, -1),
                    image_data: screenFrameData // Para enviar la captura de imágen (Compartir pantalla)
                }),
            });
    
            // 3. Leemos el stream que nos llega del servidor
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
    
            // Función recursiva para procesar el stream
            function processStream() {
                reader.read().then(({ done, value }) => {
                    // Si el stream ha finalizado, procesamos la respuesta final y terminamos.
                    if (done) {
                        console.log("Stream de texto finalizado.");

                        let responseForHistory = fullBotResponse;
                        let responseForDisplayAndAudio = fullBotResponse;

                        const actionRegex = /```json\s*([\s\S]*?)\s*```/;
                        const match = fullBotResponse.match(actionRegex);

                        if (match && match[1]) {
                            try {
                                const actionJSON = JSON.parse(match[1]);
                                ejecutarAccion(actionJSON);
                                // Limpiamos la respuesta para no mostrar el JSON al usuario
                                responseForDisplayAndAudio = fullBotResponse.replace(actionRegex, '').trim();
                                botMessageElement.querySelector('p').textContent = responseForDisplayAndAudio;
                            } catch (error) {
                                console.error("Error al procesar la acción JSON:", error);
                            }
                        }
                        
                        // Estas dos líneas ahora se ejecutan siempre al finalizar,
                        // tanto si hubo una acción como si no.
                        conversationHistory.push({ role: 'model', parts: [{ text: responseForHistory }] });
                        playElevenLabsAudio(responseForDisplayAndAudio);
                        
                        // Este return es crucial para detener el bucle de lectura.
                        return;
                    }

                    // Si el stream no ha terminado, decodificamos y procesamos el chunk actual.
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n\n').filter(line => line.trim() !== '');

                    lines.forEach(line => {
                        if (line.startsWith('data:')) {
                            try {
                                const data = JSON.parse(line.substring(5));
                                if(data.text) {
                                    fullBotResponse += data.text;
                                    botMessageElement.querySelector('p').textContent = fullBotResponse;
                                    chatBox.scrollTop = chatBox.scrollHeight;
                                }
                            } catch (e) {
                                console.error("Error parseando un fragmento de stream:", e, "Fragmento:", line);
                            }
                        }
                    });
                    
                    // Continuamos leyendo el siguiente fragmento del stream.
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

    // Acciones que puede realizar Alex
    function ejecutarAccion(action) {
        // Verifica si la acción es un 'clic' y si tiene un selector
        if (action.action === 'click' && action.selector) {
            const elemento = document.querySelector(action.selector);
            
            // Si el elemento existe en la página, haz clic en él
            if (elemento) {
                console.log(`Acción detectada: Haciendo clic en '${action.selector}'`);
                elemento.click();
            } else {
                console.warn(`Acción no ejecutable: selector no encontrado: ${action.selector}`);
            }
        }
    }
});