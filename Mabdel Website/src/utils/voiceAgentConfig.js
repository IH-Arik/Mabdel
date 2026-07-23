export const AI_LANGUAGE_STORAGE_KEY = 'gocustify_ai_language';

export const AI_LANGUAGE_OPTIONS = [
  { code: 'en-US', label: 'EN', name: 'English' },
  { code: 'bn-BD', label: 'বাংলা', name: 'বাংলা' },
  { code: 'hi-IN', label: 'हिं', name: 'हिंदी' },
  { code: 'ar-SA', label: 'عر', name: 'العربية' },
  { code: 'es-ES', label: 'ES', name: 'Español' },
  { code: 'fr-FR', label: 'FR', name: 'Français' },
  { code: 'pt-BR', label: 'PT', name: 'Português' },
  { code: 'ru-RU', label: 'RU', name: 'Русский' },
  { code: 'ur-PK', label: 'اُر', name: 'Urdu' },
  { code: 'tr-TR', label: 'TR', name: 'Türkçe' },
];

const INITIAL_PROMPTS = {
  'en-US': {
    invoice: 'Tell me about the invoice — client name, service description, amount, and due date.',
    agreement: 'Tell me about the agreement — client name, type of agreement, and start date.',
    lease: 'Tell me about the lease — tenant name, property address, and monthly rent.',
    bulk_message: 'What message do you want to send and to whom?',
    calendar: 'Tell me about the meeting — title, date, and time.',
    contact: 'Tell me about the contact — first name, last name, phone, and email.',
  },
  'bn-BD': {
    invoice: 'ইনভয়েস সম্পর্কে বলুন — ক্লায়েন্টের নাম, সার্ভিসের বিবরণ, পরিমাণ এবং নির্ধারিত তারিখ।',
    agreement: 'চুক্তি সম্পর্কে বলুন — ক্লায়েন্টের নাম, চুক্তির ধরন এবং শুরুর তারিখ।',
    lease: 'লিজ সম্পর্কে বলুন — ভাড়াটেনার নাম, সম্পত্তির ঠিকানা এবং মাসিক ভাড়া।',
    bulk_message: 'আপনি কী বার্তা পাঠাতে চান এবং কাকে পাঠাবেন?',
    calendar: 'মিটিং সম্পর্কে বলুন — শিরোনাম, তারিখ এবং সময়।',
    contact: 'কন্ট্যাক্ট সম্পর্কে বলুন — নাম, ফোন এবং ইমেইল।',
  },
  'hi-IN': {
    invoice: 'इनवॉइस के बारे में बताएं — क्लाइंट का नाम, सेवा विवरण, राशि और देय तिथि।',
    agreement: 'अनुबंध के बारे में बताएं — क्लाइंट का नाम, अनुबंध का प्रकार और प्रारंभ तिथि।',
    lease: 'लीज के बारे में बताएं — किरायेदार का नाम, संपत्ति का पता और मासिक किराया।',
    bulk_message: 'आप कौन सा संदेश भेजना चाहते हैं और किसे?',
    calendar: 'मीटिंग के बारे में बताएं — शीर्षक, तारीख और समय।',
    contact: 'संपर्क के बारे में बताएं — नाम, फ़ोन और ईमेल।',
  },
  'ar-SA': {
    invoice: 'أخبرني عن الفاتورة — اسم العميل، وصف الخدمة، المبلغ، وتاريخ الاستحقاق.',
    agreement: 'أخبرني عن العقد — اسم العميل، نوع العقد، وتاريخ البدء.',
    lease: 'أخبرني عن عقد الإيجار — اسم المستأجر، عنوان العقار، والإيجار الشهري.',
    bulk_message: 'ما هي الرسالة التي تريد إرسالها وإلى من؟',
    calendar: 'أخبرني عن الاجتماع — العنوان والتاريخ والوقت.',
    contact: 'أخبرني عن جهة الاتصال — الاسم والهاتف والبريد الإلكتروني.',
  },
  'es-ES': {
    invoice: 'Cuéntame sobre la factura — nombre del cliente, descripción del servicio, monto y fecha de vencimiento.',
    agreement: 'Cuéntame sobre el acuerdo — nombre del cliente, tipo de acuerdo y fecha de inicio.',
    lease: 'Cuéntame sobre el contrato de alquiler — nombre del inquilino, dirección y renta mensual.',
    bulk_message: '¿Qué mensaje quieres enviar y a quién?',
    calendar: 'Cuéntame sobre la reunión — título, fecha y hora.',
    contact: 'Cuéntame sobre el contacto — nombre, teléfono y correo electrónico.',
  },
  'fr-FR': {
    invoice: "Parlez-moi de la facture — nom du client, description du service, montant et date d'échéance.",
    agreement: "Parlez-moi de l'accord — nom du client, type d'accord et date de début.",
    lease: 'Parlez-moi du bail — nom du locataire, adresse du bien et loyer mensuel.',
    bulk_message: 'Quel message voulez-vous envoyer et à qui?',
    calendar: 'Parlez-moi de la réunion — titre, date et heure.',
    contact: 'Parlez-moi du contact — prénom, nom, téléphone et e-mail.',
  },
  'pt-BR': {
    invoice: 'Fale sobre a fatura — nome do cliente, descrição do serviço, valor e data de vencimento.',
    agreement: 'Fale sobre o contrato — nome do cliente, tipo de contrato e data de início.',
    lease: 'Fale sobre o contrato de aluguel — nome do inquilino, endereço e aluguel mensal.',
    bulk_message: 'Que mensagem você quer enviar e para quem?',
    calendar: 'Fale sobre a reunião — título, data e horário.',
    contact: 'Fale sobre o contato — nome, telefone e e-mail.',
  },
  'ru-RU': {
    invoice: 'Расскажите о счёте — имя клиента, описание услуги, сумма и срок оплаты.',
    agreement: 'Расскажите о договоре — имя клиента, тип договора и дата начала.',
    lease: 'Расскажите об аренде — имя арендатора, адрес и ежемесячная арендная плата.',
    bulk_message: 'Какое сообщение вы хотите отправить и кому?',
    calendar: 'Расскажите о встрече — название, дата и время.',
    contact: 'Расскажите о контакте — имя, телефон и электронная почта.',
  },
  'ur-PK': {
    invoice: 'انوائس کے بارے میں بتائیں — کلائنٹ کا نام، سروس کی تفصیل، رقم اور ادائیگی کی تاریخ۔',
    agreement: 'معاہدے کے بارے میں بتائیں — کلائنٹ کا نام، معاہدے کی قسم اور شروع ہونے کی تاریخ۔',
    lease: 'کرایہ معاہدے کے بارے میں بتائیں — کرایہ دار کا نام، پراپرٹی کا پتہ اور ماہانہ کرایہ۔',
    bulk_message: 'آپ کون سا پیغام بھیجنا چاہتے ہیں اور کسے؟',
    calendar: 'میٹنگ کے بارے میں بتائیں — عنوان، تاریخ اور وقت۔',
    contact: 'رابطے کے بارے میں بتائیں — نام، فون اور ای میل۔',
  },
  'tr-TR': {
    invoice: 'Fatura hakkında bilgi verin — müşteri adı, hizmet açıklaması, tutar ve vade tarihi.',
    agreement: 'Anlaşma hakkında bilgi verin — müşteri adı, anlaşma türü ve başlangıç tarihi.',
    lease: 'Kira sözleşmesi hakkında bilgi verin — kiracı adı, mülk adresi ve aylık kira.',
    bulk_message: 'Ne mesaj göndermek istiyorsunuz ve kime?',
    calendar: 'Toplantı hakkında bilgi verin — başlık, tarih ve saat.',
    contact: 'Kişi hakkında bilgi verin — ad, telefon ve e-posta.',
  },
};

