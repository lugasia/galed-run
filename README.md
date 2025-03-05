# ריצת ניווט גלעד

אפליקציית משחק ניווט עבור קיבוץ גלעד. המשחק מאפשר למשתתפים לנווט בין נקודות עניין בקיבוץ, לענות על שאלות ולצבור נקודות.

## תכונות

- מעקב GPS בזמן אמת
- 13 נקודות עניין מוגדרות מראש
- שאלות טריוויה בכל נקודה
- מערכת עונשין לתשובות שגויות
- ממשק ניהול למנהלי המשחק
- יומן אירועים בזמן אמת

## דרישות מערכת

- Node.js 18 ומעלה
- MongoDB
- npm או yarn

## התקנה מקומית

1. שכפל את המאגר:
```bash
git clone https://github.com/yourusername/galed-run.git
cd galed-run
```

2. התקן את התלויות:
```bash
npm install
```

3. צור קובץ `.env.local` והגדר את המשתנים הבאים:
```
MONGODB_URI=your_mongodb_connection_string
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

4. הפעל את שרת הפיתוח:
```bash
# בטרמינל ראשון
npm run dev

# בטרמינל שני
npm run ws
```

## פריסה לייצור (חינם לחלוטין)

### 1. הגדרת MongoDB Atlas (חינם)

1. צור חשבון ב-[MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. צור cluster חדש (בחר באפשרות החינמית)
3. הגדר משתמש וסיסמה למסד הנתונים
4. הגדר את ה-IP Access List להרשות גישה מכל מקום (0.0.0.0/0)
5. קבל את ה-connection string

### 2. פריסת שרת ה-WebSocket ב-Render (חינם)

1. צור חשבון ב-[Render](https://render.com)
2. צור Web Service חדש
3. התחבר למאגר ה-GitHub שלך
4. הגדר את הפקודות הבאות:
   - Build Command: `npm install && npm run build:ws`
   - Start Command: `npm run start:ws`
5. הוסף את משתני הסביבה הנדרשים

### 3. פריסת האפליקציה ב-Netlify (חינם)

1. צור חשבון ב-[Netlify](https://www.netlify.com)
2. התחבר למאגר ה-GitHub שלך
3. הגדר את הפקודות הבאות:
   - Build Command: `npm run build`
   - Publish Directory: `.next`
4. הגדר את משתני הסביבה:
   - `MONGODB_URI`: מחרוזת החיבור של MongoDB Atlas
   - `NEXT_PUBLIC_APP_URL`: כתובת ה-URL של האפליקציה
   - `NEXT_PUBLIC_WS_URL`: כתובת ה-WebSocket (מ-Render)

## מבנה הפרויקט

```
galed-run/
├── app/
│   ├── admin/         # דפי ניהול
│   ├── api/          # נקודות קצה של ה-API
│   ├── components/   # רכיבים משותפים
│   ├── game/         # ממשק המשחק
│   ├── lib/          # פונקציות עזר
│   ├── models/       # מודלים של MongoDB
│   └── types/        # הגדרות TypeScript
├── public/          # קבצים סטטיים
└── websocket-server.ts  # שרת WebSocket
```

## רישיון

MIT # galed-run
