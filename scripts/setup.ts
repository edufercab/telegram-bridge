#!/usr/bin/env tsx
/**
 * Interactive setup wizard for telegram-bridge.
 * Run with: pnpm setup
 */

import { createInterface } from 'readline/promises'
import { randomBytes } from 'crypto'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { Lang } from '../src/lib/i18n'

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
}

const ok   = (msg: string) => console.log(`  ${c.green}✓${c.reset} ${msg}`)
const warn = (msg: string) => console.log(`  ${c.yellow}⚠${c.reset}  ${msg}`)
const fail = (msg: string) => console.log(`  ${c.red}✗${c.reset} ${msg}`)
const info = (msg: string) => console.log(`  ${c.dim}${msg}${c.reset}`)
const step = (n: number, total: number, msg: string) =>
  console.log(`\n${c.bold}${c.cyan}[${n}/${total}]${c.reset} ${c.bold}${msg}${c.reset}`)

// ─── i18n ─────────────────────────────────────────────────────────────────────

interface T {
  // Language selector
  selectLanguage: string

  // Guards
  mustRunFromRoot: string
  envAlreadyExists: string
  overwriteAndReconfigure: string
  nothingChanged: string

  // Step names
  stepPrerequisites: string
  stepApiKey: string
  stepBotToken: string
  stepChatId: string
  stepConfiguration: string
  stepAutostart: string

  // Step 1
  nodeVersionOk: (v: string) => string
  nodeTooOld: (v: string) => string

  // Step 2
  generatingApiKey: string
  apiKeyGenerated: string

  // Step 3
  botTokenInstructions: string
  botTokenExample: string
  pasteBotToken: string
  tokenCannotBeEmpty: string
  tokenFormatWarning: string
  validatingToken: string
  botVerified: (username: string) => string
  tokenRejected: string
  configuringBot: string
  botConfigured: string

  // Step 4
  chatIdInstructions: (username: string) => string
  waitingForMessage: string
  timedOut: string
  findChatIdManually: string
  enterChatIdManually: string
  invalidChatId: string
  chatIdDetected: (id: number) => string

  // Step 5
  serverPort: string
  sessionTimeout: string
  envCreated: string
  building: string
  buildComplete: string
  buildFailed: string
  shellVarsAdded: (file: string) => string
  shellVarsAlreadyPresent: (file: string) => string
  claudeMdCreated: string
  claudeMdUpdated: string
  claudeMdAlreadyPresent: string

  // Step 6
  setupSystemdQuestion: string
  systemdCommandsHeader: string
  serviceFileWritten: (p: string) => string

  // Done
  setupComplete: string
  labelStartServer: string
  labelTestIt: string
  labelReloadShell: string
  labelThenFromClaude: string
  reloadShellCmd: (file: string) => string
  thenFromClaudeCmd: (dir: string) => string

  // Misc
  fatalError: string
  enterNumber: string
  invalidChoice: string
  yesNo: string
  yesNoDefault: (def: 'y' | 'n') => string
}

