// Función para leer texto en voz alta usando la API del navegador
function leerTexto(texto) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'es-ES'; // ¡Importante para el acento correcto!
        window.speechSynthesis.speak(utterance);
    } else {
        console.log('Tu navegador no soporta la síntesis de voz.');
    }
}

// Probamos que la función de voz inicial funciona
document.addEventListener('DOMContentLoaded', () => {
    const mensajeInicial = document.querySelector('.bot-message p').textContent;
    leerTexto(mensajeInicial);
});