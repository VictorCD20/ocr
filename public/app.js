// State Management
let selectedFile = null;
let currentFotoBase64 = null;
let documents = [];

document.addEventListener('DOMContentLoaded', () => {
  checkHealth();
  // Establecer fecha por defecto a hoy
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('input-fecha').value = today;
  
  // Drag and drop handlers
  const dropzone = document.getElementById('dropzone');
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--primary-cyan)';
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.style.borderColor = 'var(--border-color)';
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--border-color)';
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
});

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));

  if (tabName === 'registrar') {
    document.getElementById('tab-registrar').classList.add('active');
    document.getElementById('view-registrar').classList.add('active');
  } else if (tabName === 'historial') {
    document.getElementById('tab-historial').classList.add('active');
    document.getElementById('view-historial').classList.add('active');
    loadHistory();
  }
}

async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    const statusBadge = document.getElementById('api-status');
    if (data.geminiConfigured) {
      statusBadge.textContent = 'Gemini API Lista';
      statusBadge.className = 'badge badge-aprobado';
      statusBadge.style.display = 'inline-block';
    } else {
      statusBadge.textContent = 'Falta GEMINI_API_KEY en .env';
      statusBadge.className = 'badge badge-rechazado';
      statusBadge.style.display = 'inline-block';
    }
  } catch (err) {
    console.error('Error al conectar con backend:', err);
  }
}

function handleFileSelect(event) {
  if (event.target.files && event.target.files[0]) {
    handleFile(event.target.files[0]);
  }
}

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Por favor selecciona una imagen válida.');
    return;
  }
  selectedFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    currentFotoBase64 = e.target.result;
    document.getElementById('image-preview').src = e.target.result;
    document.getElementById('preview-wrapper').style.display = 'flex';
    document.getElementById('dropzone').style.display = 'none';
    document.getElementById('btn-process-ocr').disabled = false;
    document.getElementById('btn-clear').style.display = 'inline-flex';
  };
  reader.readAsDataURL(file);
}

function clearUpload() {
  selectedFile = null;
  currentFotoBase64 = null;
  document.getElementById('file-input').value = '';
  document.getElementById('image-preview').src = '';
  document.getElementById('preview-wrapper').style.display = 'none';
  document.getElementById('dropzone').style.display = 'flex';
  document.getElementById('btn-process-ocr').disabled = true;
  document.getElementById('btn-clear').style.display = 'none';
  document.getElementById('ocr-alert').style.display = 'none';
}

async function processOCR() {
  if (!selectedFile) return;

  const btnProcess = document.getElementById('btn-process-ocr');
  const ocrAlert = document.getElementById('ocr-alert');
  ocrAlert.style.display = 'none';

  btnProcess.disabled = true;
  btnProcess.innerHTML = `<div class="spinner"></div> <span>Analizando comprobante...</span>`;

  const formData = new FormData();
  formData.append('imagen', selectedFile);

  try {
    const res = await fetch('/api/ocr', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Error al procesar la imagen.');
    }

    fillFormWithOCR(data.ocr, data.foto_original);

  } catch (error) {
    console.error('Error OCR:', error);
    ocrAlert.className = 'alert alert-error';
    ocrAlert.textContent = `❌ ${error.message}`;
    ocrAlert.style.display = 'block';
  } finally {
    btnProcess.disabled = false;
    btnProcess.innerHTML = `<span>⚡ Procesar con OCR</span>`;
  }
}

function fillFormWithOCR(ocr, fotoOriginal) {
  if (fotoOriginal) {
    currentFotoBase64 = fotoOriginal;
  }

  // Rellenar campos principales
  document.getElementById('input-proveedor').value = ocr.proveedor || '';
  document.getElementById('input-fecha').value = ocr.fecha || new Date().toISOString().split('T')[0];
  document.getElementById('input-hora').value = ocr.hora || '';
  document.getElementById('input-total').value = ocr.total !== null ? ocr.total : '';
  document.getElementById('input-subtotal').value = ocr.subtotal !== null ? ocr.subtotal : '';
  document.getElementById('input-iva').value = ocr.iva !== null ? ocr.iva : '';
  
  if (ocr.categoria_sugerida) {
    const catSelect = document.getElementById('select-categoria');
    if ([...catSelect.options].some(o => o.value === ocr.categoria_sugerida)) {
      catSelect.value = ocr.categoria_sugerida;
    }
  }

  document.getElementById('input-rfc-emisor').value = ocr.rfc_emisor || '';
  document.getElementById('input-rfc-receptor').value = ocr.rfc_receptor || '';
  document.getElementById('input-folio').value = ocr.folio || '';
  document.getElementById('input-uuid').value = ocr.uuid || '';

  if (ocr.metodo_pago) {
    const metodoSelect = document.getElementById('select-metodo');
    const val = ocr.metodo_pago.toLowerCase();
    if (val.includes('tarj') || val.includes('card')) metodoSelect.value = 'tarjeta';
    else if (val.includes('trans') || val.includes('spei')) metodoSelect.value = 'transferencia';
    else metodoSelect.value = 'efectivo';
  }

  // Estado sugerido
  const selectEstado = document.getElementById('select-estado');
  if (ocr.requiere_revision) {
    selectEstado.value = 'pendiente_revision';
  } else {
    selectEstado.value = 'aprobado';
  }

  // Calidad badge
  const badgeCalidad = document.getElementById('badge-calidad');
  badgeCalidad.textContent = `Calidad: ${ocr.calidad_imagen || 'regular'}`;
  badgeCalidad.style.display = 'inline-block';

  // Mostrar motivos de revisión si existen
  const ocrAlert = document.getElementById('ocr-alert');
  if (ocr.requiere_revision && ocr.motivos_revision && ocr.motivos_revision.length > 0) {
    ocrAlert.className = 'alert alert-warning';
    ocrAlert.textContent = `⚠️ Revisión recomendada: ${ocr.motivos_revision.join(', ')}`;
    ocrAlert.style.display = 'block';
  } else {
    ocrAlert.className = 'alert alert-success';
    ocrAlert.textContent = `✅ Datos extraídos correctamente. Verifica y guarda el gasto.`;
    ocrAlert.style.display = 'block';
  }

  // Renderizar conceptos
  renderConceptosTable(ocr.conceptos || []);
}