const FIELD_QUESTIONS = {
  'en-US': {
    agreement: {
      prompt: 'Describe the agreement in one sentence.',
      client_name: "What is the client's full name?",
      client_email: "What is the client's email address? (e.g. john@gmail.com)",
      client_phone: "What is the client's phone number?",
      agreement_type: 'What type of agreement? For example: NDA, service, or contract.',
      start_date: 'What is the start date?',
      title: 'What should the agreement title be?',
    },
    lease: {
      prompt: 'Describe the lease briefly — tenant, property, and rent.',
      tenant_name: "What is the tenant's full name?",
      tenant_email: "What is the tenant's email address? (e.g. john@gmail.com)",
      tenant_phone: "What is the tenant's phone number?",
      landlord_name: "What is the landlord's name?",
      property_address: 'What is the full property address?',
      property_type: 'What type of property? Apartment, house, or office?',
      monthly_rent: 'What is the monthly rent amount?',
      security_deposit: 'What is the security deposit amount?',
      start_date: 'What is the lease start date?',
      end_date: 'What is the lease end date?',
    },
    invoice: {
      client_name: "What is the client's full name?",
      client_email: "What is the client's email address? (e.g. john@gmail.com)",
      items: 'What is the service or product? Say the quantity, description, and price. For example: 3 hours web design at $50 each.',
      due_date: 'When is the payment due?',
      notes: 'Any notes for this invoice?',
    },
    bulk_message: {
      content: 'What should the message say?',
      subject: 'What is the message subject?',
      recipients: 'Who should receive this?',
      channel: 'Send by email or SMS?',
    },
    calendar: {
      title: 'What is the meeting title?',
      starts_at: 'When does the meeting start?',
      ends_at: 'When does it end?',
      description: 'Any agenda or description?',
    },
    contact: {
      first_name: "What is the contact's first name?",
      last_name: "What is the contact's last name?",
      phone: "What is the contact's phone number?",
      email: "What is the contact's email address? (e.g. john@gmail.com)",
      date_of_birth: "What is the contact's date of birth? (say skip to skip)",
      notes: "Any notes for this contact? (say skip to skip)",
    },
  },
  'bn-BD': {
    agreement: {
      prompt: 'এক বাক্যে চুক্তির বিবরণ দিন।',
      client_name: 'ক্লায়েন্টের পূর্ণ নাম কী?',
      client_email: 'ক্লায়েন্টের ইমেইল ঠিকানা কী? (যেমন john@gmail.com)',
      client_phone: 'ক্লায়েন্টের ফোন নম্বর কী?',
      agreement_type: 'চুক্তির ধরন কী? যেমন: NDA, সার্ভিস, বা কনট্র্যাক্ট।',
      start_date: 'শুরুর তারিখ কী?',
      title: 'চুক্তির শিরোনাম কী হবে?',
    },
    lease: {
      prompt: 'লিজের সংক্ষিপ্ত বিবরণ দিন — ভাড়াটে, সম্পত্তি এবং ভাড়া।',
      tenant_name: 'ভাড়াটেনার পূর্ণ নাম কী?',
      tenant_email: 'ভাড়াটেনার ইমেইল ঠিকানা কী? (যেমন john@gmail.com)',
      tenant_phone: 'ভাড়াটেনার ফোন নম্বর কী?',
      landlord_name: 'বাড়িওয়ালার নাম কী?',
      property_address: 'সম্পত্তির পূর্ণ ঠিকানা কী?',
      property_type: 'সম্পত্তির ধরন কী? অ্যাপার্টমেন্ট, বাড়ি বা অফিস?',
      monthly_rent: 'মাসিক ভাড়ার পরিমাণ কত?',
      security_deposit: 'নিরাপত্তা জামানতের পরিমাণ কত?',
      start_date: 'লিজের শুরুর তারিখ কী?',
      end_date: 'লিজের শেষ তারিখ কী?',
    },
    invoice: {
      client_name: 'ক্লায়েন্টের পূর্ণ নাম কী?',
      client_email: 'ক্লায়েন্টের ইমেইল ঠিকানা কী? (যেমন john@gmail.com)',
      items: 'সার্ভিস বা পণ্য কী? পরিমাণ, বিবরণ এবং মূল্য বলুন। যেমন: ৩ ঘণ্টা ওয়েব ডিজাইন ৫০ ডলারে।',
      due_date: 'পেমেন্টের শেষ তারিখ কবে?',
      notes: 'এই ইনভয়েসের জন্য কোনো নোট আছে?',
    },
    bulk_message: {
      content: 'বার্তায় কী লেখা থাকবে?',
      subject: 'বার্তার বিষয় কী?',
      recipients: 'কে এটি পাবে?',
      channel: 'ইমেইল নাকি এসএমএসে পাঠাবেন?',
    },
    calendar: {
      title: 'মিটিংয়ের শিরোনাম কী?',
      starts_at: 'মিটিং কখন শুরু হবে?',
      ends_at: 'কখন শেষ হবে?',
      description: 'কোনো এজেন্ডা বা বিবরণ আছে?',
    },
    contact: {
      first_name: 'কন্ট্যাক্টের নাম (প্রথম) কী?',
      last_name: 'কন্ট্যাক্টের পদবি কী?',
      phone: 'কন্ট্যাক্টের ফোন নম্বর কী?',
      email: 'কন্ট্যাক্টের ইমেইল ঠিকানা কী? (যেমন john@gmail.com)',
      date_of_birth: "কন্ট্যাক্টের জন্মতারিখ কী? (বাদ দিতে 'skip' বলুন)",
      notes: "কোনো নোট আছে? (বাদ দিতে 'skip' বলুন)",
    },
  },
  'hi-IN': {
    agreement: {
      prompt: 'एक वाक्य में अनुबंध का विवरण दें।',
      client_name: 'क्लाइंट का पूरा नाम क्या है?',
      client_email: 'क्लाइंट का ईमेल पता क्या है? (जैसे john@gmail.com)',
      client_phone: 'क्लाइंट का फोन नंबर क्या है?',
      agreement_type: 'अनुबंध किस प्रकार का है? जैसे: NDA, सेवा, या अनुबंध।',
      start_date: 'प्रारंभ तिथि क्या है?',
      title: 'अनुबंध का शीर्षक क्या होना चाहिए?',
    },
    lease: {
      prompt: 'लीज का संक्षिप्त विवरण दें — किरायेदार, संपत्ति और किराया।',
      tenant_name: 'किरायेदार का पूरा नाम क्या है?',
      tenant_email: 'किरायेदार का ईमेल पता क्या है? (जैसे john@gmail.com)',
      tenant_phone: 'किरायेदार का फोन नंबर क्या है?',
      landlord_name: 'मकान मालिक का नाम क्या है?',
      property_address: 'संपत्ति का पूरा पता क्या है?',
      property_type: 'संपत्ति का प्रकार क्या है? अपार्टमेंट, घर या कार्यालय?',
      monthly_rent: 'मासिक किराया कितना है?',
      security_deposit: 'सुरक्षा जमा राशि कितनी है?',
      start_date: 'लीज शुरू होने की तारीख क्या है?',
      end_date: 'लीज समाप्त होने की तारीख क्या है?',
    },
    invoice: {
      client_name: 'क्लाइंट का पूरा नाम क्या है?',
      client_email: 'क्लाइंट का ईमेल पता क्या है? (जैसे john@gmail.com)',
      items: 'सेवा या उत्पाद क्या है? मात्रा, विवरण और कीमत बताएं। जैसे: 3 घंटे वेब डिज़ाइन $50 प्रति घंटा।',
      due_date: 'भुगतान की देय तारीख कब है?',
      notes: 'इस इनवॉइस के लिए कोई नोट?',
    },
    bulk_message: {
      content: 'संदेश में क्या लिखना है?',
      subject: 'संदेश का विषय क्या है?',
      recipients: 'इसे कौन प्राप्त करेगा?',
      channel: 'ईमेल से भेजें या SMS से?',
    },
    calendar: {
      title: 'मीटिंग का शीर्षक क्या है?',
      starts_at: 'मीटिंग कब शुरू होती है?',
      ends_at: 'कब समाप्त होती है?',
      description: 'कोई एजेंडा या विवरण?',
    },
    contact: {
      first_name: 'संपर्क का पहला नाम क्या है?',
      last_name: 'संपर्क का अंतिम नाम क्या है?',
      phone: 'संपर्क का फ़ोन नंबर क्या है?',
      email: 'संपर्क का ईमेल पता क्या है? (जैसे john@gmail.com)',
      date_of_birth: "संपर्क की जन्म तिथि क्या है? (छोड़ने के लिए 'skip' कहें)",
      notes: "कोई नोट? (छोड़ने के लिए 'skip' कहें)",
    },
  },
  'ar-SA': {
    agreement: {
      prompt: 'صِف العقد في جملة واحدة.',
      client_name: 'ما الاسم الكامل للعميل؟',
      client_email: 'ما عنوان البريد الإلكتروني للعميل؟ (مثال: john@gmail.com)',
      client_phone: 'ما رقم هاتف العميل؟',
      agreement_type: 'ما نوع العقد؟ مثال: NDA أو خدمة أو عقد.',
      start_date: 'ما تاريخ البدء؟',
      title: 'ما عنوان العقد؟',
    },
    lease: {
      prompt: 'صِف عقد الإيجار باختصار — المستأجر والعقار والإيجار.',
      tenant_name: 'ما الاسم الكامل للمستأجر؟',
      tenant_email: 'ما عنوان البريد الإلكتروني للمستأجر؟ (مثال: john@gmail.com)',
      tenant_phone: 'ما رقم هاتف المستأجر؟',
      landlord_name: 'ما اسم المالك؟',
      property_address: 'ما العنوان الكامل للعقار؟',
      property_type: 'ما نوع العقار؟ شقة أم منزل أم مكتب؟',
      monthly_rent: 'ما قيمة الإيجار الشهري؟',
      security_deposit: 'ما قيمة التأمين؟',
      start_date: 'ما تاريخ بدء الإيجار؟',
      end_date: 'ما تاريخ نهاية الإيجار؟',
    },
    invoice: {
      client_name: 'ما الاسم الكامل للعميل؟',
      client_email: 'ما عنوان البريد الإلكتروني للعميل؟ (مثال: john@gmail.com)',
      items: 'ما الخدمة أو المنتج؟ اذكر الكمية والوصف والسعر. مثال: 3 ساعات تصميم ويب بسعر 50 دولارًا لكل ساعة.',
      due_date: 'متى يحين موعد الدفع؟',
      notes: 'هل توجد ملاحظات لهذه الفاتورة؟',
    },
    bulk_message: {
      content: 'ماذا يجب أن تقول الرسالة؟',
      subject: 'ما موضوع الرسالة؟',
      recipients: 'من الذي يجب أن يستلمها؟',
      channel: 'إرسال عبر البريد الإلكتروني أم SMS؟',
    },
    calendar: {
      title: 'ما عنوان الاجتماع؟',
      starts_at: 'متى يبدأ الاجتماع؟',
      ends_at: 'متى ينتهي؟',
      description: 'هل توجد أجندة أو وصف؟',
    },
    contact: {
      first_name: 'ما الاسم الأول لجهة الاتصال؟',
      last_name: 'ما اسم العائلة لجهة الاتصال؟',
      phone: 'ما رقم هاتف جهة الاتصال؟',
      email: 'ما البريد الإلكتروني لجهة الاتصال؟ (مثال: john@gmail.com)',
      date_of_birth: "ما تاريخ ميلاد جهة الاتصال؟ (قل 'skip' للتخطي)",
      notes: "هل توجد ملاحظات؟ (قل 'skip' للتخطي)",
    },
  },
  'es-ES': {
    agreement: {
      prompt: 'Describe el acuerdo en una frase.',
      client_name: '¿Cuál es el nombre completo del cliente?',
      client_email: '¿Cuál es el correo electrónico del cliente? (ej. john@gmail.com)',
      client_phone: '¿Cuál es el número de teléfono del cliente?',
      agreement_type: '¿Qué tipo de acuerdo es? Por ejemplo: NDA, servicio o contrato.',
      start_date: '¿Cuál es la fecha de inicio?',
      title: '¿Cuál debe ser el título del acuerdo?',
    },
    lease: {
      prompt: 'Describe brevemente el alquiler — inquilino, propiedad y renta.',
      tenant_name: '¿Cuál es el nombre completo del inquilino?',
      tenant_email: '¿Cuál es el correo electrónico del inquilino? (ej. john@gmail.com)',
      tenant_phone: '¿Cuál es el número de teléfono del inquilino?',
      landlord_name: '¿Cuál es el nombre del propietario?',
      property_address: '¿Cuál es la dirección completa de la propiedad?',
      property_type: '¿Qué tipo de propiedad es? ¿Apartamento, casa u oficina?',
      monthly_rent: '¿Cuál es el monto del alquiler mensual?',
      security_deposit: '¿Cuál es el monto del depósito de seguridad?',
      start_date: '¿Cuál es la fecha de inicio del alquiler?',
      end_date: '¿Cuál es la fecha de finalización del alquiler?',
    },
    invoice: {
      client_name: '¿Cuál es el nombre completo del cliente?',
      client_email: '¿Cuál es el correo electrónico del cliente? (ej. john@gmail.com)',
      items: '¿Cuál es el servicio o producto? Di la cantidad, descripción y precio. Ejemplo: 3 horas de diseño web a $50 cada una.',
      due_date: '¿Cuándo vence el pago?',
      notes: '¿Alguna nota para esta factura?',
    },
    bulk_message: {
      content: '¿Qué debe decir el mensaje?',
      subject: '¿Cuál es el asunto del mensaje?',
      recipients: '¿Quién debe recibirlo?',
      channel: '¿Enviar por correo electrónico o SMS?',
    },
    calendar: {
      title: '¿Cuál es el título de la reunión?',
      starts_at: '¿Cuándo comienza la reunión?',
      ends_at: '¿Cuándo termina?',
      description: '¿Alguna agenda o descripción?',
    },
    contact: {
      first_name: '¿Cuál es el nombre del contacto?',
      last_name: '¿Cuál es el apellido del contacto?',
      phone: '¿Cuál es el número de teléfono del contacto?',
      email: '¿Cuál es el correo electrónico del contacto? (ej. john@gmail.com)',
      date_of_birth: "¿Cuál es la fecha de nacimiento del contacto? (di 'skip' para omitir)",
      notes: "¿Alguna nota? (di 'skip' para omitir)",
    },
  },
  'fr-FR': {
    agreement: {
      prompt: "Décrivez l'accord en une phrase.",
      client_name: 'Quel est le nom complet du client ?',
      client_email: "Quelle est l'adresse e-mail du client ? (ex. john@gmail.com)",
      client_phone: 'Quel est le numéro de téléphone du client ?',
      agreement_type: "Quel type d'accord ? Par exemple : NDA, service ou contrat.",
      start_date: 'Quelle est la date de début ?',
      title: "Quel doit être le titre de l'accord ?",
    },
    lease: {
      prompt: 'Décrivez brièvement le bail — locataire, bien et loyer.',
      tenant_name: 'Quel est le nom complet du locataire ?',
      tenant_email: "Quelle est l'adresse e-mail du locataire ? (ex. john@gmail.com)",
      tenant_phone: 'Quel est le numéro de téléphone du locataire ?',
      landlord_name: 'Quel est le nom du propriétaire ?',
      property_address: "Quelle est l'adresse complète du bien ?",
      property_type: 'Quel type de bien ? Appartement, maison ou bureau ?',
      monthly_rent: 'Quel est le montant du loyer mensuel ?',
      security_deposit: 'Quel est le montant du dépôt de garantie ?',
      start_date: 'Quelle est la date de début du bail ?',
      end_date: 'Quelle est la date de fin du bail ?',
    },
    invoice: {
      client_name: 'Quel est le nom complet du client ?',
      client_email: "Quelle est l'adresse e-mail du client ? (ex. john@gmail.com)",
      items: 'Quel est le service ou produit ? Donnez la quantité, la description et le prix. Exemple : 3 heures de web design à 50 $ chacune.',
      due_date: 'Quand le paiement est-il dû ?',
      notes: 'Des notes pour cette facture ?',
    },
    bulk_message: {
      content: 'Que doit dire le message ?',
      subject: 'Quel est le sujet du message ?',
      recipients: 'Qui doit le recevoir ?',
      channel: 'Envoyer par e-mail ou par SMS ?',
    },
    calendar: {
      title: 'Quel est le titre de la réunion ?',
      starts_at: 'Quand la réunion commence-t-elle ?',
      ends_at: 'Quand se termine-t-elle ?',
      description: 'Un agenda ou une description ?',
    },
    contact: {
      first_name: 'Quel est le prénom du contact ?',
      last_name: 'Quel est le nom du contact ?',
      phone: 'Quel est le numéro de téléphone du contact ?',
      email: "Quelle est l'adresse e-mail du contact ? (ex. john@gmail.com)",
      date_of_birth: "Quelle est la date de naissance du contact ? (dites 'skip' pour ignorer)",
      notes: "Des notes ? (dites 'skip' pour ignorer)",
    },
  },
  'pt-BR': {
    agreement: {
      prompt: 'Descreva o contrato em uma frase.',
      client_name: 'Qual é o nome completo do cliente?',
      client_email: 'Qual é o e-mail do cliente? (ex. john@gmail.com)',
      client_phone: 'Qual é o telefone do cliente?',
      agreement_type: 'Que tipo de contrato é? Por exemplo: NDA, serviço ou contrato.',
      start_date: 'Qual é a data de início?',
      title: 'Qual deve ser o título do contrato?',
    },
    lease: {
      prompt: 'Descreva o aluguel brevemente — inquilino, imóvel e aluguel.',
      tenant_name: 'Qual é o nome completo do inquilino?',
      tenant_email: 'Qual é o e-mail do inquilino? (ex. john@gmail.com)',
      tenant_phone: 'Qual é o telefone do inquilino?',
      landlord_name: 'Qual é o nome do proprietário?',
      property_address: 'Qual é o endereço completo do imóvel?',
      property_type: 'Qual é o tipo de imóvel? Apartamento, casa ou escritório?',
      monthly_rent: 'Qual é o valor do aluguel mensal?',
      security_deposit: 'Qual é o valor do depósito de segurança?',
      start_date: 'Qual é a data de início do aluguel?',
      end_date: 'Qual é a data de término do aluguel?',
    },
    invoice: {
      client_name: 'Qual é o nome completo do cliente?',
      client_email: 'Qual é o e-mail do cliente? (ex. john@gmail.com)',
      items: 'Qual é o serviço ou produto? Diga a quantidade, descrição e preço. Exemplo: 3 horas de web design a $50 cada.',
      due_date: 'Quando o pagamento vence?',
      notes: 'Alguma observação para esta fatura?',
    },
    bulk_message: {
      content: 'O que a mensagem deve dizer?',
      subject: 'Qual é o assunto da mensagem?',
      recipients: 'Quem deve recebê-la?',
      channel: 'Enviar por e-mail ou SMS?',
    },
    calendar: {
      title: 'Qual é o título da reunião?',
      starts_at: 'Quando a reunião começa?',
      ends_at: 'Quando termina?',
      description: 'Alguma pauta ou descrição?',
    },
    contact: {
      first_name: 'Qual é o primeiro nome do contato?',
      last_name: 'Qual é o sobrenome do contato?',
      phone: 'Qual é o telefone do contato?',
      email: 'Qual é o e-mail do contato? (ex. john@gmail.com)',
      date_of_birth: "Qual é a data de nascimento do contato? (diga 'skip' para pular)",
      notes: "Alguma observação? (diga 'skip' para pular)",
    },
  },
  'ru-RU': {
    agreement: {
      prompt: 'Опишите договор одним предложением.',
      client_name: 'Как полное имя клиента?',
      client_email: 'Какой адрес электронной почты клиента? (например, john@gmail.com)',
      client_phone: 'Какой номер телефона клиента?',
      agreement_type: 'Какой это тип договора? Например: NDA, сервисный договор или контракт.',
      start_date: 'Какова дата начала?',
      title: 'Каким должен быть заголовок договора?',
    },
    lease: {
      prompt: 'Кратко опишите аренду — арендатор, объект и арендная плата.',
      tenant_name: 'Как полное имя арендатора?',
      tenant_email: 'Какой адрес электронной почты арендатора? (например, john@gmail.com)',
      tenant_phone: 'Какой номер телефона арендатора?',
      landlord_name: 'Как зовут арендодателя?',
      property_address: 'Какой полный адрес объекта?',
      property_type: 'Какой тип недвижимости? Квартира, дом или офис?',
      monthly_rent: 'Какова ежемесячная арендная плата?',
      security_deposit: 'Каков размер залога?',
      start_date: 'Какова дата начала аренды?',
      end_date: 'Какова дата окончания аренды?',
    },
    invoice: {
      client_name: 'Как полное имя клиента?',
      client_email: 'Какой адрес электронной почты клиента? (например, john@gmail.com)',
      items: 'Что за услуга или продукт? Укажите количество, описание и цену. Например: 3 часа веб-дизайна по $50 каждый.',
      due_date: 'Когда наступает срок оплаты?',
      notes: 'Есть ли примечания к этому счёту?',
    },
    bulk_message: {
      content: 'Что должно быть в сообщении?',
      subject: 'Какая тема сообщения?',
      recipients: 'Кто должен его получить?',
      channel: 'Отправить по электронной почте или SMS?',
    },
    calendar: {
      title: 'Какое название встречи?',
      starts_at: 'Когда начинается встреча?',
      ends_at: 'Когда она заканчивается?',
      description: 'Есть ли повестка или описание?',
    },
    contact: {
      first_name: 'Как зовут контакт?',
      last_name: 'Какая фамилия у контакта?',
      phone: 'Какой номер телефона у контакта?',
      email: 'Какой адрес электронной почты у контакта? (например, john@gmail.com)',
      date_of_birth: "Какова дата рождения контакта? (скажите 'skip', чтобы пропустить)",
      notes: "Есть ли примечания? (скажите 'skip', чтобы пропустить)",
    },
  },
  'ur-PK': {
    agreement: {
      prompt: 'ایک جملے میں معاہدے کی وضاحت کریں۔',
      client_name: 'کلائنٹ کا پورا نام کیا ہے؟',
      client_email: 'کلائنٹ کا ای میل پتہ کیا ہے؟ (مثال: john@gmail.com)',
      client_phone: 'کلائنٹ کا فون نمبر کیا ہے؟',
      agreement_type: 'یہ کس قسم کا معاہدہ ہے؟ مثال: NDA، سروس، یا کنٹریکٹ۔',
      start_date: 'شروع ہونے کی تاریخ کیا ہے؟',
      title: 'معاہدے کا عنوان کیا ہونا چاہیے؟',
    },
    lease: {
      prompt: 'کرایہ معاہدے کی مختصر وضاحت کریں — کرایہ دار، پراپرٹی، اور کرایہ۔',
      tenant_name: 'کرایہ دار کا پورا نام کیا ہے؟',
      tenant_email: 'کرایہ دار کا ای میل پتہ کیا ہے؟ (مثال: john@gmail.com)',
      tenant_phone: 'کرایہ دار کا فون نمبر کیا ہے؟',
      landlord_name: 'مالک مکان کا نام کیا ہے؟',
      property_address: 'پراپرٹی کا مکمل پتہ کیا ہے؟',
      property_type: 'پراپرٹی کس قسم کی ہے؟ اپارٹمنٹ، گھر، یا دفتر؟',
      monthly_rent: 'ماہانہ کرایہ کتنا ہے؟',
      security_deposit: 'سیکیورٹی ڈپازٹ کتنا ہے؟',
      start_date: 'کرایہ معاہدہ کب شروع ہوگا؟',
      end_date: 'کرایہ معاہدہ کب ختم ہوگا؟',
    },
    invoice: {
      client_name: 'کلائنٹ کا پورا نام کیا ہے؟',
      client_email: 'کلائنٹ کا ای میل پتہ کیا ہے؟ (مثال: john@gmail.com)',
      items: 'سروس یا پروڈکٹ کیا ہے؟ مقدار، تفصیل، اور قیمت بتائیں۔ مثال: 3 گھنٹے ویب ڈیزائن $50 فی گھنٹہ۔',
      due_date: 'ادائیگی کی آخری تاریخ کب ہے؟',
      notes: 'کیا اس انوائس کے لیے کوئی نوٹ ہے؟',
    },
    bulk_message: {
      content: 'پیغام میں کیا لکھا جائے؟',
      subject: 'پیغام کا عنوان کیا ہے؟',
      recipients: 'یہ کس کو بھیجا جائے؟',
      channel: 'ای میل سے بھیجنا ہے یا SMS سے؟',
    },
    calendar: {
      title: 'میٹنگ کا عنوان کیا ہے؟',
      starts_at: 'میٹنگ کب شروع ہوگی؟',
      ends_at: 'کب ختم ہوگی؟',
      description: 'کوئی ایجنڈا یا تفصیل؟',
    },
    contact: {
      first_name: 'رابطے کا پہلا نام کیا ہے؟',
      last_name: 'رابطے کا آخری نام کیا ہے؟',
      phone: 'رابطے کا فون نمبر کیا ہے؟',
      email: 'رابطے کا ای میل پتہ کیا ہے؟ (مثال: john@gmail.com)',
      date_of_birth: "رابطے کی تاریخِ پیدائش کیا ہے؟ (اسے چھوڑنے کے لیے 'skip' کہیں)",
      notes: "کوئی نوٹ؟ (اسے چھوڑنے کے لیے 'skip' کہیں)",
    },
  },
  'tr-TR': {
    agreement: {
      prompt: 'Anlaşmayı tek cümleyle açıklayın.',
      client_name: 'Müşterinin tam adı nedir?',
      client_email: 'Müşterinin e-posta adresi nedir? (örn. john@gmail.com)',
      client_phone: 'Müşterinin telefon numarası nedir?',
      agreement_type: 'Bu ne tür bir anlaşma? Örneğin: NDA, hizmet veya sözleşme.',
      start_date: 'Başlangıç tarihi nedir?',
      title: 'Anlaşma başlığı ne olmalı?',
    },
    lease: {
      prompt: 'Kira sözleşmesini kısaca açıklayın — kiracı, mülk ve kira.',
      tenant_name: 'Kiracının tam adı nedir?',
      tenant_email: 'Kiracının e-posta adresi nedir? (örn. john@gmail.com)',
      tenant_phone: 'Kiracının telefon numarası nedir?',
      landlord_name: 'Ev sahibinin adı nedir?',
      property_address: 'Mülkün tam adresi nedir?',
      property_type: 'Mülk türü nedir? Daire, ev veya ofis?',
      monthly_rent: 'Aylık kira tutarı nedir?',
      security_deposit: 'Depozito tutarı nedir?',
      start_date: 'Kira başlangıç tarihi nedir?',
      end_date: 'Kira bitiş tarihi nedir?',
    },
    invoice: {
      client_name: 'Müşterinin tam adı nedir?',
      client_email: 'Müşterinin e-posta adresi nedir? (örn. john@gmail.com)',
      items: 'Hizmet veya ürün nedir? Miktarı, açıklamayı ve fiyatı söyleyin. Örnek: Saat başına $50 ile 3 saat web tasarımı.',
      due_date: 'Ödeme son tarihi ne zaman?',
      notes: 'Bu fatura için not var mı?',
    },
    bulk_message: {
      content: 'Mesajda ne yazmalı?',
      subject: 'Mesajın konusu nedir?',
      recipients: 'Bunu kim almalı?',
      channel: 'E-posta ile mi yoksa SMS ile mi gönderilsin?',
    },
    calendar: {
      title: 'Toplantının başlığı nedir?',
      starts_at: 'Toplantı ne zaman başlıyor?',
      ends_at: 'Ne zaman bitiyor?',
      description: 'Herhangi bir gündem veya açıklama var mı?',
    },
    contact: {
      first_name: 'Kişinin adı nedir?',
      last_name: 'Kişinin soyadı nedir?',
      phone: 'Kişinin telefon numarası nedir?',
      email: 'Kişinin e-posta adresi nedir? (örn. john@gmail.com)',
      date_of_birth: "Kişinin doğum tarihi nedir? (atlamak için 'skip' deyin)",
      notes: "Herhangi bir not var mı? (atlamak için 'skip' deyin)",
    },
  },
};

