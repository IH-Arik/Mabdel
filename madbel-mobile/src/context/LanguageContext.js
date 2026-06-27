import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_TRANSLATIONS, LANGUAGE_OPTIONS } from "../i18n/appTranslations";

const STORAGE_KEY = "@mabdel_voice_lang";

export const LANGUAGES = LANGUAGE_OPTIONS;

const interpolate = (template, params = {}) =>
  String(template || "").replace(/\{(\w+)\}/g, (_, key) =>
    params[key] == null ? "" : String(params[key]),
  );

const getTranslation = (langCode, key, params) => {
  const template =
    APP_TRANSLATIONS?.[langCode]?.[key] ??
    APP_TRANSLATIONS?.["en-US"]?.[key] ??
    key;
  return interpolate(template, params);
};

// ─── Translated initial prompts ───────────────────────────────────────────────
export const INITIAL_PROMPTS_I18N = {
  "en-US": {
    invoice: "Tell me about the invoice — client name, service description, amount, and due date.",
    agreement: "Tell me about the agreement — client name, type of agreement, and start date.",
    lease: "Tell me about the lease — tenant name, property address, and monthly rent.",
    bulk_message: "What message do you want to send and to whom?",
    calendar: "Tell me about the meeting — title, date, and time.",
    contact: "Tell me about the contact — first name, last name, phone, and email.",
  },
  "bn-BD": {
    invoice: "ইনভয়েস সম্পর্কে বলুন — ক্লায়েন্টের নাম, সার্ভিসের বিবরণ, পরিমাণ এবং নির্ধারিত তারিখ।",
    agreement: "চুক্তি সম্পর্কে বলুন — ক্লায়েন্টের নাম, চুক্তির ধরন এবং শুরুর তারিখ।",
    lease: "লিজ সম্পর্কে বলুন — ভাড়াটেনার নাম, সম্পত্তির ঠিকানা এবং মাসিক ভাড়া।",
    bulk_message: "আপনি কী বার্তা পাঠাতে চান এবং কাকে পাঠাবেন?",
    calendar: "মিটিং সম্পর্কে বলুন — শিরোনাম, তারিখ এবং সময়।",
    contact: "কন্ট্যাক্ট সম্পর্কে বলুন — নাম, ফোন এবং ইমেইল।",
  },
  "hi-IN": {
    invoice: "इनवॉइस के बारे में बताएं — क्लाइंट का नाम, सेवा विवरण, राशि और देय तिथि।",
    agreement: "अनुबंध के बारे में बताएं — क्लाइंट का नाम, अनुबंध का प्रकार और प्रारंभ तिथि।",
    lease: "लीज के बारे में बताएं — किरायेदार का नाम, संपत्ति का पता और मासिक किराया।",
    bulk_message: "आप कौन सा संदेश भेजना चाहते हैं और किसे?",
    calendar: "मीटिंग के बारे में बताएं — शीर्षक, तारीख और समय।",
    contact: "संपर्क के बारे में बताएं — नाम, फ़ोन और ईमेल।",
  },
  "ar-SA": {
    invoice: "أخبرني عن الفاتورة — اسم العميل، وصف الخدمة، المبلغ، وتاريخ الاستحقاق.",
    agreement: "أخبرني عن العقد — اسم العميل، نوع العقد، وتاريخ البدء.",
    lease: "أخبرني عن عقد الإيجار — اسم المستأجر، عنوان العقار، والإيجار الشهري.",
    bulk_message: "ما هي الرسالة التي تريد إرسالها وإلى من؟",
    calendar: "أخبرني عن الاجتماع — العنوان والتاريخ والوقت.",
    contact: "أخبرني عن جهة الاتصال — الاسم والهاتف والبريد الإلكتروني.",
  },
  "es-ES": {
    invoice: "Cuéntame sobre la factura — nombre del cliente, descripción del servicio, monto y fecha de vencimiento.",
    agreement: "Cuéntame sobre el acuerdo — nombre del cliente, tipo de acuerdo y fecha de inicio.",
    lease: "Cuéntame sobre el contrato de alquiler — nombre del inquilino, dirección y renta mensual.",
    bulk_message: "¿Qué mensaje quieres enviar y a quién?",
    calendar: "Cuéntame sobre la reunión — título, fecha y hora.",
    contact: "Cuéntame sobre el contacto — nombre, teléfono y correo electrónico.",
  },
  "fr-FR": {
    invoice: "Parlez-moi de la facture — nom du client, description du service, montant et date d'échéance.",
    agreement: "Parlez-moi de l'accord — nom du client, type d'accord et date de début.",
    lease: "Parlez-moi du bail — nom du locataire, adresse du bien et loyer mensuel.",
    bulk_message: "Quel message voulez-vous envoyer et à qui?",
    calendar: "Parlez-moi de la réunion — titre, date et heure.",
    contact: "Parlez-moi du contact — prénom, nom, téléphone et e-mail.",
  },
  "pt-BR": {
    invoice: "Fale sobre a fatura — nome do cliente, descrição do serviço, valor e data de vencimento.",
    agreement: "Fale sobre o contrato — nome do cliente, tipo de contrato e data de início.",
    lease: "Fale sobre o contrato de aluguel — nome do inquilino, endereço e aluguel mensal.",
    bulk_message: "Que mensagem você quer enviar e para quem?",
    calendar: "Fale sobre a reunião — título, data e horário.",
    contact: "Fale sobre o contato — nome, telefone e e-mail.",
  },
  "ru-RU": {
    invoice: "Расскажите о счёте — имя клиента, описание услуги, сумма и срок оплаты.",
    agreement: "Расскажите о договоре — имя клиента, тип договора и дата начала.",
    lease: "Расскажите об аренде — имя арендатора, адрес и ежемесячная арендная плата.",
    bulk_message: "Какое сообщение вы хотите отправить и кому?",
    calendar: "Расскажите о встрече — название, дата и время.",
    contact: "Расскажите о контакте — имя, телефон и электронная почта.",
  },
  "ur-PK": {
    invoice: "انوائس کے بارے میں بتائیں — کلائنٹ کا نام، سروس کی تفصیل، رقم اور ادائیگی کی تاریخ۔",
    agreement: "معاہدے کے بارے میں بتائیں — کلائنٹ کا نام، معاہدے کی قسم اور شروع ہونے کی تاریخ۔",
    lease: "کرایہ معاہدے کے بارے میں بتائیں — کرایہ دار کا نام، پراپرٹی کا پتہ اور ماہانہ کرایہ۔",
    bulk_message: "آپ کون سا پیغام بھیجنا چاہتے ہیں اور کسے؟",
    calendar: "میٹنگ کے بارے میں بتائیں — عنوان، تاریخ اور وقت۔",
    contact: "رابطے کے بارے میں بتائیں — نام، فون اور ای میل۔",
  },
  "tr-TR": {
    invoice: "Fatura hakkında bilgi verin — müşteri adı, hizmet açıklaması, tutar ve vade tarihi.",
    agreement: "Anlaşma hakkında bilgi verin — müşteri adı, anlaşma türü ve başlangıç tarihi.",
    lease: "Kira sözleşmesi hakkında bilgi verin — kiracı adı, mülk adresi ve aylık kira.",
    bulk_message: "Ne mesaj göndermek istiyorsunuz ve kime?",
    calendar: "Toplantı hakkında bilgi verin — başlık, tarih ve saat.",
    contact: "Kişi hakkında bilgi verin — ad, telefon ve e-posta.",
  },
};

