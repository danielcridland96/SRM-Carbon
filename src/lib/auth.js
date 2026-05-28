/**
 * auth.js — Azure Static Web Apps built-in authentication helpers.
 *
 * Azure SWA handles the OAuth 2.0 / OpenID Connect flow with Azure AD
 * entirely on the server side. The browser only needs to redirect to
 * /.auth/login/aad to start the flow, and /.auth/me to read the current
 * user's identity after login.
 *
 * No MSAL library or Azure SDK is needed in the browser bundle.
 */

/**
 * getAuthUser — returns the current Azure AD principal from the SWA auth
 * session, or null if the user is not signed in.
 *
 * Response shape:
 *   {
 *     identityProvider: "aad",
 *     userId:           "<azure-object-id>",
 *     userDetails:      "email@srm.com",
 *     userRoles:        ["anonymous", "authenticated"]
 *   }
 */
export async function getAuthUser() {
  try {
    const r = await fetch('/.auth/me');
    if (!r.ok) return null;
    const { clientPrincipal } = await r.json();
    return clientPrincipal; // null when not authenticated
  } catch {
    return null;
  }
}

/**
 * loginUrl — builds the Azure AD login redirect URL.
 * After login, Azure SWA redirects back to post_login_redirect_uri.
 *
 * @param {string} redirectUri  Path to return to after login (default: '/')
 */
export function loginUrl(redirectUri = '/') {
  return `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/**
 * logout — ends the Azure SWA session and redirects to the home page.
 */
export async function logout() {
  window.location.href = '/.auth/logout?post_logout_redirect_uri=/';
}
