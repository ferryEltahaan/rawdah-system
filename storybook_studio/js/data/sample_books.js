/**
 * ============================================================================
 * PRELOADED SAMPLE BOOKS & PROMPTS MANIFEST
 * ============================================================================
 * Contains Maryam's complete royal storybook with direct links to assets,
 * plus alternative child book templates.
 */

const SAMPLE_PROJECTS = {
  mariam: {
    childName: "مريم",
    childAge: "5 سنوات",
    bookTitle: "الأميرة مريم والقلعة السحرية",
    artStyle: "pixar_3d",
    photoUrl: "assets/mariam/mariam_school_color_1792360059645.jpg",
    facialFeatures: "وجه بيضاوي ناعم مع جبهة واضحة ومشدودة، عينان لوزيتان واسعتان بنيتان داكنتان بجفون واضحة ونظرة ذكية بريئة، حواجب طبيعية داكنة مقوسة برقة، أنف دقيق ورفيع، شفتان ناعمتان بابتسامة رقيقة هادئة وخجولة، شعر بني داكن مشدود للأعلى ومربوط بفيونكة بيضاء نقية مع ظهور لطيف للأذنين.",
    outfitRule: "فستان أميرة وردي بأكمام منتفخة وزخارف ذهبية مع تاج ذهبي رقيق وعصا سحرية مضيئة",
    englishPromptLock: "Direct facial likeness of the little girl from reference: smooth oval face, clear prominent forehead, naturally arched dark delicate eyebrows, authentic almond-shaped dark brown eyes with clear double eyelids, slender gentle nose bridge, subtle sweet shy smile, and dark brown hair pulled tightly back into a high topknot bun tied with a crisp white ribbon bow. High-end Pixar-meets-fairytale storybook art, volumetric lighting, vertical A4 composition. --ar 3:4 --cw 100",
    scenes: [
      {
        id: "cover",
        number: 1,
        title: "غلاف الكتاب الملكي",
        storyArabic: "«الأميرة مريم والقلعة السحرية» — حكاية وتلوين للبطلة مريم.",
        colorImg: "assets/mariam/mariam_cover_color_1792360002072.jpg",
        bwImg: "assets/mariam/mariam_cover_bw_1792360032493.jpg",
        promptEn: "Masterpiece children's book cover illustration, vertical A4 format. Direct facial likeness of the little girl from the reference image: precise facial structure with smooth oval face, prominent clear forehead, dark naturally arched delicate eyebrows, authentic almond-shaped dark brown eyes, slender gentle nose, sweet shy smile, dark brown hair with white ribbon bow. Dressed as a royal princess in a pastel pink gown with puffed sleeves and gold filigree, wearing a delicate golden tiara and holding a glowing star wand. Magical pink fairytale castle behind her. Soft volumetric lighting. --ar 3:4 --cw 100"
      },
      {
        id: "school",
        number: 2,
        title: "في الطريق إلى المدرسة",
        storyArabic: "أَشْرَقَتْ شَمْسُ الصَّبَاحِ الدَّافِئَةِ، وَاسْتَعَدَّتْ مَرْيَمُ لِيَوْمٍ مُمَيَّزٍ. ارْتَدَتْ قَمِيصَهَا الأَبْيَضَ وَوِشَاحَهَا الأَحْمَرَ الجَمِيلَ وَحَقِيبَتَهَا التُّرْكُوازِيَّةَ، وَسَارَتْ تَبْتَسِمُ لِلأَزْهَارِ فِي طَرِيقِهَا نَحْوَ المَدْرَسَةِ.",
        colorImg: "assets/mariam/mariam_school_color_1792360059645.jpg",
        bwImg: "assets/mariam/mariam_school_bw_1792360100516.jpg",
        promptEn: "A charming children's storybook illustration of a cheerful little schoolgirl based on the reference photo: round cute face, big brown eyes, dark brown hair tied up with a white ribbon bow. Wearing her school uniform: crisp white buttoned shirt, red neck scarf, dark denim skirt, white tights, and a bright turquoise backpack. Standing happily on a sunny paved stone pathway in front of a colorful friendly school building with lush green trees and blooming flower bushes. Vibrant soft colors, warm morning sunlight, vertical A4 composition. --ar 3:4"
      },
      {
        id: "crown",
        number: 3,
        title: "التاج السحري المتلألئ",
        storyArabic: "وَفِي حَدِيقَةِ الأَزْهَارِ العَجِيبَةِ، لَمَحَتْ مَرْيَمُ بَرِيقاً ذَهَبِيّاً يَتَلَأْلَأُ! اقْتَرَبَتْ فَوَجَدَتْ تَاجاً مَلَكِيّاً سِحْرِيّاً يَسْتَقِرُّ فَوْقَ وِسَادَةٍ مُخْمَلِيَّةٍ نَاعِمَةٍ، لَمَسَتْهُ فَتَحَوَّلَتْ مَلَابِسُهَا إِلَى فُسْتَانِ أَمِيرَةٍ وَرْدِيٍّ فَاتِنٍ!",
        colorImg: "assets/mariam/mariam_crown_color_1792360148272.jpg",
        bwImg: "assets/mariam/mariam_crown_bw_1792360195397.jpg",
        promptEn: "Whimsical storybook illustration of the little princess girl (round cute face, brown eyes, dark hair with white bow) in a regal pink gown with puffed sleeves. She is gently bending down to pick up a glowing magical gold crown resting on a soft velvet cushion in a fairy tale flower garden. Sparkles, magical fairy dust, and glowing butterflies surround the crown. Expression of awe and joyful wonder on her face. Dreamy pastel palette, golden glow, magical storybook art, vertical A4. --ar 3:4"
      },
      {
        id: "castle",
        number: 4,
        title: "الوصول إلى القلعة السحرية",
        storyArabic: "وَقَفَتِ الأَمِيرَةُ مَرْيَمُ تَنْظُرُ بِانْبِهَارٍ إِلَى القَلْعَةِ السِّحْرِيَّةِ الوَرْدِيَّةِ ذَاتِ الأَبْرَاجِ العَاجِيَّةِ العَالِيَةِ، لِتَبْدَأَ مَعَهَا أَعْظَمُ حِكَايَةٍ فِي عَالَمِ الأَحْلَامِ!",
        colorImg: "assets/mariam/mariam_cover_color_1792360002072.jpg",
        bwImg: "assets/mariam/mariam_cover_bw_1792360032493.jpg",
        promptEn: "Little princess Maryam looking with joy at a giant pink fairytale castle with ivory towers and golden arched gates. A cobblestone path leads to the gateway with blooming lavender and sparkling stars. High-end children's illustration, vertical A4 composition. --ar 3:4"
      }
    ]
  },

  ahmed: {
    childName: "أحمد",
    childAge: "6 سنوات",
    bookTitle: "أحمد ورائد الفضاء الصغير",
    artStyle: "pixar_3d",
    photoUrl: "assets/mariam/mariam_school_color_1792360059645.jpg",
    facialFeatures: "وجه مستدير مشرق، عينان عسليتان واسعتان مليئتان بالحماس، شعر أسود قصير مرتب، ابتسامة عريضة واثقة وشجاعة.",
    outfitRule: "بدلة فضاء بيضاء مستقبلية مع خطوط زرقاء وخوذة فضاء زجاجية عاكسة للنجوم",
    englishPromptLock: "Brave cute little boy astronaut: round face, hazel eyes, short neat black hair, wearing futuristic white space suit with cyan glowing stripes. Standing on a colorful planet under cosmic galaxy stars. Pixar 3D style. --ar 3:4",
    scenes: [
      {
        id: "ahmed_cover",
        number: 1,
        title: "غلاف مغامرة الفضاء",
        storyArabic: "«أحمد ورائد الفضاء الصغير» — رحلة استكشاف كواكب المجرة.",
        colorImg: "assets/mariam/mariam_cover_color_1792360002072.jpg",
        bwImg: "assets/mariam/mariam_cover_bw_1792360032493.jpg",
        promptEn: "Children's space adventure book cover: little boy astronaut smiling and waving from alien planet with friendly cute alien creatures and rocket ship behind him. --ar 3:4"
      }
    ]
  },

  nour: {
    childName: "نور",
    childAge: "4 سنوات",
    bookTitle: "نور ومستكشفة الغابة العجيبة",
    artStyle: "storybook_watercolor",
    photoUrl: "assets/mariam/mariam_school_color_1792360059645.jpg",
    facialFeatures: "ملامح طفولية بريئة، عينان بنيتان واسعتان، ضفيرتان لطيفتا المنظر، قبعة استكشاف سفاري كاكي.",
    outfitRule: "ملابس سفاري خضراء فاتحة مع حقيبة مراقبة الفراشات وعدسة مكبرة",
    englishPromptLock: "Cute little girl safari explorer with pigtails and khaki hat holding a magnifying glass in magical lush rainforest with colorful birds. Watercolor storybook art. --ar 3:4",
    scenes: [
      {
        id: "nour_cover",
        number: 1,
        title: "غلاف الغابة العجيبة",
        storyArabic: "«نور ومستكشفة الغابة العجيبة» — صداقة الحيوانات اللطيفة.",
        colorImg: "assets/mariam/mariam_cover_color_1792360002072.jpg",
        bwImg: "assets/mariam/mariam_cover_bw_1792360032493.jpg",
        promptEn: "Children's jungle safari book cover: little girl explorer with baby lion cub and baby elephant playing peacefully near a crystal waterfall. --ar 3:4"
      }
    ]
  }
};

window.SAMPLE_PROJECTS = SAMPLE_PROJECTS;