const INTENT_ORDER = ['invoice', 'bulk_message', 'calendar', 'lease', 'agreement', 'group', 'contact', 'call', 'email'];

const INTENT_PATTERNS = {
  invoice: [/\bcreate[_\s-]*invoice\b/i, /\bnew[_\s-]*invoice\b/i, /\binvoice\b/i, /\bbill(?:ing)?\b/i],
  bulk_message: [/\bsend[_\s-]*bulk[_\s-]*message\b/i, /\bcreate[_\s-]*bulk[_\s-]*message\b/i, /\bbulk[_\s-]*message\b/i, /\bbulk[_\s-]*messaging\b/i, /\bmass[_\s-]*message\b/i],
  calendar: [/\bschedule[_\s-]*meeting\b/i, /\bcreate[_\s-]*meeting\b/i, /\bmeeting\b/i, /\bcalendar\b/i],
  lease: [/\bcreate[_\s-]*lease\b/i, /\bnew[_\s-]*lease\b/i, /\blease\b/i, /\brental\b/i, /\btenant\b/i, /\blandlord\b/i],
  agreement: [/\bnew[_\s-]*agreement\b/i, /\bcreate[_\s-]*agreement\b/i, /\bagreement\b/i, /\bcontract\b/i, /\bnda\b/i],
  group: [/\bgroup\b/i, /\bcommunity\b/i, /\bteam chat\b/i],
  contact: [/\bcontact\b/i, /\bperson\b/i, /\bphonebook\b/i],
  call: [/\bcall\b/i, /\bphone\b/i, /\bdial\b/i],
  email: [/\bemail\b/i, /\bmail\b/i],
};