function renderConceptosTable(conceptos) {
  const tbody = document.getElementById('conceptos-body');
  tbody.innerHTML = '';

  if (!conceptos || conceptos.length === 0) {
    addConceptoRow();
    return;
  }

  conceptos.forEach(c => {
    addConceptoRow(c.descripcion, c.cantidad, c.precio_unitario, c.importe);
  });
}

function addConceptoRow(desc = '', cant = '', precio = '', imp = '') {
  const tbody = document.getElementById('conceptos-body');
  const tr = document.createElement('tr');

  tr.innerHTML = `
    <td><input type="text" class="concepto-desc" value="${desc || ''}" placeholder="Ej. Café Grano 1kg"></td>
    <td><input type="number" step="0.01" class="concepto-cant" value="${cant !== null ? cant : ''}" placeholder="1"></td>
    <td><input type="number" step="0.01" class="concepto-precio" value="${precio !== null ? precio : ''}" placeholder="0.00"></td>
    <td><input type="number" step="0.01" class="concepto-imp" value="${imp !== null ? imp : ''}" placeholder="0.00"></td>
    <td><button type="button" style="background:none; border:none; color:var(--status-rechazado); cursor:pointer;" onclick="this.closest('tr').remove()">✕</button></td>
  `;

  tbody.appendChild(tr);
}

function getConceptosFromTable() {
  const rows = document.querySelectorAll('#conceptos-body tr');
  const conceptos = [];
  rows.forEach(tr => {
    const desc = tr.querySelector('.concepto-desc').value.trim();
    const cant = tr.querySelector('.concepto-cant').value;
    const precio = tr.querySelector('.concepto-precio').value;
    const imp = tr.querySelector('.concepto-imp').value;

    if (desc || imp) {
      conceptos.push({
        descripcion: desc || 'Artículo',
        cantidad: cant ? Number(cant) : 1,
        precio_unitario: precio ? Number(precio) : 0,
        importe: imp ? Number(imp) : 0
      });
    }
  });
  return conceptos;
}

async function saveDocument(event) {
  event.preventDefault();

  const btnSave = document.getElementById('btn-save');
  btnSave.disabled = true;
  btnSave.innerHTML = `<div class="spinner"></div> <span>Guardando...</span>`;

  const payload = {
    proveedor: document.getElementById('input-proveedor').value.trim(),
    fecha: document.getElementById('input-fecha').value,
    hora: document.getElementById('input-hora').value || null,
    total: parseFloat(document.getElementById('input-total').value) || 0,
    subtotal: parseFloat(document.getElementById('input-subtotal').value) || 0,
    iva: parseFloat(document.getElementById('input-iva').value) || 0,
    categoria: document.getElementById('select-categoria').value,
    rfc_emisor: document.getElementById('input-rfc-emisor').value.trim() || null,
    rfc_receptor: document.getElementById('input-rfc-receptor').value.trim() || null,
    folio: document.getElementById('input-folio').value.trim() || null,
    metodo_pago: document.getElementById('select-metodo').value,
    uuid: document.getElementById('input-uuid').value.trim() || null,
    quien_hizo_gasto: document.getElementById('input-quien').value.trim() || 'Dueña/Encargada',
    notas: document.getElementById('input-notas').value.trim(),
    conceptos: getConceptosFromTable(),
    estado: document.getElementById('select-estado').value,
    foto_original: currentFotoBase64
  };

  try {
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Error al guardar comprobante');
    }

    const savedDoc = await res.json();
    alert(`✅ Comprobante de "${savedDoc.proveedor}" guardado correctamente.`);

    // Limpiar pantalla y cambiar a historial
    document.getElementById('form-comprobante').reset();
    clearUpload();
    switchTab('historial');

  } catch (err) {
    console.error('Error al guardar:', err);
    alert(`❌ Error al guardar: ${err.message}`);
  } finally {
    btnSave.disabled = false;
    btnSave.innerHTML = `💾 Guardar Comprobante`;
  }
}