const translations: Record<Lang, T> = {
  en: {
    selectLanguage: 'Select your language',
    mustRunFromRoot: 'Run this script from the telegram-bridge repo root.',
    envAlreadyExists: '.env already exists.',
    overwriteAndReconfigure: 'Overwrite and reconfigure?',
    nothingChanged: 'Nothing changed. Exiting.',
    stepPrerequisites: 'Prerequisites',
    stepApiKey: 'API Key',
    stepBotToken: 'Telegram Bot Token',
    stepChatId: 'Your Telegram Chat ID',
    stepConfiguration: 'Configuration',
    stepAutostart: 'Autostart (optional)',
    nodeVersionOk: (v) => `Node.js ${v}`,
    nodeTooOld: (v) => `Node.js 20+ required (found ${v}). Install via nvm: nvm install 20`,
    generatingApiKey: 'Generating a secure 32-byte API key...',
    apiKeyGenerated: 'API_KEY generated',
    botTokenInstructions: 'Open Telegram → search @BotFather → send /newbot → copy the token.',
    botTokenExample: 'Example: 110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw',
    pasteBotToken: 'Paste your bot token',
    tokenCannotBeEmpty: 'Token cannot be empty.',
    tokenFormatWarning: 'This doesn\'t look like a bot token (expected: 123456789:ABC…). Trying anyway…',
    validatingToken: 'Validating token with Telegram API…',
    botVerified: (u) => `Bot @${u} verified`,
    tokenRejected: 'Token rejected by Telegram. Check for typos and try again.',
    configuringBot: 'Setting bot name and description…',
    botConfigured: 'Bot profile configured',
    chatIdInstructions: (u) => `Open Telegram, find your bot @${u}, and send it any message.`,
    waitingForMessage: 'Waiting up to 2 minutes…',
    timedOut: 'Timed out waiting for a message.',
    findChatIdManually: 'Find your Chat ID manually with:',
    enterChatIdManually: 'Enter your Chat ID manually',
    invalidChatId: 'Invalid Chat ID. Exiting.',
    chatIdDetected: (id) => `Chat ID detected: ${id}`,
    serverPort: 'Server port',
    sessionTimeout: 'Session auto-expire after N minutes of inactivity',
    envCreated: '.env created  (mode 600 — readable only by you)',
    building: 'Building TypeScript…',
    buildComplete: 'Build complete',
    buildFailed: 'Build failed',
    shellVarsAdded: (f) => `Shell env vars added to ${f}`,
    shellVarsAlreadyPresent: (f) => `Shell env vars already present in ${f} — skipped`,
    claudeMdCreated: '~/.claude/CLAUDE.md created with bridge instructions',
    claudeMdUpdated: '~/.claude/CLAUDE.md updated with bridge instructions',
    claudeMdAlreadyPresent: '~/.claude/CLAUDE.md already has the bridge section — skipped',
    setupSystemdQuestion: 'Set up systemd service so the bridge starts on boot?',
    systemdCommandsHeader: 'Run these commands to install the systemd service:',
    serviceFileWritten: (p) => `Service file written to: ${p}`,
    setupComplete: 'Setup complete!',
    labelStartServer: 'Start the server:',
    labelTestIt: 'Test it:',
    labelReloadShell: 'Reload your shell to pick up the new env vars:',
    labelThenFromClaude: 'Then from any Claude Code session:',
    reloadShellCmd: (f) => `source ${f}`,
    thenFromClaudeCmd: (d) => `node ${d}/claude-sdk/dist/cli.js connect`,
    fatalError: 'Fatal',
    enterNumber: 'Enter number',
    invalidChoice: 'Invalid choice.',
    yesNo: 'y/n',
    yesNoDefault: (d) => d === 'y' ? 'Y/n' : 'y/N',
  },

  es: {
    selectLanguage: 'Elige tu idioma',
    mustRunFromRoot: 'Ejecuta este script desde la raíz del repositorio telegram-bridge.',
    envAlreadyExists: 'El archivo .env ya existe.',
    overwriteAndReconfigure: '¿Sobreescribir y reconfigurar?',
    nothingChanged: 'Sin cambios. Saliendo.',
    stepPrerequisites: 'Requisitos previos',
    stepApiKey: 'Clave API',
    stepBotToken: 'Token del bot de Telegram',
    stepChatId: 'Tu Chat ID de Telegram',
    stepConfiguration: 'Configuración',
    stepAutostart: 'Inicio automático (opcional)',
    nodeVersionOk: (v) => `Node.js ${v}`,
    nodeTooOld: (v) => `Se requiere Node.js 20+ (encontrado ${v}). Instala con nvm: nvm install 20`,
    generatingApiKey: 'Generando una clave API segura de 32 bytes...',
    apiKeyGenerated: 'API_KEY generada',
    botTokenInstructions: 'Abre Telegram → busca @BotFather → envía /newbot → copia el token.',
    botTokenExample: 'Ejemplo: 110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw',
    pasteBotToken: 'Pega tu token del bot',
    tokenCannotBeEmpty: 'El token no puede estar vacío.',
    tokenFormatWarning: 'Esto no parece un token de bot (formato esperado: 123456789:ABC…). Intentando igualmente…',
    validatingToken: 'Validando token con la API de Telegram…',
    botVerified: (u) => `Bot @${u} verificado`,
    tokenRejected: 'Token rechazado por Telegram. Revisa si hay errores tipográficos.',
    configuringBot: 'Configurando nombre y descripción del bot…',
    botConfigured: 'Perfil del bot configurado',
    chatIdInstructions: (u) => `Abre Telegram, busca tu bot @${u} y envíale cualquier mensaje.`,
    waitingForMessage: 'Esperando hasta 2 minutos…',
    timedOut: 'Tiempo de espera agotado.',
    findChatIdManually: 'Encuentra tu Chat ID manualmente con:',
    enterChatIdManually: 'Introduce tu Chat ID manualmente',
    invalidChatId: 'Chat ID inválido. Saliendo.',
    chatIdDetected: (id) => `Chat ID detectado: ${id}`,
    serverPort: 'Puerto del servidor',
    sessionTimeout: 'Expirar sesión tras N minutos de inactividad',
    envCreated: '.env creado  (modo 600 — solo tú puedes leerlo)',
    building: 'Compilando TypeScript…',
    buildComplete: 'Compilación completada',
    buildFailed: 'Error en la compilación',
    shellVarsAdded: (f) => `Variables de entorno añadidas a ${f}`,
    shellVarsAlreadyPresent: (f) => `Variables de entorno ya presentes en ${f} — omitido`,
    claudeMdCreated: '~/.claude/CLAUDE.md creado con las instrucciones del bridge',
    claudeMdUpdated: '~/.claude/CLAUDE.md actualizado con las instrucciones del bridge',
    claudeMdAlreadyPresent: '~/.claude/CLAUDE.md ya tiene la sección del bridge — omitido',
    setupSystemdQuestion: '¿Configurar servicio systemd para que el bridge arranque al inicio?',
    systemdCommandsHeader: 'Ejecuta estos comandos para instalar el servicio systemd:',
    serviceFileWritten: (p) => `Archivo de servicio escrito en: ${p}`,
    setupComplete: '¡Configuración completada!',
    labelStartServer: 'Inicia el servidor:',
    labelTestIt: 'Pruébalo:',
    labelReloadShell: 'Recarga tu shell para activar las nuevas variables de entorno:',
    labelThenFromClaude: 'Luego, desde cualquier sesión de Claude Code:',
    reloadShellCmd: (f) => `source ${f}`,
    thenFromClaudeCmd: (d) => `node ${d}/claude-sdk/dist/cli.js connect`,
    fatalError: 'Error fatal',
    enterNumber: 'Introduce un número',
    invalidChoice: 'Opción inválida.',
    yesNo: 's/n',
    yesNoDefault: (d) => d === 'y' ? 'S/n' : 's/N',
  },

  zh: {
    selectLanguage: '选择语言',
    mustRunFromRoot: '请从 telegram-bridge 仓库根目录运行此脚本。',
    envAlreadyExists: '.env 文件已存在。',
    overwriteAndReconfigure: '覆盖并重新配置？',
    nothingChanged: '未做任何更改，退出。',
    stepPrerequisites: '前提条件',
    stepApiKey: 'API 密钥',
    stepBotToken: 'Telegram 机器人令牌',
    stepChatId: '你的 Telegram Chat ID',
    stepConfiguration: '配置',
    stepAutostart: '开机自启（可选）',
    nodeVersionOk: (v) => `Node.js ${v}`,
    nodeTooOld: (v) => `需要 Node.js 20+（当前版本 ${v}）。通过 nvm 安装：nvm install 20`,
    generatingApiKey: '正在生成 32 字节安全 API 密钥...',
    apiKeyGenerated: 'API_KEY 已生成',
    botTokenInstructions: '打开 Telegram → 搜索 @BotFather → 发送 /newbot → 复制令牌。',
    botTokenExample: '示例：110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw',
    pasteBotToken: '粘贴你的机器人令牌',
    tokenCannotBeEmpty: '令牌不能为空。',
    tokenFormatWarning: '这看起来不像机器人令牌（预期格式：123456789:ABC…）。仍将尝试…',
    validatingToken: '正在通过 Telegram API 验证令牌…',
    botVerified: (u) => `机器人 @${u} 验证成功`,
    tokenRejected: 'Telegram 拒绝了该令牌，请检查是否有拼写错误。',
    configuringBot: '正在设置机器人名称和简介…',
    botConfigured: '机器人资料已配置',
    chatIdInstructions: (u) => `打开 Telegram，找到你的机器人 @${u}，向它发送任意消息。`,
    waitingForMessage: '等待最长 2 分钟…',
    timedOut: '等待消息超时。',
    findChatIdManually: '手动获取 Chat ID：',
    enterChatIdManually: '手动输入你的 Chat ID',
    invalidChatId: 'Chat ID 无效，退出。',
    chatIdDetected: (id) => `检测到 Chat ID：${id}`,
    serverPort: '服务器端口',
    sessionTimeout: '无活动 N 分钟后自动终止会话',
    envCreated: '.env 已创建（权限 600 — 仅你可读）',
    building: '正在编译 TypeScript…',
    buildComplete: '编译完成',
    buildFailed: '编译失败',
    shellVarsAdded: (f) => `环境变量已添加到 ${f}`,
    shellVarsAlreadyPresent: (f) => `${f} 中已存在环境变量 — 已跳过`,
    claudeMdCreated: '已创建 ~/.claude/CLAUDE.md 并写入 bridge 使用说明',
    claudeMdUpdated: '已更新 ~/.claude/CLAUDE.md，写入 bridge 使用说明',
    claudeMdAlreadyPresent: '~/.claude/CLAUDE.md 已包含 bridge 配置 — 已跳过',
    setupSystemdQuestion: '是否配置 systemd 服务以实现开机自启？',
    systemdCommandsHeader: '运行以下命令安装 systemd 服务：',
    serviceFileWritten: (p) => `服务文件已写入：${p}`,
    setupComplete: '配置完成！',
    labelStartServer: '启动服务器：',
    labelTestIt: '测试：',
    labelReloadShell: '重新加载 Shell 以应用新的环境变量：',
    labelThenFromClaude: '然后在任意 Claude Code 会话中：',
    reloadShellCmd: (f) => `source ${f}`,
    thenFromClaudeCmd: (d) => `node ${d}/claude-sdk/dist/cli.js connect`,
    fatalError: '致命错误',
    enterNumber: '输入数字',
    invalidChoice: '无效选项。',
    yesNo: 'y/n',
    yesNoDefault: (d) => d === 'y' ? 'Y/n' : 'y/N',
  },

  hi: {
    selectLanguage: 'अपनी भाषा चुनें',
    mustRunFromRoot: 'इस स्क्रिप्ट को telegram-bridge रिपो की रूट डायरेक्टरी से चलाएँ।',
    envAlreadyExists: '.env फ़ाइल पहले से मौजूद है।',
    overwriteAndReconfigure: 'ओवरराइट करें और पुनः कॉन्फ़िगर करें?',
    nothingChanged: 'कोई बदलाव नहीं। बाहर निकल रहे हैं।',
    stepPrerequisites: 'पूर्वापेक्षाएँ',
    stepApiKey: 'API कुंजी',
    stepBotToken: 'Telegram Bot टोकन',
    stepChatId: 'आपका Telegram Chat ID',
    stepConfiguration: 'कॉन्फ़िगरेशन',
    stepAutostart: 'स्वतः प्रारंभ (वैकल्पिक)',
    nodeVersionOk: (v) => `Node.js ${v}`,
    nodeTooOld: (v) => `Node.js 20+ आवश्यक है (मिला: ${v})। nvm से इंस्टॉल करें: nvm install 20`,
    generatingApiKey: '32-बाइट सुरक्षित API कुंजी बना रहे हैं...',
    apiKeyGenerated: 'API_KEY बन गई',
    botTokenInstructions: 'Telegram खोलें → @BotFather खोजें → /newbot भेजें → टोकन कॉपी करें।',
    botTokenExample: 'उदाहरण: 110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw',
    pasteBotToken: 'अपना bot टोकन पेस्ट करें',
    tokenCannotBeEmpty: 'टोकन खाली नहीं हो सकता।',
    tokenFormatWarning: 'यह bot टोकन जैसा नहीं दिखता (अपेक्षित: 123456789:ABC…)। फिर भी प्रयास कर रहे हैं…',
    validatingToken: 'Telegram API से टोकन सत्यापित किया जा रहा है…',
    botVerified: (u) => `Bot @${u} सत्यापित हो गया`,
    tokenRejected: 'Telegram ने टोकन अस्वीकार कर दिया। टाइपिंग की गलतियाँ जाँचें।',
    configuringBot: 'Bot का नाम और विवरण सेट किया जा रहा है…',
    botConfigured: 'Bot प्रोफ़ाइल कॉन्फ़िगर हो गया',
    chatIdInstructions: (u) => `Telegram खोलें, अपना bot @${u} ढूँढें और उसे कोई भी संदेश भेजें।`,
    waitingForMessage: '2 मिनट तक प्रतीक्षा कर रहे हैं…',
    timedOut: 'संदेश की प्रतीक्षा में समय समाप्त।',
    findChatIdManually: 'Chat ID मैन्युअल रूप से प्राप्त करें:',
    enterChatIdManually: 'अपना Chat ID मैन्युअल दर्ज करें',
    invalidChatId: 'अमान्य Chat ID। बाहर निकल रहे हैं।',
    chatIdDetected: (id) => `Chat ID मिली: ${id}`,
    serverPort: 'सर्वर पोर्ट',
    sessionTimeout: 'N मिनट निष्क्रियता के बाद सत्र स्वतः समाप्त करें',
    envCreated: '.env बन गई  (mode 600 — केवल आप पढ़ सकते हैं)',
    building: 'TypeScript कंपाइल हो रहा है…',
    buildComplete: 'बिल्ड पूरी हुई',
    buildFailed: 'बिल्ड विफल रही',
    shellVarsAdded: (f) => `Shell वेरिएबल ${f} में जोड़े गए`,
    shellVarsAlreadyPresent: (f) => `${f} में Shell वेरिएबल पहले से हैं — छोड़ा गया`,
    claudeMdCreated: '~/.claude/CLAUDE.md बनाई गई और bridge निर्देश लिखे गए',
    claudeMdUpdated: '~/.claude/CLAUDE.md अपडेट की गई',
    claudeMdAlreadyPresent: '~/.claude/CLAUDE.md में bridge सेक्शन पहले से है — छोड़ा गया',
    setupSystemdQuestion: 'बूट पर bridge स्वतः शुरू करने के लिए systemd सेवा सेट करें?',
    systemdCommandsHeader: 'systemd सेवा इंस्टॉल करने के लिए ये कमांड चलाएँ:',
    serviceFileWritten: (p) => `सेवा फ़ाइल यहाँ लिखी गई: ${p}`,
    setupComplete: 'सेटअप पूर्ण!',
    labelStartServer: 'सर्वर शुरू करें:',
    labelTestIt: 'परीक्षण करें:',
    labelReloadShell: 'नई env वेरिएबल के लिए shell रीलोड करें:',
    labelThenFromClaude: 'फिर किसी भी Claude Code सत्र से:',
    reloadShellCmd: (f) => `source ${f}`,
    thenFromClaudeCmd: (d) => `node ${d}/claude-sdk/dist/cli.js connect`,
    fatalError: 'गंभीर त्रुटि',
    enterNumber: 'नंबर दर्ज करें',
    invalidChoice: 'अमान्य विकल्प।',
    yesNo: 'h/n',
    yesNoDefault: (d) => d === 'y' ? 'H/n' : 'h/N',
  },

  ar: {
    selectLanguage: 'اختر لغتك',
    mustRunFromRoot: 'شغّل هذا السكريبت من المجلد الجذري لمستودع telegram-bridge.',
    envAlreadyExists: 'ملف .env موجود بالفعل.',
    overwriteAndReconfigure: 'هل تريد الكتابة فوقه وإعادة الضبط؟',
    nothingChanged: 'لم يتغير شيء. جارٍ الخروج.',
    stepPrerequisites: 'المتطلبات الأساسية',
    stepApiKey: 'مفتاح API',
    stepBotToken: 'رمز بوت Telegram',
    stepChatId: 'معرّف دردشتك على Telegram',
    stepConfiguration: 'الإعداد',
    stepAutostart: 'التشغيل التلقائي (اختياري)',
    nodeVersionOk: (v) => `Node.js ${v}`,
    nodeTooOld: (v) => `مطلوب Node.js 20+ (الإصدار الحالي: ${v}). ثبّته عبر nvm: nvm install 20`,
    generatingApiKey: 'جارٍ توليد مفتاح API آمن من 32 بايت...',
    apiKeyGenerated: 'تم توليد API_KEY',
    botTokenInstructions: 'افتح Telegram ← ابحث عن @BotFather ← أرسل /newbot ← انسخ الرمز.',
    botTokenExample: 'مثال: 110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw',
    pasteBotToken: 'الصق رمز البوت',
    tokenCannotBeEmpty: 'لا يمكن أن يكون الرمز فارغاً.',
    tokenFormatWarning: 'لا يبدو هذا رمز بوت صحيحاً (الصيغة المتوقعة: 123456789:ABC…). جارٍ المحاولة على أي حال…',
    validatingToken: 'جارٍ التحقق من الرمز عبر Telegram API…',
    botVerified: (u) => `تم التحقق من البوت @${u}`,
    tokenRejected: 'رفض Telegram الرمزَ. تحقق من عدم وجود أخطاء إملائية.',
    configuringBot: 'جارٍ ضبط اسم البوت ووصفه…',
    botConfigured: 'تم ضبط ملف البوت',
    chatIdInstructions: (u) => `افتح Telegram، ابحث عن البوت @${u} وأرسل له أي رسالة.`,
    waitingForMessage: 'في انتظار رسالة (مدة أقصاها دقيقتان)…',
    timedOut: 'انتهت مهلة الانتظار.',
    findChatIdManually: 'ابحث عن Chat ID يدوياً باستخدام:',
    enterChatIdManually: 'أدخل Chat ID يدوياً',
    invalidChatId: 'Chat ID غير صالح. جارٍ الخروج.',
    chatIdDetected: (id) => `تم اكتشاف Chat ID: ${id}`,
    serverPort: 'منفذ الخادم',
    sessionTimeout: 'إنهاء الجلسة تلقائياً بعد N دقيقة من عدم النشاط',
    envCreated: 'تم إنشاء .env  (الصلاحية 600 — لا يقرأه إلا أنت)',
    building: 'جارٍ تصريف TypeScript…',
    buildComplete: 'اكتمل البناء',
    buildFailed: 'فشل البناء',
    shellVarsAdded: (f) => `تمت إضافة متغيرات البيئة إلى ${f}`,
    shellVarsAlreadyPresent: (f) => `متغيرات البيئة موجودة بالفعل في ${f} — تم التخطي`,
    claudeMdCreated: 'تم إنشاء ~/.claude/CLAUDE.md وإضافة تعليمات البريدج',
    claudeMdUpdated: 'تم تحديث ~/.claude/CLAUDE.md بتعليمات البريدج',
    claudeMdAlreadyPresent: '~/.claude/CLAUDE.md يحتوي على قسم البريدج بالفعل — تم التخطي',
    setupSystemdQuestion: 'هل تريد إعداد خدمة systemd لتشغيل البريدج تلقائياً عند الإقلاع؟',
    systemdCommandsHeader: 'شغّل هذه الأوامر لتثبيت خدمة systemd:',
    serviceFileWritten: (p) => `تم كتابة ملف الخدمة في: ${p}`,
    setupComplete: 'اكتمل الإعداد!',
    labelStartServer: 'شغّل الخادم:',
    labelTestIt: 'اختبره:',
    labelReloadShell: 'أعد تحميل الـ shell لتفعيل متغيرات البيئة الجديدة:',
    labelThenFromClaude: 'ثم من أي جلسة Claude Code:',
    reloadShellCmd: (f) => `source ${f}`,
    thenFromClaudeCmd: (d) => `node ${d}/claude-sdk/dist/cli.js connect`,
    fatalError: 'خطأ فادح',
    enterNumber: 'أدخل رقماً',
    invalidChoice: 'خيار غير صالح.',
    yesNo: 'n/y',
    yesNoDefault: (d) => d === 'y' ? 'Y/n' : 'y/N',
  },

  fr: {
    selectLanguage: 'Choisissez votre langue',
    mustRunFromRoot: 'Exécutez ce script depuis la racine du dépôt telegram-bridge.',
    envAlreadyExists: 'Le fichier .env existe déjà.',
    overwriteAndReconfigure: 'Écraser et reconfigurer ?',
    nothingChanged: 'Aucun changement. Fermeture.',
    stepPrerequisites: 'Prérequis',
    stepApiKey: 'Clé API',
    stepBotToken: 'Token du bot Telegram',
    stepChatId: 'Votre Chat ID Telegram',
    stepConfiguration: 'Configuration',
    stepAutostart: 'Démarrage automatique (optionnel)',
    nodeVersionOk: (v) => `Node.js ${v}`,
    nodeTooOld: (v) => `Node.js 20+ requis (trouvé ${v}). Installez via nvm : nvm install 20`,
    generatingApiKey: 'Génération d\'une clé API sécurisée de 32 octets...',
    apiKeyGenerated: 'API_KEY générée',
    botTokenInstructions: 'Ouvrez Telegram → cherchez @BotFather → envoyez /newbot → copiez le token.',
    botTokenExample: 'Exemple : 110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw',
    pasteBotToken: 'Collez votre token de bot',
    tokenCannotBeEmpty: 'Le token ne peut pas être vide.',
    tokenFormatWarning: 'Ceci ne ressemble pas à un token de bot (attendu : 123456789:ABC…). Tentative quand même…',
    validatingToken: 'Validation du token via l\'API Telegram…',
    botVerified: (u) => `Bot @${u} vérifié`,
    tokenRejected: 'Token rejeté par Telegram. Vérifiez les fautes de frappe.',
    configuringBot: 'Configuration du nom et de la description du bot…',
    botConfigured: 'Profil du bot configuré',
    chatIdInstructions: (u) => `Ouvrez Telegram, trouvez votre bot @${u} et envoyez-lui n'importe quel message.`,
    waitingForMessage: 'Attente jusqu\'à 2 minutes…',
    timedOut: 'Délai d\'attente dépassé.',
    findChatIdManually: 'Trouvez votre Chat ID manuellement avec :',
    enterChatIdManually: 'Entrez votre Chat ID manuellement',
    invalidChatId: 'Chat ID invalide. Fermeture.',
    chatIdDetected: (id) => `Chat ID détecté : ${id}`,
    serverPort: 'Port du serveur',
    sessionTimeout: 'Expiration de session après N minutes d\'inactivité',
    envCreated: '.env créé  (mode 600 — lisible uniquement par vous)',
    building: 'Compilation TypeScript…',
    buildComplete: 'Compilation terminée',
    buildFailed: 'Échec de la compilation',
    shellVarsAdded: (f) => `Variables d'environnement ajoutées dans ${f}`,
    shellVarsAlreadyPresent: (f) => `Variables d'environnement déjà présentes dans ${f} — ignoré`,
    claudeMdCreated: '~/.claude/CLAUDE.md créé avec les instructions du bridge',
    claudeMdUpdated: '~/.claude/CLAUDE.md mis à jour avec les instructions du bridge',
    claudeMdAlreadyPresent: '~/.claude/CLAUDE.md contient déjà la section bridge — ignoré',
    setupSystemdQuestion: 'Configurer un service systemd pour démarrer le bridge au démarrage ?',
    systemdCommandsHeader: 'Exécutez ces commandes pour installer le service systemd :',
    serviceFileWritten: (p) => `Fichier de service écrit dans : ${p}`,
    setupComplete: 'Configuration terminée !',
    labelStartServer: 'Démarrez le serveur :',
    labelTestIt: 'Testez :',
    labelReloadShell: 'Rechargez votre shell pour activer les nouvelles variables d\'environnement :',
    labelThenFromClaude: 'Puis depuis n\'importe quelle session Claude Code :',
    reloadShellCmd: (f) => `source ${f}`,
    thenFromClaudeCmd: (d) => `node ${d}/claude-sdk/dist/cli.js connect`,
    fatalError: 'Erreur fatale',
    enterNumber: 'Entrez un numéro',
    invalidChoice: 'Choix invalide.',
    yesNo: 'o/n',
    yesNoDefault: (d) => d === 'y' ? 'O/n' : 'o/N',
  },
}

