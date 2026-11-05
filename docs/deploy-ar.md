# دليل تشغيل ميزان ونشره (بالتفصيل)

هذا الدليل يأخذك من الصفر إلى موقع منشور على الإنترنت، فيه حسابات ومزامنة بين الأجهزة، والمعلّم الذكي (Claude)، والتذكيرات.

| الجزء | ماذا يضيف | إلزامي؟ |
| --- | --- | --- |
| 1. Supabase | الحسابات، قاعدة البيانات، المزامنة بين الأجهزة | نعم للحسابات |
| 2. التشغيل على جهازك | تجربة الموقع مربوطًا بقاعدة البيانات | للتجربة |
| 3. Vercel | الموقع على الإنترنت برابط | نعم للنشر |
| 4. Claude (المعلّم والمساعد) | الذكاء الاصطناعي | اختياري |
| 5. التذكيرات على الهاتف | إشعارات حتى والموقع مغلق | اختياري |

**التكلفة:** Supabase و Vercel مجانيان في الخطة المجانية. Claude يُدفع حسب الاستخدام من حساب Anthropic، والحد اليومي في ميزان (60 رسالة) يحميك من أي مفاجأة.

> **قاعدة الأمان الذهبية:** هناك مفاتيح **عامة** (آمنة في الموقع) ومفاتيح **سرّية** (على الخادم فقط).
> - عام: `Project URL` و `anon key`.
> - سرّي، لا تضعه في الموقع ولا ترسله لأحد: `service_role key`، كلمة مرور قاعدة البيانات، `ANTHROPIC_API_KEY`.

---

## الجزء 1: Supabase (قاعدة البيانات والحسابات)

### 1.1 أنشئ المشروع
1. افتح **supabase.com** واضغط **Start your project**، ثم سجّل الدخول (الأسهل بحساب GitHub).
2. اضغط **New project** واملأ:
   - **Name:** `mizan`
   - **Database Password:** اضغط **Generate a password** واحفظها في مكان آمن (لن تحتاجها في الدليل، لكن لا تفقدها).
   - **Region:** اختر الأقرب لك، مثل **Central EU (Frankfurt)** أو **South Asia (Mumbai)**.
3. اضغط **Create new project** وانتظر دقيقة أو اثنتين حتى يجهز.

### 1.2 أنشئ الجداول بلصقة واحدة
1. من القائمة الجانبية اليسرى: **SQL Editor**.
2. اضغط **New query** (أو **+**).
3. في المستودع افتح الملف **`supabase/setup.sql`**، واضغط **Raw** ثم انسخ المحتوى كاملًا (Ctrl+A ثم Ctrl+C).
4. الصقه في محرر Supabase واضغط **Run** (أو Ctrl+Enter).
5. يجب أن تظهر رسالة **Success. No rows returned**.
   - هذا الملف ينشئ كل الجداول (19 جدولًا)، وقواعد الأمان (كل مستخدم يرى بياناته فقط)، ومخزن المرفقات، والمزامنة الفورية.
   - **آمن تشغيله أكثر من مرة**؛ إن ظهر خطأ، شغّله مرة أخرى وأرسل لي نص الخطأ.
6. للتأكد: من **Table Editor** يجب أن ترى جداول مثل `cards` و `books` و `flashcards`.

### 1.3 إعدادات تسجيل الدخول
1. **Authentication → Sign In / Providers → Email**: تأكد أنه مفعّل.
   - إن أردت الدخول فورًا دون رسالة تأكيد على البريد، أطفئ **Confirm email** (لحساب شخصي هذا مقبول).
2. **Authentication → URL Configuration**:
   - **Site URL:** ضع مؤقتًا `http://localhost:5173`، وبعد النشر على Vercel غيّره إلى رابط موقعك.
   - **Redirect URLs:** اضغط **Add URL** وأضف:
     - `http://localhost:5173/**`
     - `https://اسم-موقعك.vercel.app/**` (بعد الجزء 3)
3. (اختياري) الدخول بحساب Google: **Authentication → Providers → Google**
   - تحتاج **Client ID** و **Client Secret** من Google Cloud Console ← APIs & Services ← Credentials ← Create OAuth client ID (نوع Web).
   - في Google أضف **Authorized redirect URI**: `https://<project-ref>.supabase.co/auth/v1/callback` (يظهر لك جاهزًا في صفحة Supabase).

### 1.4 انسخ المفتاحين العامّين
**Project Settings (رمز الترس) → API** (قد يظهر باسم **Data API** أو **API Keys**):
- **Project URL**: مثل `https://abcdefghijk.supabase.co`
- **anon public** (أو **publishable key**): نص طويل يبدأ غالبًا بـ `eyJ` أو `sb_publishable_`

هذان كل ما يحتاجه الموقع. **لا تنسخ** `service_role`.

---

## الجزء 2: شغّل الموقع على جهازك مربوطًا بقاعدة البيانات

تحتاج **Node.js 20 أو أحدث** (من nodejs.org) و **Git**.

```bash
git clone https://github.com/mohammedyusuf145/MizanWeb.git
cd MizanWeb
npm install
```

أنشئ ملفًا اسمه **`.env.local`** في مجلد المشروع (بجانب `package.json`) وضع فيه:
```
VITE_SUPABASE_URL=https://abcdefghijk.supabase.co
VITE_SUPABASE_ANON_KEY=المفتاح-العام-هنا
```
> هذا الملف لا يُرفع إلى GitHub (موجود في `.gitignore`).

تحقّق من الاتصال:
```bash
npm run check:supabase
```
يجب أن ترى:
```
  ✓ Auth reachable (email: on, Google: off)
  ✓ All 15 tables exist
Mizan is connected.
```
ثم شغّل الموقع:
```bash
npm run dev
```
افتح `http://localhost:5173`، أنشئ حسابًا، وجرّب. إن كان عندك بيانات من وضع "بدون حساب" على نفس المتصفح، سيظهر لك في صفحة **اليوم** زر **استيراد** لنقلها إلى حسابك.

