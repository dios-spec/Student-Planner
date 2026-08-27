# Stage 12 teacher verification setup

Stage 12 never puts the teacher password in client code. The app sends it over HTTPS to
`/api/verify-teacher`; the server verifies the signed Firebase ID token, compares a SHA-256
password hash in constant time, rate-limits failures, and writes the `role: teacher` custom claim.

## 1. Create the password verifier

Choose a new, unique teacher password (16+ random characters). Do not put the password
or its verifier in a `VITE_*` variable, source file, screenshot, or chat message.

From the project folder:

```
npm run teacher:hash
```

It prompts for the password with the input hidden, never writes it to disk, argv or any
log, and prints only a verifier that looks like:

```
scrypt$N=16384,r=8,p=1$<salt>$<hash>
```

### Why this replaced the old SHA-256 value

The previous setup stored a bare, unsalted SHA-256 of the password. SHA-256 is a fast
hash, so a human-chosen password is recoverable from that digest offline in seconds with
commodity hardware, and the digest sits in an environment variable readable by anyone
with dashboard access or a logged environment dump. Recovering it grants the
`role: teacher` custom claim. The server-side rate limit (5 attempts per user, 25 per IP)
only ever protected the online guessing path.

scrypt is salted and deliberately slow and memory-hard, so the verifier is not a
practical target for offline cracking, and two deployments using the same password no
longer share a digest.

## 2. Add the server environment variable

In Vercel, open **Project -> Settings -> Environment Variables** and add:

- Name: `TEACHER_VERIFICATION_PASSWORD_HASH`
- Value: the `scrypt$...` verifier printed above
- Environments: Production, plus Preview if you test preview deployments

The existing server endpoints also require the existing Firebase Admin values:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

Never prefix any of these values with `VITE_`. Redeploy after saving them.

### Migrating from the old variable

The old `TEACHER_VERIFICATION_PASSWORD_SHA256` is still accepted, so deploying this code
before you rotate cannot lock teachers out. While it is in use the server logs a warning
once per instance. **Delete `TEACHER_VERIFICATION_PASSWORD_SHA256` once
`TEACHER_VERIFICATION_PASSWORD_HASH` is set and deployed** -- if both are present the new
one wins, but leaving the weak digest in the environment defeats the point of rotating.

Rotating changes future verification only. Teachers who are already verified keep their
role, because the role lives in a Firebase custom claim, not in the password.

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