// ─── Readline ─────────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout })

async function ask(question: string, defaultValue?: string): Promise<string> {
  const hint = defaultValue ? ` ${c.dim}[${defaultValue}]${c.reset}` : ''
  const answer = await rl.question(`  ${c.yellow}?${c.reset} ${question}${hint}: `)
  return answer.trim() || defaultValue || ''
}

async function confirm(question: string, t: T, defaultYes = false): Promise<boolean> {
  const hint = t.yesNoDefault(defaultYes ? 'y' : 'n')
  const answer = await rl.question(`  ${c.yellow}?${c.reset} ${question} (${hint}): `)
  if (!answer.trim()) return defaultYes
  return answer.trim().toLowerCase().startsWith('y') ||
         answer.trim().toLowerCase().startsWith('s') ||  // sí
         answer.trim().toLowerCase().startsWith('h') ||  // हाँ
         answer.trim().toLowerCase().startsWith('o')     // oui
}

async function pickLanguage(): Promise<Lang> {
  const langs: { code: Lang; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'zh', label: '中文（简体）' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'ar', label: 'العربية' },
    { code: 'fr', label: 'Français' },
  ]

  console.log(`\n  Select your language / Elige tu idioma / 选择语言 / भाषा चुनें / اختر لغتك / Choisissez votre langue\n`)
  langs.forEach(({ label }, i) => {
    console.log(`  ${c.cyan}${i + 1}${c.reset}  ${label}`)
  })
  console.log('')

  while (true) {
    const raw = await rl.question(`  ${c.yellow}?${c.reset} Enter number / Introduce número / 输入数字 / नंबर / رقم / Numéro [1]: `)
    const n = parseInt(raw.trim() || '1', 10)
    if (n >= 1 && n <= langs.length) return langs[n - 1]!.code
    console.log(`  ${c.red}✗${c.reset}  1–${langs.length}`)
  }
}

