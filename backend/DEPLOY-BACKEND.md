# Putting the chatbot backend online (Render)

The website and widget are on Netlify. The backend (this folder) needs its own always-on Node server. These steps use
Render because it can run the backend and keep its files on a persistent disk. Check Render's current plans and
prices first: the disk needs a paid plan, and the embedding model needs about 1 GB of memory or more.

## What is special about this backend (why it is not a plain "git push")
- The search index (backend/data/vectors/knowledge_vectors.json) is in .gitignore, so Git never contains it. Without it
  the hosted chatbot knows nothing about UNILUS. `npm run export:index` makes a copy for Git in backend/seed/.
  That copy deliberately LEAVES OUT documents staff uploaded through the dashboard, so test uploads are not published.
- Everything that changes while it runs lives in backend/data: the database, uploaded documents and the index (which grows
  when a document is uploaded). On a host without a persistent disk all of it disappears at each restart.
  `npm run start:host` (used by render.yaml) points backend/data at the disk and keeps it between deploys.
- The embedding model is downloaded on first use. render.yaml keeps it on the disk and loads it at start-up.

## Step 1. On your computer: make the starting index and push
    cd backend
    npm run export:index
    cd ..
    git status        (backend/seed/ should appear; backend/.env must NOT)
    git add -A
    git commit -m "Add backend hosting setup"
    git push
It prints how many records it kept (about 1480) and which uploaded files it left out. Run it again whenever you rebuild
the index with `npm run build-index`.

## Step 2. Create the service on Render
1. Sign in at render.com and connect your GitHub account.
2. New -> Blueprint -> choose this repository. Render reads render.yaml at the top of the repository.
3. It asks for GROQ_API_KEY: paste it there (never in a file). AUTH_JWT_SECRET and ADMIN_API_KEY are created for you.
4. Check the plan and the 5 GB disk, then apply. The first build takes a few minutes.
5. In the service's Logs, look for:
       [host] backend/data -> /var/data; knowledge index seeded.
       Server running on port ...
       Embedding model warmed up
   "seeded" appears the first time, "already there" afterwards.

## Step 3. Check it
Open the service address (something like https://unilus-chatbot-backend.onrender.com):
you should see "UNILUS Chatbot Backend Running". Then, in PowerShell:
    curl.exe -X POST "https://YOUR-SERVICE.onrender.com/api/chat" -H "Content-Type: application/json" -d "{\"question\":\"When do fees close?\"}"
You should get a JSON answer.

## Step 4. Connect the Netlify site to it
In netlify.toml (repository root), remove the # signs from the redirect block and put your Render address in:
    [[redirects]]
      from = "/api/*"
      to = "https://YOUR-SERVICE.onrender.com/api/:splat"
      status = 200
      force = true
Then git add / commit / push. Netlify redeploys, and https://uniluschatbot.netlify.app/api/... now reaches the backend.
The widget, sign-in and staff dashboard already call /api on their own site, so nothing else changes.

## Step 5. Staff dashboard and email
- Staff admin key: Render -> your service -> Environment -> ADMIN_API_KEY (click to reveal). Enter it on the dashboard sign-in.
- Email for resolved tickets: add RESEND_API_KEY (or SMTP_*) and EMAIL_FROM on the Environment tab. See EMAIL-SETUP.md.

## Things to know
- Replacing the index later: the disk copy is kept on purpose (it contains staff uploads). To replace it with a new
  seed, open the service's Shell and delete /var/data/vectors/knowledge_vectors.json, then redeploy. Staff uploads would
  need uploading again.
- Out of memory (service keeps restarting): choose a bigger plan.
- First request slow or timing out: the model is still loading. Wait for "Embedding model warmed up" in the logs.
- Netlify gives forwarded requests about 26 seconds. If very large file uploads fail, build the widget with
  VITE_API_BASE=https://YOUR-SERVICE.onrender.com/api (a Netlify environment variable) and add your site's address to the
  backend's allowed origins.
- Before real students use it: keep the repository private, replace the demo logins (backend/data/demo_users.json),
  and make sure ADMIN_API_KEY is long and secret.
