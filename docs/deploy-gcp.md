# Deploy to Google Cloud Run (GitHub Actions)

Pushing to `main` or `master` runs tests, builds Docker images, pushes them to **Artifact Registry**, and deploys two **Cloud Run** services (API + static web UI). The workflow then sets `FRONTEND_URL` and `CORS_ORIGINS` on the API to match the web service URL (for magic links and browser CORS).

## 1. Google Cloud setup (one-time)

1. Create or pick a **GCP project** and note its **Project ID**.

2. Enable APIs (Console or gcloud):

   ```bash
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com iamcredentials.googleapis.com
   ```

3. Create an **Artifact Registry** Docker repository (example: `sign-up-system` in the same region you will use for Cloud Run):

   ```bash
   gcloud artifacts repositories create sign-up-system \
     --repository-format=docker \
     --location=asia-east2 \
     --description="sign-up-system images"
   ```

4. **Workload Identity Federation** — connect GitHub to GCP so Actions can deploy without a long-lived JSON key. Follow the official guide:

   - [google-github-actions/auth — Workload Identity Federation](https://github.com/google-github-actions/auth#setting-up-workload-identity-federation)

   You will obtain:

   - **Workload Identity Provider** resource name → GitHub secret `WIF_PROVIDER`
   - **Service account email** → GitHub secret `WIF_SERVICE_ACCOUNT`

5. Grant the GitHub Actions service account (the one in `WIF_SERVICE_ACCOUNT`) at least:

   - `roles/run.admin`
   - `roles/artifactregistry.writer`
   - `roles/iam.serviceAccountUser` (needed so Cloud Run can be updated; scope to the project or the Cloud Run runtime service account per Google’s WIF guide)

## 2. GitHub configuration

### Repository variables (Settings → Secrets and variables → Actions → Variables)

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `GCP_PROJECT_ID` | **Yes** | `my-project-123` | Deploy job runs only if this is set. |
| `GCP_REGION` | No | `asia-east2` | Defaults to `asia-east2` if omitted. |
| `CLOUD_RUN_API_SERVICE` | No | `sign-up-api` | API service name. |
| `CLOUD_RUN_WEB_SERVICE` | No | `sign-up-web` | Web UI service name. |
| `ARTIFACT_REGISTRY_REPO` | No | `sign-up-system` | Must match the repo you created. |
| `CORS_ORIGIN_REGEX` | No | `https://.*\.a\.run\.app$` | Lets the SPA call the API before the final CORS URL is written. |

### Repository secrets

| Secret | Purpose |
|--------|---------|
| `WIF_PROVIDER` | Full Workload Identity Provider name from GCP. |
| `WIF_SERVICE_ACCOUNT` | Service account email for federation. |
| `MONGODB_URL` | MongoDB connection string (Atlas or other). |
| `SMTP_USER` | Gmail (or other SMTP) user. |
| `SMTP_PASSWORD` | App password or SMTP secret. |
| `SMTP_FROM` | From header, e.g. `HKUST FINA Portal <you@gmail.com>`. |
| `ADMIN_EMAILS` | Comma-separated admin emails for the Classes feature. |

Optional: add more secrets later (e.g. extra env vars) by editing `.github/workflows/deploy-gcp.yml`.

## 3. Behaviour

1. **Test** — `frontend`: `npm ci` + `npm run build`. `backend`: install requirements + `compileall`.
2. **Build/push** `api:$GITHUB_SHA` and `web:$GITHUB_SHA` to `{region}-docker.pkg.dev/{project}/{repo}/`.
3. **Deploy API** with MongoDB + SMTP + admin env; temporary `FRONTEND_URL=https://placeholder.invalid`; `CORS_ORIGIN_REGEX` allows typical Cloud Run HTTPS origins.
4. **Deploy web** with `VITE_API_URL` set to the **live API URL** from step 3.
5. **Update API** — set `FRONTEND_URL` and `CORS_ORIGINS` to the **web** Cloud Run URL (magic links and strict CORS).

Open the **web** service URL from the Cloud Run console to use the app.

## 4. Troubleshooting

- **Deploy job skipped:** set variable `GCP_PROJECT_ID`.
- **CORS errors:** Check the last workflow step succeeded; confirm `CORS_ORIGINS` on the API service matches the browser origin (your web Cloud Run URL). Add extra origins via `CORS_ORIGINS` in the workflow if you also host the UI elsewhere (e.g. Vercel).
- **Magic links wrong domain:** `FRONTEND_URL` must be the public web URL; it is updated automatically at the end of each deploy.
- **MongoDB / SMTP special characters:** If `gcloud --set-env-vars` breaks on `&` or commas, store values in [Secret Manager](https://cloud.google.com/secret-manager) and switch the workflow to `--set-secrets` (advanced).

## 5. Cost notes

Cloud Run charges when requests run; `min-instances: 0` allows scale-to-zero. Artifact Registry stores image layers (small ongoing cost). Adjust regions and limits in the workflow as needed.