// ─── Telegram API ─────────────────────────────────────────────────────────────

interface TgResponse<T> { ok: boolean; result?: T; description?: string }
interface Update {
  update_id: number
  message?: { message_id: number; chat: { id: number; username?: string }; text?: string }
}

async function tgGet<T>(token: string, method: string, params: Record<string, string | number> = {}): Promise<TgResponse<T>> {
  const url = new URL(`https://api.telegram.org/bot${token}/${method}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const res = await fetch(url.toString())
  return res.json() as Promise<TgResponse<T>>
}

const BOT_TOKEN_RE = /^\d{8,12}:[A-Za-z0-9_-]{35,}$/

function looksLikeBotToken(token: string): boolean {
  return BOT_TOKEN_RE.test(token)
}

async function validateBotToken(token: string): Promise<{ valid: boolean; username?: string }> {
  try {
    const res = await tgGet<{ username: string }>(token, 'getMe')
    return res.ok && res.result ? { valid: true, username: res.result.username } : { valid: false }
  } catch { return { valid: false } }
}

async function configureBot(token: string): Promise<void> {
  const name = 'Claude Bridge'
  const description = [
    '⚡ Claude Code bridge — stay in the loop while Claude works.',
    '',
    'Claude connects when it starts a task, sends you progress updates, reads your replies, and disconnects when done.',
    '',
    'When Claude is not active, this bot stays silent. 🔴',
  ].join('\n')
  const shortDescription = 'Get Telegram updates from Claude Code while it works on your machine.'

  await Promise.allSettled([
    tgGet(token, 'setMyName', { name }),
    tgGet(token, 'setMyDescription', { description }),
    tgGet(token, 'setMyShortDescription', { short_description: shortDescription }),
  ])
}

async function detectChatId(token: string, timeoutSeconds = 120): Promise<number | null> {
  const initial = await tgGet<Update[]>(token, 'getUpdates', { limit: 1 })
  const existing = initial.result ?? []
  const offset = existing.length > 0 ? (existing[existing.length - 1]!.update_id + 1) : 0
  const deadline = Date.now() + timeoutSeconds * 1000

  while (Date.now() < deadline) {
    const remaining = Math.ceil((deadline - Date.now()) / 1000)
    const pollTimeout = Math.min(30, remaining)
    if (pollTimeout <= 0) break
    try {
      const res = await tgGet<Update[]>(token, 'getUpdates', {
        offset, timeout: pollTimeout, allowed_updates: 'message',
      })
      const updates = res.result ?? []
      if (updates.length > 0 && updates[0]?.message) return updates[0].message.chat.id
    } catch { await new Promise(r => setTimeout(r, 2000)) }
  }
  return null
}

// ─── File helpers ─────────────────────────────────────────────────────────────

function writeEnv(values: Record<string, string | number>): void {
  const lines = [
    '# Generated by telegram-bridge setup wizard',
    `# Created: ${new Date().toISOString()}`,
    '',
    ...Object.entries(values).map(([k, v]) => `${k}=${v}`),
  ]
  fs.writeFileSync('.env', lines.join('\n') + '\n', { mode: 0o600 })
}

