// utils.js

// --- Utilidades DOM y UI ---
const $ = (id) => document.getElementById(id);
const pad2 = (n)=> String(n).padStart(2,'0');

let toastTimer = null;
const headerMsg = $('headerMsg');

/**
 * Muestra una notificación temporal en el header.
 * @param {string} type - Tipo de mensaje ('ok', 'bad', 'warn', 'info').
 * @param {string} title - Título principal del mensaje.
 * @param {string} [msg] - Mensaje adicional.
 */
function toast(type, title, msg){
  if(toastTimer) clearTimeout(toastTimer);
  headerMsg.className = type || 'info';
  headerMsg.textContent = `${title} ${msg ? '— ' + msg : ''}`;
  headerMsg.style.opacity = '1';
  toastTimer = setTimeout(()=>{
    headerMsg.style.opacity = '0';
  }, 3000);
}

// --- Configuración de Ratios ---

const RATIOS = [
  { key:'1:1', value:1,      out:(s)=>({w:s,h:s}) },
  { key:'4:5', value:4/5,    out:(s)=>({w:s,h: Math.round(s*5/4)}) },
  { key:'9:16', value:9/16,  out:(s)=>({w:s,h: Math.round(s*16/9)}) },
  { key:'3:2', value:3/2,    out:(s)=>({w:s,h: Math.round(s*2/3)}) },
  { key:'4:3', value:4/3,    out:(s)=>({w:s,h: Math.round(s*3/4)}) },
  { key:'1.91:1', value:1.91,out:(s)=>({w:s,h: Math.round(s/1.91)}) },
];

/** Obtiene la clave de ratio más cercana a un valor. */
const keyFromValue = (v) => RATIOS.map(r=>({k:r.key,d:Math.abs(r.value-v)})).sort((a,b)=>a.d-b.d)[0]?.k || '1:1';

/** Obtiene el valor numérico de un ratio. */
const valueFromKey = (k) => RATIOS.find(r=>r.key===k)?.value ?? 1;

/** Obtiene las dimensiones de salida para un ratio y tamaño base. */
const outDims = (k, base) => (RATIOS.find(r=>r.key===k)?.out ?? ((s)=>({w:s,h:s})))(base);


// --- Utilidades de Ficheros y Descarga ---

/** Obtiene las dimensiones naturales de una imagen a partir de su URL. */
async function getMeta(url){
  return new Promise((resolve, reject)=>{
    const im = new Image();
    im.onload = ()=> resolve({w:im.naturalWidth,h:im.naturalHeight});
    im.onerror = reject;
    im.src = url;
  });
}

/** Convierte un DataURL a un objeto Blob. */
function dataURLToBlob(dataURL){
  const [h,b] = dataURL.split(',');
  const mime = h.match(/:(.*?);/)[1];
  const bin = atob(b);
  const arr = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return new Blob([arr], {type:mime});
}

/** Inicia la descarga de un Blob con un nombre de archivo dado. */
function downloadBlob(blob, filename){
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}

/** Limpia y formatea un nombre de archivo. */
function baseName(name){
  return (name||'image').replace(/\.[a-z0-9]+$/i,'').replace(/[^\w\-]+/g,'_').slice(0,80);
}

/** Carga una imagen a partir de una URL para usar su objeto Image. */
async function imageFromUrl(url){
  return new Promise((resolve, reject)=>{
    const im = new Image();
    im.onload = ()=> resolve(im);
    im.onerror = reject;
    im.src = url;
  });
}

// --- Lógica de IA (OpenAI) ---

let openAiKey = localStorage.getItem('carusel_ai_key') || '';
const aiSettingsBtn = $('aiSettings');
const aiFixBtn = $('aiFixBtn');

function updateAiUi() {
    aiFixBtn.style.display = openAiKey ? 'inline-flex' : 'none';
    if(openAiKey) aiSettingsBtn?.classList.add('primary');
    else aiSettingsBtn?.classList.remove('primary');
}

