// ingest.js - Script para procesar el PDF y crear la base de datos vectorial

const fs = require('fs/promises');
// Se importa FaissStore desde el paquete específico de la comunidad
const { FaissStore } = require("@langchain/community/vectorstores/faiss");
// Se importa el modelo de embeddings desde su propio paquete
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
// Se importa el divisor de texto desde su paquete
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const pdf = require('pdf-parse');
const dotenv = require('dotenv');

dotenv.config();

// --- CONFIGURACIÓN ---
const PDF_PATH = './manual_app.pdf';
const VECTOR_STORE_PATH = './vector_store';

async function runIngestion() {
    try {
        console.log('Iniciando el proceso de ingesta del PDF...');

        // 1. Cargar el documento PDF
        console.log(`Cargando texto desde: ${PDF_PATH}`);
        const pdfBuffer = await fs.readFile(PDF_PATH);
        const pdfData = await pdf(pdfBuffer);
        
        if (!pdfData.text) {
            throw new Error('No se pudo extraer texto del PDF.');
        }
        console.log('Texto extraído correctamente.');

        // 2. Dividir el texto en fragmentos (chunks)
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 100,
        });
        const docs = await textSplitter.createDocuments([pdfData.text]);
        console.log(`Documento dividido en ${docs.length} fragmentos.`);

        // 3. Crear los "embeddings"
        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GEMINI_API_KEY,
            model: "embedding-001", // 'model' en lugar de 'modelName'
        });
        console.log('Modelo de embeddings inicializado.');

        // 4. Crear el almacén de vectores con FAISS
        console.log('Creando el almacén de vectores con los fragmentos...');
        const vectorStore = await FaissStore.fromDocuments(docs, embeddings);
        
        // 5. Guardar el almacén de vectores en el disco
        await vectorStore.save(VECTOR_STORE_PATH);
        console.log(`¡Éxito! El almacén de vectores se ha guardado en: ${VECTOR_STORE_PATH}`);

    } catch (error) {
        console.error('Ha ocurrido un error durante la ingesta:', error);
    }
}

runIngestion();