function detectShellRcFile(): string {
  const shell = process.env['SHELL'] ?? ''
  if (shell.includes('zsh')) return path.join(os.homedir(), '.zshrc')
  return path.join(os.homedir(), '.bashrc')
}

function addEnvToShell(rcFile: string, vars: Record<string, string>): boolean {
  const marker = '# telegram-bridge'
  const existing = fs.existsSync(rcFile) ? fs.readFileSync(rcFile, 'utf8') : ''
  if (existing.includes(marker)) return false
  const block = ['', marker, ...Object.entries(vars).map(([k, v]) => `export ${k}="${v}"`), ''].join('\n')
  fs.appendFileSync(rcFile, block)
  return true
}

const CLAUDE_MD_MARKER = '## Telegram Bridge'

function buildClaudeMdBlock(installDir: string): string {
  const cliPath = path.join(installDir, 'claude-sdk', 'dist', 'cli.js')
  const serverPath = path.join(installDir, 'dist', 'index.js')
  return `
## Telegram Bridge

A local bridge at \`${installDir}\` lets you send updates to the user via Telegram and read their replies bidirectionally.

**Activate only when the user explicitly asks you to connect.**

### Starting the server

Always check if the server is running before connecting. If it is not, start it:

\`\`\`bash
# Check
curl -s http://localhost:3001/health | grep -q '"status":"ok"' && echo running || echo stopped

# Start in background if stopped
nohup node ${serverPath} >> ${installDir}/server.log 2>&1 &
\`\`\`

Wait 2 seconds after starting, then verify with the health check before proceeding.

### CLI

\`\`\`bash
node ${cliPath} <command>
\`\`\`

| Command | What it does |
|---------|-------------|
| \`status\` | Check server and session state |
| \`connect\` | Start session — bot becomes active |
| \`disconnect\` | End session — bot goes silent |
| \`send "text"\` | Send a message to the user on Telegram |
| \`send-photo <path|url> ["caption"]\` | Send an image |
| \`inbox\` | Read queued messages from the user (JSON) |
| \`read <id>\` | Mark a message as read |

### Workflow

1. Check server is running (start it if not)
2. \`connect\` → sends "🟢 Claude connected." to the user
3. Work autonomously; call \`send\` at key milestones
4. Call \`inbox\` before each response to check for user input
5. Call \`read <id>\` to acknowledge each message
6. \`disconnect\` when done → sends "🔴 Session closed."

**Disconnect triggers**: inbox message containing "stop", "disconnect", "bye", or "pause".
`
}

