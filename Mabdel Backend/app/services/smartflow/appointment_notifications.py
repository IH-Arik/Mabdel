"""Tell the customer by SMS whenever their appointment is booked, requested, moved,
cancelled or declined - whether the AI receptionist or a team member made the change.

The text is not sent directly: it is written as an outbound message in the customer's
SMS thread in Unified, so it goes out through the normal SMS path (the business's own
number, delivery receipts, a readable failure reason) and the team sees it in the inbox.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from bson import ObjectId

from app.utils.helpers import utc_now

from .conversation_service import ConversationService

logger = logging.getLogger(__name__)

KINDS = ("booked", "pending", "rescheduled", "cancelled", "declined")

TEMPLATES: dict[str, dict[str, str]] = {
    "en": {
        "booked": "{business}: your appointment is confirmed for {when}.",
        "pending": "{business}: we received your request for {when}. We'll confirm by text shortly.",
        "rescheduled": "{business}: your appointment has been moved to {when}.",
        "cancelled": "{business}: your appointment on {when} has been cancelled. Call us any time to book a new one.",
        "declined": "{business}: sorry, we can't confirm {when}. Please call us to find another time.",
    },
    "es": {
        "booked": "{business}: tu cita está confirmada para el {when}.",
        "pending": "{business}: recibimos tu solicitud para el {when}. Te confirmaremos por mensaje en breve.",
        "rescheduled": "{business}: tu cita se ha cambiado al {when}.",
        "cancelled": "{business}: tu cita del {when} ha sido cancelada. Llámanos cuando quieras para reservar otra.",
        "declined": "{business}: lo sentimos, no podemos confirmar el {when}. Llámanos para buscar otra hora.",
    },
    "fr": {
        "booked": "{business} : votre rendez-vous est confirmé pour le {when}.",
        "pending": "{business} : nous avons reçu votre demande pour le {when}. Nous vous confirmerons par SMS très vite.",
        "rescheduled": "{business} : votre rendez-vous a été déplacé au {when}.",
        "cancelled": "{business} : votre rendez-vous du {when} est annulé. Appelez-nous pour en prendre un autre.",
        "declined": "{business} : désolé, nous ne pouvons pas confirmer le {when}. Appelez-nous pour trouver un autre créneau.",
    },
    "pt": {
        "booked": "{business}: sua consulta está confirmada para {when}.",
        "pending": "{business}: recebemos seu pedido para {when}. Confirmaremos por mensagem em breve.",
        "rescheduled": "{business}: sua consulta foi remarcada para {when}.",
        "cancelled": "{business}: sua consulta de {when} foi cancelada. Ligue quando quiser para marcar outra.",
        "declined": "{business}: desculpe, não conseguimos confirmar {when}. Ligue para encontrarmos outro horário.",
    },
    "hi": {
        "booked": "{business}: आपका अपॉइंटमेंट {when} के लिए पक्का है।",
        "pending": "{business}: {when} के लिए आपका अनुरोध मिल गया है। हम जल्द ही SMS से पुष्टि करेंगे।",
        "rescheduled": "{business}: आपका अपॉइंटमेंट अब {when} पर है।",
        "cancelled": "{business}: {when} का आपका अपॉइंटमेंट रद्द कर दिया गया है। नया समय लेने के लिए कभी भी कॉल करें।",
        "declined": "{business}: माफ़ कीजिए, {when} की पुष्टि नहीं हो सकी। दूसरा समय तय करने के लिए कॉल करें।",
    },
    "ur": {
        "booked": "{business}: آپ کی اپائنٹمنٹ {when} کے لیے کنفرم ہے۔",
        "pending": "{business}: {when} کے لیے آپ کی درخواست موصول ہو گئی ہے۔ ہم جلد SMS سے تصدیق کریں گے۔",
        "rescheduled": "{business}: آپ کی اپائنٹمنٹ اب {when} پر ہے۔",
        "cancelled": "{business}: {when} کی آپ کی اپائنٹمنٹ منسوخ کر دی گئی ہے۔ نیا وقت لینے کے لیے کسی بھی وقت کال کریں۔",
        "declined": "{business}: معذرت، ہم {when} کی تصدیق نہیں کر سکے۔ دوسرا وقت طے کرنے کے لیے کال کریں۔",
    },
    "ar": {
        "booked": "{business}: تم تأكيد موعدك في {when}.",
        "pending": "{business}: استلمنا طلبك لموعد {when}. سنؤكد لك برسالة قريبًا.",
        "rescheduled": "{business}: تم نقل موعدك إلى {when}.",
        "cancelled": "{business}: تم إلغاء موعدك في {when}. اتصل بنا في أي وقت لحجز موعد جديد.",
        "declined": "{business}: عذرًا، لا يمكننا تأكيد موعد {when}. اتصل بنا لاختيار وقت آخر.",
    },
    "ru": {
        "booked": "{business}: ваша запись подтверждена на {when}.",
        "pending": "{business}: мы получили вашу заявку на {when}. Скоро подтвердим по SMS.",
        "rescheduled": "{business}: ваша запись перенесена на {when}.",
        "cancelled": "{business}: ваша запись на {when} отменена. Звоните в любое время, чтобы записаться снова.",
        "declined": "{business}: к сожалению, мы не можем подтвердить {when}. Позвоните нам, чтобы выбрать другое время.",
    },
    "tr": {
        "booked": "{business}: randevunuz {when} için onaylandı.",
        "pending": "{business}: {when} için talebinizi aldık. Kısa süre içinde SMS ile onaylayacağız.",
        "rescheduled": "{business}: randevunuz {when} tarihine taşındı.",
        "cancelled": "{business}: {when} tarihli randevunuz iptal edildi. Yeni randevu için dilediğiniz zaman arayın.",
        "declined": "{business}: üzgünüz, {when} için onay veremiyoruz. Başka bir saat için bizi arayın.",
    },
    "zh": {
        "booked": "{business}：您的预约已确认，时间为 {when}。",
        "pending": "{business}：我们已收到您 {when} 的预约请求，稍后会发短信确认。",
        "rescheduled": "{business}：您的预约已改到 {when}。",
        "cancelled": "{business}：您 {when} 的预约已取消。欢迎随时来电重新预约。",
        "declined": "{business}：抱歉，无法确认 {when} 的预约。请来电另约时间。",
    },
    "ja": {
        "booked": "{business}：ご予約を {when} で確定しました。",
        "pending": "{business}：{when} のご予約リクエストを受け付けました。まもなく SMS で確定のご連絡をします。",
        "rescheduled": "{business}：ご予約を {when} に変更しました。",
        "cancelled": "{business}：{when} のご予約はキャンセルされました。新しいご予約はいつでもお電話ください。",
        "declined": "{business}：申し訳ありませんが、{when} のご予約は確定できませんでした。別の日時をお電話でご相談ください。",
    },
}


def format_when(value: datetime, tz_name: str | None, language: str = "en") -> str:
    """The appointment time as the customer should read it: in the business's own
    timezone (stored times are UTC), never the server's."""
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    try:
        tz = ZoneInfo(tz_name or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        tz = ZoneInfo("UTC")
    aware = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    local = aware.astimezone(tz)
    if language == "en":
        return local.strftime("%a %b %d at %I:%M %p").replace(" 0", " ")
    return local.strftime("%d/%m/%Y %H:%M")


class AppointmentNotifier(ConversationService):
    async def notify(
        self,
        owner_user_id: str,
        *,
        kind: str,
        phone: str | None,
        name: str | None,
        starts_at: datetime,
        language: str | None = None,
        meeting_link: str | None = None,
    ) -> str | None:
        """Queue the SMS in the customer's thread. Returns the message id, or None when
        there is nobody to text. Never raises - a courtesy text must not undo a booking."""
        if kind not in KINDS:
            return None
        number = self._normalize_phone_value(phone or "")
        if not number or not ObjectId.is_valid(owner_user_id or ""):
            return None
        try:
            owner = await self._get_user_document(owner_user_id)
            organization_id = owner.get("organization_id")
            org = await self.db.organizations.find_one({"organization_id": organization_id}) if organization_id else None
            business = (org or {}).get("business_name") or owner.get("business_name") or owner.get("full_name") or "Your appointment"
            tz_name = ((org or {}).get("business_hours") or {}).get("timezone")
            templates = TEMPLATES.get(language or "en", TEMPLATES["en"])
            text = templates[kind].format(business=business, when=format_when(starts_at, tz_name, language if language in TEMPLATES else "en"))
            if meeting_link and kind in ("booked", "rescheduled"):
                text += f" {meeting_link}"

            conversation_id, contact_id = await self._sms_thread(owner_user_id, organization_id, number, name)
            message = await self.create_message(
                owner_user_id,
                {
                    "conversation_id": conversation_id,
                    "contact_id": contact_id,
                    "platform": "sms",
                    "direction": "outbound",
                    "content": text,
                    "automated": True,
                },
            )
            return message.get("id")
        except Exception:
            logger.warning("Could not queue the %s appointment text", kind, exc_info=True)
            return None

    async def sms_contact_id(self, owner_user_id: str, phone: str | None, name: str | None) -> str | None:
        """The CRM contact for a phone number (created if needed), for linking a booking."""
        number = self._normalize_phone_value(phone or "")
        if not number:
            return None
        organization_id = await self._resolve_organization_id(owner_user_id)
        _, contact_id = await self._sms_thread(owner_user_id, organization_id, number, name, create_conversation=False)
        return contact_id

    async def _sms_thread(
        self, owner_user_id: str, organization_id: str | None, number: str, name: str | None, *, create_conversation: bool = True
    ) -> tuple[str | None, str]:
        now = utc_now()
        contact = await self.db.contacts.find_one(
            {"user_id": owner_user_id, "identities": {"$elemMatch": {"platform": "sms", "external_id": number}}}
        ) or await self.db.contacts.find_one({"user_id": owner_user_id, "phone": number})
        if contact:
            if not any(identity.get("platform") == "sms" for identity in contact.get("identities") or []):
                await self.db.contacts.update_one(
                    {"_id": contact["_id"]},
                    {"$addToSet": {"identities": {"platform": "sms", "external_id": number, "handle": None}}},
                )
        else:
            contact = {
                "user_id": owner_user_id,
                "name": (name or "").strip() or "SMS Contact",
                "email": None,
                "phone": number,
                "avatar_url": None,
                "identities": [{"platform": "sms", "external_id": number, "handle": None}],
                "presence": "offline",
                "created_at": now,
                "updated_at": now,
            }
            contact["_id"] = (await self.db.contacts.insert_one(contact)).inserted_id
        contact_id = str(contact["_id"])
        if not create_conversation:
            return None, contact_id

        conversation = await self.db.conversations.find_one({"user_id": owner_user_id, "contact_id": contact_id, "platform": "sms"})
        if not conversation:
            conversation = {
                "user_id": owner_user_id,
                "organization_id": organization_id,
                "title": contact.get("name"),
                "contact_id": contact_id,
                "type": "direct",
                "platform": "sms",
                "member_ids": [owner_user_id],
                "assigned_to": None,
                "archived": False,
                "created_at": now,
                "updated_at": now,
                "last_message_at": now,
            }
            conversation["_id"] = (await self.db.conversations.insert_one(conversation)).inserted_id
        return str(conversation["_id"]), contact_id
