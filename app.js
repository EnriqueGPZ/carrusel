// app.js

(() => {
  // Asegurarse de que utils.js se cargó, si no, fallará el $()
  if (typeof $ !== 'function') {
      console.error('Error: utils.js no está cargado o no definió las funciones básicas.');
      return;
  }

  // --- Elementos del DOM ---
  const files = $('files');
  const list = $('list');
  const strip = $('strip');
  const img = $('image');
  const editorCanvas = $('editorCanvas');

  const preview = $('preview');
  const media = $('media');
  const dots = $('dots');

  const prevBtn = $('prev');
  const nextBtn = $('next');
  const pPrev = $('pPrev');
  const pNext = $('pNext');

  const clearAll = $('clearAll');
  const moveUp = $('moveUp');
  const moveDown = $('moveDown');

  const zoomIn = $('zoomIn');
  const zoomOut = $('zoomOut');
  const rotL = $('rotL');
  const rotR = $('rotR');
  const reset = $('reset');
  const saveCrop = $('saveCrop');

  const sizeEl = $('size');
  const fmt = $('fmt');
  const q = $('q');
  const qVal = $('qVal');

  const dlOne = $('dlOne');
  const dlZip = $('dlZip');
  const exportCropBtn = $('exportCrop');

  // Caption & AI (OpenAI)
  const captionText = $('captionText');
  const charCount = $('charCount');
  const aiFixBtn = $('aiFixBtn');
  
  // Replicate AI
  const replicatePrompt = $('replicatePrompt');
  const replicateRatio = $('replicateRatio');
  const replicateInputImage = $('replicateInputImage');
  const generateImageBtn = $('generateImageBtn');

  const countEl = $('count');
  const selNameEl = $('selName');
  const ratioLabel = $('ratioLabel');
  const ratioMode = $('ratioMode');

  const dropzone = $('dropzone');
  const empty = $('empty');

  // Modal Ratios
  const changeRatioBtn = $('changeRatio');
  const modalOverlay = $('modalOverlay');
  const modalClose = $('modalClose');
  const modalCancel = $('modalCancel');
  const modalApply = $('modalApply');
  const modalRatio = $('modalRatio');

  // Modal Help
  const helpBtn = $('helpBtn');
  const helpOverlay = $('helpOverlay');
  const helpCloseBtn = $('helpCloseBtn');
  const helpOkBtn = $('helpOkBtn');


  // --- Estado Global ---
  let items = []; 
  let selected = -1;
  let cropper = null;
  let currentRatio = 1;
  let dragFrom = null;
  let busyZip = false;
  let carouselRatioKey = null; // Ratio for the entire carousel (locked)

  editorCanvas.addEventListener('wheel', (e) => e.preventDefault(), { passive:false });

  // --- Cropper Management ---

  function destroyCropper(){
    if(cropper){ cropper.destroy(); cropper=null; }
  }

  /** Inicializa el Cropper con la configuración actual. */
  function initCropper(restoreConfig = null){
    destroyCropper();
    
    cropper = new Cropper(img, {
      viewMode: 1, 
      dragMode: 'move',
      autoCropArea: 1,
      background: false,
      zoomOnWheel: false, 
      movable: true,
      rotatable: true,
      scalable: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      checkCrossOrigin: false,
      aspectRatio: restoreConfig ? restoreConfig.ratio : (currentRatio || NaN),
      
      ready: function() {
        if(restoreConfig && restoreConfig.data){
            this.cropper.setData(restoreConfig.data);
        }
        syncPreviewRealTime(); 
      },
      cropend: function() { syncPreviewRealTime(); },
      zoom: function() { setTimeout(syncPreviewRealTime, 100); }
    });
  }

  /** Renderiza la vista previa usando el canvas actual del Cropper. */
  function syncPreviewRealTime() {
    if(!cropper) return;
    const canvas = cropper.getCroppedCanvas({
        width: 400,
        imageSmoothingQuality: 'medium'
    });
    if(!canvas) return;
    preview.src = canvas.toDataURL('image/jpeg', 0.8);
    
    // Ajustar altura del preview
    const feedContainer = document.querySelector('.feed');
    if(feedContainer) {
        const w = feedContainer.clientWidth;
        const aspect = canvas.width / canvas.height;
        media.style.height = Math.round(w / aspect) + 'px';
    }
  }

  // --- Core Application Logic ---

  function toggleEmpty(){
    empty.style.display = (items.length===0) ? 'block' : 'none';
  }

  function updateRatioModeUI(){
    ratioMode.textContent = carouselRatioKey ? `(Bloqueado)` : `(Libre)`;
    changeRatioBtn.disabled = items.length===0;
  }

  function applyCarouselRatio(ratioKey){
    carouselRatioKey = ratioKey;
    currentRatio = valueFromKey(carouselRatioKey);
    items.forEach(it => {
      it.ratioKey = null; // Borrar ratio individual
      it.cropData = null; // Borrar recorte manual
      it.thumbDataUrl = null;
    });
    updateRatioModeUI();
    renderAll();
    if(selected>=0){
      select(selected);
      toast('ok', 'Ratio aplicado', `Todo en ${carouselRatioKey}.`);
    } else {
      toast('ok', 'Ratio aplicado', `Carrusel en ${carouselRatioKey}.`);
    }
  }

  async function addFiles(fileList){
    const fs = Array.from(fileList).filter(f=>f.type.startsWith('image/'));
    if(!fs.length) return;

    for(const f of fs){
      const url = URL.createObjectURL(f);
      await getMeta(url).catch(()=>({w:0,h:0}));
      items.push({ name: f.name || '', url, ratioKey: null, cropData: null, thumbDataUrl: null });
    }

    if(selected===-1) selected = 0;
    renderAll();
    select(selected);
    updatePreview();
    toggleEmpty();
    toast('ok', 'Fotos añadidas', `${fs.length} archivo(s).`);
  }

  function updateHeader(){
    countEl.textContent = String(items.length);
    const it = items[selected];
    selNameEl.textContent = it ? (it.name || `IMG_${pad2(selected+1)}`) : '—';
  }

  function setDisabled(){
    const has = items.length>0;
    const sel = selected>=0 && selected<items.length;
    [prevBtn,nextBtn,pPrev,pNext].forEach(b=> b.disabled = (items.length<=1));
    moveUp.disabled = !sel || selected===0;
    moveDown.disabled = !sel || selected===items.length-1;
    dlZip.disabled = !has || busyZip;
    dlOne.disabled = !sel;
    exportCropBtn.disabled = !sel;
    [saveCrop,zoomIn,zoomOut,rotL,rotR,reset].forEach(b=> b.disabled = !sel);
    clearAll.disabled = !has;
    const ratiosLocked = !!carouselRatioKey;
    document.querySelectorAll('[data-r]').forEach(b => {
      b.disabled = !sel || ratiosLocked;
    });
    changeRatioBtn.disabled = !has;
  }

  function renderList(){
    list.innerHTML = '';
    items.forEach((it, i) => {
      const row = document.createElement('div');
      row.className = 'item' + (i===selected ? ' active':'');
      const th = document.createElement('div');
      th.className = 'thumb';
      const ti = document.createElement('img');
      ti.src = it.thumbDataUrl || it.url;
      th.appendChild(ti);
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.style.display = 'flex';
      meta.style.flexDirection = 'column';
      meta.style.justifyContent = 'center';
      meta.style.overflow = 'hidden';
      const n = document.createElement('div');
      n.className = 'name';
      n.textContent = `${pad2(i+1)}. ` + (it.name || `Imagen ${pad2(i+1)}`);
      const s = document.createElement('div');
      const shownRatio = carouselRatioKey || it.ratioKey;
      if(items.length && carouselRatioKey && it.ratioKey && it.ratioKey !== carouselRatioKey){
        s.className = 'sub warn';
        s.textContent = `⚠ ${it.ratioKey}`;
      } else {
        s.className = 'sub';
        s.textContent = shownRatio ? `${shownRatio}` : 'Auto';
      }
      meta.appendChild(n); meta.appendChild(s);
      const del = document.createElement('button');
      del.className = 'iconMini';
      del.innerHTML = '✕';
      del.addEventListener('click', (e) => { e.stopPropagation(); remove(i); });
      row.appendChild(th);
      row.appendChild(meta);
      row.appendChild(del);
      row.addEventListener('click', ()=> select(i));
      list.appendChild(row);
    });
    updateHeader();
    setDisabled();
  }

  function reorder(from, to){
    if(from<0 || to<0 || from>=items.length || to>=items.length) return;
    const moved = items.splice(from, 1)[0];
    items.splice(to, 0, moved);
    if(selected === from) selected = to;
    else if(from < selected && selected <= to) selected -= 1;
    else if(to <= selected && selected < from) selected += 1;
    renderAll();
    updatePreview();
  }

  function renderStrip(){
    strip.innerHTML = '';
    if(items.length===0) return;
    items.forEach((it, i) => {
      // Usar el ratio del carrusel o, si no está fijado, el ratio individual o 1:1.
      const ratioKey = carouselRatioKey || it.ratioKey || '1:1'; 
      const r = valueFromKey(ratioKey);
      const frame = document.createElement('div');
      frame.className = 'frame' + (i===selected ? ' active':'');
      frame.draggable = true;
      frame.dataset.index = String(i);
      const W = 80; 
      const H = Math.max(40, Math.round(W / r));
      frame.style.height = H + 'px';
      frame.style.width = W + 'px';
      const im = document.createElement('img');
      im.src = it.thumbDataUrl || it.url;
      im.style.width='100%'; im.style.height='100%'; im.style.objectFit='cover'; im.style.display='block';
      const b1 = document.createElement('div');
      b1.className = 'badge';
      b1.textContent = pad2(i+1);
      
      // Drag & Drop Listeners
      frame.addEventListener('click', ()=> select(i));
      frame.addEventListener('dragstart', (e)=>{
        dragFrom = i;
        frame.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', String(i)); } catch {}
      });
      frame.addEventListener('dragend', ()=>{
        dragFrom = null;
        frame.classList.remove('dragging');
        strip.querySelectorAll('.frame.over').forEach(el=> el.classList.remove('over'));
      });
      frame.addEventListener('dragover', (e)=>{
        e.preventDefault();
        frame.classList.add('over');
        e.dataTransfer.dropEffect = 'move';
      });
      frame.addEventListener('dragleave', ()=> frame.classList.remove('over'));
      frame.addEventListener('drop', (e)=>{
        e.preventDefault();
        frame.classList.remove('over');
        const from = dragFrom ?? Number(e.dataTransfer.getData('text/plain'));
        const to = i;
        if(!Number.isFinite(from) || from===to) return;
        reorder(from, to);
        toast('', 'Movido', `a posición ${pad2(to+1)}.`);
      });

      frame.appendChild(im);
      frame.appendChild(b1);
      strip.appendChild(frame);
    });
  }

  function renderAll(){
    renderList();
    renderStrip();
    toggleEmpty();
    updateRatioModeUI();
  }

  function remove(i){
    if(i<0||i>=items.length) return;
    const name = items[i]?.name || `IMG_${pad2(i+1)}`;
    URL.revokeObjectURL(items[i].url);
    items.splice(i,1);
    if(items.length===0){
      selected=-1;
      destroyCropper();
      preview.src=''; dots.innerHTML=''; img.removeAttribute('src');
      ratioLabel.textContent = '1:1'; captionText.value = ''; charCount.textContent = '0 / 2200';
      carouselRatioKey = null; currentRatio = 1;
      renderAll();
      toast('warn', 'Vacío', 'Sube fotos.');
      return;
    }
    selected = Math.min(selected, items.length-1);
    select(selected);
    renderAll();
    updatePreview();
    toast('bad', 'Eliminada', name);
  }

  function select(i){
    if(i < 0 || i >= items.length) return;
    
    destroyCropper();
    selected = i;
    const it = items[selected];
    
    // UI Updates
    const ratioKey = carouselRatioKey || it.ratioKey || keyFromValue(currentRatio);
    ratioLabel.textContent = ratioKey;
    updateHeader();

    // Limpiar y cargar imagen
    img.removeAttribute('src');
    img.src = it.url;
    
    img.onload = () => {
      let targetRatio = currentRatio;
      
      if(carouselRatioKey){
          targetRatio = valueFromKey(carouselRatioKey);
      } else if(it.ratioKey){
          targetRatio = valueFromKey(it.ratioKey);
      }
      
      currentRatio = targetRatio;

      initCropper({
          ratio: targetRatio,
          data: it.cropData 
      });
      
      renderAll();
      buildDots();
    };
  }

  function moveSelection(dir){
    if(items.length<=1) return;
    selected = (selected + dir + items.length) % items.length;
    select(selected);
  }

  function moveItem(dir){
    if(selected<0) return;
    const ni = selected + dir;
    if(ni<0 || ni>=items.length) return;
    reorder(selected, ni);
  }

  function buildDots(){
    dots.innerHTML='';
    items.forEach((_,i)=>{
      const d=document.createElement('div');
      d.className='dot'+(i===selected?' active':'');
      dots.appendChild(d);
    });
  }

  function updatePreview(){
    if(items.length===0 || selected<0) { setDisabled(); return; }
    if(!cropper) {
        const it = items[selected];
        const ratioKey = carouselRatioKey || keyFromValue(currentRatio);
        const r = valueFromKey(ratioKey);
        const feedContainer = document.querySelector('.feed');
        const w = feedContainer ? feedContainer.clientWidth : 320;
        media.style.height = Math.round(w / r) + 'px';
        preview.src = it.thumbDataUrl || it.url;
    }
    const ratioKey = carouselRatioKey || keyFromValue(currentRatio);
    ratioLabel.textContent = ratioKey;
    buildDots();
    setDisabled();
    renderStrip();
    renderList();
  }
  
  // Observador para redimensionar el preview
  const feedContainer = document.querySelector('.feed');
  if(feedContainer) {
      new ResizeObserver(() => {
          if(cropper) syncPreviewRealTime();
          else requestAnimationFrame(updatePreview);
      }).observe(feedContainer);
  }

  async function saveCurrentCrop(){
    const it = items[selected];
    if(!it || !cropper) return;

    if(!carouselRatioKey){
       const rk = keyFromValue(currentRatio);
       carouselRatioKey = rk; 
       updateRatioModeUI();
       toast('info', 'Ratio Fijado', `Carrusel ajustado a ${rk}`);
    }

    it.cropData = cropper.getData(true);
    it.ratioKey = carouselRatioKey;
    
    // Generar thumb (540px de ancho para calidad)
    const pr = valueFromKey(it.ratioKey);
    const thW = 540;
    const thH = Math.max(1, Math.round(thW / pr));
    
    const c = cropper.getCroppedCanvas({
      width: thW, height: thH,
      imageSmoothingEnabled: true, imageSmoothingQuality: 'high'
    });
    
    if(c){
        it.thumbDataUrl = c.toDataURL('image/jpeg', 0.9);
        renderList(); 
        renderStrip();
        toast('ok', 'Guardado', `Recorte aplicado.`);
    }
  }

  async function exportRecorteToDataURL(it){
    const format = fmt.value;
    const base = parseInt(sizeEl.value,10);
    const quality = parseFloat(q.value);
    const ratioKey = carouselRatioKey || it.ratioKey || keyFromValue(currentRatio);
    const {w:W,h:H} = outDims(ratioKey, base);

    // Si es la imagen activa, usamos el cropper
    if(it === items[selected] && cropper){
      if(carouselRatioKey) cropper.setAspectRatio(valueFromKey(carouselRatioKey));
      const c = cropper.getCroppedCanvas({
        width: W, height: H,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      });
      return c.toDataURL(format==='png'?'image/png':'image/jpeg', quality);
    }

    // Si no es la activa, reconstruimos desde los datos guardados
    const imgEl = await imageFromUrl(it.url);
    const canvas = document.createElement('canvas');
    canvas.width=W; canvas.height=H;
    const ctx = canvas.getContext('2d', {alpha: format==='png'});

    if(format==='jpeg'){
      ctx.fillStyle='#fff';
      ctx.fillRect(0,0,W,H);
    }

    const targetRatio = valueFromKey(ratioKey);
    let sx=0, sy=0, sw=imgEl.naturalWidth, sh=imgEl.naturalHeight;

    if(it.cropData){
      sx=it.cropData.x; sy=it.cropData.y; sw=it.cropData.width; sh=it.cropData.height;
    } else {
      // Auto-center fallback
      const iw=imgEl.naturalWidth, ih=imgEl.naturalHeight, ir=iw/ih;
      if(ir>targetRatio){ sh=ih; sw=Math.round(ih*targetRatio); sx=Math.round((iw-sw)/2); sy=0; }
      else { sw=iw; sh=Math.round(iw/targetRatio); sx=0; sy=Math.round((ih-sh)/2); }
    }

    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, W, H);

    return canvas.toDataURL(format==='png'?'image/png':'image/jpeg', quality);
  }

  async function downloadSelectedRecorte(){
    if(selected<0) return;
    if(cropper) await saveCurrentCrop();
    const it = items[selected];
    const dataUrl = await exportRecorteToDataURL(it);
    const blob = dataURLToBlob(dataUrl);
    const ext = fmt.value==='png'?'png':'jpg';
    const base = parseInt(sizeEl.value,10);
    const rk = (carouselRatioKey || it.ratioKey || keyFromValue(currentRatio)).replace(':','x').replace('.','_').replace('.','_');
    const prefix = pad2(selected+1);
    downloadBlob(blob, `${prefix}__${baseName(it.name)}__IG_${rk}__${base}.${ext}`);
    toast('ok', 'Descargada', `${prefix}`);
  }

  async function downloadZIP(){
    if(items.length===0 || busyZip) return;
    if(selected>=0 && cropper) await saveCurrentCrop();
    busyZip = true;
    setDisabled();
    toast('', 'Procesando ZIP', '...');
    const zip = new JSZip();
    const ext = fmt.value==='png'?'png':'jpg';
    const base = parseInt(sizeEl.value,10);
    const rkGlobal = carouselRatioKey || keyFromValue(currentRatio);

    // Imágenes
    for(let i=0;i<items.length;i++){
      const it = items[i];
      const dataUrl = await exportRecorteToDataURL(it);
      const blob = dataURLToBlob(dataUrl);
      const rk = (rkGlobal).replace(':','x').replace('.','_').replace('.','_');
      zip.file(`${pad2(i+1)}__${baseName(it.name)}__IG_${rk}__${base}.${ext}`, blob);
    }
    
    // Caption TXT
    const txtContent = captionText.value.trim();
    if(txtContent) {
        zip.file("caption.txt", txtContent);
    }

    const out = await zip.generateAsync({type:'blob'});
    downloadBlob(out, `caruselforge_${base}px_${(rkGlobal).replace(':','x').replace('.','_').replace('.','_')}.zip`);
    busyZip = false;
    setDisabled();
    toast('ok', 'ZIP Listo', `Descarga finalizada.`);
  }
  
  // --- Event Listeners ---
  
  // AI (OpenAI)
  if (aiFixBtn) {
    aiFixBtn.addEventListener('click', () => fixCaptionWithAI(captionText, charCount));
    updateAiUi(); // Inicializar estado visual de la IA
  }

  // AI (Replicate)
  if(generateImageBtn) {
    generateImageBtn.addEventListener('click', async () => {
        const prompt = replicatePrompt.value.trim();
        const ratio = replicateRatio.value;
        const useInputImage = replicateInputImage.value === 'yes';
        
        if (!prompt) return toast('warn', 'Prompt vacío', 'Escribe una descripción.');

        const originalText = generateImageBtn.innerHTML;
        generateImageBtn.disabled = true;
        generateImageBtn.innerHTML = '<span class="spinning">↻</span> Generando...';
        
        let inputDataUrl = null;
        if (useInputImage && selected >= 0) {
            // Usar la imagen activa, forzando recorte con la calidad máxima permitida (2160px)
            sizeEl.value = '2160'; 
            fmt.value = 'png';
            inputDataUrl = await exportRecorteToDataURL(items[selected]);
            sizeEl.value = '1080'; // Restaurar UI (aunque no se usa en el export de Replicate)
            fmt.value = 'jpeg'; // Restaurar UI
        } else if (useInputImage) {
            toast('warn', 'Sin Imagen', 'Selecciona una imagen para usar Image-to-Image.');
            generateImageBtn.disabled = false;
            generateImageBtn.innerHTML = originalText;
            return;
        }

        try {
            const imageUrl = await generateImageWithReplicate(prompt, ratio, inputDataUrl);
            
            // 1. Descargar la imagen generada como Blob
            const blob = await fetch(imageUrl).then(r => r.blob());
            
            // 2. Crear un File de la imagen generada
            const f = new File([blob], `AI_${baseName(prompt).slice(0, 30)}__${ratio.replace(':','x')}.png`, { type: 'image/png' });
            
            // 3. Añadir el File a la lista de elementos
            await addFiles([f]); 
            
            toast('ok', 'Imagen Generada', 'Añadida al carrusel.');

        } catch (err) {
            console.error(err);
            toast('bad', 'Error Replicate', err.message);
        } finally {
            generateImageBtn.disabled = false;
            generateImageBtn.innerHTML = originalText;
        }
    });
  }

  // Caption
  captionText.addEventListener('input', () => {
      const len = captionText.value.length;
      charCount.textContent = `${len} / 2200`;
      if(len > 2200) charCount.style.color = 'var(--danger)';
      else charCount.style.color = 'var(--text-dim)';
  });

  // Archivos
  files.addEventListener('change', (e)=> addFiles(e.target.files));
  
  // Limpiar
  clearAll.addEventListener('click', ()=>{
    if(items.length && !confirm('¿Vaciar todo el carrusel?')) return;
    destroyCropper();
    items.forEach(it => it.url && URL.revokeObjectURL(it.url));
    items=[]; selected=-1;
    list.innerHTML=''; strip.innerHTML='';
    preview.src=''; dots.innerHTML='';
    img.removeAttribute('src');
    ratioLabel.textContent = '1:1';
    captionText.value = '';
    charCount.textContent = '0 / 2200';
    carouselRatioKey = null;
    currentRatio = 1;
    qVal.textContent = Number(q.value).toFixed(2);
    updateHeader();
    setDisabled();
    toggleEmpty();
    updateRatioModeUI();
    toast('warn', 'Reinicio', 'Carrusel vaciado.');
  });

  // Navegación
  [prevBtn,pPrev].forEach(b=> b.addEventListener('click', ()=> moveSelection(-1)));
  [nextBtn,pNext].forEach(b=> b.addEventListener('click', ()=> moveSelection(+1)));
  window.addEventListener('keydown', (e)=>{
    if(e.target === captionText) return;
    if(e.key==='ArrowLeft') moveSelection(-1);
    if(e.key==='ArrowRight') moveSelection(+1);
    if(e.key==='Escape') {
        if(modalOverlay.style.display==='flex') closeModal();
        if(helpOverlay.style.display==='flex') helpOverlay.style.display='none';
    }
  });

  // Orden
  moveUp.addEventListener('click', ()=> moveItem(-1));
  moveDown.addEventListener('click', ()=> moveItem(+1));

  // Ratios
  document.querySelectorAll('[data-r]').forEach(b=>{
    b.addEventListener('click', ()=> {
      if(carouselRatioKey){
        toast('warn','Bloqueado', `Usa "Configurar Todo" para cambiar.`);
        return;
      }
      let r = 1;
      try { r = Function(`"use strict"; return (${b.getAttribute('data-r')});`)(); } catch {}
      currentRatio = r;
      ratioLabel.textContent = keyFromValue(r);
      if(cropper) {
          cropper.setAspectRatio(currentRatio);
          setTimeout(syncPreviewRealTime, 50);
      }
      toast('', 'Ratio Libre', `${keyFromValue(r)}`);
    });
  });

  // Controles del Cropper
  zoomIn.addEventListener('click', ()=> { cropper?.zoom(0.08); setTimeout(syncPreviewRealTime,50); });
  zoomOut.addEventListener('click', ()=> { cropper?.zoom(-0.08); setTimeout(syncPreviewRealTime,50); });
  rotL.addEventListener('click', ()=> { cropper?.rotate(-90); setTimeout(syncPreviewRealTime,50); });
  rotR.addEventListener('click', ()=> { cropper?.rotate(90); setTimeout(syncPreviewRealTime,50); });
  reset.addEventListener('click', ()=> { cropper?.reset(); setTimeout(syncPreviewRealTime,50); });
  saveCrop.addEventListener('click', saveCurrentCrop);

  // Exportación
  q.addEventListener('input', ()=> qVal.textContent = Number(q.value).toFixed(2));
  dlOne.addEventListener('click', downloadSelectedRecorte);
  exportCropBtn.addEventListener('click', downloadSelectedRecorte);
  dlZip.addEventListener('click', downloadZIP);

  // Drag & Drop para subir archivos
  const stop = (e)=>{ e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover'].forEach(ev=>{
    dropzone.addEventListener(ev, (e)=>{ stop(e); dropzone.classList.add('drag'); });
  });
  ['dragleave','drop'].forEach(ev=>{
    dropzone.addEventListener(ev, (e)=>{ stop(e); dropzone.classList.remove('drag'); });
  });
  dropzone.addEventListener('drop', (e)=>{
    const dt = e.dataTransfer;
    if(dt?.files?.length) addFiles(dt.files);
  });

  // --- Modal Ratio Events ---
  function openModal(){
    modalOverlay.style.display = 'flex';
    modalRatio.value = carouselRatioKey || keyFromValue(currentRatio);
  }
  function closeModal(){
    modalOverlay.style.display = 'none';
  }
  changeRatioBtn.addEventListener('click', () => {
    if(items.length===0) return;
    openModal();
  });
  modalClose.addEventListener('click', closeModal);
  modalCancel.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e)=> {
    if(e.target === modalOverlay) closeModal();
  });
  modalApply.addEventListener('click', () => {
    const newKey = modalRatio.value;
    if(items.length && !confirm(`¿Aplicar ${newKey} a todo? Se perderán ajustes manuales.`)) return;
    applyCarouselRatio(newKey);
    closeModal();
  });

  // --- Modal Help Events ---
  const closeHelp = () => helpOverlay.style.display='none';
  helpBtn.addEventListener('click', () => helpOverlay.style.display='flex');
  helpCloseBtn.addEventListener('click', closeHelp);
  helpOkBtn.addEventListener('click', closeHelp);
  helpOverlay.addEventListener('click', (e) => {
      if(e.target===helpOverlay) closeHelp();
  });


  // --- Inicialización ---
  qVal.textContent = Number(q.value).toFixed(2);
  setDisabled();
  updateHeader();
  toggleEmpty();
  updateRatioModeUI();
  updateReplicateUi(); // Inicializar UI de Replicate
})();