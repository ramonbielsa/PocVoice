document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const micBtn = document.getElementById('mic-btn'); // Botón del micrófono
    const backendUrl = 'http://localhost:3000/chat';

    // ---- Función de voz (SALIDA) ----
    function leerTexto(texto) {
        window.speechSynthesis.cancel(); 
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(texto);
            utterance.lang = 'es-ES';
            window.speechSynthesis.speak(utterance);
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
        chatInput.value = '';

        try {
            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: userMessage }),
            });

            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor.');
            }

            const data = await response.json();
            const botReply = data.reply;
            appendMessage(botReply, 'bot-message');
            leerTexto(botReply);

        } catch (error) {
            console.error('Error:', error);
            const errorMessage = 'Lo siento, algo salió mal. Inténtalo de nuevo.';
            appendMessage(errorMessage, 'bot-message');
            leerTexto(errorMessage);
        }
    }

    function appendMessage(message, className) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', className);
        const p = document.createElement('p');
        p.textContent = message;
        messageElement.appendChild(p);
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});