if(aiSettingsBtn) {
    aiSettingsBtn.addEventListener('click', () => {
        const key = prompt("Introduce tu API Key de OpenAI (sk-...):\nSe guardará en tu navegador.", openAiKey);
        if (key !== null) {
            openAiKey = key.trim();
            localStorage.setItem('carusel_ai_key', openAiKey);
            updateAiUi();
            toast('ok', 'API Key OpenAI', openAiKey ? 'Guardada correctamente.' : 'Eliminada.');
        }
    });
}

/**
 * Corrige y mejora el texto del caption usando la API de OpenAI.
 * Se espera que app.js pase el elemento captionText al inicializar.
 */
async function fixCaptionWithAI(captionTextEl, charCountEl) {
    const text = captionTextEl.value.trim();
    if (!text) return toast('warn', 'Texto vacío', 'Escribe algo primero.');
    if (!openAiKey) return toast('bad', 'Sin API Key', 'Configúrala en el icono ⚙️');

    const originalText = aiFixBtn.innerHTML;
    aiFixBtn.disabled = true;
    aiFixBtn.innerHTML = '<span class="spinning">↻</span> Pensando...';

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "Eres un experto copywriter para Instagram. Tu tarea es corregir la ortografía, gramática y mejorar ligeramente el estilo del texto proporcionado para que tenga mejor 'engagement'. Mantén la longitud similar. Devuelve SOLO el texto corregido."
                    },
                    { role: "user", content: text }
                ],
                temperature: 0.7
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const newText = data.choices[0].message.content;
        captionTextEl.value = newText;
        
        const len = newText.length;
        charCountEl.textContent = `${len} / 2200`;
        
        toast('ok', 'IA', 'Texto mejorado exitosamente.');

    } catch (err) {
        console.error(err);
        toast('bad', 'Error IA', 'Revisa la consola o tu Key.');
    } finally {
        aiFixBtn.disabled = false;
        aiFixBtn.innerHTML = originalText;
    }
}


// --- Lógica de IA (Replicate) ---

let replicateKey = localStorage.getItem('carusel_replicate_key') || '';
const replicateSettingsBtn = $('replicateSettings');

function updateReplicateUi() {
    if (replicateKey) replicateSettingsBtn?.classList.add('primary');
    else replicateSettingsBtn?.classList.remove('primary');
}

if(replicateSettingsBtn) {
    replicateSettingsBtn.addEventListener('click', () => {
        const key = prompt("Introduce tu API Key de Replicate (r8-...):\nSe guardará en tu navegador.", replicateKey);
        if (key !== null) {
            replicateKey = key.trim();
            localStorage.setItem('carusel_replicate_key', replicateKey);
            updateReplicateUi();
            toast('ok', 'API Key Replicate', replicateKey ? 'Guardada correctamente.' : 'Eliminada.');
        }
    });
}

/**
 * Llama a la API de Replicate para generar una imagen.
 * @param {string} prompt - El prompt para el modelo.
 * @param {string} aspectRatio - El ratio de aspecto.
 * @param {string} [imageInputDataURL] - DataURL de una imagen base (opcional).
 * @returns {Promise<string>} URL de la imagen generada.
 */
async function generateImageWithReplicate(prompt, aspectRatio, imageInputDataURL = null) {
    if (!replicateKey) throw new Error('API Key de Replicate no configurada.');

    const body = {
        "input": {
            "prompt": prompt,
            "resolution": "2K",
            "image_input": imageInputDataURL ? [imageInputDataURL] : [],
            "aspect_ratio": aspectRatio,
            "output_format": "png",
            "safety_filter_level": "block_only_high"
        }
    };

    const response = await fetch('https://api.replicate.com/v1/models/google/nano-banana-pro/predictions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${replicateKey}`,
            'Prefer': 'wait' // Para espera síncrona
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    
    if (data.error) {
        throw new Error(data.error);
    }
    if (!data.output || !data.output[0]) {
         throw new Error("La respuesta de Replicate no contiene la URL de la imagen.");
    }
    
    return data.output[0];
}