async function loadHistory() {
  const container = document.getElementById('history-container');
  container.innerHTML = `<div style="text-align:center; padding:2rem;"><div class="spinner" style="margin:0 auto 1rem;"></div>Cargando comprobantes...</div>`;

  try {
    const res = await fetch('/api/documents');
    documents = await res.json();
    renderHistory();
  } catch (err) {
    console.error('Error al cargar historial:', err);
    container.innerHTML = `<div class="alert alert-error" style="display:block;">Error al cargar comprobantes.</div>`;
  }
}

function renderHistory() {
  const container = document.getElementById('history-container');
  const estadoFilter = document.getElementById('filter-estado').value;
  const catFilter = document.getElementById('filter-categoria').value;
  const search = document.getElementById('search-input').value.toLowerCase().trim();

  let filtered = documents.filter(d => {
    if (estadoFilter !== 'todos' && d.estado !== estadoFilter) return false;
    if (catFilter !== 'todas' && d.categoria !== catFilter) return false;
    if (search) {
      const provMatch = (d.proveedor || '').toLowerCase().includes(search);
      const folioMatch = (d.folio || '').toLowerCase().includes(search);
      if (!provMatch && !folioMatch) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <p style="font-size: 1.1rem; font-weight: 500; margin-bottom: 0.5rem;">No hay comprobantes registrados</p>
        <p style="font-size: 0.85rem;">Registra tu primer ticket o factura para llevar el control.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(doc => `
    <div class="doc-card">
      <div class="doc-header">
        <div>
          <div class="doc-provider">${escapeHtml(doc.proveedor || 'Sin Nombre')}</div>
          <div class="doc-date">📅 ${doc.fecha} ${doc.hora ? '• ' + doc.hora : ''}</div>
        </div>
        <div>
          <span class="badge badge-${doc.estado}">${doc.estado.replace('_', ' ')}</span>
          <span class="badge badge-categoria" style="margin-left: 0.25rem;">${doc.categoria}</span>
        </div>
      </div>

      <div class="doc-body">
        <div>
          <div class="doc-metric-title">Total</div>
          <div class="doc-metric-value" style="color: var(--primary-cyan);">$${Number(doc.total).toFixed(2)}</div>
        </div>
        <div>
          <div class="doc-metric-title">Subtotal / IVA</div>
          <div class="doc-metric-value" style="font-size:0.85rem; font-weight:normal;">
            $${Number(doc.subtotal || 0).toFixed(2)} / $${Number(doc.iva || 0).toFixed(2)}
          </div>
        </div>
        <div>
          <div class="doc-metric-title">Método de Pago</div>
          <div class="doc-metric-value" style="font-size:0.85rem; text-transform:capitalize;">${doc.metodo_pago}</div>
        </div>
        <div>
          <div class="doc-metric-title">Registrado por</div>
          <div class="doc-metric-value" style="font-size:0.85rem;">${escapeHtml(doc.quien_hizo_gasto || 'Dueña')}</div>
        </div>
      </div>

      ${doc.conceptos && doc.conceptos.length > 0 ? `
        <div style="font-size: 0.8rem; color: var(--text-secondary); background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 4px;">
          <strong>Conceptos (${doc.conceptos.length}):</strong> ${doc.conceptos.map(c => `${c.descripcion} ($${c.importe})`).join(', ')}
        </div>
      ` : ''}

      <div class="doc-footer">
        <div>
          ${doc.folio ? `<span>Folio: <strong>${escapeHtml(doc.folio)}</strong></span>` : ''}
          ${doc.uuid ? `<span style="margin-left:0.5rem; font-size:0.75rem; color:var(--text-muted);">UUID: ${doc.uuid.substring(0, 13)}...</span>` : ''}
        </div>
        <div style="display: flex; gap: 0.5rem;">
          ${doc.estado !== 'aprobado' ? `
            <button class="btn btn-secondary" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="updateDocState('${doc.id}', 'aprobado')">Aprobar</button>
          ` : ''}
          ${doc.estado !== 'rechazado' ? `
            <button class="btn btn-secondary" style="padding:0.25rem 0.6rem; font-size:0.75rem; color:var(--status-rechazado);" onclick="updateDocState('${doc.id}', 'rechazado')">Rechazar</button>
          ` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

async function updateDocState(id, nuevoEstado) {
  try {
    const res = await fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado })
    });

    if (!res.ok) throw new Error('Error al actualizar estado');

    const updated = await res.json();
    const idx = documents.findIndex(d => d.id === id);
    if (idx !== -1) documents[idx] = updated;
    renderHistory();
  } catch (err) {
    alert(`No se pudo cambiar el estado: ${err.message}`);
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
