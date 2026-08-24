"""Fixed phrases the AI phone agent's scheduling state machine speaks, translated for
every language OpenAI's TTS officially supports among this platform's set (see
https://developers.openai.com/api/docs/guides/text-to-speech — Bengali is not on that
list, so a Bengali caller is served in English rather than risking unsupported/garbled
TTS output).

Whisper's verbose_json response identifies the spoken language as a full lowercase
name ("english", "hindi", ...), not an ISO code — this module keys phrases by short
codes for brevity, with WHISPER_LANGUAGE_TO_CODE doing that mapping.
"""

from __future__ import annotations

WHISPER_LANGUAGE_TO_CODE: dict[str, str] = {
    "english": "en",
    "hindi": "hi",
    "arabic": "ar",
    "spanish": "es",
    "french": "fr",
    "portuguese": "pt",
    "russian": "ru",
    "urdu": "ur",
    "turkish": "tr",
    "chinese": "zh",
    "japanese": "ja",
}

DEFAULT_LANGUAGE = "en"
SUPPORTED_LANGUAGES = tuple(WHISPER_LANGUAGE_TO_CODE.values())


def resolve_call_language(whisper_language_name: str | None) -> str:
    """Map Whisper's detected language name to a phrase-table code, falling back to
    English for anything not on the supported list (including Bengali, by design)."""
    if not whisper_language_name:
        return DEFAULT_LANGUAGE
    return WHISPER_LANGUAGE_TO_CODE.get(whisper_language_name.strip().lower(), DEFAULT_LANGUAGE)


# ── Fixed scheduling-flow phrases ───────────────────────────────────────────
# {placeholders} use str.format() — kept identical across languages so PHRASES[key][lang]
# can always be called the same way regardless of language.