const NORMALIZATION_RULES = [
  [/\bcreate[_\s-]*invoice\b/gi, 'create invoice'],
  [/\bnew[_\s-]*invoice\b/gi, 'new invoice'],
  [/\bsend[_\s-]*bulk[_\s-]*message\b/gi, 'send bulk message'],
  [/\bcreate[_\s-]*bulk[_\s-]*message\b/gi, 'create bulk message'],
  [/\bbulk[_\s-]*message\b/gi, 'bulk message'],
  [/\bbulk[_\s-]*messaging\b/gi, 'bulk message'],
  [/\b(schedule|create|new|set up|setup)\s+(?:a\s+|an\s+)?meeting\b/gi, 'schedule meeting'],
  [/\b(create|generate|draft|make|new)\s+(?:a\s+|an\s+)?agreement\b/gi, 'create agreement'],
  [/\b(create|generate|draft|make|new)\s+(?:a\s+|an\s+)?lease\b/gi, 'create lease'],
  [/\b(create|generate|draft|make|new)\s+(?:a\s+|an\s+)?lease\s+list\b/gi, 'create lease'],
  [/\b(create|generate|draft|make|new)\s+(?:a\s+|an\s+)?least\b/gi, 'create lease'],
  [/\b(create|generate|draft|make|new)\s+(?:a\s+|an\s+)?leash\b/gi, 'create lease'],
  [/\b(create|generate|draft|make|new)\s+(?:a\s+|an\s+)?leese\b/gi, 'create lease'],
  [/\b(send|create|draft|new)\s+(?:a\s+|an\s+)?bark\s+message\b/gi, 'send bulk message'],
  [/\b(send|create|draft|new)\s+(?:a\s+|an\s+)?bluk\s+message\b/gi, 'send bulk message'],
  [/\b(send|create|draft|new)\s+(?:a\s+|an\s+)?blok\s+message\b/gi, 'send bulk message'],
  [/\b(send|create|draft|new)\s+(?:a\s+|an\s+)?block\s+message\b/gi, 'send bulk message'],
  [/\b(send|create|draft|new)\s+(?:a\s+|an\s+)?bulk\s+massage\b/gi, 'send bulk message'],
  [/\b(send|create|draft|new)\s+(?:a\s+|an\s+)?bulk\s+messages\b/gi, 'send bulk message'],
  [/\bbark\s+message\b/gi, 'bulk message'],
  [/\bbluk\s+message\b/gi, 'bulk message'],
  [/\bblok\s+message\b/gi, 'bulk message'],
  [/\bblock\s+message\b/gi, 'bulk message'],
  [/\bbulk\s+massage\b/gi, 'bulk message'],
];

