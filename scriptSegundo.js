document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const backendUrl = 'http://localhost:3000/chat';

    // ---- Función de voz ----
    function leerTexto(texto) {
        // Detiene cualquier locución anterior para evitar que se solapen
        window.speechSynthesis.cancel(); 
        
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(texto);
            utterance.lang = 'es-ES';
            window.speechSynthesis.speak(utterance);
        } else {
            console.log('Tu navegador no soporta la síntesis de voz.');
        }
    }
    
    // Lee el mensaje inicial al cargar la página
    const mensajeInicial = document.querySelector('.bot-message p').textContent;
    leerTexto(mensajeInicial);

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

        // Muestra el mensaje del usuario en el chat
        appendMessage(userMessage, 'user-message');
        chatInput.value = '';

        try {
            // Llama a nuestro backend
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

            // Muestra la respuesta del bot en el chat
            appendMessage(botReply, 'bot-message');
            // Lee la respuesta del bot en voz alta
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
        // Hace scroll automático hacia el último mensaje
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});