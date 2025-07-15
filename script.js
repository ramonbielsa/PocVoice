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
        conversationHistory.push({role: 'user', parts: [{text: userMessage}]});
        chatInput.value = '';

        // Mostrar indicador de espera (Pensando...)
        const thinkingMessage = appendMessage("...", 'bot-message');
    
        try {
            //Petición para obtener respuesta de texto
            const textResponse = await fetch(backendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: userMessage, history: conversationHistory }),
            });
    
            if (!textResponse.ok) {
                throw new Error('Error en la respuesta del servidor.');
            }

            const data = await textResponse.json();
            const botText = data.replyText;

            // Actualizar mensaje
            thinkingMessage.querySelector('p').textContent = botText;
            conversationHistory.push({role: 'model', parts: [{text: botText}]});

            //Petición para obtener respuesta de audio
            const audioResponse = await fetch('http://localhost:3000/text-to-speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: botText }),
            });

            if (!audioResponse.ok) throw new Error('Error al obtener la respuesta de audio.');


            // Ya no leemos JSON. Ahora manejamos audio.
            const audioBlob = await audioResponse.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            // Animación del asistente Alex
            asistenteAlex.classList.add('is-speaking'); // Añadir la clase para activar animación mientras habla
            audio.play();

            // Quitar animación cuando Alex deja de hablar
            audio.onended = () => {
                asistenteAlex.classList.remove('is-speaking');
            }
    
    
        } catch (error) {
            console.error('Error:', error);
            const errorMessage = 'Lo siento, algo salió mal. Inténtalo de nuevo.';
            appendMessage(errorMessage, 'bot-message');
            // La función original de leerTexto() se puede dejar para leer solo los errores
            leerTexto(errorMessage);
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