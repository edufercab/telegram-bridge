export type Lang = 'en' | 'es' | 'zh' | 'hi' | 'ar' | 'fr'

export const SUPPORTED_LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'zh', label: '中文（简体）' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
]

interface BotMessages {
  unauthorized: string
  notAvailable: string
  textOnly: string
  messageReceived: string
}

const botMessages: Record<Lang, BotMessages> = {
  en: {
    unauthorized: 'Unauthorized.',
    notAvailable: 'Claude is not available right now. 🔴',
    textOnly: 'Only text messages are supported.',
    messageReceived: 'Message received ✓',
  },
  es: {
    unauthorized: 'No autorizado.',
    notAvailable: 'Claude no está disponible ahora mismo. 🔴',
    textOnly: 'Solo se admiten mensajes de texto.',
    messageReceived: 'Mensaje recibido ✓',
  },
  zh: {
    unauthorized: '未授权。',
    notAvailable: 'Claude 当前不可用。🔴',
    textOnly: '仅支持文本消息。',
    messageReceived: '消息已收到 ✓',
  },
  hi: {
    unauthorized: 'अनधिकृत।',
    notAvailable: 'Claude अभी उपलब्ध नहीं है। 🔴',
    textOnly: 'केवल टेक्स्ट संदेश समर्थित हैं।',
    messageReceived: 'संदेश प्राप्त हुआ ✓',
  },
  ar: {
    unauthorized: 'غير مصرح.',
    notAvailable: 'Claude غير متاح الآن. 🔴',
    textOnly: 'الرسائل النصية فقط مدعومة.',
    messageReceived: 'تم استلام الرسالة ✓',
  },
  fr: {
    unauthorized: 'Non autorisé.',
    notAvailable: "Claude n'est pas disponible pour l'instant. 🔴",
    textOnly: 'Seuls les messages texte sont pris en charge.',
    messageReceived: 'Message reçu ✓',
  },
}

export function getBotMessages(lang: Lang): BotMessages {
  return botMessages[lang]
}