PHRASES: dict[str, dict[str, str]] = {
    # Split from the old single-sentence greeting so the mandatory recording
    # disclosure can be inserted right after the business is named, not before it
    # (compliance requirement) and not after the whole pitch (sounds like an
    # afterthought). See AIPhoneAgent.greet — spoken order is intro, [assistant
    # name], disclosure, then this "pitch" continuation.
    "greeting_intro_with_business": {
        "en": "Thanks for calling {business}!",
        "hi": "{business} को कॉल करने के लिए धन्यवाद!",
        "ar": "شكرًا لاتصالك بـ {business}!",
        "es": "¡Gracias por llamar a {business}!",
        "fr": "Merci d'avoir appelé {business} !",
        "pt": "Obrigado por ligar para {business}!",
        "ru": "Спасибо, что позвонили в {business}!",
        "ur": "{business} کو کال کرنے کا شکریہ!",
        "tr": "{business} işletmesini aradığınız için teşekkürler!",
        "zh": "感谢您致电{business}！",
        "ja": "{business}にお電話いただきありがとうございます！",
    },
    "greeting_intro_no_business": {
        "en": "Thanks for calling!",
        "hi": "कॉल करने के लिए धन्यवाद!",
        "ar": "شكرًا لاتصالك!",
        "es": "¡Gracias por llamar!",
        "fr": "Merci de votre appel !",
        "pt": "Obrigado por ligar!",
        "ru": "Спасибо за звонок!",
        "ur": "کال کرنے کا شکریہ!",
        "tr": "Aradığınız için teşekkürler!",
        "zh": "感谢您的来电！",
        "ja": "お電話ありがとうございます！",
    },
    "greeting_with_business": {
        "en": "I'm their assistant — I can help set up an appointment with the team. How can I help you today?",
        "hi": "मैं उनका सहायक हूं — मैं टीम के साथ अपॉइंटमेंट सेट करने में मदद कर सकता हूं। मैं आपकी कैसे मदद कर सकता हूं?",
        "ar": "أنا مساعدهم — يمكنني مساعدتك في تحديد موعد مع الفريق. كيف يمكنني مساعدتك اليوم؟",
        "es": "Soy su asistente — puedo ayudarte a programar una cita con el equipo. ¿En qué puedo ayudarte hoy?",
        "fr": "Je suis leur assistant — je peux vous aider à organiser un rendez-vous avec l'équipe. Comment puis-je vous aider aujourd'hui ?",
        "pt": "Sou o assistente deles — posso ajudar a marcar uma consulta com a equipe. Como posso ajudar hoje?",
        "ru": "Я их помощник — могу помочь записаться на приём к команде. Чем могу помочь?",
        "ur": "میں ان کا اسسٹنٹ ہوں — میں ٹیم کے ساتھ اپائنٹمنٹ طے کرنے میں مدد کر سکتا ہوں۔ میں آپ کی کیسے مدد کر سکتا ہوں؟",
        "tr": "Onların asistanıyım — ekiple bir randevu ayarlamanıza yardımcı olabilirim. Size nasıl yardımcı olabilirim?",
        "zh": "我是他们的助理——我可以帮您和团队安排预约。请问有什么可以帮您？",
        "ja": "私はアシスタントです——チームとのご予約の設定をお手伝いできます。本日はどのようなご用件でしょうか？",
    },
    "greeting_no_business": {
        "en": "I can help set up an appointment with the team — how can I help you today?",
        "hi": "मैं टीम के साथ अपॉइंटमेंट सेट करने में मदद कर सकता हूं — मैं आपकी कैसे मदद कर सकता हूं?",
        "ar": "يمكنني مساعدتك في تحديد موعد مع الفريق — كيف يمكنني مساعدتك اليوم؟",
        "es": "Puedo ayudarte a programar una cita con el equipo — ¿en qué puedo ayudarte hoy?",
        "fr": "Je peux vous aider à organiser un rendez-vous avec l'équipe — comment puis-je vous aider aujourd'hui ?",
        "pt": "Posso ajudar a marcar uma consulta com a equipe — como posso ajudar hoje?",
        "ru": "Я могу помочь записаться на приём к команде — чем могу помочь?",
        "ur": "میں ٹیم کے ساتھ اپائنٹمنٹ طے کرنے میں مدد کر سکتا ہوں — میں آپ کی کیسے مدد کر سکتا ہوں؟",
        "tr": "Ekiple bir randevu ayarlamanıza yardımcı olabilirim — size nasıl yardımcı olabilirim?",
        "zh": "我可以帮您和团队安排预约——请问有什么可以帮您？",
        "ja": "チームとのご予約の設定をお手伝いできます——本日はどのようなご用件でしょうか？",
    },
    # Spoken once per configured language at the very start of an inbound call, each
    # in its own language — a caller who does not speak the default one still has to
    # understand which key is theirs.
    "language_menu_option": {
        "en": "For English, press {digit}.",
        "hi": "हिंदी के लिए {digit} दबाएं।",
        "ar": "للعربية، اضغط {digit}.",
        "es": "Para español, marque {digit}.",
        "fr": "Pour le français, appuyez sur {digit}.",
        "pt": "Para português, pressione {digit}.",
        "ru": "Для русского языка нажмите {digit}.",
        "ur": "اردو کے لیے {digit} دبائیں۔",
        "tr": "Türkçe için {digit} tuşlayın.",
        "zh": "中文服务请按{digit}。",
        "ja": "日本語をご希望の方は{digit}を押してください。",
    },
    # Prepended to the built-in greeting when the business has named its assistant.
    "assistant_intro": {
        "en": "This is {name}.",
        "hi": "मैं {name} बोल रहा हूं।",
        "ar": "معك {name}.",
        "es": "Le habla {name}.",
        "fr": "Ici {name}.",
        "pt": "Aqui é {name}.",
        "ru": "Это {name}.",
        "ur": "میں {name} بول رہا ہوں۔",
        "tr": "Ben {name}.",
        "zh": "我是{name}。",
        "ja": "{name}です。",
    },
    # Outbound calls: the business rang the customer, so "thanks for calling" is
    # backwards — the AI has to say who is calling and why instead.
    "outbound_intro_with_business": {
        "en": "Hi, this is the assistant calling on behalf of {business}.",
        "hi": "नमस्ते, मैं {business} की ओर से सहायक बोल रहा हूं।",
        "ar": "مرحبًا، أنا المساعد وأتصل نيابة عن {business}.",
        "es": "Hola, soy el asistente y llamo de parte de {business}.",
        "fr": "Bonjour, je suis l'assistant et j'appelle de la part de {business}.",
        "pt": "Olá, sou o assistente e estou ligando em nome de {business}.",
        "ru": "Здравствуйте, это помощник, звоню от имени {business}.",
        "ur": "السلام علیکم، میں {business} کی جانب سے اسسٹنٹ بول رہا ہوں۔",
        "tr": "Merhaba, {business} adına arayan asistanım.",
        "zh": "您好，我是代表{business}致电的助理。",
        "ja": "もしもし、{business}に代わってお電話しているアシスタントです。",
    },
    "outbound_intro_no_business": {
        "en": "Hi, this is an assistant calling on behalf of the team.",
        "hi": "नमस्ते, मैं टीम की ओर से सहायक बोल रहा हूं।",
        "ar": "مرحبًا، أنا مساعد أتصل نيابة عن الفريق.",
        "es": "Hola, soy un asistente y llamo de parte del equipo.",
        "fr": "Bonjour, je suis un assistant et j'appelle de la part de l'équipe.",
        "pt": "Olá, sou um assistente e estou ligando em nome da equipe.",
        "ru": "Здравствуйте, это помощник, звоню от имени команды.",
        "ur": "السلام علیکم، میں ٹیم کی جانب سے اسسٹنٹ بول رہا ہوں۔",
        "tr": "Merhaba, ekip adına arayan bir asistanım.",
        "zh": "您好，我是代表团队致电的助理。",
        "ja": "もしもし、チームに代わってお電話しているアシスタントです。",
    },
    "outbound_greeting_with_business": {
        "en": "Do you have a moment? I can help set up an appointment with the team.",
        "hi": "क्या आपके पास एक मिनट है? मैं टीम के साथ अपॉइंटमेंट सेट करने में मदद कर सकता हूं।",
        "ar": "هل لديك دقيقة؟ يمكنني المساعدة في تحديد موعد مع الفريق.",
        "es": "¿Tienes un momento? Puedo ayudarte a programar una cita con el equipo.",
        "fr": "Avez-vous un instant ? Je peux vous aider à organiser un rendez-vous avec l'équipe.",
        "pt": "Tem um momento? Posso ajudar a marcar uma consulta com a equipe.",
        "ru": "У вас есть минутка? Я могу помочь записаться на приём к команде.",
        "ur": "کیا آپ کے پاس ایک منٹ ہے؟ میں ٹیم کے ساتھ اپائنٹمنٹ طے کرنے میں مدد کر سکتا ہوں۔",
        "tr": "Bir dakikanız var mı? Ekiple bir randevu ayarlamanıza yardımcı olabilirim.",
        "zh": "您现在方便吗？我可以帮您和团队安排预约。",
        "ja": "少しお時間よろしいでしょうか？チームとのご予約の設定をお手伝いできます。",
    },
    "outbound_greeting_no_business": {
        "en": "Do you have a moment? I can help set up an appointment.",
        "hi": "क्या आपके पास एक मिनट है? मैं अपॉइंटमेंट सेट करने में मदद कर सकता हूं।",
        "ar": "هل لديك دقيقة؟ يمكنني المساعدة في تحديد موعد.",
        "es": "¿Tienes un momento? Puedo ayudarte a programar una cita.",
        "fr": "Avez-vous un instant ? Je peux vous aider à organiser un rendez-vous.",
        "pt": "Tem um momento? Posso ajudar a marcar uma consulta.",
        "ru": "У вас есть минутка? Я могу помочь записаться на приём.",
        "ur": "کیا آپ کے پاس ایک منٹ ہے؟ میں اپائنٹمنٹ طے کرنے میں مدد کر سکتا ہوں۔",
        "tr": "Bir dakikanız var mı? Bir randevu ayarlamanıza yardımcı olabilirim.",
        "zh": "您现在方便吗？我可以帮您安排预约。",
        "ja": "少しお時間よろしいでしょうか？ご予約の設定をお手伝いできます。",
    },
    "offer_slot_first": {
        "en": "The team is free {when}. Would that work for an appointment?",
        "hi": "टीम {when} खाली है। क्या यह अपॉइंटमेंट के लिए ठीक रहेगा?",
        "ar": "الفريق متاح {when}. هل يناسبك هذا الموعد؟",
        "es": "El equipo está libre {when}. ¿Te vendría bien para una cita?",
        "fr": "L'équipe est disponible {when}. Est-ce que ça vous conviendrait pour un rendez-vous ?",
        "pt": "A equipe está livre {when}. Isso funcionaria para uma consulta?",
        "ru": "Команда свободна {when}. Подойдёт ли это время для приёма?",
        "ur": "ٹیم {when} فارغ ہے۔ کیا یہ اپائنٹمنٹ کے لیے ٹھیک رہے گا؟",
        "tr": "Ekip {when} müsait. Bu, randevu için uygun olur mu?",
        "zh": "团队在{when}有空。这个时间适合开会吗？",
        "ja": "チームは{when}に空いています。この時間でご予約は大丈夫でしょうか？",
    },
    "offer_slot_retry": {
        "en": "No problem — how about {when} instead?",
        "hi": "कोई बात नहीं — इसके बजाय {when} कैसा रहेगा?",
        "ar": "لا مشكلة — ماذا عن {when} بدلاً من ذلك؟",
        "es": "No hay problema — ¿qué tal {when} en su lugar?",
        "fr": "Pas de problème — que diriez-vous de {when} à la place ?",
        "pt": "Sem problemas — que tal {when}?",
        "ru": "Не проблема — как насчёт {when}?",
        "ur": "کوئی بات نہیں — اس کے بجائے {when} کیسا رہے گا؟",
        "tr": "Sorun değil — bunun yerine {when} nasıl olur?",
        "zh": "没问题——那{when}怎么样？",
        "ja": "問題ありません——代わりに{when}はいかがですか？",
    },
    "confirm_reask": {
        "en": "Sorry, just to confirm — would {when} work for you?",
        "hi": "माफ़ करें, बस पुष्टि के लिए — क्या {when} आपके लिए ठीक रहेगा?",
        "ar": "عذرًا، للتأكيد فقط — هل يناسبك {when}؟",
        "es": "Perdón, solo para confirmar — ¿te vendría bien {when}?",
        "fr": "Désolé, juste pour confirmer — est-ce que {when} vous conviendrait ?",
        "pt": "Desculpe, só para confirmar — {when} funciona para você?",
        "ru": "Извините, просто чтобы уточнить — вам подойдёт {when}?",
        "ur": "معذرت، بس تصدیق کے لیے — کیا {when} آپ کے لیے ٹھیک رہے گا؟",
        "tr": "Üzgünüm, sadece teyit etmek için — {when} sizin için uygun mu?",
        "zh": "抱歉，只是想确认一下——{when}对您方便吗？",
        "ja": "すみません、確認ですが——{when}でよろしいでしょうか？",
    },
    "ask_name": {
        "en": "Great — can I get your name for the appointment request?",
        "hi": "बढ़िया — क्या मुझे अपॉइंटमेंट अनुरोध के लिए आपका नाम मिल सकता है?",
        "ar": "رائع — هل يمكنني الحصول على اسمك لطلب الموعد؟",
        "es": "Genial — ¿me das tu nombre para la solicitud de cita?",
        "fr": "Parfait — puis-je avoir votre nom pour la demande de rendez-vous ?",
        "pt": "Ótimo — posso pegar seu nome para a solicitação de consulta?",
        "ru": "Отлично — подскажите, пожалуйста, ваше имя для записи на приём?",
        "ur": "بہت اچھا — کیا مجھے اپائنٹمنٹ کی درخواست کے لیے آپ کا نام مل سکتا ہے؟",
        "tr": "Harika — randevu talebi için adınızı alabilir miyim?",
        "zh": "好的——请问您的姓名，用于预约请求？",
        "ja": "かしこまりました——ご予約のため、お名前を伺えますか？",
    },
    "ask_email": {
        "en": "Thanks, {name}. And what's the best email to send the confirmation to?",
        "hi": "धन्यवाद, {name}। पुष्टि भेजने के लिए सबसे अच्छा ईमेल क्या है?",
        "ar": "شكرًا، {name}. وما هو أفضل بريد إلكتروني لإرسال التأكيد إليه؟",
        "es": "Gracias, {name}. ¿Cuál es el mejor correo electrónico para enviarte la confirmación?",
        "fr": "Merci, {name}. Quel est le meilleur e-mail pour vous envoyer la confirmation ?",
        "pt": "Obrigado, {name}. Qual é o melhor e-mail para enviar a confirmação?",
        "ru": "Спасибо, {name}. И на какой email лучше отправить подтверждение?",
        "ur": "شکریہ، {name}۔ اور تصدیق بھیجنے کے لیے بہترین ای میل کیا ہے؟",
        "tr": "Teşekkürler, {name}. Onayı göndermek için en iyi e-posta adresiniz nedir?",
        "zh": "谢谢，{name}。请问发送确认信息的最佳邮箱是？",
        "ja": "ありがとうございます、{name}様。確認メールを送るのに最適なメールアドレスを教えていただけますか？",
    },
    "ask_email_spell": {
        "en": "Sorry, I didn't quite catch that. Could you spell out your email address for me?",
        "hi": "माफ़ करें, मैं ठीक से समझ नहीं पाया। क्या आप अपना ईमेल पता स्पेल करके बता सकते हैं?",
        "ar": "عذرًا، لم أفهم ذلك تمامًا. هل يمكنك تهجئة بريدك الإلكتروني؟",
        "es": "Perdón, no lo entendí bien. ¿Podrías deletrear tu correo electrónico?",
        "fr": "Désolé, je n'ai pas bien compris. Pourriez-vous épeler votre adresse e-mail ?",
        "pt": "Desculpe, não entendi direito. Você poderia soletrar o seu e-mail?",
        "ru": "Извините, я не совсем расслышал. Не могли бы вы продиктовать email по буквам?",
        "ur": "معذرت، میں ٹھیک سے سمجھ نہیں سکا۔ کیا آپ اپنا ای میل ایڈریس ہجے کر کے بتا سکتے ہیں؟",
        "tr": "Üzgünüm, tam anlayamadım. E-posta adresinizi harf harf söyler misiniz?",
        "zh": "抱歉，我没听清楚。您能拼一下您的电子邮箱地址吗？",
        "ja": "申し訳ございません、聞き取れませんでした。メールアドレスを一文字ずつお伝えいただけますか？",
    },
    "confirm_send": {
        "en": "Got it{email_line}. So that's {when} for {name}. Should I send this request to the team?",
        "hi": "समझ गया{email_line}। तो यह {name} के लिए {when} है। क्या मैं यह अनुरोध टीम को भेज दूं?",
        "ar": "فهمت{email_line}. إذن هذا {when} لـ {name}. هل أرسل هذا الطلب إلى الفريق؟",
        "es": "Entendido{email_line}. Entonces sería {when} para {name}. ¿Envío esta solicitud al equipo?",
        "fr": "Compris{email_line}. Donc c'est {when} pour {name}. Dois-je envoyer cette demande à l'équipe ?",
        "pt": "Entendido{email_line}. Então é {when} para {name}. Posso enviar essa solicitação para a equipe?",
        "ru": "Понял{email_line}. Итак, это {when} для {name}. Отправить запрос команде?",
        "ur": "سمجھ گیا{email_line}۔ تو یہ {name} کے لیے {when} ہے۔ کیا میں یہ درخواست ٹیم کو بھیج دوں؟",
        "tr": "Anladım{email_line}. Yani {name} için {when}. Bu talebi ekibe göndereyim mi?",
        "zh": "好的{email_line}。那就是{name}的{when}。我现在把这个请求发给团队吗？",
        "ja": "承知しました{email_line}。{name}様、{when}ですね。このリクエストをチームに送信してよろしいですか？",
    },
    "confirm_reask_yesno": {
        "en": "Sorry, should I go ahead and send this appointment request to the team — yes or no?",
        "hi": "माफ़ करें, क्या मैं यह अपॉइंटमेंट अनुरोध टीम को भेज दूं — हां या नहीं?",
        "ar": "عذرًا، هل أرسل طلب الموعد هذا إلى الفريق — نعم أم لا؟",
        "es": "Perdón, ¿envío esta solicitud de cita al equipo — sí o no?",
        "fr": "Désolé, dois-je envoyer cette demande de rendez-vous à l'équipe — oui ou non ?",
        "pt": "Desculpe, devo enviar essa solicitação de consulta para a equipe — sim ou não?",
        "ru": "Извините, отправить запись на приём команде — да или нет?",
        "ur": "معذرت، کیا میں یہ اپائنٹمنٹ کی درخواست ٹیم کو بھیجوں — ہاں یا نہیں؟",
        "tr": "Üzgünüm, bu randevu talebini ekibe göndereyim mi — evet mi hayır mı?",
        "zh": "抱歉，我要把这个预约请求发给团队吗——是还是否？",
        "ja": "すみません、このご予約リクエストをチームに送信してよろしいですか——はい、いいえ？",
    },
    "sent_to_team": {
        "en": "Done — I've submitted your appointment request for {when} to the team, and they'll confirm shortly. Anything else I can help with?",
        "hi": "हो गया — मैंने यह टीम को भेज दिया है, वे जल्द ही पुष्टि करेंगे। क्या मैं किसी और चीज़ में मदद कर सकता हूं?",
        "ar": "تم — لقد أرسلت هذا إلى الفريق، وسيؤكدون قريبًا. هل هناك شيء آخر يمكنني مساعدتك به؟",
        "es": "Listo — le envié esto al equipo, y confirmarán en breve. ¿Hay algo más en lo que pueda ayudarte?",
        "fr": "C'est fait — j'ai envoyé ceci à l'équipe, qui confirmera sous peu. Puis-je vous aider avec autre chose ?",
        "pt": "Pronto — enviei isso para a equipe, e eles confirmarão em breve. Posso ajudar com mais alguma coisa?",
        "ru": "Готово — я отправил это команде, они скоро подтвердят. Могу ли я ещё чем-то помочь?",
        "ur": "ہو گیا — میں نے یہ ٹیم کو بھیج دیا ہے، وہ جلد تصدیق کریں گے۔ کیا میں کسی اور چیز میں مدد کر سکتا ہوں؟",
        "tr": "Tamamdır — bunu ekibe gönderdim, kısa süre içinde onaylayacaklar. Başka bir konuda yardımcı olabilir miyim?",
        "zh": "好了——我已经把这个发给团队了，他们很快会确认。还有什么我可以帮您的吗？",
        "ja": "完了しました——チームに送信しましたので、まもなく確認のご連絡があります。他に何かお手伝いできることはございますか？",
    },
    "meeting_booked_direct": {
        "en": "Great news — your appointment for {when} is confirmed and booked on our calendar! Anything else I can help with?",
        "hi": "बढ़िया खबर — {when} के लिए आपकी अपॉइंटमेंट हमारे कैलेंडर पर कंफर्म और बुक हो गई है! क्या मैं किसी और चीज़ में मदद कर सकता हूं?",
        "ar": "أخبار رائعة — تم تأكيد موعدك في {when} وحجزه على تقويمنا! هل هناك شيء آخر يمكنني مساعدتك به؟",
        "es": "¡Buenas noticias! Tu cita para {when} está confirmada y reservada en nuestro calendario. ¿Hay algo más en lo que pueda ayudarte?",
        "fr": "Excellente nouvelle — votre rendez-vous pour {when} est confirmé et réservé sur notre calendrier ! Puis-je vous aider avec autre chose ?",
        "pt": "Ótimas notícias — sua consulta para {when} está confirmada e agendada em nosso calendário! Posso ajudar com mais alguma coisa?",
        "ru": "Отличные новости — ваш приём на {when} подтверждён и забронирован в нашем календаре! Могу ли я ещё чем-то помочь?",
        "ur": "بہت اچھی خبر — {when} کے لیے آپ کی اپائنٹمنٹ ہمارے کیلنڈر پر تصدیق شدہ اور بک ہو گئی ہے! کیا میں کسی اور چیز میں مدد کر سکتا ہوں؟",
        "tr": "Harika haber — {when} için randevunuz onaylandı ve takvimimize eklendi! Başka bir konuda yardımcı olabilir miyim?",
        "zh": "好消息——您在{when}的预约已确认并添加到我们的日历中！还有什么我可以帮您的吗？",
        "ja": "朗報です——{when}のご予約が確認され、カレンダーに登録されました！他に何かお手伝いできることはございますか？",
    },
    "declined_send": {
        "en": "No problem, I won't send that. Anything else I can help with?",
        "hi": "कोई बात नहीं, मैं इसे नहीं भेजूंगा। क्या मैं किसी और चीज़ में मदद कर सकता हूं?",
        "ar": "لا مشكلة، لن أرسل ذلك. هل هناك شيء آخر يمكنني مساعدتك به؟",
        "es": "No hay problema, no lo enviaré. ¿Hay algo más en lo que pueda ayudarte?",
        "fr": "Pas de problème, je ne l'enverrai pas. Puis-je vous aider avec autre chose ?",
        "pt": "Sem problemas, não vou enviar isso. Posso ajudar com mais alguma coisa?",
        "ru": "Хорошо, не буду отправлять. Могу ли я ещё чем-то помочь?",
        "ur": "کوئی بات نہیں، میں یہ نہیں بھیجوں گا۔ کیا میں کسی اور چیز میں مدد کر سکتا ہوں؟",
        "tr": "Sorun değil, bunu göndermeyeceğim. Başka bir konuda yardımcı olabilir miyim?",
        "zh": "没问题，我不会发送。还有什么我可以帮您的吗？",
        "ja": "承知しました、送信いたしません。他に何かお手伝いできることはございますか？",
    },
    "no_slots_this_week": {
        "en": "I'm sorry, I don't see any open times in the next week. Someone from the team will follow up with you directly.",
        "hi": "क्षमा करें, मुझे अगले सप्ताह कोई खाली समय नहीं दिख रहा। टीम से कोई सीधे आपसे संपर्क करेगा।",
        "ar": "آسف، لا أرى أي مواعيد متاحة في الأسبوع القادم. سيتواصل معك أحد أفراد الفريق مباشرة.",
        "es": "Lo siento, no veo horarios disponibles la próxima semana. Alguien del equipo se comunicará contigo directamente.",
        "fr": "Désolé, je ne vois pas de créneaux disponibles la semaine prochaine. Quelqu'un de l'équipe vous recontactera directement.",
        "pt": "Desculpe, não vejo horários disponíveis na próxima semana. Alguém da equipe entrará em contato diretamente.",
        "ru": "Извините, на следующей неделе свободных мест нет. Кто-то из команды свяжется с вами напрямую.",
        "ur": "معذرت، مجھے اگلے ہفتے کوئی خالی وقت نظر نہیں آ رہا۔ ٹیم سے کوئی براہ راست آپ سے رابطہ کرے گا۔",
        "tr": "Üzgünüm, önümüzdeki hafta uygun bir zaman göremiyorum. Ekipten biri sizinle doğrudan iletişime geçecek.",
        "zh": "抱歉，未来一周没有空余时间。团队成员会直接与您联系。",
        "ja": "申し訳ございません、来週の空き時間が見つかりません。チームメンバーが直接ご連絡いたします。",
    },
    "gave_up_after_retries": {
        "en": "I'm having trouble finding a time that works. Someone from the team will call you back to sort out a time.",
        "hi": "मुझे कोई उपयुक्त समय ढूंढने में परेशानी हो रही है। टीम से कोई आपको वापस कॉल करके समय तय करेगा।",
        "ar": "أواجه صعوبة في إيجاد وقت مناسب. سيتصل بك أحد أفراد الفريق لتحديد الموعد.",
        "es": "Estoy teniendo problemas para encontrar un horario que funcione. Alguien del equipo te devolverá la llamada para acordar un horario.",
        "fr": "J'ai du mal à trouver un créneau qui convient. Quelqu'un de l'équipe vous rappellera pour convenir d'un horaire.",
        "pt": "Estou com dificuldade para encontrar um horário. Alguém da equipe ligará de volta para combinar um horário.",
        "ru": "Мне не удаётся найти подходящее время. Кто-то из команды перезвонит вам, чтобы согласовать время.",
        "ur": "مجھے کوئی مناسب وقت تلاش کرنے میں مشکل ہو رہی ہے۔ ٹیم سے کوئی آپ کو واپس کال کر کے وقت طے کرے گا۔",
        "tr": "Uygun bir zaman bulmakta zorlanıyorum. Ekipten biri sizi arayarak bir zaman ayarlayacak.",
        "zh": "我暂时找不到合适的时间。团队成员会给您回电安排时间。",
        "ja": "都合の良い時間が見つかりませんでした。チームメンバーが折り返しお電話して、日時を調整いたします。",
    },
    "did_not_understand": {
        "en": "I'm sorry, could you say that again?",
        "hi": "क्षमा करें, क्या आप इसे फिर से कह सकते हैं?",
        "ar": "آسف، هل يمكنك إعادة ذلك؟",
        "es": "Lo siento, ¿podrías repetir eso?",
        "fr": "Désolé, pourriez-vous répéter ?",
        "pt": "Desculpe, você poderia repetir isso?",
        "ru": "Извините, не могли бы вы повторить?",
        "ur": "معذرت، کیا آپ دوبارہ کہہ سکتے ہیں؟",
        "tr": "Üzgünüm, tekrar söyler misiniz?",
        "zh": "抱歉，您能再说一遍吗？",
        "ja": "申し訳ございません、もう一度おっしゃっていただけますか？",
    },
    "recording_disclosure": {
        "en": "Quick note — this call may be recorded for quality and training purposes.",
        "hi": "एक सूचना — गुणवत्ता और प्रशिक्षण उद्देश्यों के लिए यह कॉल रिकॉर्ड की जा सकती है।",
        "ar": "ملاحظة سريعة — قد يتم تسجيل هذه المكالمة لأغراض الجودة والتدريب.",
        "es": "Una nota — esta llamada puede ser grabada con fines de calidad y capacitación.",
        "fr": "Petite précision — cet appel peut être enregistré à des fins de qualité et de formation.",
        "pt": "Um aviso rápido — esta ligação pode ser gravada para fins de qualidade e treinamento.",
        "ru": "Небольшое уточнение — этот звонок может быть записан в целях контроля качества и обучения.",
        "ur": "ایک مختصر نوٹ — یہ کال کوالٹی اور تربیت کے مقاصد کے لیے ریکارڈ کی جا سکتی ہے۔",
        "tr": "Kısa bir not — bu görüşme kalite ve eğitim amacıyla kaydedilebilir.",
        "zh": "温馨提示——本次通话可能会被录音，用于质量与培训目的。",
        "ja": "ご案内— この通話は品質向上およびトレーニングのために録音される場合があります。",
    },
    "technical_issue": {
        "en": "I'm very sorry, we're having a technical issue on our end right now. Please try calling back in a few minutes. Goodbye.",
        "hi": "मुझे बहुत खेद है, अभी हमारी ओर से एक तकनीकी समस्या आ रही है। कृपया कुछ मिनटों में फिर से कॉल करने का प्रयास करें। अलविदा।",
        "ar": "أنا آسف جدًا، نواجه مشكلة تقنية من جانبنا الآن. يرجى المحاولة مرة أخرى بعد بضع دقائق. مع السلامة.",
        "es": "Lo siento mucho, estamos teniendo un problema técnico en este momento. Por favor, intenta llamar de nuevo en unos minutos. Adiós.",
        "fr": "Je suis vraiment désolé, nous rencontrons un problème technique en ce moment. Veuillez rappeler dans quelques minutes. Au revoir.",
        "pt": "Sinto muito, estamos com um problema técnico no momento. Por favor, tente ligar novamente em alguns minutos. Até logo.",
        "ru": "Мне очень жаль, сейчас у нас возникла техническая проблема. Пожалуйста, перезвоните через несколько минут. До свидания.",
        "ur": "مجھے بہت افسوس ہے، ابھی ہماری طرف سے ایک تکنیکی مسئلہ ہو رہا ہے۔ براہ کرم چند منٹوں میں دوبارہ کال کریں۔ خدا حافظ۔",
        "tr": "Çok özür dilerim, şu anda bizde teknik bir sorun yaşanıyor. Lütfen birkaç dakika sonra tekrar arayın. Hoşça kalın.",
        "zh": "非常抱歉，我们这边目前遇到技术问题。请稍后几分钟再拨打。再见。",
        "ja": "大変申し訳ございません、現在こちらで技術的な問題が発生しております。数分後に再度おかけ直しください。失礼いたします。",
    },
}


