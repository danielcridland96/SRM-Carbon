# Environment Variables Reference

## Azure Static Web App — Application Settings

Set in: **Azure Portal → Static Web App → Configuration → Application settings**
(or via `az staticwebapp appsettings set`)

These are available to both the Azure Functions API (`process.env.*`) and referenced
by name in `staticwebapp.config.json`.

| Variable | Required | Description |
|---|---|---|
| `AZURE_POSTGRESQL_CONNECTIONSTRING` | ✅ | Full PostgreSQL connection string for Azure Database for PostgreSQL. Format: `postgresql://user:password@server.postgres.database.azure.com:5432/srmcarbon?ssl=true` |
| `AZURE_CLIENT_ID` | ✅ | Azure AD App Registration Application (client) ID. Referenced by name in `staticwebapp.config.json`. |
| `AZURE_CLIENT_SECRET` | ✅ | Azure AD App Registration client secret value. Referenced by name in `staticwebapp.config.json`. |

---

## Local Development (Azure Functions)

Create `api/local.settings.json` (git-ignored) from `api/local.settings.json.example`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "AZURE_POSTGRESQL_CONNECTIONSTRING": "postgresql://srmadmin:password@srm-carbon-db.postgres.database.azure.com:5432/srmcarbon?ssl=true"
  }
}
```

> For local function testing, `x-ms-client-principal` headers won't be injected
> automatically. Use the [SWA CLI](https://github.com/Azure/static-web-apps-cli)
> (`swa start`) which emulates the SWA auth layer locally.

---

## Frontend Build Variables

The React frontend no longer uses any Vite environment variables — all configuration
has moved to `staticwebapp.config.json` and the Azure Functions environment.

The old `.env` file (containing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`)
is no longer needed and can be deleted.

---

## GitHub Secrets

| Secret | How to set | Used by |
|---|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Auto-set by `az staticwebapp create --login-with-github`, or manually from Azure Portal → Static Web App → Manage deployment token | GitHub Actions deployment workflow |
