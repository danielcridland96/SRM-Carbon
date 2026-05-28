# Azure Infrastructure Setup Guide

This guide covers creating all Azure resources needed for the SRM Carbon Tracker.
Complete steps 1–3 in order. Step 4 (Azure AD App Registration) requires Azure AD
admin access — see `azure-ad-app-registration.md` for those steps.

---

## Prerequisites

- Azure CLI installed: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli
- Access to the SRM Azure subscription
- GitHub repository admin access

Log in to Azure:
```bash
az login
az account set --subscription "<SRM Subscription Name or ID>"
```

---

## Step 1 — Create a Resource Group

```bash
az group create \
  --name rg-srm-carbon \
  --location uksouth
```

---

## Step 2 — Create Azure Database for PostgreSQL Flexible Server

```bash
az postgres flexible-server create \
  --resource-group rg-srm-carbon \
  --name srm-carbon-db \
  --location uksouth \
  --admin-user srmadmin \
  --admin-password "<choose-a-strong-password>" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 16 \
  --storage-size 32 \
  --public-access 0.0.0.0
```

> The `--public-access 0.0.0.0` flag allows Azure services (including Azure Functions)
> to connect. This does not expose the server to the public internet — PostgreSQL
> authentication is still required.

### Create the database

```bash
az postgres flexible-server db create \
  --resource-group rg-srm-carbon \
  --server-name srm-carbon-db \
  --database-name srmcarbon
```

### Run the schema

```bash
psql "postgresql://srmadmin:<password>@srm-carbon-db.postgres.database.azure.com:5432/srmcarbon?ssl=true" \
  -f database/schema.sql
```

### Create the first admin user

After running the schema, insert the first admin's SRM email so they can log in:

```sql
INSERT INTO user_profiles (email, full_name, role, office_name)
VALUES ('daniel.cridland@srm.com', 'Daniel Cridland', 'admin', NULL);
```

> Replace with the actual admin's SRM Microsoft account email.
> `azure_oid` will be populated automatically on their first login.

### Build the connection string

```
postgresql://srmadmin:<password>@srm-carbon-db.postgres.database.azure.com:5432/srmcarbon?ssl=true
```

Save this — it is needed in Step 3.

---

## Step 3 — Create Azure Static Web App

```bash
az staticwebapp create \
  --resource-group rg-srm-carbon \
  --name srm-carbon \
  --location uksouth \
  --source https://github.com/danielcridland96/SRM-Carbon \
  --branch main \
  --app-location "/" \
  --api-location "api" \
  --output-location "dist" \
  --login-with-github
```

This command:
- Creates the Static Web App resource
- Links it to the GitHub repository
- Generates a deployment token and adds it to GitHub Secrets automatically
- Creates the `.github/workflows/azure-static-web-apps.yml` action (already in the repo)

### Set application settings (environment variables)

```bash
SWA_NAME="srm-carbon"
RG="rg-srm-carbon"

az staticwebapp appsettings set \
  --name $SWA_NAME \
  --resource-group $RG \
  --setting-names \
    AZURE_POSTGRESQL_CONNECTIONSTRING="postgresql://srmadmin:<password>@srm-carbon-db.postgres.database.azure.com:5432/srmcarbon?ssl=true" \
    AZURE_CLIENT_ID="<from-azure-ad-app-registration>" \
    AZURE_CLIENT_SECRET="<from-azure-ad-app-registration>"
```

> `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` come from Step 4 (Azure AD App Registration).
> You can set the PostgreSQL connection string now and come back to add the AD settings later.

### Get the deployed URL

```bash
az staticwebapp show \
  --name srm-carbon \
  --resource-group rg-srm-carbon \
  --query "defaultHostname" \
  --output tsv
```

This URL (e.g. `srm-carbon.azurestaticapps.net`) is needed when registering the Azure AD app.

---

## Step 4 — Azure AD App Registration

See `docs/azure-ad-app-registration.md` — **requires Azure AD admin access**.

---

## Step 5 — Configure `staticwebapp.config.json`

Once you have the Tenant ID from Step 4, update the `openIdIssuer` in `staticwebapp.config.json`:

```json
"openIdIssuer": "https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0"
```

Replace `AZURE_TENANT_ID` with the actual value. Commit and push to `main` to redeploy.

---

## Verifying the deployment

1. Navigate to `https://srm-carbon.azurestaticapps.net/`
2. The check-in form should load and show the office banner
3. Navigate to `/portal` — you should be redirected to the Microsoft login page
4. Sign in with `daniel.cridland@srm.com` (or whichever admin email you inserted)
5. After login, the portal should load with the Visitors tab

---

## Custom domain (optional)

```bash
az staticwebapp hostname set \
  --name srm-carbon \
  --resource-group rg-srm-carbon \
  --hostname srm-carbon.yourdomain.com
```

Then add the CNAME record in your DNS provider pointing to `srm-carbon.azurestaticapps.net`.