// ─── Translated field questions ───────────────────────────────────────────────
const FIELD_QUESTIONS_BASE = {
  agreement: {
    prompt: "Describe the agreement in one sentence.",
    client_name: "What is the client's full name?",
    client_email: "What is the client's email address? (e.g. john@gmail.com)",
    client_phone: "What is the client's phone number?",
    agreement_type: "What type of agreement? For example: NDA, service, or contract.",
    start_date: "What is the start date?",
    title: "What should the agreement title be?",
  },
  lease: {
    prompt: "Describe the lease briefly — tenant, property, and rent.",
    tenant_name: "What is the tenant's full name?",
    tenant_email: "What is the tenant's email address? (e.g. john@gmail.com)",
    tenant_phone: "What is the tenant's phone number?",
    landlord_name: "What is the landlord's name?",
    property_address: "What is the full property address?",
    property_type: "What type of property? Apartment, house, or office?",
    monthly_rent: "What is the monthly rent amount?",
    security_deposit: "What is the security deposit amount?",
    start_date: "What is the lease start date?",
    end_date: "What is the lease end date?",
  },
  invoice: {
    client_name: "What is the client's full name?",
    client_email: "What is the client's email address? (e.g. john@gmail.com)",
    items: "What is the service or product? Say the quantity, description, and price. For example: 3 hours web design at $50 each.",
    due_date: "When is the payment due?",
    notes: "Any notes for this invoice?",
  },
  bulk_message: {
    content: "What should the message say?",
    subject: "What is the message subject?",
    recipients: "Who should receive this?",
    channel: "Send by email or SMS?",
  },
  calendar: {
    title: "What is the meeting title?",
    starts_at: "When does the meeting start?",
    ends_at: "When does it end?",
    description: "Any agenda or description?",
  },
  contact: {
    first_name: "What is the contact's first name?",
    last_name: "What is the contact's last name?",
    phone: "What is the contact's phone number?",
    email: "What is the contact's email address? (e.g. john@gmail.com)",
    date_of_birth: "What is the contact's date of birth? (say skip to skip)",
    notes: "Any notes for this contact? (say skip to skip)",
  },
};

