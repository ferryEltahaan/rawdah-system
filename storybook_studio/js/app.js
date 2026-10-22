/**
 * ============================================================================
 * STORYBOOK & COLORING STUDIO - MAIN APPLICATION CONTROLLER
 * ============================================================================
 * Orchestrates: Identity, Line-Art Engine, Maze Engine, Activities & Print
 */

class StorybookApp {
  constructor() {
    this.currentProject = null;
    this.currentColoringCanvas = null;
    this.splitPercent = 50; // The split viewer slider %
    this.isDragging = false;
    this.approvedScenes = new Set();

    this._init();
  }

  // ============================================================
  // INIT & EVENT BINDING
  // ============================================================
  _init() {
    this._bindTabs();
    this._bindIdentityTab();
    this._bindLineArtTab();
    this._bindActivitiesTab();
    this._bindPreviewTab();
    this._bindGlobalActions();

    // Load Maryam project by default
    this._loadProject('mariam');
  }

  // ============================================================
  // TAB NAVIGATION
  // ============================================================
  _bindTabs() {
    document.querySelectorAll('.step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(tabId)?.classList.add('active');

        // Tab-specific on-show
        if (tabId === 'tab-lineart') this._initLineArtTab();
        if (tabId === 'tab-activities') this._initActivitiesTab();
        if (tabId === 'tab-preview') this._syncPreviewTab();
      });
    });
  }

  // ============================================================
  // TAB 1: IDENTITY & STORY SCENES
  // ============================================================
  _bindIdentityTab() {
    // Child Photo Upload
    const photoArea = document.getElementById('photoDropArea');
    const photoInput = document.getElementById('childPhotoInput');
    const photoImg = document.getElementById('childPhotoImg');

    photoArea?.addEventListener('click', () => photoInput?.click());

    photoInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const url = URL.createObjectURL(file);
        photoImg.src = url;
        this._showToast('📷 تم رفع صورة الطفل بنجاح!');
      }
    });

    // Drag and Drop on photo area
    photoArea?.addEventListener('dragover', (e) => {
      e.preventDefault();
      photoArea.style.borderColor = 'var(--accent-gold)';
    });
    photoArea?.addEventListener('dragleave', () => {
      photoArea.style.borderColor = 'var(--accent-purple)';
    });
    photoArea?.addEventListener('drop', (e) => {
      e.preventDefault();
      photoArea.style.borderColor = 'var(--accent-purple)';
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        photoImg.src = url;
        this._showToast('📷 تم رفع الصورة بنجاح!');
      }
    });

    // Quick sample buttons
    document.querySelectorAll('.chip-btn[data-sample]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._loadProject(btn.dataset.sample);
      });
    });

    // Copy Identity Prompt button
    document.getElementById('copyAnchorBtn')?.addEventListener('click', () => {
      const features = document.getElementById('facialFeatures')?.value || '';
      const outfit = document.getElementById('outfitRule')?.value || '';
      const style = document.getElementById('artStyle')?.value || '';

      const englishPrompt = this.currentProject?.englishPromptLock ||
        `Direct facial likeness from reference image. ${features} Wearing: ${outfit}. Art style: ${style}. A4 portrait, high-quality children's book illustration. --ar 3:4 --cw 100`;

      navigator.clipboard.writeText(englishPrompt)
        .then(() => this._showToast('✅ تم نسخ برومبت الهوية للحافظة! الصقه في Midjourney أو Flux'))
        .catch(() => this._showToast('❌ فشل النسخ، حاول مجدداً'));
    });

    // Add scene button → open Story Manager modal (Pane 1)
    document.getElementById('addSceneBtn')?.addEventListener('click', () => {
      window.storyManager?.openModal('tab-add-scene');
    });

    // Live sync cover/dedication text as user types
    ['childName', 'bookTitle'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this._syncLiveTextFields());
    });
  }

  _loadProject(key) {
    const project = window.SAMPLE_PROJECTS?.[key];
    if (!project) return;

    this.currentProject = project;

    // Populate form fields
    this._setVal('childName', project.childName);
    this._setVal('childAge', project.childAge);
    this._setVal('bookTitle', project.bookTitle);
    this._setVal('facialFeatures', project.facialFeatures);
    this._setVal('outfitRule', project.outfitRule);
    this._setVal('artStyle', project.artStyle);

    // Set photo
    const photoImg = document.getElementById('childPhotoImg');
    if (photoImg && project.photoUrl) photoImg.src = project.photoUrl;

    // Render scenes
    this._renderScenesList(project.scenes || []);

    // Sync live text
    this._syncLiveTextFields();

    // Update certificate
    window.activitiesEngine?.updateCertificate(project.childName, project.bookTitle);

    this._showToast(`✨ تم تحميل مشروع «${project.childName}» بنجاح!`);
  }

  _renderScenesList(scenes) {
    const container = document.getElementById('scenesListContainer');
    if (!container) return;
    container.innerHTML = '';

    const colors = ['#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b','#ef4444'];

    scenes.forEach((scene) => {
      const div = document.createElement('div');
      div.className = 'scene-card-item';
      div.dataset.sceneId = scene.id;

      const colorExists = !!(scene.colorImg && !scene.colorImg.startsWith('data:image/svg'));
      const bwExists = !!(scene.bwImg && !scene.bwImg.startsWith('data:image/svg'));
      const bg = colors[(scene.number - 1) % colors.length];

      // SVG placeholder for missing images
      const svgPh = `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90"><rect fill="${bg}33" width="90" height="90" rx="8"/><text x="45" y="38" text-anchor="middle" font-size="26" fill="${bg}">🖼</text><text x="45" y="58" text-anchor="middle" font-size="10" fill="${bg}" font-family="sans-serif">${scene.number}</text><text x="45" y="72" text-anchor="middle" font-size="8" fill="#888" font-family="sans-serif">اضغط للرفع</text></svg>`
      )}`;

      const thumbSrc = colorExists ? scene.colorImg : svgPh;
      const statusClass = colorExists && bwExists ? 'status-done' : colorExists ? 'status-partial' : 'status-pending';
      const statusText = colorExists && bwExists ? '✅ مكتمل' : colorExists ? '🔶 يحتاج تلوين' : '⚠️ ارفع صورة';

      div.innerHTML = `
        <div class="scene-thumb-wrap" data-scene-id="${scene.id}" title="انقر أو اسحب لرفع صورة المشهد الملون">
          <img class="scene-thumb" src="${thumbSrc}" alt="صورة المشهد">
          <div class="scene-thumb-overlay"><span>📷 رفع صورة</span></div>
          <input type="file" class="scene-img-input" accept="image/*" style="display:none;" data-scene-id="${scene.id}">
        </div>
        <div class="scene-details">
          <div class="scene-details-header">
            <h4>${scene.number}. ${scene.title}</h4>
            <span class="scene-status ${statusClass}">${statusText}</span>
          </div>
          <p class="scene-desc">${(scene.storyArabic || '').substring(0, 85)}…</p>
          <div class="scene-actions">
            <button class="btn btn-outline btn-mini copy-prompt-btn" data-scene="${scene.id}">📋 برومبت</button>
            ${colorExists ? `<button class="btn btn-secondary btn-mini auto-bw-btn" data-scene="${scene.id}">⚡ توليد تلوين</button>` : ''}
            ${colorExists ? `<button class="btn btn-outline btn-mini load-lineart-btn" data-scene="${scene.id}" data-img="${scene.colorImg}">🎨 استوديو</button>` : ''}
          </div>
        </div>
      `;
      container.appendChild(div);
    });

    // Per-scene image upload (click + drag-drop)
    container.querySelectorAll('.scene-thumb-wrap').forEach(wrap => {
      const input = wrap.querySelector('.scene-img-input');
      wrap.addEventListener('click', () => input?.click());
      wrap.addEventListener('dragover', (e) => { e.preventDefault(); wrap.style.outline = '2px solid var(--accent-gold)'; });
      wrap.addEventListener('dragleave', () => { wrap.style.outline = ''; });
      wrap.addEventListener('drop', (e) => {
        e.preventDefault(); wrap.style.outline = '';
        const file = e.dataTransfer.files[0];
        if (file?.type.startsWith('image/')) this._applySceneImage(wrap.dataset.sceneId, file);
      });
      input?.addEventListener('change', (e) => {
        if (e.target.files[0]) this._applySceneImage(input.dataset.sceneId, e.target.files[0]);
      });
    });

    // Copy prompt
    container.querySelectorAll('.copy-prompt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const scene = this.currentProject?.scenes?.find(s => s.id === btn.dataset.scene);
        const text = scene?.promptEn || '';
        if (text) navigator.clipboard.writeText(text).then(() => this._showToast('📋 تم نسخ البرومبت!'));
        else this._showToast('⚠️ لا يوجد برومبت محفوظ لهذا المشهد بعد');
      });
    });

    // Auto generate B&W from color per scene
    container.querySelectorAll('.auto-bw-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const scene = this.currentProject?.scenes?.find(s => s.id === btn.dataset.scene);
        if (!scene?.colorImg) return;
        btn.textContent = '⏳ جارٍ...';
        btn.disabled = true;
        const img = new Image();
        img.src = scene.colorImg;
        img.onload = () => {
          const result = window.lineArtEngine?.process(img, { thickness: 3, edgeThreshold: 45, smoothing: 2 });
          if (result) {
            scene.bwImg = result.toDataURL('image/png');
            this._showToast(`✅ تم توليد صفحة تلوين "${scene.title}"!`);
            this._renderScenesList(this.currentProject.scenes);
          }
        };
        img.onerror = () => { btn.textContent = '⚡ توليد تلوين'; btn.disabled = false; };
      });
    });

    // Load scene into lineart studio
    container.querySelectorAll('.load-lineart-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.img) {
          this._loadSceneIntoLineArt(btn.dataset.img);
          document.querySelector('[data-tab="tab-lineart"]')?.click();
        }
      });
    });
  }

  // Upload image → auto apply to scene + auto-generate B&W
  _applySceneImage(sceneId, file) {
    const scene = this.currentProject?.scenes?.find(s => s.id === sceneId);
    if (!scene) return;
    const url = URL.createObjectURL(file);
    scene.colorImg = url;
    this._showToast(`📷 رُفعت صورة "${scene.title}" — جارٍ توليد صفحة التلوين...`);
    const img = new Image();
    img.src = url;
    img.onload = () => {
      const result = window.lineArtEngine?.process(img, { thickness: 3, edgeThreshold: 45, smoothing: 2 });
      if (result) { scene.bwImg = result.toDataURL('image/png'); }
      this._showToast(`✅ "${scene.title}" — الصورة وصفحة التلوين جاهزتان!`);
      this._renderScenesList(this.currentProject.scenes);
    };
  }

  _syncLiveTextFields() {
    const name = document.getElementById('childName')?.value || '';
    const title = document.getElementById('bookTitle')?.value || '';

    this._setInner('previewCoverTitle', title.replace(/\s+و\s+/, '<br><span>') + (title.includes(' و ') ? '</span>' : ''));
    this._setInner('previewCoverChildName', name);
    this._setInner('previewDedicationName', name);
    this._setInner('certChildNameDisplay', `الأميرة ${name}`);
    this._setInner('certBookTitleDisplay', `«${title}»`);
    this._setInner('printCertChildName', `الأميرة ${name}`);
    this._setInner('printCertBookTitle', `«${title}»`);
  }

  // ============================================================
  // TAB 2: LINE-ART ENGINE
  // ============================================================
  _bindLineArtTab() {
    // Range sliders live feedback
    const sliders = {
      lineThickness: { el: document.getElementById('lineThickness'), label: document.getElementById('lineThicknessVal'), unit: ' px (مناسب للأطفال)' },
      edgeThreshold: { el: document.getElementById('edgeThreshold'), label: document.getElementById('edgeThresholdVal'), map: { 15: 'تفاصيل عالية', 30: 'دقيق', 45: 'متوازن', 60: 'رئيسي', 80: 'مبسط جداً' } },
      smoothingFactor: { el: document.getElementById('smoothingFactor'), label: document.getElementById('smoothingVal'), map: { 1: 'بدون تنعيم', 2: 'مفعل', 3: 'قوي', 4: 'ناعم جداً', 5: 'أقصى تنعيم' } }
    };

    Object.values(sliders).forEach(({ el, label, unit, map }) => {
      el?.addEventListener('input', () => {
        if (label) {
          if (map) label.textContent = map[el.value] || el.value;
          else if (unit) label.textContent = `${el.value}${unit}`;
        }
      });
    });

    // Scene selector changes source image
    document.getElementById('sceneSelector')?.addEventListener('change', (e) => {
      const scene = this.currentProject?.scenes?.find(s => s.id === e.target.value);
      if (scene?.colorImg) this._loadSceneIntoLineArt(scene.colorImg);
    });

    // Apply Algorithm
    document.getElementById('applyAlgorithmBtn')?.addEventListener('click', () => {
      this._runLineArtProcessing();
    });

    // Download coloring page
    document.getElementById('downloadColoringPageBtn')?.addEventListener('click', () => {
      if (!this.currentColoringCanvas) {
        this._showToast('⚠️ اضغط "معالجة واستخراج صفحة التلوين" أولاً!');
        return;
      }
      const link = document.createElement('a');
      link.download = `coloring_page_${Date.now()}.png`;
      link.href = this.currentColoringCanvas.toDataURL('image/png');
      link.click();
      this._showToast('💾 تم تنزيل صفحة التلوين بجودة عالية!');
    });

    // Save to manifest
    document.getElementById('saveToBookManifestBtn')?.addEventListener('click', () => {
      const selectedScene = document.getElementById('sceneSelector')?.value;
      if (selectedScene) {
        this.approvedScenes.add(selectedScene);
        this._showToast(`✅ تم اعتماد مشهد «${selectedScene}» في كتاب الطباعة!`);
      }
    });

    // View mode buttons
    document.getElementById('viewModeSplit')?.addEventListener('click', () => this._setViewMode('split'));
    document.getElementById('viewModeColoringOnly')?.addEventListener('click', () => this._setViewMode('coloring'));
    document.getElementById('viewModeColorOnly')?.addEventListener('click', () => this._setViewMode('color'));

    // Split Slider Drag
    this._bindSplitSlider();
  }

  _initLineArtTab() {
    // Load default scene image
    const defaultScene = this.currentProject?.scenes?.[0];
    if (defaultScene?.colorImg) {
      this._loadSceneIntoLineArt(defaultScene.colorImg);
    }
  }

  _loadSceneIntoLineArt(imgUrl) {
    const sourceImg = document.getElementById('sourceColorImg');
    if (sourceImg) {
      sourceImg.src = imgUrl;
      this._setStatusText('تم تحميل الصورة. جاهز للمعالجة الحسابية الفورية');

      // Pre-process automatically
      sourceImg.onload = () => {
        setTimeout(() => this._runLineArtProcessing(), 300);
      };
    }
  }

  _runLineArtProcessing() {
    const sourceImg = document.getElementById('sourceColorImg');
    const outputCanvas = document.getElementById('outputColoringCanvas');
    if (!sourceImg || !outputCanvas) return;

    this._setStatusText('⚡ جارٍ تطبيق خوارزمية Sobel Edge Detection...');

    const options = {
      thickness: parseInt(document.getElementById('lineThickness')?.value || 3),
      edgeThreshold: parseInt(document.getElementById('edgeThreshold')?.value || 45),
      smoothing: parseInt(document.getElementById('smoothingFactor')?.value || 2),
      cleanBackground: document.getElementById('cleanBackgroundToggle')?.checked ?? true,
      boldOutlines: document.getElementById('boldOutlinesToggle')?.checked ?? true,
    };

    // Use requestAnimationFrame so UI updates with status first
    requestAnimationFrame(() => {
      try {
        const resultCanvas = window.lineArtEngine.process(sourceImg, options);
        
        // Copy result to output canvas
        outputCanvas.width = resultCanvas.width;
        outputCanvas.height = resultCanvas.height;
        const ctx = outputCanvas.getContext('2d');
        ctx.drawImage(resultCanvas, 0, 0);
        this.currentColoringCanvas = outputCanvas;

        this._setStatusText('✅ صفحة التلوين جاهزة! خطوط سوداء نقية 100% — بدون أي ظلال رمادية');
        this._showToast('🎨 تم استخراج صفحة التلوين بنجاح!');
      } catch (err) {
        console.error('LineArt processing error:', err);
        this._setStatusText('❌ خطأ أثناء المعالجة: ' + err.message);
      }
    });
  }

  _setViewMode(mode) {
    const clipped = document.getElementById('clippedColorWrap');
    const handle = document.getElementById('splitHandle');
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));

    if (mode === 'split') {
      document.getElementById('viewModeSplit')?.classList.add('active');
      if (clipped) { clipped.style.display = ''; clipped.style.width = '50%'; }
      if (handle) handle.style.display = '';
    } else if (mode === 'coloring') {
      document.getElementById('viewModeColoringOnly')?.classList.add('active');
      if (clipped) clipped.style.display = 'none';
      if (handle) handle.style.display = 'none';
    } else if (mode === 'color') {
      document.getElementById('viewModeColorOnly')?.classList.add('active');
      if (clipped) { clipped.style.display = ''; clipped.style.width = '100%'; }
      if (handle) handle.style.display = 'none';
    }
  }

  _bindSplitSlider() {
    const handle = document.getElementById('splitHandle');
    const container = document.getElementById('splitViewer');
    const clipped = document.getElementById('clippedColorWrap');

    if (!handle || !container || !clipped) return;

    let dragging = false;

    handle.addEventListener('mousedown', () => { dragging = true; });
    window.addEventListener('mouseup', () => { dragging = false; });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const rect = container.getBoundingClientRect();
      const percent = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
      handle.style.left = `${percent}%`;
      clipped.style.width = `${percent}%`;
    });

    // Touch support
    handle.addEventListener('touchstart', () => { dragging = true; }, { passive: true });
    window.addEventListener('touchend', () => { dragging = false; });
    window.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const rect = container.getBoundingClientRect();
      const touch = e.touches[0];
      const percent = Math.max(5, Math.min(95, ((touch.clientX - rect.left) / rect.width) * 100));
      handle.style.left = `${percent}%`;
      clipped.style.width = `${percent}%`;
    }, { passive: true });
  }

  // ============================================================
  // TAB 3: ACTIVITIES
  // ============================================================
  _bindActivitiesTab() {
    // Maze
    document.getElementById('regenerateMazeBtn')?.addEventListener('click', () => {
      this._generateMaze();
    });

    document.getElementById('toggleMazeSolutionBtn')?.addEventListener('click', () => {
      window.mazeEngine.showSolution = !window.mazeEngine.showSolution;
      const canvas = document.getElementById('mazeCanvas');
      if (canvas) window.mazeEngine.render(canvas);
      this._showToast(window.mazeEngine.showSolution ? '👁️ تم إظهار مسار الحل' : '🙈 تم إخفاء الحل');
    });

    document.getElementById('mazeDifficulty')?.addEventListener('change', () => {
      this._generateMaze();
    });

    // Connect the Dots
    document.getElementById('dotsShapeSelect')?.addEventListener('change', (e) => {
      const canvas = document.getElementById('dotsCanvas');
      if (canvas) window.activitiesEngine?.renderDots(canvas, e.target.value);
    });

    document.getElementById('downloadDotsBtn')?.addEventListener('click', () => {
      const canvas = document.getElementById('dotsCanvas');
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `connect_the_dots_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this._showToast('💾 تم تنزيل صفحة توصيل النقاط!');
    });
  }

  _initActivitiesTab() {
    // Generate maze on first open
    this._generateMaze();

    // Render dots
    const dotsCanvas = document.getElementById('dotsCanvas');
    if (dotsCanvas) {
      window.activitiesEngine?.renderDots(dotsCanvas, 'crown');
    }

    // Update certificate
    const name = document.getElementById('childName')?.value || 'مريم';
    const title = document.getElementById('bookTitle')?.value || 'الأميرة مريم والقلعة السحرية';
    window.activitiesEngine?.updateCertificate(name, title);
  }

  _generateMaze() {
    const difficultyEl = document.getElementById('mazeDifficulty');
    const size = parseInt(difficultyEl?.value || 15);
    const canvas = document.getElementById('mazeCanvas');
    if (!canvas) return;

    window.mazeEngine.generate(size);
    window.mazeEngine.showSolution = false;
    window.mazeEngine.render(canvas);

    // Also update the print page img
    this._syncMazeToPrintPage();
  }

  _syncMazeToPrintPage() {
    const mazeCanvas = document.getElementById('mazeCanvas');
    const printImg = document.getElementById('printMazeImg');
    if (mazeCanvas && printImg) {
      printImg.src = mazeCanvas.toDataURL('image/png');
    }
  }

  // ============================================================
  // TAB 4: PREVIEW & PRINT
  // ============================================================
  _bindPreviewTab() {
    document.getElementById('directPrintBtn')?.addEventListener('click', () => {
      this._printBook();
    });

    document.getElementById('printFullBookBtn')?.addEventListener('click', () => {
      document.querySelector('[data-tab="tab-preview"]')?.click();
      setTimeout(() => this._printBook(), 500);
    });

    document.getElementById('downloadAllPagesZipBtn')?.addEventListener('click', () => {
      this._showToast('💡 استخدم "طباعة / حفظ كـ PDF" من متصفحك لحفظ الكتاب كاملاً بمقاس A4 نقياً!');
    });
  }

  _syncPreviewTab() {
    this._syncLiveTextFields();
    this._syncMazeToPrintPage();
  }

  _printBook() {
    this._syncPreviewTab();
    this._setStatusText('🖨️ جارٍ فتح نافذة الطباعة...');
    setTimeout(() => {
      window.print();
      this._showToast('✅ تم فتح نافذة الطباعة — اختر "حفظ كـ PDF" للحصول على ملف A4 جاهز للمطبعة');
    }, 200);
  }

  // ============================================================
  // GLOBAL ACTIONS
  // ============================================================
  _bindGlobalActions() {
    document.getElementById('loadMaryamBtn')?.addEventListener('click', () => {
      document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.chip-btn[data-sample="mariam"]')?.classList.add('active');
      this._loadProject('mariam');
      document.querySelector('[data-tab="tab-identity"]')?.click();
    });

    // New Book → open Story Manager modal (Pane 2: New Child Book)
    document.getElementById('newBookBtn')?.addEventListener('click', () => {
      window.storyManager?.openModal('tab-new-book');
    });

    // Add Stories button in header → open modal on templates tab
    document.getElementById('addStoriesBtn')?.addEventListener('click', () => {
      window.storyManager?.openModal('tab-templates');
    });
  }

  _clearForm() {
    ['childName', 'childAge', 'bookTitle', 'facialFeatures', 'outfitRule'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const photoImg = document.getElementById('childPhotoImg');
    if (photoImg) photoImg.src = '';
    document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('scenesListContainer').innerHTML = '';
    this.currentProject = null;
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================
  _setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  }

  _setInner(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html || '';
  }

  _setStatusText(text) {
    const el = document.getElementById('canvasStatusText');
    if (el) el.textContent = text;
  }

  _showToast(message) {
    const toast = document.getElementById('toastMessage');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }
}

// ============================================================
// BOOTSTRAP APPLICATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  window.app = new StorybookApp();
  console.log('🎨 Storybook Studio Engine Initialized — Zero-Error Mode Active');
});
