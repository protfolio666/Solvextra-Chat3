# Railway Deployment Guide

This guide will help you deploy the Solvextra customer support platform to Railway.

## Prerequisites

- A Railway account (https://railway.app)
- A PostgreSQL database (Railway provides one for free)
- API keys for AI providers (OpenAI, Gemini, or OpenRouter)
- SendGrid API key (optional, for email notifications)

## Deployment Steps

### 1. Create New Project on Railway

1. Go to https://railway.app and create a new project
2. Click "Deploy from GitHub repo" and connect your repository
3. Railway will automatically detect the Node.js application

### 2. Add PostgreSQL Database

1. In your Railway project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway will create a database and provide a `DATABASE_URL`

### 3. Configure Environment Variables

Add the following environment variables in Railway's dashboard:

#### Required Variables

```bash
# Database (automatically set by Railway when you add PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database

# Session Secret (generate a random string)
SESSION_SECRET=your-super-secret-session-key-here

# Node Environment
NODE_ENV=production

# Port (Railway sets this automatically)
PORT=5000
```

#### AI Provider API Keys (at least one required)

```bash
# OpenAI (recommended)
OPENAI_API_KEY=sk-...

# Google Gemini
GEMINI_API_KEY=...

# OpenRouter (free models available)
OPENROUTER_API_KEY=sk-or-...
```

#### Optional: Email Notifications

```bash
# SendGrid for email notifications
SENDGRID_API_KEY=SG...
```

### 4. Configure Build & Start Commands

Railway should auto-detect these, but verify in Settings:

**Build Command:**
```bash
npm install && npm run build && npm run db:push --force
```

**Start Command:**
```bash
npm start
```

**Important:** The `--force` flag is required to skip interactive prompts during database migrations on Railway.

### 5. Health Check Configuration

Railway will automatically use the `/health` endpoint to monitor your deployment.

**Health Check URL:** `https://your-app.up.railway.app/health`

Expected Response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-15T10:30:00.000Z",
  "uptime": 123.45,
  "environment": "production"
}
```

### 6. Domain Configuration

1. Railway provides a default domain: `your-app.up.railway.app`
2. To add a custom domain:
   - Go to your service settings
   - Click "Settings" → "Domains"
   - Add your custom domain and configure DNS

### 7. Database Migration

The build command includes `npm run db:push` which automatically syncs your database schema. If you need to force push schema changes:

```bash
npm run db:push --force
```

## Environment Variables Reference

### Core System

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | Auto-set by Railway |
| `SESSION_SECRET` | Secret for session encryption | Yes | None |
| `NODE_ENV` | Environment (production/development) | Yes | production |
| `PORT` | Server port | No | 5000 |

### AI Providers

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key | No* | sk-proj-... |
| `GEMINI_API_KEY` | Google Gemini API key | No* | AIzaSy... |
| `OPENROUTER_API_KEY` | OpenRouter API key | No* | sk-or-v1-... |

*At least one AI provider API key is required for AI features

### Optional Services

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `SENDGRID_API_KEY` | SendGrid for email notifications | No | SG.xxx |

## Post-Deployment Setup

After successful deployment:

1. **Create Admin Account:**
   - Visit `https://your-app.up.railway.app/auth`
   - Default admin credentials:
     - Email: `abhishek@solvextra.com`
     - Password: `Solvextra098$#@`
   - **Change this immediately after first login!**

2. **Configure AI Settings:**
   - Go to Settings → AI Configuration
   - Select your AI provider (OpenAI, Gemini, or OpenRouter)
   - Configure system prompt and knowledge base

3. **Set Up Channels:**
   - Go to Channels
   - Configure Telegram, WhatsApp, or other channels
   - Follow the integration guides

4. **Configure Email Notifications:**
   - Go to Settings → Notifications
   - Add SendGrid API key and sender email
   - Enable email notifications

5. **Add Agents:**
   - Go to Agents (admin only)
   - Create agent accounts
   - Set agent status to "Available"

## Monitoring & Logs

### View Logs

Railway provides real-time logs:
1. Go to your service in Railway
2. Click "Deployments"
3. Select the active deployment
4. View logs in real-time

### Health Check Monitoring

- Railway automatically monitors `/health` endpoint
- If health check fails, Railway will attempt to restart the service
- You can also manually check: `curl https://your-app.up.railway.app/health`

## Troubleshooting

### Build Fails

- **Issue:** Database migration fails
- **Solution:** Ensure `DATABASE_URL` is set before build
- **Fix:** Add `npm run db:push --force` to build command

### Application Won't Start

- **Issue:** Missing environment variables
- **Solution:** Verify all required variables are set
- **Fix:** Check Railway logs for specific errors

### WebSocket Connection Issues

- **Issue:** Real-time messaging not working
- **Solution:** Ensure Railway domain is used in WebSocket connection
- **Fix:** Check browser console for WebSocket errors

### Database Connection Errors

- **Issue:** Cannot connect to database
- **Solution:** Verify `DATABASE_URL` is correctly formatted
- **Fix:** Ensure PostgreSQL service is running in Railway

## Performance Optimization

### Database Pooling

The application uses Drizzle ORM with Neon serverless driver which handles connection pooling automatically.

### Scaling

Railway allows easy horizontal scaling:
1. Go to Service Settings
2. Adjust instance count
3. Configure auto-scaling rules

## Security Checklist

- [ ] Change default admin password
- [ ] Set strong `SESSION_SECRET`
- [ ] Use HTTPS (Railway provides this automatically)
- [ ] Restrict database access to Railway network only
- [ ] Rotate API keys regularly
- [ ] Enable two-factor authentication for Railway account
- [ ] Review and limit environment variable access

## Backup & Recovery

### Database Backups

Railway automatically backs up PostgreSQL databases:
- Daily backups retained for 7 days
- Manual backups can be created anytime

### Restore from Backup

1. Go to PostgreSQL service in Railway
2. Click "Backups"
3. Select backup to restore
4. Click "Restore"

## Cost Estimation

Railway pricing (as of 2025):

- **Starter Plan:** $5/month
  - 512 MB RAM
  - 1 GB disk
  - Shared CPU

- **Pro Plan:** $20/month
  - 8 GB RAM
  - 100 GB disk
  - Dedicated resources

- **Database:** Included in plan or pay-as-you-go

## Support

- Railway Documentation: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Solvextra Issues: Open issue in repository

## Quick Commands Reference

```bash
# Deploy from CLI
railway up

# View logs
railway logs

# Open in browser
railway open

# Run migrations
railway run npm run db:push

# SSH into container
railway shell
```
