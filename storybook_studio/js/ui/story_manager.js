/**
 * ============================================================================
 * STORY MANAGER UI — 3-in-1 Modal Controller
 * ============================================================================
 * Handles: Add Scene | New Child Book | Templates Library
 */

class StoryManager {
  constructor() {
    this._colorImgUrl = null;
    this._bwImgUrl = null;
    this._init();
  }

  _init() {
    this._bindOpenTriggers();
    this._bindModalClose();
    this._bindModalTabs();
    this._bindPane1_AddScene();
    this._bindPane2_NewBook();
    this._bindPane3_Templates();
    this._bindPromptsModal();
  }

  // ============================================================
  // OPEN TRIGGERS
  // ============================================================
  _bindOpenTriggers() {
    // "Add Scene" button in identity tab
    document.getElementById('addSceneBtn')?.addEventListener('click', () => {
      this.openModal('tab-add-scene');
    });
    // "New Book" button in header
    document.getElementById('newBookBtn')?.addEventListener('click', () => {
      this.openModal('tab-new-book');
    });
  }

  openModal(paneId = 'tab-add-scene') {
    const modal = document.getElementById('storyManagerModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Switch to requested pane
    this._switchModalPane(paneId);

    // Update current book name display
    const name = document.getElementById('childName')?.value || 'الكتاب الحالي';
    document.getElementById('currentBookNameDisplay')?.setAttribute('textContent', name);
    const el = document.getElementById('currentBookNameDisplay');
    if (el) el.textContent = name;

    // Load templates on first open
    if (paneId === 'tab-templates') this._renderTemplatesGrid();
  }

  _bindModalClose() {
    document.getElementById('closeModalBtn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('storyManagerModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'storyManagerModal') this.closeModal();
    });
  }

  closeModal() {
    document.getElementById('storyManagerModal').style.display = 'none';
    document.body.style.overflow = '';
  }

  // ============================================================
  // MODAL TAB SWITCHING
  // ============================================================
  _bindModalTabs() {
    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._switchModalPane(btn.dataset.modalTab);
        if (btn.dataset.modalTab === 'tab-templates') {
          this._renderTemplatesGrid();
        }
      });
    });
  }

  _switchModalPane(paneId) {
    document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.modal-pane').forEach(p => p.classList.remove('active'));

    document.querySelector(`[data-modal-tab="${paneId}"]`)?.classList.add('active');
    document.getElementById(paneId)?.classList.add('active');
  }

  // ============================================================
  // PANE 1: ADD SCENE TO CURRENT BOOK
  // ============================================================
  _bindPane1_AddScene() {
    // Color image upload
    const colorBox = document.getElementById('colorImgBox');
    const colorInput = document.getElementById('colorImgInput');
    colorBox?.addEventListener('click', () => colorInput?.click());
    colorInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      this._colorImgUrl = url;
      this._previewImg('colorImgPreview', 'colorImgPlaceholder', url);
    });

    // B&W image upload
    const bwBox = document.getElementById('bwImgBox');
    const bwInput = document.getElementById('bwImgInput');
    bwBox?.addEventListener('click', () => bwInput?.click());
    bwInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      this._bwImgUrl = url;
      this._previewImg('bwImgPreview', 'bwImgPlaceholder', url);
    });

    // Auto-generate line art from color image
    document.getElementById('autoGenerateLineart')?.addEventListener('click', () => {
      if (!this._colorImgUrl) {
        window.app?._showToast('⚠️ ارفع الصورة الملونة أولاً ثم اضغط التوليد الحسابي');
        return;
      }
      const tempImg = new Image();
      tempImg.src = this._colorImgUrl;
      tempImg.onload = () => {
        const result = window.lineArtEngine?.process(tempImg, { thickness: 3, edgeThreshold: 45, smoothing: 2 });
        if (result) {
          const url = result.toDataURL('image/png');
          this._bwImgUrl = url;
          this._previewImg('bwImgPreview', 'bwImgPlaceholder', url);
          window.app?._showToast('✅ تم توليد صفحة التلوين حسابياً تلقائياً!');
        }
      };
    });

    // Confirm Add Scene
    document.getElementById('addSceneConfirmBtn')?.addEventListener('click', () => {
      this._confirmAddScene();
    });
  }

  _previewImg(imgId, placeholderId, url) {
    const img = document.getElementById(imgId);
    const ph = document.getElementById(placeholderId);
    if (img) { img.src = url; img.style.display = 'block'; }
    if (ph) ph.style.display = 'none';
  }

  _confirmAddScene() {
    const title = document.getElementById('newSceneTitle')?.value?.trim();
    const story = document.getElementById('newSceneStory')?.value?.trim();
    const number = parseInt(document.getElementById('newSceneNumber')?.value || 5);
    const promptEn = document.getElementById('newScenePromptEn')?.value?.trim() || '';

    if (!title) { window.app?._showToast('⚠️ أدخل عنوان المشهد أولاً'); return; }
    if (!story) { window.app?._showToast('⚠️ أدخل نص القصة أولاً'); return; }
    if (!this._colorImgUrl) { window.app?._showToast('⚠️ ارفع صورة المشهد الملونة أولاً'); return; }

    // Build scene object
    const newScene = {
      id: `scene_custom_${Date.now()}`,
      number,
      title,
      storyArabic: story,
      colorImg: this._colorImgUrl,
      bwImg: this._bwImgUrl || this._colorImgUrl,
      promptEn
    };

    // Add to current project
    if (!window.app?.currentProject) {
      window.app?._showToast('⚠️ لا يوجد كتاب مفتوح، افتح مشروعاً أولاً');
      return;
    }

    window.app.currentProject.scenes = window.app.currentProject.scenes || [];
    // Insert in order
    window.app.currentProject.scenes.push(newScene);
    window.app.currentProject.scenes.sort((a, b) => a.number - b.number);

    // Re-render scenes list
    window.app._renderScenesList(window.app.currentProject.scenes);

    // Also add a live page in the print preview
    this._addPageToBookPreview(newScene);

    // Reset form
    this._resetAddSceneForm();
    this.closeModal();
    window.app?._showToast(`✅ تم إضافة مشهد "${title}" للكتاب بنجاح!`);
  }

  _addPageToBookPreview(scene) {
    const container = document.getElementById('bookPrintableContainer');
    if (!container) return;

    // Add narrative page
    const narrativePage = document.createElement('article');
    narrativePage.className = 'a4-page story-narrative-page';
    narrativePage.innerHTML = `
      <div class="page-content-wrapper">
        <div class="story-illustration-frame">
          <img src="${scene.colorImg}" alt="${scene.title}" onerror="this.style.background='#f1f5f9'">
        </div>
        <div class="story-text-card">
          <div class="scene-chapter-badge">المشهد ${scene.number}</div>
          <h3 class="scene-title">${scene.title}</h3>
          <p class="scene-story-body">${scene.storyArabic}</p>
        </div>
        <div class="page-footer-number">مشهد ${scene.number}</div>
      </div>
    `;

    // Add coloring page
    const coloringPage = document.createElement('article');
    coloringPage.className = 'a4-page story-coloring-page';
    coloringPage.innerHTML = `
      <div class="page-content-wrapper">
        <div class="coloring-header-banner">
          <span>🖍️ لَوِّنِ مَعَنَا: ${scene.title}</span>
        </div>
        <div class="coloring-art-frame">
          <img src="${scene.bwImg}" alt="صفحة تلوين: ${scene.title}">
        </div>
        <div class="coloring-tip"><span>💡 استخدم ألوانك المفضلة!</span></div>
        <div class="page-footer-number">مشهد ${scene.number} — تلوين</div>
      </div>
    `;

    // Insert before the last 2 pages (maze + certificate)
    const allPages = container.querySelectorAll('.a4-page');
    const lastTwo = allPages.length >= 2 ? allPages[allPages.length - 2] : null;
    if (lastTwo) {
      container.insertBefore(narrativePage, lastTwo);
      container.insertBefore(coloringPage, lastTwo);
    } else {
      container.appendChild(narrativePage);
      container.appendChild(coloringPage);
    }
  }

  _resetAddSceneForm() {
    ['newSceneTitle', 'newSceneStory', 'newScenePromptEn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('newSceneNumber').value = window.app?.currentProject?.scenes?.length + 1 || 5;
    this._colorImgUrl = null;
    this._bwImgUrl = null;
    ['colorImgPreview', 'bwImgPreview'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.style.display = 'none'; el.src = ''; }
    });
    ['colorImgPlaceholder', 'bwImgPlaceholder'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    });
  }

  // ============================================================
  // PANE 2: NEW CHILD BOOK
  // ============================================================
  _bindPane2_NewBook() {
    // Show custom theme input when 'custom' selected
    document.getElementById('nbTheme')?.addEventListener('change', (e) => {
      const customGroup = document.getElementById('nbCustomThemeGroup');
      if (customGroup) customGroup.style.display = e.target.value === 'custom' ? '' : 'none';
    });

    // Create book
    document.getElementById('createNewBookBtn')?.addEventListener('click', () => {
      this._createNewBook();
    });

    // Generate prompts only
    document.getElementById('generatePromptsBtn')?.addEventListener('click', () => {
      this._showGeneratedPrompts();
    });
  }

  _getNewBookData() {
    const theme = document.getElementById('nbTheme')?.value;
    const customTheme = document.getElementById('nbCustomTheme')?.value;

    return {
      childName: document.getElementById('nbChildName')?.value?.trim() || 'الطفل',
      childAge: document.getElementById('nbChildAge')?.value?.trim() || '5 سنوات',
      bookTitle: document.getElementById('nbBookTitle')?.value?.trim() || `كتاب ${document.getElementById('nbChildName')?.value}`,
      theme: theme === 'custom' ? customTheme : theme,
      artStyle: document.getElementById('nbArtStyle')?.value || 'pixar_3d',
      scenesCount: parseInt(document.getElementById('nbScenesCount')?.value || 6),
      facialFeatures: document.getElementById('nbFeatures')?.value?.trim() || '',
      outfitRule: document.getElementById('nbOutfit')?.value?.trim() || '',
    };
  }

  _createNewBook() {
    const data = this._getNewBookData();
    if (!data.childName) { window.app?._showToast('⚠️ أدخل اسم الطفل'); return; }
    if (!data.bookTitle) { window.app?._showToast('⚠️ أدخل عنوان الكتاب'); return; }

    const newProject = {
      childName: data.childName,
      childAge: data.childAge,
      bookTitle: data.bookTitle,
      artStyle: data.artStyle,
      photoUrl: '',
      facialFeatures: data.facialFeatures,
      outfitRule: data.outfitRule,
      englishPromptLock: this._buildEnglishLock(data),
      scenes: this._buildScenesFromTheme(data),
    };

    // Register in SAMPLE_PROJECTS
    const key = `custom_${Date.now()}`;
    window.SAMPLE_PROJECTS[key] = newProject;

    // Load it
    window.app?.['_loadProject']?.(key) || this._loadDirect(newProject);

    this.closeModal();
    window.app?._showToast(`✨ تم إنشاء كتاب «${data.bookTitle}» بنجاح! أضف صورة الطفل الآن.`);

    // Switch to identity tab
    document.querySelector('[data-tab="tab-identity"]')?.click();
  }

  _loadDirect(project) {
    // Inject directly into app
    if (window.app) {
      window.app.currentProject = project;
      window.app._setVal?.('childName', project.childName);
      window.app._setVal?.('childAge', project.childAge);
      window.app._setVal?.('bookTitle', project.bookTitle);
      window.app._setVal?.('facialFeatures', project.facialFeatures);
      window.app._setVal?.('outfitRule', project.outfitRule);
      window.app._renderScenesList?.(project.scenes || []);
      window.app._syncLiveTextFields?.();
      window.activitiesEngine?.updateCertificate(project.childName, project.bookTitle);
    }
  }

  _showGeneratedPrompts() {
    const data = this._getNewBookData();
    if (!data.childName) { window.app?._showToast('⚠️ أدخل اسم الطفل أولاً'); return; }

    const scenes = this._buildScenesFromTheme(data);
    const lockPrompt = this._buildEnglishLock(data);

    let html = `
      <div class="prompt-section">
        <h3>🔒 بطاقة الهوية الثابتة (Identity Lock Prompt)</h3>
        <p class="prompt-desc">أضف هذا النص في بداية كل برومبت مع صورة الطفل:</p>
        <div class="prompt-block" data-text="${this._escAttr(lockPrompt)}">
          <button class="copy-one-btn">نسخ</button>
          <pre>${lockPrompt}</pre>
        </div>
      </div>
      <hr>
      <h3>📸 برومبتات المشاهد (${scenes.length} مشهد)</h3>
    `;

    scenes.forEach((scene, idx) => {
      const fullPrompt = `${lockPrompt} ${scene.promptEn || ''}`.trim();
      html += `
        <div class="prompt-section">
          <h4>المشهد ${idx + 1}: ${scene.title}</h4>
          <p class="prompt-desc ar-text">${scene.storyArabic}</p>
          <div class="prompt-block" data-text="${this._escAttr(fullPrompt)}">
            <button class="copy-one-btn">نسخ</button>
            <pre>${fullPrompt}</pre>
          </div>
        </div>
      `;
    });

    const output = document.getElementById('promptsOutput');
    if (output) output.innerHTML = html;

    // Bind copy buttons
    output?.querySelectorAll('.copy-one-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.closest('.prompt-block')?.dataset.text || '';
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = '✅ تم!';
          setTimeout(() => btn.textContent = 'نسخ', 2000);
        });
      });
    });

    // Show prompts modal
    document.getElementById('promptsModal').style.display = 'flex';
  }

  _buildEnglishLock(data) {
    const styleMap = {
      pixar_3d: 'High-end Pixar 3D meets fairytale storybook illustration style, soft volumetric lighting, 8k resolution',
      watercolor: 'Warm classic watercolor children\'s book illustration, textured paper feel, soft gentle colors',
      cartoon_2d: 'Vibrant 2D cartoon animation style, bold clean lines, bright saturated colors',
      chalk: 'Colorful chalk art on dark background, whimsical hand-drawn style'
    };
    const style = styleMap[data.artStyle] || styleMap.pixar_3d;
    const features = data.facialFeatures ? `Precise character likeness: ${data.facialFeatures}.` : 'Cute child protagonist.';
    const outfit = data.outfitRule ? `Wearing: ${data.outfitRule}.` : '';

    return `Character "${data.childName}" (${data.childAge}): ${features} ${outfit} ${style}. Vertical A4 portrait composition, children's storybook quality, no text or watermarks. --ar 3:4`;
  }

  _buildScenesFromTheme(data) {
    const themeScenes = {
      fantasy: [
        { title: `غلاف: ${data.bookTitle}`, story: `مَرْحَباً بِكَ فِي عَالَمِ السِّحْرِ وَالمُغَامَرَةِ يَا بَطَلَنَا ${data.childName}!`, promptEn: `children's book cover, fantasy magical adventure, sparkles and glowing magical elements` },
        { title: 'البداية', story: `ذَاتَ يَوْمٍ، اكْتَشَفَ ${data.childName} شَيْئاً عَجِيباً غَيَّرَ حَيَاتَهُ إِلَى الأَبَدِ.`, promptEn: 'child discovering magical object, sense of wonder and excitement' },
        { title: 'المغامرة', story: `انْطَلَقَ ${data.childName} فِي مُغَامَرَةٍ لَمْ يَتَخَيَّلْهَا قَطُّ.`, promptEn: 'brave child embarking on magical adventure journey' },
        { title: 'الصديق الجديد', story: `قَابَلَ ${data.childName} صَدِيقاً غَيْرَ مُتَوَقَّعٍ سَاعَدَهُ فِي الطَّرِيقِ.`, promptEn: 'child meeting an unexpected magical friend, heartwarming encounter' },
        { title: 'التحدي الكبير', story: `وَاجَهَ ${data.childName} تَحَدِّيهُ الأَكْبَرَ وَقَرَّرَ أَنَّهُ لَنْ يَسْتَسْلِمَ.`, promptEn: 'determined child facing a big magical challenge, brave expression' },
        { title: 'النهاية السعيدة', story: `فَازَ ${data.childName} بِشَجَاعَتِهِ وَقَلْبِهِ الطَّيِّبِ وَعَادَ بَطَلاً مُحَبَّباً!`, promptEn: 'triumphant child celebrated as hero, joyful magical ending' }
      ],
      space: [
        { title: `غلاف: ${data.bookTitle}`, story: `النُّجُومُ تَنْتَظِرُكَ يَا ${data.childName}، رَائِدُ الفَضَاءِ الصَّغِيرُ الشُّجَاعُ!`, promptEn: 'children\'s space book cover, little astronaut in rocket ship heading to colorful galaxy' },
        { title: 'الاستعداد للإطلاق', story: `ارْتَدَى ${data.childName} بَدْلَةَ الفَضَاءِ وَرَكِبَ صَارُوخَهُ الكَبِيرَ بِابْتِسَامَةٍ وَاثِقَةٍ.`, promptEn: 'child in space suit boarding rocket ship, countdown' },
        { title: 'كوكب الأحلام', story: `هَبَطَ ${data.childName} عَلَى كَوْكَبٍ لَمْ تَرَهُ عَيْنٌ مِنْ قَبْلُ — مُضِيءٍ بِكُلِّ أَلْوَانِ الطَّيْفِ.`, promptEn: 'little astronaut landing on magical colorful alien planet, alien landscape' },
        { title: 'أصدقاء النجوم', story: `قَابَلَ ${data.childName} كَائِنَاتٍ فَضَائِيَّةً صَغِيرَةً وَدِيَّةً وَتَبَادَلُوا الهَدَايَا.`, promptEn: 'child astronaut exchanging gifts with cute friendly alien creatures' },
        { title: 'إنقاذ الكوكب', story: `عَلِمَ ${data.childName} أَنَّ الكَوْكَبَ بِحَاجَةٍ لِلمُسَاعَدَةِ، فَسَارَعَ بِشَجَاعَةٍ لِإِنْقَاذِهِ.`, promptEn: 'brave young astronaut saving a planet with glowing heroic action' },
        { title: 'العودة منتصراً', story: `عَادَ ${data.childName} إِلَى الأَرْضِ بَطَلاً عَظِيماً وَفِي قَلْبِهِ ذِكْرَيَاتٌ لِلأَبَدِ!`, promptEn: 'happy astronaut child returning home, parents hugging, welcome back celebration' }
      ],
      islamic: [
        { title: `غلاف: ${data.bookTitle}`, story: `بِسْمِ اللهِ نَبْدَأُ حِكَايَةَ بَطَلِنَا ${data.childName} الطَّيِّبِ الأَخْلَاقِ.`, promptEn: 'Islamic children\'s book cover, kind smiling child, warm golden mosque background, soft colors' },
        { title: 'الصدق يفوز', story: `اخْتَارَ ${data.childName} دَائِماً الصِّدْقَ حَتَّى لَوْ كَانَ صَعْباً، فَنَالَ حُبَّ الجَمِيعِ.`, promptEn: 'honest child telling truth, warm glowing moral scene' },
        { title: 'رحمة بالحيوانات', story: `وَجَدَ ${data.childName} قِطَّةً صَغِيرَةً جَائِعَةً فَأَطْعَمَهَا وَرَعَاهَا بِرَحْمَةٍ وَحُبٍّ.`, promptEn: 'kind child feeding and caring for stray kitten, warm compassionate scene' },
        { title: 'مساعدة الجار', story: `رَأَى ${data.childName} جَارَهُ العَجُوزَ يَحْتَاجُ مُسَاعَدَةً فَأَسْرَعَ إِلَيْهِ بِكُلِّ فَرَحٍ.`, promptEn: 'child helping elderly neighbor, warm community scene, golden afternoon light' },
        { title: 'الصبر والشكر', story: `حِينَ لَمْ يَحْصَلْ ${data.childName} عَلَى مَا أَرَادَ تَذَكَّرَ النِّعَمَ وَشَكَرَ اللهَ بِرِضَى.`, promptEn: 'content patient child, grateful expression, peaceful scene with warm light' },
        { title: 'البطل الحقيقي', story: `تَعَلَّمَ ${data.childName} أَنَّ البَطَلَ الحَقِيقِيَّ هُوَ مَنْ يَخَافُ اللهَ وَيُحِبُّ النَّاسَ.`, promptEn: 'happy good-hearted child surrounded by loving family and friends, golden warm scene' }
      ]
    };

    const themeKey = Object.keys(themeScenes).find(k => data.theme?.includes(k)) || 'fantasy';
    const base = themeScenes[themeKey] || themeScenes.fantasy;
    return base.slice(0, data.scenesCount).map((s, i) => ({ ...s, id: `custom_${i + 1}`, number: i + 1 }));
  }

  _escAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ============================================================
  // PANE 3: TEMPLATES LIBRARY
  // ============================================================
  _bindPane3_Templates() {
    document.getElementById('templateSearch')?.addEventListener('input', () => this._renderTemplatesGrid());
    document.getElementById('templateCategoryFilter')?.addEventListener('change', () => this._renderTemplatesGrid());
  }

  _renderTemplatesGrid() {
    const grid = document.getElementById('templatesGrid');
    if (!grid) return;

    const query = (document.getElementById('templateSearch')?.value || '').toLowerCase();
    const category = document.getElementById('templateCategoryFilter')?.value || 'all';
    const templates = window.STORY_TEMPLATES || [];

    const filtered = templates.filter(t => {
      const matchCat = category === 'all' || t.category === category;
      const matchSearch = !query || t.title.toLowerCase().includes(query) || t.description.toLowerCase().includes(query);
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted);">لا توجد قوالب مطابقة للبحث</div>';
      return;
    }

    grid.innerHTML = filtered.map(t => `
      <div class="template-card" data-template-id="${t.id}">
        <div class="tpl-emoji">${t.emoji}</div>
        <div class="tpl-category-badge">${this._catLabel(t.category)}</div>
        <h3 class="tpl-title">${t.title}</h3>
        <p class="tpl-desc">${t.description}</p>
        <div class="tpl-meta">
          <span>🎂 ${t.ageRange}</span>
          <span>📖 ${t.scenesCount} مشاهد</span>
        </div>
        <div class="tpl-actions">
          <button class="btn btn-primary btn-mini use-template-btn" data-id="${t.id}">
            ✨ استخدام هذا القالب
          </button>
          <button class="btn btn-outline btn-mini preview-template-btn" data-id="${t.id}">
            👁️ معاينة المشاهد
          </button>
        </div>
      </div>
    `).join('');

    // Bind template buttons
    grid.querySelectorAll('.use-template-btn').forEach(btn => {
      btn.addEventListener('click', () => this._useTemplate(btn.dataset.id));
    });

    grid.querySelectorAll('.preview-template-btn').forEach(btn => {
      btn.addEventListener('click', () => this._previewTemplate(btn.dataset.id));
    });
  }

  _catLabel(cat) {
    const map = { fantasy: '🏰 خيال', space: '🚀 فضاء', ocean: '🌊 بحر', jungle: '🦁 غابة', islamic: '☪️ إسلامية', educational: '📚 تعليمية' };
    return map[cat] || cat;
  }

  _useTemplate(id) {
    const tpl = (window.STORY_TEMPLATES || []).find(t => t.id === id);
    if (!tpl) return;

    // Populate new book form with template data
    this._switchModalPane('tab-new-book');
    document.getElementById('nbBookTitle').value = tpl.title;
    document.getElementById('nbArtStyle').value = tpl.artStyle || 'pixar_3d';
    document.getElementById('nbOutfit').value = tpl.outfitRule || '';
    document.getElementById('nbScenesCount').value = tpl.scenesCount;

    window.app?._showToast(`✨ تم تحميل قالب «${tpl.title}» — أدخل اسم الطفل وابدأ!`);
  }

  _previewTemplate(id) {
    const tpl = (window.STORY_TEMPLATES || []).find(t => t.id === id);
    if (!tpl) return;

    let html = `<div class="prompt-section"><h3>${tpl.emoji} ${tpl.title}</h3><p>${tpl.description}</p><hr></div>`;
    tpl.scenes.forEach((s, i) => {
      html += `
        <div class="prompt-section">
          <h4>المشهد ${i + 1}: ${s.title}</h4>
          <p class="ar-text prompt-desc">${s.story}</p>
          <div class="prompt-block" data-text="${this._escAttr(s.prompt_suffix)}">
            <button class="copy-one-btn">نسخ</button>
            <pre>${s.prompt_suffix}</pre>
          </div>
        </div>
      `;
    });

    const output = document.getElementById('promptsOutput');
    if (output) output.innerHTML = html;

    output?.querySelectorAll('.copy-one-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.closest('.prompt-block')?.dataset.text || '';
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = '✅ تم!';
          setTimeout(() => btn.textContent = 'نسخ', 2000);
        });
      });
    });

    document.getElementById('promptsModal').style.display = 'flex';
  }

  // ============================================================
  // PROMPTS MODAL
  // ============================================================
  _bindPromptsModal() {
    document.getElementById('closePromptsModalBtn')?.addEventListener('click', () => {
      document.getElementById('promptsModal').style.display = 'none';
    });
    document.getElementById('closePromptsModalBtn2')?.addEventListener('click', () => {
      document.getElementById('promptsModal').style.display = 'none';
    });
    document.getElementById('promptsModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'promptsModal') document.getElementById('promptsModal').style.display = 'none';
    });
    document.getElementById('copyAllPromptsBtn')?.addEventListener('click', () => {
      const allText = Array.from(document.querySelectorAll('#promptsOutput pre')).map(p => p.textContent).join('\n\n---\n\n');
      navigator.clipboard.writeText(allText).then(() => window.app?._showToast('📋 تم نسخ جميع البرومبتات!'));
    });
  }
}

// ============================================================
// BOOTSTRAP
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  window.storyManager = new StoryManager();
});
