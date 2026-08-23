# Stage 12 teacher verification setup

Stage 12 never puts the teacher password in client code. The app sends it over HTTPS to
`/api/verify-teacher`; the server verifies the signed Firebase ID token, compares a SHA-256
password hash in constant time, rate-limits failures, and writes the `role: teacher` custom claim.

## 1. Create the password hash

Choose a new, unique teacher password (preferably 16+ random characters). Do not put the password
or its hash in a `VITE_*` variable, source file, screenshot, or chat message.

Run this in PowerShell. It hides the password while you type and prints only its SHA-256 hash:

```powershell
$secure = Read-Host "Teacher password" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($plain)
    $hash = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}
$hash
```

## 2. Add the server environment variable

In Vercel, open **Project → Settings → Environment Variables** and add:

- Name: `TEACHER_VERIFICATION_PASSWORD_SHA256`
- Value: the 64-character hash printed above
- Environments: Production, plus Preview if you test preview deployments

The existing server endpoints and this endpoint also require the existing Firebase Admin values:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

Never prefix any of these four values with `VITE_`. Redeploy after saving them.

## 3. Deploy the security rules before the new app

From the project folder:

```powershell
firebase deploy --only firestore:rules
npm run build
```

Then deploy the app to Vercel. Deploying the rules first closes the old profile-field write path
before teacher badges become visible.

## 4. Verify the flow

1. On a new profile, choose **Teacher** during onboarding and enter the teacher password.
2. On an existing profile, open **You → Are you a teacher?**.
3. After success, confirm that **Verified teacher** appears on the profile.
4. Enter a wrong password once and confirm that no role is granted.

The client force-refreshes its Firebase ID token after verification, so a reload should not be
needed. Five failed attempts lock that user for 30 minutes; the broader IP limit is 25 attempts.

Changing the password protects future verification but does not revoke teachers who were already
verified. Removing an existing teacher must clear the user's custom `role` claim and the matching
server-managed profile fields with the Firebase Admin SDK.