function updateClaudeMd(installDir: string): { updated: boolean; created: boolean } {
  const claudeMdPath = path.join(os.homedir(), '.claude', 'CLAUDE.md')
  const block = buildClaudeMdBlock(installDir)
  if (!fs.existsSync(claudeMdPath)) {
    fs.mkdirSync(path.dirname(claudeMdPath), { recursive: true })
    fs.writeFileSync(claudeMdPath, `# Claude Global Configuration\n${block}`)
    return { updated: false, created: true }
  }
  const existing = fs.readFileSync(claudeMdPath, 'utf8')
  if (existing.includes(CLAUDE_MD_MARKER)) return { updated: false, created: false }
  fs.appendFileSync(claudeMdPath, block)
  return { updated: true, created: false }
}

function buildSystemdUnit(installDir: string): string {
  return `[Unit]
Description=Telegram Bridge
After=network.target

[Service]
Type=simple
User=${os.userInfo().username}
WorkingDirectory=${installDir}
ExecStart=${process.execPath} dist/index.js
Restart=always
RestartSec=5
EnvironmentFile=${installDir}/.env

[Install]
WantedBy=multi-user.target
`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.clear()
  console.log(`${c.bold}${c.blue}
  ████████╗███████╗██╗      ███████╗ ██████╗ ██████╗  █████╗ ███╗   ███╗
     ██╔══╝██╔════╝██║      ██╔════╝██╔════╝ ██╔══██╗██╔══██╗████╗ ████║
     ██║   █████╗  ██║█████╗█████╗  ██║  ███╗██████╔╝███████║██╔████╔██║
     ██║   ██╔══╝  ██║╚════╝██╔══╝  ██║   ██║██╔══██╗██╔══██║██║╚██╔╝██║
     ██║   ███████╗███████╗ ███████╗╚██████╔╝██║  ██║██║  ██║██║ ╚═╝ ██║
     ╚═╝   ╚══════╝╚══════╝ ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝
                         BRIDGE — Setup Wizard
${c.reset}`)

  // ── Language selection — FIRST thing, before anything else ─────────────────
  const lang = await pickLanguage()
  const t = translations[lang]

  console.log('')

  // ── Guard: repo root ───────────────────────────────────────────────────────
  if (!fs.existsSync('package.json') || !fs.existsSync('src/index.ts')) {
    fail(t.mustRunFromRoot)
    rl.close()
    process.exit(1)
  }

  const installDir = process.cwd()
  const TOTAL = 6

  // ── Existing .env ──────────────────────────────────────────────────────────
  if (fs.existsSync('.env')) {
    warn(t.envAlreadyExists)
    const overwrite = await confirm(t.overwriteAndReconfigure, t, false)
    if (!overwrite) {
      console.log(`\n  ${t.nothingChanged}\n`)
      rl.close()
      return
    }
  }

  // ── Step 1: Prerequisites ──────────────────────────────────────────────────
  step(1, TOTAL, t.stepPrerequisites)
  const nodeVer = process.versions.node
  if (parseInt(nodeVer.split('.')[0]!, 10) < 20) {
    fail(t.nodeTooOld(nodeVer))
    rl.close()
    process.exit(1)
  }
  ok(t.nodeVersionOk(nodeVer))

  // ── Step 2: API Key ────────────────────────────────────────────────────────
  step(2, TOTAL, t.stepApiKey)
  info(t.generatingApiKey)
  const apiKey = randomBytes(32).toString('hex')
  ok(`${t.apiKeyGenerated}  ${c.dim}(${apiKey.slice(0, 8)}…)${c.reset}`)

  // ── Step 3: Bot Token ──────────────────────────────────────────────────────
  step(3, TOTAL, t.stepBotToken)
  info(t.botTokenInstructions)
  info(t.botTokenExample)
  info('')

  let botToken = ''
  let botUsername = ''
  while (true) {
    botToken = await ask(t.pasteBotToken)
    if (!botToken) { fail(t.tokenCannotBeEmpty); continue }
    if (!looksLikeBotToken(botToken)) warn(t.tokenFormatWarning)
    process.stdout.write(`  ${c.dim}${t.validatingToken}${c.reset}\r`)
    const check = await validateBotToken(botToken)
    process.stdout.write(' '.repeat(70) + '\r')
    if (check.valid) {
      botUsername = check.username ?? 'unknown'
      ok(t.botVerified(botUsername))
      process.stdout.write(`  ${c.dim}${t.configuringBot}${c.reset}\r`)
      await configureBot(botToken)
      process.stdout.write(' '.repeat(70) + '\r')
      ok(t.botConfigured)
      break
    }
    fail(t.tokenRejected)
  }

  // ── Step 4: Chat ID ────────────────────────────────────────────────────────
  step(4, TOTAL, t.stepChatId)
  info(t.chatIdInstructions(botUsername))
  info(t.waitingForMessage)
  info('')

  let chatId: number
  const detected = await detectChatId(botToken, 120)

  if (!detected) {
    fail(t.timedOut)
    info('')
    info(t.findChatIdManually)
    info(`  curl "https://api.telegram.org/bot${botToken}/getUpdates" | jq '.result[0].message.chat.id'`)
    const manual = await ask(t.enterChatIdManually)
    const parsed = parseInt(manual, 10)
    if (isNaN(parsed)) { fail(t.invalidChatId); rl.close(); process.exit(1) }
    chatId = parsed
  } else {
    chatId = detected
  }
  ok(t.chatIdDetected(chatId))

  // ── Step 5: Configuration ──────────────────────────────────────────────────
  step(5, TOTAL, t.stepConfiguration)

  const portStr = await ask(t.serverPort, '3001')
  const port = parseInt(portStr, 10) || 3001

  const timeoutStr = await ask(t.sessionTimeout, '30')
  const timeout = parseInt(timeoutStr, 10) || 30

  writeEnv({
    API_KEY: apiKey,
    TELEGRAM_BOT_TOKEN: botToken,
    TELEGRAM_CHAT_ID: chatId,
    PORT: port,
    SESSION_TIMEOUT_MINUTES: timeout,
    NODE_ENV: 'production',
    LANGUAGE: lang,
  })
  ok(t.envCreated)

  info(t.building)
  try {
    execFileSync('pnpm', ['build'], { stdio: 'pipe' })
    ok(t.buildComplete)
  } catch (err) {
    const stderr = err instanceof Error && 'stderr' in err
      ? (err as NodeJS.ErrnoException & { stderr: Buffer }).stderr?.toString()
      : String(err)
    fail(`${t.buildFailed}:\n${stderr}`)
    process.exit(1)
  }

  const rcFile = detectShellRcFile()
  const added = addEnvToShell(rcFile, {
    TELEGRAM_BRIDGE_URL: `http://localhost:${port}`,
    TELEGRAM_BRIDGE_API_KEY: apiKey,
  })
  added ? ok(t.shellVarsAdded(rcFile)) : warn(t.shellVarsAlreadyPresent(rcFile))

  const { updated, created } = updateClaudeMd(installDir)
  if (created) ok(t.claudeMdCreated)
  else if (updated) ok(t.claudeMdUpdated)
  else warn(t.claudeMdAlreadyPresent)

  // ── Step 6: Autostart ──────────────────────────────────────────────────────
  step(6, TOTAL, t.stepAutostart)
  const wantSystemd = await confirm(t.setupSystemdQuestion, t, false)

  if (wantSystemd) {
    const unitPath = '/tmp/telegram-bridge.service'
    fs.writeFileSync(unitPath, buildSystemdUnit(installDir))
    console.log('')
    info(t.systemdCommandsHeader)
    console.log('')
    console.log(`    ${c.cyan}sudo cp ${unitPath} /etc/systemd/system/telegram-bridge.service${c.reset}`)
    console.log(`    ${c.cyan}sudo systemctl daemon-reload${c.reset}`)
    console.log(`    ${c.cyan}sudo systemctl enable --now telegram-bridge${c.reset}`)
    console.log('')
    info(t.serviceFileWritten(unitPath))
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log(`
${c.bold}${c.green}  ✓ ${t.setupComplete}${c.reset}

  ${c.bold}${t.labelStartServer}${c.reset}
    pnpm start

  ${c.bold}${t.labelTestIt}${c.reset}
    node claude-sdk/dist/cli.js status

  ${c.bold}${t.labelReloadShell}${c.reset}
    ${t.reloadShellCmd(rcFile)}

  ${c.bold}${t.labelThenFromClaude}${c.reset}
    ${t.thenFromClaudeCmd(installDir)}
`)

  rl.close()
}

main().catch((err: Error) => {
  console.error(`\n${c.red}${translations['en']!.fatalError}:${c.reset} ${err.message}`)
  rl.close()
  process.exit(1)
})