# ── Date/time phrase names, for _friendly_slot ──────────────────────────────

WEEKDAYS: dict[str, list[str]] = {
    "en": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    "hi": ["सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"],
    "ar": ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"],
    "es": ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"],
    "fr": ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"],
    "pt": ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"],
    "ru": ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"],
    "ur": ["پیر", "منگل", "بدھ", "جمعرات", "جمعہ", "ہفتہ", "اتوار"],
    "tr": ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"],
    "zh": ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"],
    "ja": ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"],
}

MONTHS: dict[str, list[str]] = {
    "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    "hi": ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"],
    "ar": ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
    "es": ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    "fr": ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
    "pt": ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
    "ru": ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
    "ur": ["جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون", "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر"],
    "tr": ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
    "zh": ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
    "ja": ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
}

# "{weekday}, {month} {day} at {time}" doesn't read naturally in every language (word
# order, particles) — each language gets its own template built from the same parts.
DATE_TEMPLATES: dict[str, str] = {
    "en": "{weekday}, {month} {day} at {time}",
    "hi": "{weekday}, {day} {month} को {time} बजे",
    "ar": "{weekday} {day} {month} الساعة {time}",
    "es": "el {weekday} {day} de {month} a las {time}",
    "fr": "{weekday} {day} {month} à {time}",
    "pt": "{weekday}, {day} de {month} às {time}",
    "ru": "{weekday}, {day} {month} в {time}",
    "ur": "{weekday}، {day} {month} کو {time} بجے",
    "tr": "{day} {month} {weekday}, saat {time}",
    "zh": "{month}{day}日{weekday} {time}",
    "ja": "{month}{day}日（{weekday}）{time}",
}


