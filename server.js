import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Detectar entorno serverless (Vercel)
const IS_VERCEL = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const DATA_DIR = IS_VERCEL ? '/tmp' : path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'documents.json');

// Asegurar carpeta data/ o /tmp
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}
if (!fs.existsSync(DATA_FILE)) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify([]), 'utf-8'); } catch (e) {}
}

// Configurar multer para recibir archivos de imágenes en memoria
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB max
});

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper para leer/escribir documentos
function readDocuments() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Error leyendo documents.json:', err);
    return [];
  }
}

function writeDocuments(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// 1. GET /api/health
app.get('/api/health', (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  res.json({
    status: 'ok',
    geminiConfigured: !!(apiKey && apiKey.trim() !== ''),
    timestamp: new Date().toISOString()
  });
});

// 2. GET /api/documents
app.get('/api/documents', (req, res) => {
  const docs = readDocuments();
  res.json(docs);
});

// 3. POST /api/ocr
app.post('/api/ocr', upload.single('imagen'), async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      return res.status(400).json({
        error: 'Llave GEMINI_API_KEY no configurada en el archivo .env del backend.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'No se ha adjuntado ninguna imagen para procesar.'
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Intentar con gemini-2.5-flash / gemini-2.0-flash o gemini-1.5-flash-latest
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `Eres un extractor OCR para comprobantes de una cafetería pequeña en México. Lee la imagen y devuelve solo JSON válido. No inventes datos. Si un dato no aparece, usa null. Si hay duda o la foto está borrosa, marca requiere_revision true.

Devuelve esta estructura:
{
  "tipo": "ticket | factura_cfdi | comprobante | no_identificado",
  "calidad_imagen": "buena | regular | mala",
  "requiere_revision": true,
  "motivos_revision": [],
  "proveedor": null,
  "rfc_emisor": null,
  "rfc_receptor": null,
  "uuid": null,
  "fecha": null,
  "hora": null,
  "folio": null,
  "metodo_pago": null,
  "categoria_sugerida": "insumo | gasto | venta | nomina | otro",
  "subtotal": null,
  "iva": null,
  "total": null,
  "conceptos": [
    {
      "descripcion": null,
      "cantidad": null,
      "precio_unitario": null,
      "importe": null
    }
  ],
  "confianza": 0
}`;

    const imageParts = [
      {
        inlineData: {
          data: req.file.buffer.toString('base64'),
          mimeType: req.file.mimetype || 'image/jpeg'
        }
      }
    ];

    const modelsToTry = [
      process.env.GEMINI_MODEL,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro'
    ].filter(Boolean);

    let result = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent([prompt, ...imageParts]);
        if (result) break;
      } catch (err) {
        console.warn(`Error probando modelo ${modelName}:`, err.message);
        lastError = err;
      }
    }

    if (!result) {
      throw lastError || new Error('No se pudo generar respuesta con ninguno de los modelos probados.');
    }

    const responseText = await result.response.text();

    // Limpiar respuesta para obtener JSON estricto
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let ocrData;
    try {
      ocrData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Error al parsear JSON devuelto por Gemini:', responseText);
      return res.status(500).json({
        error: 'El modelo no devolvió un JSON válido.',
        raw: responseText
      });
    }

    // Convertir foto a Base64 Data URL para guardarla localmente como preview
    const fotoBase64 = `data:${req.file.mimetype || 'image/jpeg'};base64,${req.file.buffer.toString('base64')}`;

    res.json({
      ocr: ocrData,
      foto_original: fotoBase64
    });

  } catch (error) {
    console.error('Error en POST /api/ocr:', error);
    res.status(500).json({
      error: 'Error al procesar la imagen con Gemini API.',
      details: error.message
    });
  }
});

// 4. POST /api/documents (Crear/Guardar comprobante)
app.post('/api/documents', (req, res) => {
  try {
    const docData = req.body;
    if (!docData || typeof docData !== 'object') {
      return res.status(400).json({ error: 'Datos de documento inválidos.' });
    }

    const docs = readDocuments();

    const newDoc = {
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      proveedor: docData.proveedor || null,
      fecha: docData.fecha || new Date().toISOString().split('T')[0],
      hora: docData.hora || null,
      total: docData.total !== undefined ? Number(docData.total) : 0,
      subtotal: docData.subtotal !== undefined ? Number(docData.subtotal) : 0,
      iva: docData.iva !== undefined ? Number(docData.iva) : 0,
      rfc_emisor: docData.rfc_emisor || null,
      rfc_receptor: docData.rfc_receptor || null,
      uuid: docData.uuid || null,
      folio: docData.folio || null,
      metodo_pago: docData.metodo_pago || 'efectivo',
      categoria: docData.categoria || 'insumo',
      quien_hizo_gasto: docData.quien_hizo_gasto || 'Dueña/Encargada',
      notas: docData.notas || '',
      conceptos: Array.isArray(docData.conceptos) ? docData.conceptos : [],
      foto_original: docData.foto_original || null,
      estado: docData.estado || 'aprobado',
      tipo: docData.tipo || 'comprobante',
      confianza: docData.confianza || 100,
      creado_en: new Date().toISOString(),
      actualizado_en: new Date().toISOString()
    };

    docs.unshift(newDoc);
    writeDocuments(docs);

    res.status(201).json(newDoc);
  } catch (error) {
    console.error('Error en POST /api/documents:', error);
    res.status(500).json({ error: 'Error al guardar el comprobante.' });
  }
});

// 5. PATCH /api/documents/:id (Actualizar comprobante)
app.patch('/api/documents/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const docs = readDocuments();
    const index = docs.findIndex(d => d.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Comprobante no encontrado.' });
    }

    const updatedDoc = {
      ...docs[index],
      ...updates,
      actualizado_en: new Date().toISOString()
    };

    docs[index] = updatedDoc;
    writeDocuments(docs);

    res.json(updatedDoc);
  } catch (error) {
    console.error('Error en PATCH /api/documents/:id:', error);
    res.status(500).json({ error: 'Error al actualizar el comprobante.' });
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor CODIA OCR ejecutándose en http://localhost:${PORT}`);
  });
}

export default app;