export const FIELD_QUESTIONS_I18N = {
  "en-US": FIELD_QUESTIONS_BASE,

  "bn-BD": {
    agreement: {
      prompt: "এক বাক্যে চুক্তির বিবরণ দিন।",
      client_name: "ক্লায়েন্টের পূর্ণ নাম কী?",
      client_email: "ক্লায়েন্টের ইমেইল ঠিকানা কী? (যেমন john@gmail.com)",
      client_phone: "ক্লায়েন্টের ফোন নম্বর কী?",
      agreement_type: "চুক্তির ধরন কী? যেমন: NDA, সার্ভিস, বা কনট্র্যাক্ট।",
      start_date: "শুরুর তারিখ কী?",
      title: "চুক্তির শিরোনাম কী হবে?",
    },
    lease: {
      prompt: "লিজের সংক্ষিপ্ত বিবরণ দিন — ভাড়াটে, সম্পত্তি এবং ভাড়া।",
      tenant_name: "ভাড়াটেনার পূর্ণ নাম কী?",
      tenant_email: "ভাড়াটেনার ইমেইল ঠিকানা কী? (যেমন john@gmail.com)",
      tenant_phone: "ভাড়াটেনার ফোন নম্বর কী?",
      landlord_name: "বাড়িওয়ালার নাম কী?",
      property_address: "সম্পত্তির পূর্ণ ঠিকানা কী?",
      property_type: "সম্পত্তির ধরন কী? অ্যাপার্টমেন্ট, বাড়ি বা অফিস?",
      monthly_rent: "মাসিক ভাড়ার পরিমাণ কত?",
      security_deposit: "নিরাপত্তা জামানতের পরিমাণ কত?",
      start_date: "লিজের শুরুর তারিখ কী?",
      end_date: "লিজের শেষ তারিখ কী?",
    },
    invoice: {
      client_name: "ক্লায়েন্টের পূর্ণ নাম কী?",
      client_email: "ক্লায়েন্টের ইমেইল ঠিকানা কী? (যেমন john@gmail.com)",
      items: "সার্ভিস বা পণ্য কী? পরিমাণ, বিবরণ এবং মূল্য বলুন। যেমন: ৩ ঘণ্টা ওয়েব ডিজাইন ৫০ ডলারে।",
      due_date: "পেমেন্টের শেষ তারিখ কবে?",
      notes: "এই ইনভয়েসের জন্য কোনো নোট আছে?",
    },
    bulk_message: {
      content: "বার্তায় কী লেখা থাকবে?",
      subject: "বার্তার বিষয় কী?",
      recipients: "কে এটি পাবে?",
      channel: "ইমেইল নাকি এসএমএসে পাঠাবেন?",
    },
    calendar: {
      title: "মিটিংয়ের শিরোনাম কী?",
      starts_at: "মিটিং কখন শুরু হবে?",
      ends_at: "কখন শেষ হবে?",
      description: "কোনো এজেন্ডা বা বিবরণ আছে?",
    },
    contact: {
      first_name: "কন্ট্যাক্টের নাম (প্রথম) কী?",
      last_name: "কন্ট্যাক্টের পদবি কী?",
      phone: "কন্ট্যাক্টের ফোন নম্বর কী?",
      email: "কন্ট্যাক্টের ইমেইল ঠিকানা কী? (যেমন john@gmail.com)",
      date_of_birth: "কন্ট্যাক্টের জন্মতারিখ কী? (বাদ দিতে 'skip' বলুন)",
      notes: "কোনো নোট আছে? (বাদ দিতে 'skip' বলুন)",
    },
  },

  "hi-IN": {
    agreement: {
      prompt: "एक वाक्य में अनुबंध का विवरण दें।",
      client_name: "क्लाइंट का पूरा नाम क्या है?",
      client_email: "क्लाइंट का ईमेल पता क्या है? (जैसे john@gmail.com)",
      client_phone: "क्लाइंट का फोन नंबर क्या है?",
      agreement_type: "अनुबंध किस प्रकार का है? जैसे: NDA, सेवा, या अनुबंध।",
      start_date: "प्रारंभ तिथि क्या है?",
      title: "अनुबंध का शीर्षक क्या होना चाहिए?",
    },
    lease: {
      prompt: "लीज का संक्षिप्त विवरण दें — किरायेदार, संपत्ति और किराया।",
      tenant_name: "किरायेदार का पूरा नाम क्या है?",
      tenant_email: "किरायेदार का ईमेल पता क्या है? (जैसे john@gmail.com)",
      tenant_phone: "किरायेदार का फोन नंबर क्या है?",
      landlord_name: "मकान मालिक का नाम क्या है?",
      property_address: "संपत्ति का पूरा पता क्या है?",
      property_type: "संपत्ति का प्रकार क्या है? अपार्टमेंट, घर या कार्यालय?",
      monthly_rent: "मासिक किराया कितना है?",
      security_deposit: "सुरक्षा जमा राशि कितनी है?",
      start_date: "लीज शुरू होने की तारीख क्या है?",
      end_date: "लीज समाप्त होने की तारीख क्या है?",
    },
    invoice: {
      client_name: "क्लाइंट का पूरा नाम क्या है?",
      client_email: "क्लाइंट का ईमेल पता क्या है? (जैसे john@gmail.com)",
      items: "सेवा या उत्पाद क्या है? मात्रा, विवरण और कीमत बताएं। जैसे: 3 घंटे वेब डिज़ाइन $50 प्रति घंटा।",
      due_date: "भुगतान की देय तारीख कब है?",
      notes: "इस इनवॉइस के लिए कोई नोट?",
    },
    bulk_message: {
      content: "संदेश में क्या लिखना है?",
      subject: "संदेश का विषय क्या है?",
      recipients: "इसे कौन प्राप्त करेगा?",
      channel: "ईमेल से भेजें या SMS से?",
    },
    calendar: {
      title: "मीटिंग का शीर्षक क्या है?",
      starts_at: "मीटिंग कब शुरू होती है?",
      ends_at: "कब समाप्त होती है?",
      description: "कोई एजेंडा या विवरण?",
    },
    contact: {
      first_name: "संपर्क का पहला नाम क्या है?",
      last_name: "संपर्क का अंतिम नाम क्या है?",
      phone: "संपर्क का फ़ोन नंबर क्या है?",
      email: "संपर्क का ईमेल पता क्या है? (जैसे john@gmail.com)",
      date_of_birth: "संपर्क की जन्म तिथि क्या है? (छोड़ने के लिए 'skip' कहें)",
      notes: "कोई नोट? (छोड़ने के लिए 'skip' कहें)",
    },
  },

  "ar-SA": {
    agreement: {
      prompt: "صف العقد في جملة واحدة.",
      client_name: "ما هو الاسم الكامل للعميل؟",
      client_email: "ما هو عنوان البريد الإلكتروني للعميل؟ (مثال: john@gmail.com)",
      client_phone: "ما هو رقم هاتف العميل؟",
      agreement_type: "ما نوع الاتفاقية؟ مثلاً: NDA أو خدمة أو عقد.",
      start_date: "ما هو تاريخ البدء؟",
      title: "ما عنوان الاتفاقية؟",
    },
    lease: {
      prompt: "صف عقد الإيجار باختصار — المستأجر والعقار والإيجار.",
      tenant_name: "ما هو الاسم الكامل للمستأجر؟",
      tenant_email: "ما هو عنوان البريد الإلكتروني للمستأجر؟ (مثال: john@gmail.com)",
      tenant_phone: "ما هو رقم هاتف المستأجر؟",
      landlord_name: "ما هو اسم المالك؟",
      property_address: "ما هو عنوان العقار الكامل؟",
      property_type: "ما نوع العقار؟ شقة أو منزل أو مكتب؟",
      monthly_rent: "ما مبلغ الإيجار الشهري؟",
      security_deposit: "ما مبلغ التأمين؟",
      start_date: "ما تاريخ بدء الإيجار؟",
      end_date: "ما تاريخ انتهاء الإيجار؟",
    },
    invoice: {
      client_name: "ما هو الاسم الكامل للعميل؟",
      client_email: "ما هو عنوان البريد الإلكتروني للعميل؟ (مثال: john@gmail.com)",
      items: "ما هي الخدمة أو المنتج؟ قل الكمية والوصف والسعر. مثلاً: 3 ساعات تصميم ويب بـ 50 دولار للساعة.",
      due_date: "متى موعد استحقاق الدفع؟",
      notes: "هل هناك ملاحظات لهذه الفاتورة؟",
    },
    bulk_message: {
      content: "ماذا تريد أن تقول في الرسالة؟",
      subject: "ما موضوع الرسالة؟",
      recipients: "من يجب أن يستلمها؟",
      channel: "إرسال عبر البريد الإلكتروني أو الرسائل القصيرة؟",
    },
    calendar: {
      title: "ما عنوان الاجتماع؟",
      starts_at: "متى يبدأ الاجتماع؟",
      ends_at: "متى ينتهي؟",
      description: "هل هناك جدول أعمال أو وصف؟",
    },
    contact: {
      first_name: "ما هو الاسم الأول لجهة الاتصال؟",
      last_name: "ما هو اسم العائلة لجهة الاتصال؟",
      phone: "ما هو رقم هاتف جهة الاتصال؟",
      email: "ما هو البريد الإلكتروني لجهة الاتصال؟ (مثال: john@gmail.com)",
      date_of_birth: "ما هو تاريخ ميلاد جهة الاتصال؟ (قل تخطي للتخطي)",
      notes: "أي ملاحظات؟ (قل تخطي للتخطي)",
    },
  },

  "es-ES": {
    agreement: {
      prompt: "Describe el acuerdo en una oración.",
      client_name: "¿Cuál es el nombre completo del cliente?",
      client_email: "¿Cuál es el correo electrónico del cliente? (ej. john@gmail.com)",
      client_phone: "¿Cuál es el número de teléfono del cliente?",
      agreement_type: "¿Qué tipo de acuerdo? Por ejemplo: NDA, servicio o contrato.",
      start_date: "¿Cuál es la fecha de inicio?",
      title: "¿Cuál debería ser el título del acuerdo?",
    },
    lease: {
      prompt: "Describe el contrato de alquiler brevemente — inquilino, propiedad y renta.",
      tenant_name: "¿Cuál es el nombre completo del inquilino?",
      tenant_email: "¿Cuál es el correo electrónico del inquilino? (ej. john@gmail.com)",
      tenant_phone: "¿Cuál es el número de teléfono del inquilino?",
      landlord_name: "¿Cuál es el nombre del arrendador?",
      property_address: "¿Cuál es la dirección completa de la propiedad?",
      property_type: "¿Qué tipo de propiedad? ¿Apartamento, casa u oficina?",
      monthly_rent: "¿Cuál es el monto del alquiler mensual?",
      security_deposit: "¿Cuál es el monto del depósito de seguridad?",
      start_date: "¿Cuál es la fecha de inicio del alquiler?",
      end_date: "¿Cuál es la fecha de fin del alquiler?",
    },
    invoice: {
      client_name: "¿Cuál es el nombre completo del cliente?",
      client_email: "¿Cuál es el correo electrónico del cliente? (ej. john@gmail.com)",
      items: "¿Cuál es el servicio o producto? Di la cantidad, descripción y precio. Por ejemplo: 3 horas de diseño web a $50 cada una.",
      due_date: "¿Cuándo vence el pago?",
      notes: "¿Alguna nota para esta factura?",
    },
    bulk_message: {
      content: "¿Qué debe decir el mensaje?",
      subject: "¿Cuál es el asunto del mensaje?",
      recipients: "¿Quién debería recibirlo?",
      channel: "¿Enviar por correo electrónico o SMS?",
    },
    calendar: {
      title: "¿Cuál es el título de la reunión?",
      starts_at: "¿Cuándo comienza la reunión?",
      ends_at: "¿Cuándo termina?",
      description: "¿Algún orden del día o descripción?",
    },
    contact: {
      first_name: "¿Cuál es el nombre del contacto?",
      last_name: "¿Cuál es el apellido del contacto?",
      phone: "¿Cuál es el número de teléfono del contacto?",
      email: "¿Cuál es el correo electrónico del contacto? (ej. john@gmail.com)",
      date_of_birth: "¿Cuál es la fecha de nacimiento? (di 'skip' para omitir)",
      notes: "¿Alguna nota? (di 'skip' para omitir)",
    },
  },

  "fr-FR": {
    agreement: {
      prompt: "Décrivez l'accord en une phrase.",
      client_name: "Quel est le nom complet du client?",
      client_email: "Quelle est l'adresse e-mail du client? (ex. john@gmail.com)",
      client_phone: "Quel est le numéro de téléphone du client?",
      agreement_type: "Quel type d'accord? Par exemple: NDA, service ou contrat.",
      start_date: "Quelle est la date de début?",
      title: "Quel devrait être le titre de l'accord?",
    },
    lease: {
      prompt: "Décrivez le bail brièvement — locataire, bien et loyer.",
      tenant_name: "Quel est le nom complet du locataire?",
      tenant_email: "Quelle est l'adresse e-mail du locataire? (ex. john@gmail.com)",
      tenant_phone: "Quel est le numéro de téléphone du locataire?",
      landlord_name: "Quel est le nom du propriétaire?",
      property_address: "Quelle est l'adresse complète du bien?",
      property_type: "Quel type de bien? Appartement, maison ou bureau?",
      monthly_rent: "Quel est le montant du loyer mensuel?",
      security_deposit: "Quel est le montant du dépôt de garantie?",
      start_date: "Quelle est la date de début du bail?",
      end_date: "Quelle est la date de fin du bail?",
    },
    invoice: {
      client_name: "Quel est le nom complet du client?",
      client_email: "Quelle est l'adresse e-mail du client? (ex. john@gmail.com)",
      items: "Quel est le service ou produit? Dites la quantité, la description et le prix. Par exemple: 3 heures de design web à 50$ chacune.",
      due_date: "Quelle est la date d'échéance du paiement?",
      notes: "Des notes pour cette facture?",
    },
    bulk_message: {
      content: "Que doit dire le message?",
      subject: "Quel est le sujet du message?",
      recipients: "Qui doit le recevoir?",
      channel: "Envoyer par e-mail ou SMS?",
    },
    calendar: {
      title: "Quel est le titre de la réunion?",
      starts_at: "Quand commence la réunion?",
      ends_at: "Quand se termine-t-elle?",
      description: "Un ordre du jour ou une description?",
    },
    contact: {
      first_name: "Quel est le prénom du contact?",
      last_name: "Quel est le nom de famille du contact?",
      phone: "Quel est le numéro de téléphone du contact?",
      email: "Quelle est l'adresse e-mail du contact? (ex. john@gmail.com)",
      date_of_birth: "Quelle est la date de naissance? (dites 'skip' pour ignorer)",
      notes: "Des notes? (dites 'skip' pour ignorer)",
    },
  },

  "pt-BR": {
    agreement: {
      prompt: "Descreva o contrato em uma frase.",
      client_name: "Qual é o nome completo do cliente?",
      client_email: "Qual é o endereço de e-mail do cliente? (ex. john@gmail.com)",
      client_phone: "Qual é o número de telefone do cliente?",
      agreement_type: "Que tipo de contrato? Por exemplo: NDA, serviço ou contrato.",
      start_date: "Qual é a data de início?",
      title: "Qual deve ser o título do contrato?",
    },
    lease: {
      prompt: "Descreva o contrato de aluguel brevemente — inquilino, imóvel e aluguel.",
      tenant_name: "Qual é o nome completo do inquilino?",
      tenant_email: "Qual é o endereço de e-mail do inquilino? (ex. john@gmail.com)",
      tenant_phone: "Qual é o número de telefone do inquilino?",
      landlord_name: "Qual é o nome do proprietário?",
      property_address: "Qual é o endereço completo do imóvel?",
      property_type: "Que tipo de imóvel? Apartamento, casa ou escritório?",
      monthly_rent: "Qual é o valor do aluguel mensal?",
      security_deposit: "Qual é o valor do depósito caução?",
      start_date: "Qual é a data de início do aluguel?",
      end_date: "Qual é a data de término do aluguel?",
    },
    invoice: {
      client_name: "Qual é o nome completo do cliente?",
      client_email: "Qual é o endereço de e-mail do cliente? (ex. john@gmail.com)",
      items: "Qual é o serviço ou produto? Diga a quantidade, descrição e preço. Por exemplo: 3 horas de design web a R$50 cada.",
      due_date: "Quando vence o pagamento?",
      notes: "Alguma observação para esta fatura?",
    },
    bulk_message: {
      content: "O que a mensagem deve dizer?",
      subject: "Qual é o assunto da mensagem?",
      recipients: "Quem deve recebê-la?",
      channel: "Enviar por e-mail ou SMS?",
    },
    calendar: {
      title: "Qual é o título da reunião?",
      starts_at: "Quando a reunião começa?",
      ends_at: "Quando termina?",
      description: "Alguma pauta ou descrição?",
    },
    contact: {
      first_name: "Qual é o primeiro nome do contato?",
      last_name: "Qual é o sobrenome do contato?",
      phone: "Qual é o telefone do contato?",
      email: "Qual é o e-mail do contato? (ex. john@gmail.com)",
      date_of_birth: "Qual é a data de nascimento? (diga 'skip' para ignorar)",
      notes: "Alguma observação? (diga 'skip' para ignorar)",
    },
  },

  "ru-RU": {
    agreement: {
      prompt: "Опишите договор в одном предложении.",
      client_name: "Как полное имя клиента?",
      client_email: "Какой адрес электронной почты клиента? (напр. john@gmail.com)",
      client_phone: "Какой номер телефона клиента?",
      agreement_type: "Какой тип соглашения? Например: NDA, сервисный или контракт.",
      start_date: "Какова дата начала?",
      title: "Как должно называться соглашение?",
    },
    lease: {
      prompt: "Кратко опишите аренду — арендатор, объект и арендная плата.",
      tenant_name: "Как полное имя арендатора?",
      tenant_email: "Какой адрес электронной почты арендатора? (напр. john@gmail.com)",
      tenant_phone: "Какой номер телефона арендатора?",
      landlord_name: "Как имя арендодателя?",
      property_address: "Каков полный адрес объекта?",
      property_type: "Тип объекта? Квартира, дом или офис?",
      monthly_rent: "Какова ежемесячная арендная плата?",
      security_deposit: "Каков размер залога?",
      start_date: "Какова дата начала аренды?",
      end_date: "Какова дата окончания аренды?",
    },
    invoice: {
      client_name: "Как полное имя клиента?",
      client_email: "Какой адрес электронной почты клиента? (напр. john@gmail.com)",
      items: "Что за услуга или товар? Укажите количество, описание и цену. Например: 3 часа веб-дизайна по $50 каждый.",
      due_date: "Когда срок оплаты?",
      notes: "Есть ли примечания к счёту?",
    },
    bulk_message: {
      content: "Что должно быть в сообщении?",
      subject: "Какова тема сообщения?",
      recipients: "Кто должен его получить?",
      channel: "Отправить по электронной почте или SMS?",
    },
    calendar: {
      title: "Каково название встречи?",
      starts_at: "Когда начинается встреча?",
      ends_at: "Когда заканчивается?",
      description: "Есть ли повестка или описание?",
    },
    contact: {
      first_name: "Как имя контакта?",
      last_name: "Как фамилия контакта?",
      phone: "Какой номер телефона контакта?",
      email: "Какой адрес электронной почты контакта? (напр. john@gmail.com)",
      date_of_birth: "Какова дата рождения? (скажите 'skip' для пропуска)",
      notes: "Есть ли примечания? (скажите 'skip' для пропуска)",
    },
  },

  "ur-PK": {
    agreement: {
      prompt: "ایک جملے میں معاہدے کی وضاحت کریں۔",
      client_name: "کلائنٹ کا پورا نام کیا ہے؟",
      client_email: "کلائنٹ کا ای میل پتہ کیا ہے؟ (مثلاً john@gmail.com)",
      client_phone: "کلائنٹ کا فون نمبر کیا ہے؟",
      agreement_type: "معاہدے کی قسم کیا ہے؟ مثلاً: NDA، سروس یا کنٹریکٹ۔",
      start_date: "شروع ہونے کی تاریخ کیا ہے؟",
      title: "معاہدے کا عنوان کیا ہونا چاہیے؟",
    },
    lease: {
      prompt: "کرایہ معاہدے کا مختصر بیان دیں — کرایہ دار، پراپرٹی اور کرایہ۔",
      tenant_name: "کرایہ دار کا پورا نام کیا ہے؟",
      tenant_email: "کرایہ دار کا ای میل پتہ کیا ہے؟ (مثلاً john@gmail.com)",
      tenant_phone: "کرایہ دار کا فون نمبر کیا ہے؟",
      landlord_name: "مالک مکان کا نام کیا ہے؟",
      property_address: "پراپرٹی کا مکمل پتہ کیا ہے؟",
      property_type: "پراپرٹی کی قسم کیا ہے؟ اپارٹمنٹ، مکان یا دفتر؟",
      monthly_rent: "ماہانہ کرایہ کتنا ہے؟",
      security_deposit: "سیکیورٹی ڈپازٹ کتنا ہے؟",
      start_date: "کرایہ معاہدے کی شروع تاریخ کیا ہے؟",
      end_date: "کرایہ معاہدے کی آخری تاریخ کیا ہے؟",
    },
    invoice: {
      client_name: "کلائنٹ کا پورا نام کیا ہے؟",
      client_email: "کلائنٹ کا ای میل پتہ کیا ہے؟ (مثلاً john@gmail.com)",
      items: "سروس یا پروڈکٹ کیا ہے؟ تعداد، تفصیل اور قیمت بتائیں۔ مثلاً: 3 گھنٹے ویب ڈیزائن $50 فی گھنٹہ۔",
      due_date: "ادائیگی کی آخری تاریخ کب ہے؟",
      notes: "اس انوائس کے لیے کوئی نوٹ؟",
    },
    bulk_message: {
      content: "پیغام میں کیا لکھنا ہے؟",
      subject: "پیغام کا موضوع کیا ہے؟",
      recipients: "اسے کون وصول کرے گا؟",
      channel: "ای میل سے بھیجیں یا SMS سے؟",
    },
    calendar: {
      title: "میٹنگ کا عنوان کیا ہے؟",
      starts_at: "میٹنگ کب شروع ہوتی ہے؟",
      ends_at: "کب ختم ہوتی ہے؟",
      description: "کوئی ایجنڈا یا تفصیل؟",
    },
    contact: {
      first_name: "رابطے کا پہلا نام کیا ہے؟",
      last_name: "رابطے کا آخری نام کیا ہے؟",
      phone: "رابطے کا فون نمبر کیا ہے؟",
      email: "رابطے کا ای میل پتہ کیا ہے؟ (مثلاً john@gmail.com)",
      date_of_birth: "تاریخ پیدائش کیا ہے؟ (چھوڑنے کے لیے 'skip' کہیں)",
      notes: "کوئی نوٹ؟ (چھوڑنے کے لیے 'skip' کہیں)",
    },
  },

  "tr-TR": {
    agreement: {
      prompt: "Anlaşmayı bir cümleyle açıklayın.",
      client_name: "Müşterinin tam adı nedir?",
      client_email: "Müşterinin e-posta adresi nedir? (ör. john@gmail.com)",
      client_phone: "Müşterinin telefon numarası nedir?",
      agreement_type: "Anlaşma türü nedir? Örneğin: NDA, hizmet veya sözleşme.",
      start_date: "Başlangıç tarihi nedir?",
      title: "Anlaşmanın başlığı ne olmalı?",
    },
    lease: {
      prompt: "Kira sözleşmesini kısaca açıklayın — kiracı, mülk ve kira.",
      tenant_name: "Kiracının tam adı nedir?",
      tenant_email: "Kiracının e-posta adresi nedir? (ör. john@gmail.com)",
      tenant_phone: "Kiracının telefon numarası nedir?",
      landlord_name: "Ev sahibinin adı nedir?",
      property_address: "Mülkün tam adresi nedir?",
      property_type: "Mülk türü nedir? Daire, ev veya ofis?",
      monthly_rent: "Aylık kira tutarı nedir?",
      security_deposit: "Depozito miktarı nedir?",
      start_date: "Kira başlangıç tarihi nedir?",
      end_date: "Kira bitiş tarihi nedir?",
    },
    invoice: {
      client_name: "Müşterinin tam adı nedir?",
      client_email: "Müşterinin e-posta adresi nedir? (ör. john@gmail.com)",
      items: "Hizmet veya ürün nedir? Miktar, açıklama ve fiyatı söyleyin. Örneğin: 3 saat web tasarımı, her biri $50.",
      due_date: "Ödeme vadesi ne zaman?",
      notes: "Bu fatura için bir not var mı?",
    },
    bulk_message: {
      content: "Mesaj ne demelidir?",
      subject: "Mesajın konusu nedir?",
      recipients: "Bunu kim almalı?",
      channel: "E-posta mı yoksa SMS ile mi gönderilsin?",
    },
    calendar: {
      title: "Toplantının başlığı nedir?",
      starts_at: "Toplantı ne zaman başlar?",
      ends_at: "Ne zaman biter?",
      description: "Herhangi bir gündem veya açıklama var mı?",
    },
    contact: {
      first_name: "Kişinin adı nedir?",
      last_name: "Kişinin soyadı nedir?",
      phone: "Kişinin telefon numarası nedir?",
      email: "Kişinin e-posta adresi nedir? (ör. john@gmail.com)",
      date_of_birth: "Doğum tarihi nedir? (atlamak için 'skip' deyin)",
      notes: "Herhangi bir not? (atlamak için 'skip' deyin)",
    },
  },
};