# ── Intent-detection keywords, per language ─────────────────────────────────
# Once the AI is speaking a caller's language, their "yes"/"no"/"I'd like to
# schedule..." comes back in that language too — the English-only keyword lists this
# state machine started with would silently stop recognizing anything.

SCHEDULING_KEYWORDS: dict[str, tuple[str, ...]] = {
    "en": ("schedule", "meeting", "appointment", "book", "available", "availability", "free time", "set up a call", "talk to someone", "speak to someone"),
    "hi": ("मीटिंग", "अपॉइंटमेंट", "समय", "बुक", "उपलब्ध", "बात करनी है"),
    "ar": ("موعد", "اجتماع", "حجز", "متاح", "أتحدث مع أحد"),
    "es": ("reunión", "cita", "reservar", "disponible", "agendar", "hablar con alguien"),
    "fr": ("réunion", "rendez-vous", "réserver", "disponible", "planifier", "parler à quelqu'un"),
    "pt": ("reunião", "compromisso", "agendar", "disponível", "marcar", "falar com alguém"),
    "ru": ("встреча", "записаться", "свободн", "назначить", "поговорить с кем-то"),
    "ur": ("میٹنگ", "اپائنٹمنٹ", "وقت", "بک", "دستیاب", "بات کرنی ہے"),
    "tr": ("toplantı", "randevu", "rezervasyon", "müsait", "ayarlamak", "biriyle konuşmak"),
    "zh": ("会议", "预约", "安排", "有空", "见面", "找人聊聊"),
    "ja": ("会議", "打ち合わせ", "予約", "空いて", "設定", "話したい"),
}

