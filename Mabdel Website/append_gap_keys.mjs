import fs from 'fs';

const translations = {
  docs_email_label: {
    'ar-SA': 'البريد الإلكتروني',
    'es-ES': 'Correo electrónico',
    'fr-FR': 'E-mail',
    'pt-BR': 'E-mail',
    'ru-RU': 'Эл. почта',
    'ur-PK': 'ای میل',
    'tr-TR': 'E-posta'
  },
  docs_phone_label: {
    'ar-SA': 'الهاتف',
    'es-ES': 'Teléfono',
    'fr-FR': 'Téléphone',
    'pt-BR': 'Telefone',
    'ru-RU': 'Телефон',
    'ur-PK': 'فون',
    'tr-TR': 'Telefon'
  },
  bulk_improve_with_ai: {
    'ar-SA': 'تحسين بواسطة الذكاء الاصطناعي',
    'es-ES': 'Mejorar con IA',
    'fr-FR': "Améliorer avec l'IA",
    'pt-BR': 'Melhorar com IA',
    'ru-RU': 'Улучшить с помощью ИИ',
    'ur-PK': 'مصنوعی ذہانت سے بہتر بنائیں',
    'tr-TR': 'Yapay Zeka ile Geliştir'
  },
  bulk_attachments_label: {
    'ar-SA': 'المرفقات',
    'es-ES': 'Archivos adjuntos',
    'fr-FR': 'Pièces jointes',
    'pt-BR': 'Anexos',
    'ru-RU': 'Вложения',
    'ur-PK': 'منسلکات',
    'tr-TR': 'Ekler'
  },
  bulk_variables_label: {
    'ar-SA': 'المتغيرات:',
    'es-ES': 'Variables:',
    'fr-FR': 'Variables :',
    'pt-BR': 'Variáveis:',
    'ru-RU': 'Переменные:',
    'ur-PK': 'متغیرات:',
    'tr-TR': 'Değişkenler:'
  },
  integ_webhook_secret_placeholder: {
    'ar-SA': 'سر الويب هوك الاختياري',
    'es-ES': 'Secreto de webhook opcional',
    'fr-FR': 'Secret de webhook facultatif',
    'pt-BR': 'Segredo de webhook opcional',
    'ru-RU': 'Необязательный секрет вебхука',
    'ur-PK': 'اختیاری ویب ہک خفیہ کوڈ',
    'tr-TR': 'İsteğe bağlı webhook sırrı'
  },
  act_type_walking: {
    'ar-SA': 'المشي',
    'es-ES': 'Caminar',
    'fr-FR': 'Marche',
    'pt-BR': 'Caminhada',
    'ru-RU': 'Ходьба',
    'ur-PK': 'پیدل چلنا',
    'tr-TR': 'Yürüyüş'
  },
  act_type_running: {
    'ar-SA': 'الجري',
    'es-ES': 'Correr',
    'fr-FR': 'Course',
    'pt-BR': 'Corrida',
    'ru-RU': 'Бег',
    'ur-PK': 'دوڑنا',
    'tr-TR': 'Koşu'
  },
  act_type_cycling: {
    'ar-SA': 'ركوب الدراجات',
    'es-ES': 'Ciclismo',
    'fr-FR': 'Cyclisme',
    'pt-BR': 'Ciclismo',
    'ru-RU': 'Велосипед',
    'ur-PK': 'سائیکل چلانا',
    'tr-TR': 'Bisiklet'
  },
  act_type_swimming: {
    'ar-SA': 'السباحة',
    'es-ES': 'Natación',
    'fr-FR': 'Natation',
    'pt-BR': 'Natação',
    'ru-RU': 'Плавание',
    'ur-PK': 'تیرنا',
    'tr-TR': 'Yüzme'
  },
  act_type_workout: {
    'ar-SA': 'التمارين الرياضية',
    'es-ES': 'Entrenamiento',
    'fr-FR': 'Entraînement',
    'pt-BR': 'Treino',
    'ru-RU': 'Тренировка',
    'ur-PK': 'ورزش',
    'tr-TR': 'Egzersiz'
  }
};

const filePath = 'c:/project/Mabdel AI/Mabdel Website/src/i18n/translations.js';
let content = fs.readFileSync(filePath, 'utf-8');

const langs = ['ar-SA', 'es-ES', 'fr-FR', 'pt-BR', 'ru-RU', 'ur-PK', 'tr-TR'];

for (const lang of langs) {
  const targetTag = `'${lang}': {`;
  const pos = content.indexOf(targetTag);
  if (pos === -1) {
    console.error(`Could not find block for ${lang}`);
    process.exit(1);
  }

  // Find the end of this language block
  const blockEndPos = content.indexOf('\n  },', pos);
  const blockContent = content.slice(pos, blockEndPos);

  const keysToAdd = Object.entries(translations).filter(([k]) => {
    return !blockContent.includes(`    ${k}:`);
  });

  if (!keysToAdd.length) {
    console.log(`${lang}: all keys already present, skipping.`);
    continue;
  }

  const keyLines = keysToAdd
    .map(([k, vals]) => `    ${k}: ${JSON.stringify(vals[lang])},`)
    .join('\n');

  content = content.slice(0, blockEndPos) + keyLines + '\n' + content.slice(blockEndPos);
  console.log(`${lang}: appended ${keysToAdd.length} keys.`);
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log(`Done!`);
