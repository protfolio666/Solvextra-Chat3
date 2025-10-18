# 🔧 Telegram AI Not Responding - Fix Guide

## The Problem
You're messaging "HELLO" in Telegram but the AI bot is not responding.

## Root Causes
1. ❌ AI is disabled or paused
2. ❌ No AI API key configured (OpenAI, Gemini, or OpenRouter)
3. ❌ Telegram webhook not registered
4. ❌ Telegram bot token not configured

---

## ✅ Step-by-Step Fix

### Step 1: Login to Your Admin Panel
1. Open your app: `https://YOUR-REPLIT-URL.replit.dev`
2. Login with: `abhishek@solvextra.com`
3. Go to **Settings**

---

### Step 2: Configure AI Settings
1. Click **Settings** → **AI Configuration**
2. Make sure:
   - ✅ **Enable AI** is turned **ON**
   - ✅ **Pause AI** is turned **OFF**
   - ✅ Select AI Provider: **Gemini** (recommended - it's FREE!)
   - ✅ Select Model: **gemini-2.0-flash-exp** or **gemini-1.5-flash**

---

### Step 3: Add AI API Key

#### Option A: Use Gemini (FREE & RECOMMENDED)
1. Go to: https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key (starts with `AIzaSy...`)
4. In Replit, go to **Secrets** (🔒 icon in left sidebar)
5. Add new secret:
   - Name: `GEMINI_API_KEY`
   - Value: `AIzaSy...` (paste your key)
6. Click "Add Secret"

#### Option B: Use OpenAI (Paid)
1. Go to: https://platform.openai.com/api-keys
2. Create API key
3. In Replit Secrets, add:
   - Name: `OPENAI_API_KEY`
   - Value: `sk-proj-...` (your key)

#### Option C: Use OpenRouter (Free tier available)
1. Go to: https://openrouter.ai/keys
2. Create API key
3. In Replit Secrets, add:
   - Name: `OPENROUTER_API_KEY`
   - Value: `sk-or-v1-...` (your key)

---

### Step 4: Configure Telegram Integration
1. In your app, go to **Settings** → **Channels**
2. Find **Telegram** section
3. Enter your **Telegram Bot Token** (from @BotFather)
4. Click **Enable Telegram**
5. Click **Save**

**The webhook will auto-register when you save!**

---

### Step 5: Get Your Telegram Bot Token

If you don't have a bot yet:

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Follow the prompts to create your bot
4. Copy the **API Token** (looks like: `7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw`)
5. Paste it in Step 4 above

---

### Step 6: Test It!

1. Open Telegram and find your bot
2. Send: `/start`
3. Send: `Hello`
4. **AI should respond immediately!** 🎉

---

## 🚨 Common Issues

### "AI still not responding"
✅ **Check:** Go to Settings → AI Configuration
✅ **Verify:** "Enable AI" is ON and "Pause AI" is OFF
✅ **Verify:** You added the API key in Secrets (not Settings!)

### "Telegram says bot is not found"
✅ **Check:** Did you copy the correct bot username from @BotFather?
✅ **Check:** Did you send `/start` to your bot first?

### "Error: API key not configured"
✅ **Check:** Go to Secrets tab (🔒 icon)
✅ **Verify:** You added `GEMINI_API_KEY` or `OPENAI_API_KEY`
✅ **Restart:** After adding secrets, restart your app

---

## 🔍 Diagnostic Commands

To check if everything is configured, you can:

1. **Check AI Settings:**
   - Login to admin panel
   - Go to Settings → AI Configuration
   - See if AI is enabled

2. **Check Telegram Settings:**
   - Go to Settings → Channels
   - See if Telegram token is configured

3. **Check Console Logs:**
   - Look for: `📨 Telegram webhook received:`
   - If you see this, webhook is working!
   - If not, webhook is not registered

---

## ⚡ Quick Test

Send this to your Telegram bot:
```
Hello, I need help with my order
```

**Expected AI response:**
The AI should respond with a helpful message asking for more details.

**If AI doesn't respond:**
1. Check Replit logs for errors
2. Verify API key is set in Secrets
3. Verify AI is enabled in Settings
4. Verify Telegram token is correct in Channels

---

## 🎯 For Railway Deployment

When deploying to Railway:

1. **Add ALL secrets in Railway dashboard:**
   - `GEMINI_API_KEY` or `OPENAI_API_KEY`
   - `NODE_ENV=production`
   - Railway auto-provides `DATABASE_URL`

2. **After deployment:**
   - Login to your Railway URL
   - Configure AI settings (enable AI, select provider)
   - Configure Telegram (add bot token, enable)
   - Webhook auto-registers with your Railway URL!

3. **Test:**
   - Send message to your Telegram bot
   - AI should respond within seconds!

---

## 🆘 Still Need Help?

If none of this works, please share:
1. Screenshot of Settings → AI Configuration
2. Screenshot of Settings → Channels (hide sensitive tokens)
3. Do you see errors in the console?

The most common issue is: **AI is paused** or **No API key added**.

---

## 📝 Recommended Setup (FREE)

**Best FREE setup:**
- AI Provider: **Gemini**
- Model: **gemini-2.0-flash-exp**
- API Key: Get free from https://aistudio.google.com/app/apikey
- Telegram: Configure bot token from @BotFather

This gives you **unlimited AI responses for FREE!**