AFFIRMATIVE_WORDS: dict[str, tuple[str, ...]] = {
    "en": ("yes", "yeah", "yep", "sure", "ok", "okay", "sounds good", "correct", "right"),
    "hi": ("हां", "जी हां", "ठीक है", "बिल्कुल", "सही है"),
    "ar": ("نعم", "أجل", "حسنًا", "تمام", "أكيد"),
    "es": ("sí", "claro", "vale", "de acuerdo", "correcto"),
    "fr": ("oui", "d'accord", "bien sûr", "exact", "ok"),
    "pt": ("sim", "claro", "certo", "ok", "combinado"),
    "ru": ("да", "конечно", "хорошо", "ладно", "точно"),
    "ur": ("ہاں", "جی ہاں", "ٹھیک ہے", "بالکل", "درست"),
    "tr": ("evet", "tamam", "olur", "kesinlikle", "doğru"),
    "zh": ("是", "好的", "可以", "没问题", "对"),
    "ja": ("はい", "そうです", "大丈夫です", "いいです", "お願いします"),
}

NEGATIVE_WORDS: dict[str, tuple[str, ...]] = {
    "en": ("no", "nope", "not really", "don't", "dont"),
    "hi": ("नहीं", "जी नहीं"),
    "ar": ("لا", "لا شكرًا"),
    "es": ("no",),
    "fr": ("non",),
    "pt": ("não",),
    "ru": ("нет",),
    "ur": ("نہیں",),
    "tr": ("hayır", "yok"),
    "zh": ("不", "不行", "不要"),
    "ja": ("いいえ", "だめ", "結構です"),
}


def matches_any(text: str, language: str, table: dict[str, tuple[str, ...]]) -> bool:
    """Checks text against a language's keyword list, falling back to English's list
    too — a caller mid-switch between languages, or a Whisper mis-detection on a
    short utterance, still gets recognized rather than stalling the conversation."""
    lowered = text.lower().strip()
    keywords = set(table.get(language, ())) | set(table.get(DEFAULT_LANGUAGE, ()))
    return any(keyword in lowered for keyword in keywords)


def phrase(key: str, language: str, **kwargs) -> str:
    """Look up a translated phrase, falling back to English if the language or key
    isn't found (should never happen for a supported language, but never crash a
    live call over a missing translation)."""
    table = PHRASES.get(key)
    if not table:
        return ""
    template = table.get(language) or table.get(DEFAULT_LANGUAGE, "")
    try:
        return template.format(**kwargs)
    except (KeyError, IndexError):
        return template
