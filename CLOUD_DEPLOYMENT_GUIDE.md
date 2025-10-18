# 🚀 Cloud Deployment Guide - Environment Variables Setup

## ✅ GREAT NEWS! 

Your bot is NOW configured to work 24/7 in the cloud using **environment variables**! This means:

✅ **Bot runs immediately** after deployment  
✅ **No manual UI configuration** needed  
✅ **Works even when no one is logged in**  
✅ **Perfect for Railway, Render, Fly.io, etc.**

---

## 🔥 How It Works

The system now checks **2 places** for channel integration:

1. **First**: Database (UI Settings) - if you configure it through the UI
2. **Second**: Environment Variables - automatic fallback if nothing in database

This means you can set everything up via environment variables on Railway, and it will **work immediately** when deployed!

---

## 📝 Environment Variables You Need

### For Railway/Cloud Deployment

Add these environment variables in your Railway dashboard:

```bash
# ===== AI PROVIDER (Choose ONE) =====
# Option 1: Gemini (FREE - Recommended!)
GEMINI_API_KEY=AIzaSy...your-key-here

# Option 2: OpenAI (Paid)
OPENAI_API_KEY=sk-proj-...your-key-here

# Option 3: OpenRouter (Free tier available)
OPENROUTER_API_KEY=sk-or-v1-...your-key-here

# ===== TELEGRAM =====
TELEGRAM_BOT_TOKEN=7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
TELEGRAM_ENABLED=true  # Optional, defaults to true

# ===== WHATSAPP (Optional) =====
WHATSAPP_API_TOKEN=your-whatsapp-token
WHATSAPP_ENABLED=true

# ===== INSTAGRAM (Optional) =====
INSTAGRAM_ACCESS_TOKEN=your-instagram-token
INSTAGRAM_ENABLED=true

# ===== TWITTER/X (Optional) =====
TWITTER_API_KEY=your-twitter-api-key
TWITTER_ENABLED=true

# ===== EMAIL NOTIFICATIONS (Optional) =====
SENDGRID_API_KEY=SG.your-sendgrid-key-here

# ===== SYSTEM =====
NODE_ENV=production
# DATABASE_URL is auto-provided by Railway
```

---

## 🎯 Step-by-Step: Railway Deployment

### Step 1: Prepare Your Code

```bash
# Make sure everything is committed
git add .
git commit -m "Ready for Railway deployment with env vars"
git push
```

### Step 2: Deploy to Railway

1. Go to **https://railway.app**
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Railway will auto-detect Node.js and start deploying

### Step 3: Add Database

1. In Railway dashboard, click **"New" → "Database" → "Add PostgreSQL"**
2. Railway automatically creates `DATABASE_URL` variable
3. Your app uses this automatically!

### Step 4: Add Environment Variables

In Railway dashboard → **Variables** tab, add:

```bash
# MINIMUM REQUIRED FOR BOT TO WORK:
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather
GEMINI_API_KEY=your-gemini-api-key
NODE_ENV=production
```

### Step 5: Wait for Webhook Auto-Registration

After deployment:
- The system **automatically registers Telegram webhook** on startup!
- Look for this in Railway logs:
  ```
  ✅ Telegram webhook auto-registered successfully at: https://yourapp.railway.app/api/webhooks/telegram
  ```

### Step 6: Test It!

1. Open Telegram
2. Find your bot
3. Send: `Hello`
4. **AI responds immediately!** 🎉

---

## 🔧 Complete Environment Variables Reference

| Variable | Required? | Purpose | Example |
|----------|-----------|---------|---------|
| `TELEGRAM_BOT_TOKEN` | No* | Telegram bot API token | `7123456789:AAH...` |
| `TELEGRAM_ENABLED` | No | Enable/disable Telegram | `true` (default) |
| `GEMINI_API_KEY` | No* | Google Gemini API key (FREE!) | `AIzaSy...` |
| `OPENAI_API_KEY` | No* | OpenAI API key (Paid) | `sk-proj-...` |
| `OPENROUTER_API_KEY` | No* | OpenRouter API key | `sk-or-v1-...` |
| `WHATSAPP_API_TOKEN` | No | WhatsApp Business API token | Your token |
| `WHATSAPP_ENABLED` | No | Enable/disable WhatsApp | `true` |
| `INSTAGRAM_ACCESS_TOKEN` | No | Instagram Graph API token | Your token |
| `INSTAGRAM_ENABLED` | No | Enable/disable Instagram | `true` |
| `TWITTER_API_KEY` | No | Twitter/X API key | Your key |
| `TWITTER_ENABLED` | No | Enable/disable Twitter | `true` |
| `SENDGRID_API_KEY` | No | SendGrid for email notifications | `SG.your-key` |
| `NODE_ENV` | Yes | Environment mode | `production` |
| `DATABASE_URL` | Auto | PostgreSQL connection string | Auto-set by Railway |

**\*** At least ONE AI provider key is required (Gemini, OpenAI, or OpenRouter)

---

## 🌐 Railway-Specific Configuration

Railway automatically provides:
- `RAILWAY_PUBLIC_DOMAIN` - Your app's public URL
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Port to bind (your app already handles this correctly!)

The webhook auto-registration uses these automatically!

---

## ⚙️ How Auto-Registration Works

When your app starts on Railway:

1. **Detects** `TELEGRAM_BOT_TOKEN` in environment
2. **Gets** the public domain from Railway environment
3. **Calls** Telegram API to register webhook:
   ```
   https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://yourapp.railway.app/api/webhooks/telegram
   ```
4. **Logs** success/failure in Railway logs
5. **Bot is ready!** Telegram sends all messages to your app

