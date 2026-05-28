# Azure AD App Registration Guide

**Requires:** Azure AD (Entra ID) admin access on the SRM tenant.

This registers the SRM Carbon Tracker as an application in Azure AD so staff can
sign in using their SRM Microsoft accounts.

---

## Step 1 — Create the App Registration

In the Azure Portal:

1. Go to **Azure Active Directory** → **App registrations** → **New registration**
2. Fill in:
   - **Name:** `SRM Carbon Tracker`
   - **Supported account types:** `Accounts in this organizational directory only (SRM only - Single tenant)`
   - **Redirect URI:** Select `Web` and enter `https://srm-carbon.azurestaticapps.net/.auth/login/aad/callback`
     > Replace with your actual Static Web App URL from Step 3 of the infrastructure guide.
3. Click **Register**

---

## Step 2 — Record the IDs

On the app registration overview page, copy:

| Value | Where used |
|---|---|
| **Application (client) ID** | `AZURE_CLIENT_ID` app setting in Static Web App |
| **Directory (tenant) ID** | `openIdIssuer` in `staticwebapp.config.json` |

---

## Step 3 — Create a Client Secret

1. Go to **Certificates & secrets** → **New client secret**
2. Description: `SRM Carbon Tracker - Static Web App`
3. Expiry: **24 months** (set a calendar reminder to rotate before expiry)
4. Click **Add**
5. **Copy the secret value immediately** — it is only shown once

Save this as `AZURE_CLIENT_SECRET` in the Static Web App application settings.

---

## Step 4 — Configure API Permissions (optional)

The app only needs the default `openid`, `profile`, and `email` claims to identify
users. No additional API permissions are required unless you add Microsoft Graph
integration in the future.

Verify under **API permissions** that these are present:
- `Microsoft Graph` → `User.Read` (delegated)

---

## Step 5 — Update `staticwebapp.config.json`

In the repository, update `staticwebapp.config.json` with the real Tenant ID:

```json
"openIdIssuer": "https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0"
```

Commit and push to trigger a redeployment.

---

## Step 6 — Add the App Settings to Azure Static Web Apps

In the Azure Portal → Static Web App → **Configuration** → **Application settings**:

| Name | Value |
|---|---|
| `AZURE_CLIENT_ID` | Application (client) ID from Step 2 |
| `AZURE_CLIENT_SECRET` | Secret value from Step 3 |

Or via CLI:
```bash
az staticwebapp appsettings set \
  --name srm-carbon \
  --resource-group rg-srm-carbon \
  --setting-names \
    AZURE_CLIENT_ID="<application-client-id>" \
    AZURE_CLIENT_SECRET="<client-secret-value>"
```

---

## Step 7 — Verify

1. Navigate to `https://srm-carbon.azurestaticapps.net/portal`
2. You should be redirected to `login.microsoftonline.com`
3. Sign in with an SRM account that has a row in `user_profiles`
4. After login, the portal loads with the correct role and office

---

## Troubleshooting

**"Admin access required" after login**
The signed-in Microsoft account does not have a row in `user_profiles`. Insert one via psql:
```sql
INSERT INTO user_profiles (email, full_name, role, office_name)
VALUES ('email@srm.com', 'Full Name', 'admin', NULL);
```

**Redirect URI mismatch error**
The URI in the app registration must exactly match the SWA URL. Check the registered
redirect URI includes `/.auth/login/aad/callback` and uses `https`.

**AADSTS50011: The redirect URI specified in the request does not match**
Add the exact URI shown in the error to the app registration's redirect URIs.
