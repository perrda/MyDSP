# Deploy MyDSP as an HTTPS PWA

MyDSP is a static Vite SPA. **GitHub Pages** is the recommended permanent host (works on Mac, iPhone, iPad — no localhost).

## Live URL (after setup)

`https://perrda.github.io/MyDSP/`

## First-time: push to GitHub + enable Pages

### 1. Sign in to GitHub in Terminal (one time)

```bash
cd ~/AI_Projects/MyDSP
gh auth login
```

Choose: **GitHub.com** → **HTTPS** → **Login with a web browser** → follow the code in the browser.

### 2. Create the MyDSP repo and push

```bash
cd ~/AI_Projects/MyDSP
git add -A
git status
git commit -m "Initial MyDSP app for GitHub Pages"
gh repo create MyDSP --private --source=. --remote=origin --push
```

(Use `--public` instead of `--private` if you prefer the code visible.)

### 3. Turn on GitHub Pages

1. Open https://github.com/perrda/MyDSP  
2. **Settings** → **Pages**  
3. Under **Build and deployment** → **Source**: choose **GitHub Actions**  
4. Wait 1–2 minutes for the deploy workflow (Actions tab) to finish  
5. Open **https://perrda.github.io/MyDSP/**

### 4. Install on devices

- **iPhone / iPad:** Safari → that URL → Share → Add to Home Screen  
- **Mac:** Chrome/Edge → Install app, or Safari bookmark / Home Screen  

Delete any old **localhost** shortcuts.

## Later updates

```bash
cd ~/AI_Projects/MyDSP
git add -A
git commit -m "Describe your change"
git push
```

GitHub Actions rebuilds the live site automatically.

## Other hosts (optional)

- **Netlify:** `npm run build && npx netlify deploy --prod --dir=dist`  
- **Cloudflare Pages:** connect the same GitHub repo  

## Sync between devices

Each browser has its own local data. Use **Settings → Encrypted cloud sync** (or full backup
download/restore) to share between phone and Mac.

**Step-by-step:** [SYNC_SETUP.md](./SYNC_SETUP.md)

### Sync endpoint (Cloudflare Worker) — short version

1. Cloudflare → Workers → create `mydsp-sync`
2. Bind a KV namespace as `STORE`
3. Paste `sync-endpoint/worker.js`
4. Optional: set secret `SYNC_KEY` and append `?key=…` to the URL
5. In MyDSP Settings → Sync, paste the Worker URL and your passphrase → **Push** on desktop,
   **Pull & merge** on phone