// ─── Context ──────────────────────────────────────────────────────────────────
const LanguageContext = createContext({
  selectedLang: "en-US",
  setSelectedLang: () => {},
  currentLang: LANGUAGES[0],
  t: () => "",
  getPrompt: () => "",
  getQuestion: () => "",
});

export const LanguageProvider = ({ children }) => {
  const [selectedLang, setSelectedLangState] = useState("en-US");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v && LANGUAGES.find((l) => l.code === v)) setSelectedLangState(v);
    });
  }, []);

  const setSelectedLang = useCallback((code) => {
    setSelectedLangState(code);
    AsyncStorage.setItem(STORAGE_KEY, code).catch((_err) => {
      // language preference could not be persisted — non-fatal
    });
  }, []);

  const currentLang = LANGUAGES.find((l) => l.code === selectedLang) ?? LANGUAGES[0];

  const getPrompt = useCallback(
    (intent) =>
      INITIAL_PROMPTS_I18N[selectedLang]?.[intent] ??
      INITIAL_PROMPTS_I18N["en-US"][intent] ??
      "",
    [selectedLang],
  );

  const getQuestion = useCallback(
    (intent, fieldKey) =>
      FIELD_QUESTIONS_I18N[selectedLang]?.[intent]?.[fieldKey] ??
      FIELD_QUESTIONS_I18N["en-US"]?.[intent]?.[fieldKey] ??
      "",
    [selectedLang],
  );

  const t = useCallback(
    (key, params) => getTranslation(selectedLang, key, params),
    [selectedLang],
  );

  return (
    <LanguageContext.Provider
      value={{ selectedLang, setSelectedLang, currentLang, t, getPrompt, getQuestion }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