---

## الجزء 3: النشر على Vercel (رابط على الإنترنت)

1. افتح **vercel.com** وسجّل الدخول **بحساب GitHub**.
2. **Add New… → Project** واختر مستودع **MizanWeb** ثم **Import**.
   - إن لم يظهر: **Adjust GitHub App Permissions** واسمح لـ Vercel بالوصول إلى المستودع.
3. الإعدادات (يتعرّف عليها تلقائيًا):
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. افتح **Environment Variables** وأضف:
   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | رابط مشروعك |
   | `VITE_SUPABASE_ANON_KEY` | المفتاح العام |
5. اضغط **Deploy** وانتظر دقيقة. ستحصل على رابط مثل `https://mizan-xxxx.vercel.app`.
6. **ارجع إلى Supabase** (الخطوة 1.3) وضع هذا الرابط في **Site URL** وأضف `https://mizan-xxxx.vercel.app/**` في **Redirect URLs**.
7. كل مرة يُرفع تحديث إلى فرع `main` في GitHub، ينشر Vercel النسخة الجديدة تلقائيًا.

**تثبيت ميزان كتطبيق:** افتح الرابط على هاتفك:
- iPhone (Safari): زر المشاركة ← **إضافة إلى الشاشة الرئيسية**.
- Android (Chrome): **الإعدادات ← الحساب ← تثبيت ميزان** أو من قائمة المتصفح.

---

## الجزء 4: تشغيل Claude (المعلّم والمساعد)

Claude يعمل من **دالة على خادم Supabase** (Edge Function)، فمفتاحك لا يصل إلى المتصفح أبدًا. الأسئلة تُرسَل من حسابك في ميزان إلى الدالة، والدالة تكلّم Claude بمفتاحك.

### 4.1 أنشئ مفتاح Anthropic
1. افتح **console.anthropic.com** وسجّل.
2. **Billing**: أضف رصيدًا صغيرًا (مثلًا 5 دولارات تكفي كثيرًا مع الحد اليومي).
3. **API Keys → Create Key**، سمّه `mizan`، وانسخه (يبدأ بـ `sk-ant-`). **لا يظهر مرة ثانية، ولا تشاركه.**

### 4.2 ارفع الدوال إلى Supabase
من مجلد المشروع على جهازك:
```bash
npx supabase login
```
يفتح المتصفح لتوافق. ثم اربط المشروع (الـ ref هو الجزء قبل `.supabase.co` في رابطك):
```bash
npx supabase link --project-ref abcdefghijk
```
ضع الأسرار (تبقى على الخادم فقط):
```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase secrets set TUTOR_MODEL=claude-sonnet-5-5 TUTOR_MODEL_LIGHT=claude-haiku-5-5
npx supabase secrets set TUTOR_DAILY_MESSAGE_CAP=60 TUTOR_DAILY_TOKEN_CAP=150000
npx supabase secrets set ALLOWED_ORIGINS=https://mizan-xxxx.vercel.app,http://localhost:5173
```
ارفع الدوال:
```bash
npx supabase functions deploy tutor
npx supabase functions deploy delete-account
```
تحقّق:
```bash
npm run check:supabase
```
يجب أن ترى `✓ Edge Function "tutor" deployed`. افتح **Claude** في ميزان واختر **المعلّم** أو **اسأل أي شيء**.

**تغيير النموذج لاحقًا:** سطر واحد، مثل `npx supabase secrets set TUTOR_MODEL=claude-opus-5-5`، بدون إعادة نشر الموقع.

---

## الجزء 5: التذكيرات على الهاتف (اختياري)

1. أنشئ مفتاحي VAPID:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. في Vercel أضف `VITE_VAPID_PUBLIC_KEY` = المفتاح العام، ثم **Redeploy**.
3. في Supabase:
   ```bash
   npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:بريدك
   npx supabase secrets set CRON_SECRET=نص-عشوائي-طويل
   npx supabase functions deploy send-reminders
   ```
4. افتح `supabase/cron/schedule-reminders.sql`، واستبدل `<project-ref>` و `<CRON_SECRET>`، ثم شغّله في **SQL Editor**.
5. في ميزان: **الإعدادات ← الإشعارات ← تفعيل**.

---

## حلّ المشاكل

| المشكلة | السبب والحل |
| --- | --- |
| الموقع يقول "على هذا الجهاز" ولا يطلب تسجيل الدخول | متغيرات `VITE_SUPABASE_*` غير موجودة. أضفها في `.env.local` أو في Vercel ثم **Redeploy**. |
| `Missing tables` في الفحص | لم يُشغَّل `supabase/setup.sql`. شغّله في SQL Editor. |
| بعد تسجيل الدخول بـ Google يرجع لصفحة خطأ | رابط موقعك غير موجود في **Redirect URLs** في Supabase. |
| لم تصل رسالة تأكيد البريد | تحقّق من البريد المزعج، أو أطفئ **Confirm email** (الخطوة 1.3). |
| Claude يقول "لم يُجهَّز المعلّم على الخادم" | لم تُرفَع دالة `tutor` أو لم يُضبط `ANTHROPIC_API_KEY` (الجزء 4). |
| Claude يقول "بلغت حدّ رسائل اليوم" | الحد اليومي يحميك من التكلفة؛ غيّره بـ `TUTOR_DAILY_MESSAGE_CAP`. |
| المشروع المجاني توقّف | Supabase يوقف المشاريع المجانية بعد أسبوع دون استخدام. افتح لوحة Supabase واضغط **Restore**. |
