# PazarGlobal Frontend - Deployment Guide

## Vercel Deployment

### 1. Prerequisites
- Vercel account
- GitHub repository connected
- Supabase project configured

### 2. Environment Variables

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Agent Backend
VITE_AGENT_URL=https://your-agent.railway.app

# App Config (Optional)
VITE_APP_NAME=PazarGlobal
VITE_APP_VERSION=3.0.0
```

### 3. Build Command

Vercel automatically runs:
```bash
npm run build
```

Or specify in `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

### 4. Deploy

```bash
# Install Vercel CLI (optional)
npm i -g vercel

# Deploy
cd pazarglobal-frontend
vercel --prod
```

### 5. Custom Domain (Optional)

1. Go to Vercel Dashboard → Settings → Domains
2. Add custom domain: `pazarglobal.com`
3. Configure DNS (A/CNAME records)
4. SSL automatically provisioned

---

## Local Development

### 1. Setup

```bash
cd pazarglobal-frontend
npm install
```

### 2. Environment Variables

Create `.env`:
```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
VITE_AGENT_URL=http://localhost:8000
```

### 3. Run

```bash
npm run dev
```

Visit: `http://localhost:5173`

### 4. Build (Production)

```bash
npm run build
npm run preview  # Test production build
```

---

## Features

### ✅ Completed
- [x] User authentication (Supabase Auth)
- [x] WebChat interface (realtime messaging)
- [x] Category selection (deterministik)
- [x] Listing creation/search UI
- [x] Image upload + preview
- [x] Profile/favorites management
- [x] i18next (Turkish/English)
- [x] Responsive design (mobile-first)

### 🚧 In Progress
- [ ] Push notifications (Supabase Realtime)
- [ ] Payment integration (Stripe/İyzico)
- [ ] Deep linking (listing sharing)
- [ ] Admin panel (moderation)

---

## Project Structure

```
pazarglobal-frontend/
├── src/
│   ├── components/
│   │   └── feature/
│   │       ├── ChatBox.tsx (WebChat UI)
│   │       ├── TopNavigation.tsx
│   │       └── VoiceChat.tsx
│   ├── pages/
│   │   ├── home/ (Landing page)
│   │   ├── auth/ (Login/Register)
│   │   ├── listings/ (Search/Browse)
│   │   ├── create-listing/ (New listing)
│   │   └── profile/ (User profile)
│   ├── services/
│   │   ├── agentApi.ts (Agent backend calls)
│   │   └── supabase.ts (DB client)
│   ├── stores/
│   │   └── authStore.ts (Zustand state)
│   ├── types/
│   │   └── listing.ts (TypeScript interfaces)
│   └── i18n/ (Translations)
├── supabase/
│   ├── migrations/ (SQL schemas)
│   └── functions/ (Edge Functions)
├── ARCHITECTURE.md (System architecture)
└── README.md
```

---

## API Integration

### Agent Backend Endpoints

```typescript
// Get categories
const categories = await fetch(`${AGENT_URL}/webchat/categories`);

// Send message
const response = await fetch(`${AGENT_URL}/webchat/message`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: userId,
    message: 'iPhone satıyorum',
    session_id: sessionId
  })
});

// Upload media
const formData = new FormData();
formData.append('file', file);
formData.append('user_id', userId);
formData.append('draft_id', draftId);

await fetch(`${AGENT_URL}/webchat/media/analyze`, {
  method: 'POST',
  body: formData
});
```

### Supabase Client

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Auth
await supabase.auth.signInWithPassword({ email, password });

// Realtime
supabase
  .channel('listings')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'listings' }, (payload) => {
    console.log('New listing:', payload);
  })
  .subscribe();
```

---

## Troubleshooting

### Build Fails
- Check `package.json` dependencies
- Verify Node version (18+)
- Run `npm install` again
- Check Vercel build logs

### CORS Errors
- Verify agent backend `CORS_ALLOW_ORIGINS` includes frontend URL
- Check network tab for actual error
- Ensure `.env` variables are loaded

### Authentication Issues
- Verify Supabase project URL/keys
- Check RLS policies in Supabase dashboard
- Test auth in Supabase SQL editor

### Images Not Loading
- Check Supabase Storage bucket permissions
- Verify image URLs are public
- Test direct URL access in browser

---

## Performance Optimization

### 1. Code Splitting
Vite automatically code-splits routes:
```typescript
const Home = lazy(() => import('./pages/home/page'));
const Listings = lazy(() => import('./pages/listings/page'));
```

### 2. Image Optimization
```typescript
// Use Supabase image transformation
const thumbnailUrl = `${imageUrl}?width=300&height=300&fit=cover`;
```

### 3. Caching
```typescript
// Service Worker (PWA)
// Add vite-plugin-pwa to vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ]
});
```

---

## Security Checklist

- [x] Use `VITE_SUPABASE_ANON_KEY` (not service key)
- [x] Enable RLS on all tables
- [x] Sanitize user inputs (XSS prevention)
- [x] HTTPS only (Vercel enforces)
- [x] Content Security Policy headers
- [x] Rate limit API calls (agent backend)
- [x] Keep dependencies updated (`npm audit`)

---

## Testing

### Manual Testing
```bash
npm run dev

# Test flows:
1. Register new user
2. Create listing (with image)
3. Search listings
4. Edit profile
5. Add to favorites
```

### E2E Testing (Future)
```bash
npm install -D playwright
npx playwright test
```

---

**Last Updated:** 15 January 2026
