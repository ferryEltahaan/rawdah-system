/**
 * ============================================================================
 * STORY TEMPLATES LIBRARY — 15 Rich Ready-Made Templates
 * ============================================================================
 * Each template generates scene-by-scene English prompts automatically.
 * User only needs to add child photos.
 */

const STORY_TEMPLATES = [
  {
    id: "tpl_princess_castle",
    category: "fantasy",
    title: "الأميرة الصغيرة والقلعة السحرية",
    emoji: "👑",
    description: "أميرة تكتشف تاجاً سحرياً يقودها إلى مملكة الأحلام المليئة بالفراشات والزهور.",
    ageRange: "3-7 سنوات",
    scenesCount: 6,
    artStyle: "pixar_3d",
    outfitRule: "فستان أميرة وردي بأكمام منتفخة وزخارف ذهبية مع تاج ذهبي رقيق",
    scenes: [
      { title: "الغلاف الملكي", story: "أَهْلاً بِكِ فِي مَمْلَكَةِ الأَحْلَامِ، يَا أَمِيرَتَنَا الصَّغِيرَةَ!", prompt_suffix: "book cover for princess, magical pink fairytale castle with golden towers, sparkles and butterflies, pink gown with gold filigree, golden tiara, glowing star wand" },
      { title: "في الحديقة السحرية", story: "مَشَتِ الأَمِيرَةُ فِي الحَدِيقَةِ السِّحْرِيَّةِ وَسَطَ الوُرُودِ المُتَفَتِّحَةِ وَالفَرَاشَاتِ المُلَوَّنَةِ.", prompt_suffix: "princess girl walking in enchanted garden with giant colorful flowers, glowing butterflies, morning light" },
      { title: "اكتشاف التاج", story: "لَمَحَتِ الأَمِيرَةُ بَرِيقاً ذَهَبِيّاً بَيْنَ الأَزْهَارِ فَوَجَدَتْ تَاجاً سِحْرِيّاً يَتَلَأْلَأُ!", prompt_suffix: "princess discovering a glowing magical crown on a velvet cushion surrounded by sparkling fairy dust and roses" },
      { title: "الوصول للقلعة", story: "سَارَتِ الأَمِيرَةُ عَبْرَ الطَّرِيقِ الحَجَرِيِّ نَحْوَ القَلْعَةِ الوَرْدِيَّةِ المَهِيبَةِ.", prompt_suffix: "princess approaching a grand pink fairytale castle along a magical stone path with lavender flowers" },
      { title: "لقاء التنين الودود", story: "عِنْدَ بَوَّابَةِ القَلْعَةِ كَانَ يَنْتَظِرُهَا تِنِّينٌ صَغِيرٌ لَطِيفٌ بِعُيُونٍ خَضْرَاءَ نَاعِمَةٍ!", prompt_suffix: "little princess smiling and meeting a cute friendly baby dragon with big green eyes at a castle gate" },
      { title: "حفل المملكة", story: "أَقَامَتِ المَمْلَكَةُ حَفْلاً كَبِيرَاً احْتِفَالاً بِمَجِيءِ الأَمِيرَةِ الصَّغِيرَةِ الشُّجَاعَةِ!", prompt_suffix: "joyful kingdom celebration party, princess waving to cheering fairy tale characters, colorful lanterns and balloons" }
    ]
  },

  {
    id: "tpl_space_explorer",
    category: "space",
    title: "رائد الفضاء الصغير",
    emoji: "🚀",
    description: "طفل شجاع يرتدي بدلة الفضاء ويسافر عبر المجرات لاستكشاف كواكب رائعة وصداقة مخلوقات لطيفة.",
    ageRange: "4-8 سنوات",
    scenesCount: 6,
    artStyle: "pixar_3d",
    outfitRule: "بدلة فضاء بيضاء مستقبلية مع خطوط زرقاء مضيئة وخوذة زجاجية شفافة",
    scenes: [
      { title: "غلاف: انطلاق إلى النجوم", story: "اسْتَعِدُّوا لِلانْطِلَاقِ! رَائِدُنَا الصَّغِيرُ يَتَّجِهُ إِلَى النُّجُومِ!", prompt_suffix: "children's book cover, little astronaut boy launching in colorful rocket ship into starry galaxy, nebula clouds" },
      { title: "في محطة الفضاء", story: "وَصَلَ رَائِدُنَا الصَّغِيرُ إِلَى مَحَطَّةِ الفَضَاءِ الضَّخْمَةِ المُتَلَأْلِئَةِ.", prompt_suffix: "small astronaut child inside a colorful futuristic space station floating in orbit, view of Earth below" },
      { title: "كوكب الحلوى", story: "يَا لَهُ مِنْ كَوْكَبٍ عَجِيبٍ! كُلُّهُ مَصْنُوعٌ مِنَ الحُلْوَى وَالسُّكَّرِ الوَرْدِيِّ!", prompt_suffix: "astronaut child landing on a candy planet, candy mountains and lollipop trees, pastel rainbow colors" },
      { title: "صديق المريخ اللطيف", story: "قَابَلَ رَائِدُنَا مَخْلُوقاً فَضَائِيّاً صَغِيرَاً أَخْضَرَ بِعُيُونٍ كَبِيرَةٍ وَدِيَّةٍ.", prompt_suffix: "little astronaut making friends with a cute tiny green alien with big friendly eyes, on Mars surface" },
      { title: "ركوب نيزك", story: "تَسَلَّقَ رَائِدُنَا نَيْزَكاً كَبِيرَاً وَطَارَ عَلَيْهِ عَبْرَ المَجَرَّةِ كَالبَطَلِ!", prompt_suffix: "brave young astronaut riding a giant glowing meteor through a colorful galaxy, stars streaking past" },
      { title: "العودة المنتصرة", story: "عَادَ رَائِدُنَا الصَّغِيرُ الشُّجَاعُ إِلَى الأَرْضِ مَحْمِلاً ذِكْرَيَاتٍ لَا تُنْسَى!", prompt_suffix: "happy little astronaut returning home to Earth, landing in backyard, parents waving with pride" }
    ]
  },

  {
    id: "tpl_ocean_explorer",
    category: "ocean",
    title: "مستكشفة أعماق البحر",
    emoji: "🌊",
    description: "غوص في عالم المرجان والأسماك الملونة واكتشاف كنوز القصور المغمورة تحت الموج.",
    ageRange: "3-7 سنوات",
    scenesCount: 5,
    artStyle: "watercolor",
    outfitRule: "بدلة غوص لطيفة فيروزية مع أقنعة وزعانف ملونة",
    scenes: [
      { title: "غلاف: في قلب البحر", story: "تَعَالَيْ مَعِي نَغُوصُ فِي أَعْمَاقِ البَحْرِ العَجِيبِ!", prompt_suffix: "children's book cover, girl diver underwater surrounded by colorful coral reef and tropical fish, watercolor style" },
      { title: "حديقة المرجان", story: "رَأَتْ حَدِيقَةً مِنَ المَرْجَانِ الأَحْمَرِ وَالوَرْدِيِّ تَسْبَحُ فِيهَا آلَافُ الأَسْمَاكِ المُلَوَّنَةِ.", prompt_suffix: "little girl diver swimming through magical coral garden with glowing jellyfish and colorful fish schools" },
      { title: "صديق الدلفين", story: "قَفَزَ دَلْفِينٌ لَطِيفٌ بِابْتِسَامَتِهِ الجَمِيلَةِ لِيُرَافِقَهَا فِي رِحْلَتِهَا.", prompt_suffix: "child diver hugging a smiling friendly dolphin underwater, bubbles rising around them" },
      { title: "كنز الصدف", story: "اكْتَشَفَتِ القَاعَ كُنُوزَ الصَّدَفِ البَرَّاقَةِ وَدُرَرِ البَحْرِ اللَّامِعَةِ.", prompt_suffix: "excited little diver girl finding giant glowing seashells and pearls on ocean floor, treasure chest" },
      { title: "قصر الحورية", story: "وَجَدَتْ قَصْرَ حُورِيَّةٍ مِنَ الكَرِيسْتَالِ يَلْمَعُ فِي قَلْبِ البَحْرِ بِأَلْوَانِ قَوْسِ قُزَح!", prompt_suffix: "child diver discovering a crystal mermaid palace glowing with rainbow colors deep underwater" }
    ]
  },

  {
    id: "tpl_islamic_kindness",
    category: "islamic",
    title: "أبطال الأخلاق الحسنة",
    emoji: "🌙",
    description: "قصة تعليمية أخلاقية تُعلم الطفل قيم الصدق والرحمة والكرم والصبر من خلال مواقف حياتية جميلة.",
    ageRange: "4-8 سنوات",
    scenesCount: 6,
    artStyle: "storybook_watercolor",
    outfitRule: "ملابس إسلامية نظيفة أنيقة ذات ألوان هادئة",
    scenes: [
      { title: "غلاف: بطل الأخلاق", story: "هَذَا كِتَابُ أَخْلَاقِنَا الجَمِيلَةِ الَّتِي تُسْعِدُ قُلُوبَنَا وَتُرْضِي رَبَّنَا.", prompt_suffix: "children's Islamic book cover, kind smiling child helping others, warm golden light, mosque silhouette background" },
      { title: "الصدق ينجح دائماً", story: "قَالَ الصَّادِقُ الحَقِيقَةَ وَإِنْ كَانَتْ صَعْبَةً، فَأَحَبَّهُ الجَمِيعُ وَفَرِحُوا بِهِ.", prompt_suffix: "honest child telling the truth to kind teacher in warm classroom, soft glowing halo effect, warm colors" },
      { title: "مشاركة الطعام", story: "عِنْدَمَا رَأَى أَصْحَابَهُ جِيَاعاً، قَاسَمَهُمْ طَعَامَهُ بِسُرُورٍ وَامْتِنَانٍ لِلَّهِ.", prompt_suffix: "generous child sharing lunch with friends at school, warm smile, golden lighting, joy and gratitude" },
      { title: "مساعدة كبار السن", story: "رَأَى عَجُوزاً يَحْمِلُ حَقِيبَةً ثَقِيلَةً، فَأَسْرَعَ لِمُسَاعَدَتِهِ بِكُلِّ فَرَحٍ.", prompt_suffix: "kind child helping elderly person carry bags in a street, warm sunshine, heartwarming scene" },
      { title: "الصبر وقت الغضب", story: "عِنْدَمَا غَضِبَ، تَذَكَّرَ قَوْلَ النَّبِيِّ وَتَنَفَّسَ وَاسْتَعَاذَ، فَهَدَأَ قَلْبُهُ.", prompt_suffix: "child taking a calm deep breath, stopping anger, peaceful expression with glowing heart, serene background" },
      { title: "فرحة العطاء", story: "وَجَدَ أَنَّ فَرَحَ العَطَاءِ أَحْلَى بِكَثِيرٍ مِنَ الأَخْذِ، فَصَارَ أَسْعَدَ الأَطْفَالِ!", prompt_suffix: "joyful child giving gift to poorer friend, both children smiling, glowing happiness aura, warm watercolor style" }
    ]
  },

  {
    id: "tpl_jungle_safari",
    category: "jungle",
    title: "مستكشف الغابة العجيبة",
    emoji: "🦁",
    description: "مغامرة صفاري مثيرة في غابة استوائية سحرية مليئة بالحيوانات اللطيفة والشلالات الرائعة.",
    ageRange: "3-7 سنوات",
    scenesCount: 5,
    artStyle: "pixar_3d",
    outfitRule: "ملابس سفاري كاكي مع قبعة وحقيبة مراقبة واسعة",
    scenes: [
      { title: "غلاف: في قلب الغابة", story: "مَرْحَباً فِي الغَابَةِ العَجِيبَةِ! كُلُّ شَيْءٍ هُنَا يَحْيَا وَيَتَنَفَّسُ وَيَبْتَسِمُ!", prompt_suffix: "safari child explorer book cover surrounded by friendly jungle animals, colorful tropical birds, waterfall" },
      { title: "الفيل الحكيم", story: "قَابَلَ مُسْتَكْشِفَنَا فِيلاً عَجُوزاً حَكِيماً يَحْمِلُ ذَاكِرَةَ الغَابَةِ كُلِّهَا.", prompt_suffix: "little safari child touching trunk of wise gentle elephant, magical golden afternoon light in jungle" },
      { title: "ملكة الببغاوات", story: "بَجَّلَتْهُ مَلِكَةُ الببغاوات وَأَهْدَتْهُ رِيشَةَ الصَّدَاقَةِ المُلَوَّنَةَ مِنْ عَرْشِهَا.", prompt_suffix: "child explorer receiving colorful feather from a regal parrot queen sitting on a rainbow-colored jungle throne" },
      { title: "شلال الأسرار", story: "وَرَاءَ الشَّلَّالِ الفِضِّيِّ اكْتَشَفَ كَهْفَ الأَسْرَارِ المُضِيءَ بِالأَحْجَارِ اللَّامِعَةِ!", prompt_suffix: "safari kid discovering glowing crystal cave behind beautiful silver waterfall in lush jungle" },
      { title: "حفل وداع الغابة", story: "أَقَامَتْ حَيَوَانَاتُ الغَابَةِ حَفْلاً مُهِيباً وَدَاعاً لِصَدِيقِهَا المُسْتَكْشِفِ الصَّغِيرِ.", prompt_suffix: "farewell jungle party with all animals celebrating around the explorer child, colorful lanterns and fruits" }
    ]
  },

  {
    id: "tpl_dino_world",
    category: "fantasy",
    title: "عالم الديناصورات الودودة",
    emoji: "🦕",
    description: "طفل ينتقل عبر الزمن إلى عصر الديناصورات ويكتشف أنها حيوانات لطيفة وصديقة وليست مخيفة!",
    ageRange: "3-7 سنوات",
    scenesCount: 5,
    artStyle: "pixar_3d",
    outfitRule: "ملابس الزمن: بدلة اخضر فاتح مع حقيبة ظهر مبتكرة",
    scenes: [
      { title: "آلة الزمن العجيبة", story: "وَجَدَ الطِّفْلُ آلَةً غَرِيبَةً فِي المَخْزَنِ، ضَغَطَ زِرَّهَا الأَزْرَقَ وَأَوْمَضَ ضَوْءٌ سَاطِعٌ!", prompt_suffix: "excited child discovering a colorful time machine in a cozy attic, golden light portal opening" },
      { title: "ترحيب الديناصورات", story: "وَجَدَ نَفْسَهُ فِي غَابَةٍ عِمْلَاقَةٍ وَأَمَامَهُ ديناصور أَخْضَرُ ضَخْمٌ يَنْظُرُ إِلَيْهِ بِعُيُونٍ طَيِّبَةٍ!", prompt_suffix: "child meeting a gentle giant green dinosaur with big kind eyes in a lush prehistoric jungle" },
      { title: "ركوب الديناصور الطائر", story: "صَعِدَ عَلَى ظَهْرِ تِرِيبَيَرُودَكْتِل وَطَارَا مَعاً فَوْقَ بِحَيرَاتِ البَرَاكِين المُضِيئَةِ.", prompt_suffix: "child riding a friendly pterodactyl over glowing prehistoric lakes and volcanoes, sunset sky" },
      { title: "عش الديناصور الصغير", story: "وَجَدَ بَيْضَةً صَغِيرَةً تَتَصَدَّعُ، فَخَرَجَ مِنْهَا دِيْنُوَصُورٌ صَغِيرٌ أَلَاقَهُ وَأَحَبَّهُ!", prompt_suffix: "child gently holding a tiny baby dinosaur hatching from egg, warm golden nest light, soft baby dinosaur" },
      { title: "العودة بذكريات", story: "قَبِلَ وَدَاعَ أَصْدِقَائِهِ الدِّيْنُوصُورَاتِ وَعَادَ بِقَلْبٍ مَلِيءٍ بِالحُبِّ وَالدَّهْشَةِ!", prompt_suffix: "tearful happy goodbye, child hugging dinosaur friends, magical time portal glowing behind them" }
    ]
  },

  {
    id: "tpl_superhero_kids",
    category: "fantasy",
    title: "الطفل الخارق",
    emoji: "🦸",
    description: "طفل يكتشف قوة خارقة مخفية داخله ويستخدمها لمساعدة الآخرين وإنقاذ يومهم.",
    ageRange: "4-9 سنوات",
    scenesCount: 6,
    artStyle: "cartoon_2d",
    outfitRule: "زي البطل الخارق ملون مشرق مع رداء طيران",
    scenes: [
      { title: "اكتشاف القوة", story: "فِي يَوْمٍ عَادِيٍّ، أَحَسَّ البَطَلُ الصَّغِيرُ بِدَفْءٍ غَرِيبٍ فِي يَدَيْهِ وَبَدَأَتِ الأَشْيَاءُ تَطِيرُ!", prompt_suffix: "child discovering superpower, hands glowing, objects levitating around them in bedroom, amazed expression" },
      { title: "أول رحلة طيران", story: "انْطَلَقَ فِي السَّمَاءِ لِأَوَّلِ مَرَّةٍ بَيْنَ الغُيُومِ البَيْضَاءِ مَعَ ابْتِسَامَةٍ عَرِيضَةٍ!", prompt_suffix: "young superhero flying through fluffy white clouds above the city, cape flowing, huge smile" },
      { title: "إنقاذ القطة الصغيرة", story: "صَعِدَتِ القِطَّةُ الصَّغِيرَةُ إِلَى الشَّجَرَةِ وَلَمْ تَسْتَطِعِ النُّزُولَ، فَأَسْرَعَ البَطَلُ لِإِنْقَاذِهَا!", prompt_suffix: "little superhero child gently rescuing a tiny kitten stuck in a tall tree, neighborhood watching with gratitude" },
      { title: "تعلم التحكم", story: "تَعَلَّمَ البَطَلُ الصَّغِيرُ مِنَ الحَكِيمِ العَجُوزِ كَيْفَ يَتَحَكَّمُ فِي قُوَّتِهِ بِصَبْرٍ وَحِكْمَةٍ.", prompt_suffix: "young superhero training with wise old mentor in magical dojo, energy beams and focus, colorful aura" },
      { title: "يوم البطل في المدينة", story: "طَارَ فَوْقَ المَدِينَةِ يَنْظُرُ مَنْ يَحْتَاجُ مُسَاعَدَةً، وَقَلْبُهُ مَلِيءٌ بِالحُبِّ لِلنَّاسِ.", prompt_suffix: "young superhero patrolling above colorful cartoon city, searching to help, confident and kind expression" },
      { title: "العودة للبيت بطلاً", story: "عَادَ إِلَى بَيْتِهِ وَصَدِيقُهُ البَطَلُ الأَكْبَرُ: قَلْبُهُ الطَّيِّبُ!", prompt_suffix: "young superhero returning home to loving family, hugging parents in superhero costume, warm glowing home" }
    ]
  },

  {
    id: "tpl_school_friends",
    category: "educational",
    title: "مغامرات يومي الدراسي",
    emoji: "🎒",
    description: "قصة تعليمية تحبب الطفل في المدرسة وتُعلمه قيم الصداقة والتعاون والمشاركة.",
    ageRange: "4-8 سنوات",
    scenesCount: 5,
    artStyle: "cartoon_2d",
    outfitRule: "الزي المدرسي الأنيق (قميص أبيض + وشاح ملون + حقيبة مدرسية)",
    scenes: [
      { title: "أول يوم في المدرسة", story: "كَانَ قَلْبُهُ يَخْفِقُ حِينَ وَقَفَ أَمَامَ بَابِ المَدْرَسَةِ لِأَوَّلِ مَرَّةٍ — لَكِنَّهُ ابْتَسَمَ وَدَخَلَ!", prompt_suffix: "nervous but brave child first day at school, colorful school building, backpack, warm sunny morning" },
      { title: "اكتشاف الصديق الجديد", story: "فِي الفَصْلِ، ابْتَسَمَ لَهُ طِفْلٌ آخَرُ مِنَ الطَّاوِلَةِ المُجَاوِرَةِ وَهَكَذَا وُلِدَتْ صَدَاقَةٌ جَمِيلَةٌ.", prompt_suffix: "two children smiling at each other in colorful classroom, first meeting of a new friendship, warm light" },
      { title: "وقت الفسحة واللعب", story: "فِي وَقْتِ الفُسْحَةِ، اكْتَشَفَ أَنَّ المَلَاعِبَ مُمْلُوءَةٌ بِالأَصْدِقَاءِ الَّذِينَ يَنْتَظِرُونَهُ!", prompt_suffix: "kids playing together in colorful school playground, swings and slides, joy and laughter, sunny day" },
      { title: "مساعدة زميل", story: "رَأَى زَمِيلَهُ يَبْكِي لِأَنَّهُ نَسِيَ قَلَمَهُ، فَأَعَارَهُ قَلَمَهُ بِسُعَادَةٍ وَتَعَلَّمَ مَعْنَى العَطَاءِ.", prompt_suffix: "generous child lending pencil to sad classmate, heartwarming moment in cheerful classroom" },
      { title: "عرض الفصل المميز", story: "وَقَفَ أَمَامَ الفَصْلِ كُلِّهِ وَقَدَّمَ عَرْضَهُ بِثِقَةٍ، فَصَفَّقَ لَهُ الجَمِيعُ بِحُبٍّ.", prompt_suffix: "confident child presenting show-and-tell to happy classmates in colorful classroom, applause and pride" }
    ]
  },

  {
    id: "tpl_bakery_adventure",
    category: "educational",
    title: "مغامرة المخبزة السحرية",
    emoji: "🍰",
    description: "طفل يساعد في مخبزة سحرية تعمل بالخبز الذي يصنع السعادة، ويتعلم قيمة العمل والصناعة.",
    ageRange: "3-6 سنوات",
    scenesCount: 5,
    artStyle: "watercolor",
    outfitRule: "مريلة طاهٍ ملونة مع قبعة طاهي بيضاء صغيرة",
    scenes: [
      { title: "غلاف: المخبزة الساحرة", story: "رَائِحَةُ الخُبْزِ الطَّازَجِ تَمْلَأُ الهَوَاءَ — مَرْحَباً فِي المَخْبَزَةِ السِّحْرِيَّةِ!", prompt_suffix: "children's book cover, little baker child in colorful apron at magical bakery full of glowing cakes and bread" },
      { title: "عجن العجينة", story: "أَمْسَكَ بِالعَجِينَةِ اللَّيِّنَةِ وَعَجَنَهَا بِيَدَيْهِ الصَّغِيرَتَيْنِ وَهُوَ يَبْتَسِمُ مَلِيءً بِالفَرَحِ.", prompt_suffix: "happy child kneading colorful dough in cozy bakery kitchen, flour in hair, apron, warm light" },
      { title: "الكعك المضيء", story: "عِنْدَمَا وَضَعَ كَعْكَتَهُ فِي الفُرْنِ، خَرَجَتْ وَهِيَ تَتَلَأْلَأُ بِأَلْوَانِ قَوْسِ قُزَح!", prompt_suffix: "magical rainbow-colored cake coming out of oven, child's amazed face, warm golden oven light" },
      { title: "توزيع الكعك على الجيران", story: "حَمَلَ الكَعْكَ فِي سَلَّتِهِ وَزَارَ الجِيرَانَ يُوَزِّعُهُ بِحُبٍّ — فَرَحَ الجَمِيعُ وَشَكَرُوهُ.", prompt_suffix: "child delivering rainbow cakes in a basket to happy neighbors, neighborhood scene, watercolor style" },
      { title: "أشهر طاهٍ في الحي", story: "صَارَ بَطَلُنَا أَشْهَرَ طَاهٍ صَغِيرٍ فِي الحَيِّ وَتَعَلَّمَ أَنَّ العَمَلَ بِحُبٍّ يَصْنَعُ السَّعَادَةَ!", prompt_suffix: "proud little chef child receiving golden trophy from happy community, joyful celebration scene" }
    ]
  }
];

window.STORY_TEMPLATES = STORY_TEMPLATES;