---

## 🎨 Best Practices

### 1. Use Gemini (It's FREE!)

```bash
# Get free API key from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIzaSy...
```

### 2. Test Locally First

```bash
# Add to Replit Secrets:
TELEGRAM_BOT_TOKEN=your-token
GEMINI_API_KEY=your-key

# Test in Replit, then deploy to Railway
```

### 3. Monitor Logs

In Railway dashboard → **Deployments** → **View Logs**

Look for:
```
✅ Telegram webhook auto-registered successfully
📨 Telegram webhook received
✅ AI response sent to Telegram
```

### 4. Use Database for Runtime Changes

If you want to change settings without redeploying:
1. Login to your deployed app
2. Go to Settings → Channels
3. Update there (overrides environment variables)

---

## 🚨 Troubleshooting

### "Telegram not responding"

✅ **Check:**
1. Is `TELEGRAM_BOT_TOKEN` set in Railway variables?
2. Is `GEMINI_API_KEY` (or other AI key) set?
3. Check Railway logs for webhook registration success
4. Make sure your bot is started (send `/start` in Telegram)

### "Webhook not registered"

✅ **Check Railway logs** for:
```
✅ Telegram webhook auto-registered successfully
```

If you see error, check:
- Token is correct
- Railway deployment is complete
- Domain is accessible

### "AI not responding"

✅ **Check:**
1. At least ONE AI API key is set
2. API key is valid (not expired)
3. Check Railway logs for AI errors

---

## 🔄 Update Process

### Option 1: Environment Variables (No Redeploy)

Can't change env vars without redeploying. So...

### Option 2: UI Settings (No Redeploy Needed!)

1. Login to your deployed app
2. Go to Settings
3. Update channel integrations or AI settings
4. Changes apply immediately!

### Option 3: Code Changes (Redeploy Required)

```bash
git add .
git commit -m "Update code"
git push
# Railway auto-deploys
```

---

## 📊 Priority System

The system checks in this order:

1. **Database** (UI Settings) - Highest priority
2. **Environment Variables** - Fallback

This means:
- Set env vars for initial deployment
- Use UI for runtime changes
- Best of both worlds!

---

## 💡 Pro Tips

### 1. Keep Secrets Safe

Never commit secrets to Git:
```bash
# .env is already in .gitignore
# Only add secrets in Railway dashboard
```

### 2. Use Different Keys for Dev/Prod

**Replit (Development):**
```
TELEGRAM_BOT_TOKEN=dev-bot-token
GEMINI_API_KEY=dev-api-key
```

**Railway (Production):**
```
TELEGRAM_BOT_TOKEN=prod-bot-token
GEMINI_API_KEY=prod-api-key
```

### 3. Test Webhook URL

After deployment, visit:
```
https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo
```

Should show your Railway URL!

---

## 🎯 Quick Start Checklist

For immediate 24/7 Telegram bot:

- [ ] Get Telegram bot token from @BotFather
- [ ] Get FREE Gemini API key from https://aistudio.google.com/app/apikey
- [ ] Push code to GitHub
- [ ] Deploy to Railway from GitHub
- [ ] Add PostgreSQL database in Railway
- [ ] Add `TELEGRAM_BOT_TOKEN` to Railway variables
- [ ] Add `GEMINI_API_KEY` to Railway variables
- [ ] Add `NODE_ENV=production` to Railway variables
- [ ] Wait for deployment (check logs for webhook registration)
- [ ] Test: Send message to your Telegram bot
- [ ] Bot responds automatically! ✅

---

## 📱 Example: Complete Railway Setup

Here's exactly what your Railway variables should look like:

```bash
# In Railway dashboard → Variables tab:

TELEGRAM_BOT_TOKEN=7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
GEMINI_API_KEY=AIzaSyAB1cd2EfGhI3jKLmNo4PqRsTu5VwXy6Zz
NODE_ENV=production
```

That's it! 3 variables and you're done! 🎉

Railway automatically provides `DATABASE_URL`, so you don't need to add it.

---

## 🔥 What Happens on Deployment

```
1. Railway detects Node.js app
2. Installs dependencies (npm install)
3. Builds app if needed
4. Starts server (npm run dev OR npm start)
5. Server starts listening on dynamic PORT
6. 3 seconds later: Auto-registers Telegram webhook
7. Bot is LIVE and ready 24/7! ✅
```

---

## 🆘 Need Help?

If you see errors:

1. **Check Railway logs first**
   - Look for red error messages
   - Check webhook registration status
   - See if AI API calls succeed

2. **Common fixes:**
   - Restart deployment in Railway
   - Check API keys are valid
   - Make sure DATABASE_URL exists
   - Verify webhook URL is accessible

3. **Test endpoints:**
   - Health check: `https://yourapp.railway.app/health`
   - Should return: `{"status":"ok"}`

---

## ✨ Success Indicators

You'll know it's working when you see:

**In Railway Logs:**
```
✅ Inactivity monitor started
✅ Telegram webhook auto-registered successfully at: https://yourapp.railway.app/api/webhooks/telegram
[express] serving on port 3000
```

**In Telegram:**
1. Send message to bot
2. Bot responds immediately
3. You can close your laptop - bot keeps running!

---

## 🎉 That's It!

Your bot now runs **24/7 in the cloud**, even when:
- Your laptop is off
- You're not logged in
- No one is managing it
- It's 3 AM and a customer needs help

The AI handles everything automatically! 🤖✨

---

**Remember:** You can still use the UI to configure settings at runtime. Environment variables are just the fallback for when nothing is configured yet.

Enjoy your always-online AI bot! 🚀