export const getStoredAiLanguage = () => {
  if (typeof window === 'undefined') return 'en-US';
  return window.localStorage.getItem(AI_LANGUAGE_STORAGE_KEY) || 'en-US';
};

export const setStoredAiLanguage = (code) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AI_LANGUAGE_STORAGE_KEY, code || 'en-US');
};

export const getInitialPrompt = (language, intent) =>
  INITIAL_PROMPTS[language]?.[intent]
  || INITIAL_PROMPTS['en-US']?.[intent]
  || 'Tell me what you want to create.';

export const getFieldQuestion = (language, intent, fieldKey) =>
  FIELD_QUESTIONS[language]?.[intent]?.[fieldKey]
  || FIELD_QUESTIONS['en-US']?.[intent]?.[fieldKey]
  || `What is the ${String(fieldKey || '').replace(/_/g, ' ')}?`;

export const normalizeVoiceWorkflowTranscript = (value) => {
  let text = String(value || '').trim();
  if (!text) return '';
  text = text.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  NORMALIZATION_RULES.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  return text.replace(/\s+/g, ' ').trim();
};

export const inferVoiceWorkflowIntent = (value) => {
  const text = normalizeVoiceWorkflowTranscript(value);
  if (!text) return null;
  for (const intent of INTENT_ORDER) {
    const patterns = INTENT_PATTERNS[intent] || [];
    if (patterns.some((pattern) => pattern.test(text))) return intent;
  }
  return null;
};
