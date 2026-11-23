# Setup: login, per-user scores and emailed PDF reports

Everything here is free. No credit card, no Blaze plan, no Cloud Functions. Time needed: about 30 minutes.

What you set up:

| Part | Does | Where |
|---|---|---|
| Firebase Auth | sign-up, login, email verification, Google login | Firebase console |
| Firestore | each user's own score history | Firebase console |
| Apps Script mailer | emails the PDF report after an exam | script.google.com |
| GitHub Pages | hosts the site | github.com |

Your live address: `https://mursalfk.github.io/spsc-cce-mock-tests/`

---

## 1. Firebase

### 1.1 Create the project
1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. **Create a project**. Name it `spsc-cce-mock-tests`. Turn Google Analytics **off**.
3. Stay on the **Spark (free)** plan. Never click Upgrade. Spark has no billing account, so it cannot charge you; if a free limit is hit the feature just stops.

### 1.2 Add a web app and copy the config
1. Project overview > **Add app** > the web icon `</>`.
2. Nickname `web`. Do **not** tick Firebase Hosting. Click **Register app**.
3. Copy the `firebaseConfig` values: `apiKey`, `authDomain`, `projectId`, `appId`.
4. Open `assets/firebase-config.js` and replace the four `PASTE_...` values. Leave `mailEndpoint` for step 2.

```js
window.SPSC_CONFIG = {
  firebase: {
    apiKey: "AIza...",
    authDomain: "spsc-cce-mock-tests.firebaseapp.com",
    projectId: "spsc-cce-mock-tests",
    appId: "1:1234567890:web:abcdef"
  },
  mailEndpoint: "PASTE_YOUR_APPS_SCRIPT_EXEC_URL",
  passMark: 66
};
```

These values are not secrets. They only name your project. What protects your data is login plus the Firestore rules (1.5).

### 1.3 Turn on sign-in methods
**Build > Authentication > Get started > Sign-in method**
- **Email/Password**: enable (leave "Email link" off).
- **Google**: enable, choose a support email, save.

### 1.4 Create the database
**Build > Firestore Database > Create database**
- Edition: **Standard** (if asked).
- Location: nearest to you, for example `asia-south1` (Mumbai). It cannot be changed later.
- Mode: **Production**.

### 1.5 Publish the rules
1. Firestore Database > **Rules** tab.
2. Delete everything, paste the contents of `firestore.rules` from this folder.
3. **Publish**.

The rules let a logged-in, email-verified user read and write only their own records.

### 1.6 Authorize your website address
**Authentication > Settings > Authorized domains > Add domain**: `mursalfk.github.io`

`localhost` is already there (needed for step 3). Without this, login shows "This website address is not authorised".

### 1.7 Optional: verification email wording
**Authentication > Templates > Email address verification > edit**: set a sender name and subject you like. Firebase sends these from its own address, so they can land in spam the first time. Tell your users to check the spam folder.

---

## 2. The email sender (Google Apps Script)

This sends the PDF from your own Gmail account for free. Each user gets the report only at the address on their verified account.

1. Go to <https://script.google.com> > **New project**. Name it `SPSC mailer`.
2. Delete the sample code. Paste all of `backend/Code.gs`. Save.
3. **Project Settings** (gear) > **Script properties** > **Add script property**:

| Property | Value |
|---|---|
| `FIREBASE_API_KEY` | the same `apiKey` as in step 1.2 |
| `SITE_URL` | `https://mursalfk.github.io/spsc-cce-mock-tests/` |
| `SENDER_NAME` | optional, for example `Mock Test Practice` (keep "SPSC" out of it) |

4. In the editor, pick the function `setup` and click **Run**. Google asks for permission. If it says "Google hasn't verified this app", click **Advanced > Go to SPSC mailer (unsafe)**. It is your own script. Allow. The log should end with "Permissions granted".
5. **Deploy > New deployment** > gear > **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the **Web app URL** (ends in `/exec`).
6. Paste that URL into `mailEndpoint` in `assets/firebase-config.js`.

"Anyone" is required because a browser cannot log in to Google on your behalf. The script itself rejects every request that does not carry a valid Firebase login token for a verified email.

**If you edit Code.gs later:** Deploy > **Manage deployments** > pencil > Version: **New version** > Deploy. The URL stays the same.

**Sender account:** mails go out from the Google account that owns the script. If you would rather not use your personal Gmail, create a separate Gmail, do step 2 there.

---

## 3. Test on your computer first

Login does not work from a file opened by double-click. Use a local web server:

```bash
cd spsc-cce-mock-tests
python3 -m http.server 8000
```

Open <http://localhost:8000>. Then follow the checklist in section 5.

---

## 4. Put it on GitHub Pages

The repo must be **public** (Pages on private repos needs a paid plan).

**New repo:**
```bash
cd spsc-cce-mock-tests
git init -b main
git add .
git commit -m "Add SPSC CCE-2026 mock test pack with login and emailed PDF reports"
gh repo create spsc-cce-mock-tests --public --source=. --push \
  --description "21 mock tests (200 MCQs each) for the SPSC CCE-2026 Screening Test. Firebase login, per-user score history, emailed PDF reports. SPSC marking."
gh repo edit --add-topic spsc --add-topic spsc-cce --add-topic cce-2026 --add-topic sindh --add-topic pakistan --add-topic mock-test --add-topic mcq --add-topic quiz --add-topic flashcards --add-topic exam-prep --add-topic vanilla-javascript --add-topic static-site --add-topic firebase --add-topic firebase-auth --add-topic firestore --add-topic google-apps-script --add-topic pdf-report --add-topic github-pages
gh api -X POST repos/mursalfk/spsc-cce-mock-tests/pages -f "source[branch]=main" -f "source[path]=/"
```

**Repo already exists (you pushed the old pack):** copy everything from this folder over your repo folder (replace files), then:
```bash
git add -A
git commit -m "Add login, per-user score history and emailed PDF reports"
git push
gh repo edit --description "21 mock tests (200 MCQs each) for the SPSC CCE-2026 Screening Test. Firebase login, per-user score history, emailed PDF reports. SPSC marking."
gh repo edit --remove-topic offline-first
```

Wait 1 to 2 minutes, then open `https://mursalfk.github.io/spsc-cce-mock-tests/`. If it is not live, check Settings > Pages: Source = Deploy from a branch, `main`, `/ (root)`.

Without `gh`: create the repo on github.com, upload the files, then Settings > Pages as above.

---

## 5. Test checklist (do this once, on the live site)

1. Open the site while logged out. You should see all 21 tests with lock icons and a "Browse freely" banner.
2. Click a test. The login box opens. Choose **Create account**, enter name, email, password.
3. Open the verification email (check spam), click the link. The page notices by itself within a few seconds and takes you to the test.
4. Start a test, answer 3 questions, press **Finish**. The result page says "Report emailed to ...". Check your inbox (and spam) for the PDF.
5. Click **Download PDF** and **Email it to me again**.
6. Go back to the home page. "Your progress" and "Recent tests" show the attempt.
7. Sign out. Create a second account (another email). Confirm it starts with no history.
8. Firebase console > Firestore Database > Data: `users > (user id) > attempts` shows the records. You can see every user's scores here.
9. Try Google login once.

---

## 6. What to know (honest limits)

- **The login gate is a front-end gate.** The questions are inside the page files, so someone who knows how to view page source could read them without an account. The gate controls the normal user experience, scores and emails. It is not DRM. Real protection would need a paid server.
- **Every finished test (at least one question answered) is saved and emailed.** Flashcards are not scored.
- **Quotas (free):**
  - Gmail from Apps Script: about **100 emails a day in total** across all users. The script also caps each user at 25 per day. When the day's limit is used up, users see a message and can still download the PDF.
  - Firestore Spark: 50,000 reads and 20,000 writes a day. Far above what a study group needs.
- **Email can be slow or land in spam** the first time. The Download button always works.
- **Old progress does not carry over.** Earlier versions stored scores in the browser only.
- Scores are stored under the user's own Firebase account and can be seen by you (project owner) in the console. Mention that to the people you invite.
- To remove a user: Authentication > Users > delete. Their records stay in Firestore until you delete `users/(id)` there.
- Google login uses a pop-up. If the browser blocks it, allow pop-ups for the site.

---

## 7. Troubleshooting

| You see | Cause and fix |
|---|---|
| "Login is not set up yet" | `assets/firebase-config.js` still has `PASTE_` values, or the file was not pushed. |
| "This website address is not authorised" | Step 1.6. Add the exact domain, no `https://`, no path. |
| "This sign-in method is not switched on" | Step 1.3. |
| Login does nothing on a local file | Use `python3 -m http.server` (step 3), not a double-clicked file. |
| Result page: "Emailing is not switched on" | `mailEndpoint` is still a placeholder. |
| "Could not email the report (...)" | Press **Email it to me again**. If it keeps failing: Apps Script > **Executions** shows the error. Common causes: `FIREBASE_API_KEY` missing, `setup` never run, deployment is not "Anyone", or you edited Code.gs without a **New version** deploy. |
| "Your sign-in could not be verified" | Wrong `FIREBASE_API_KEY` in Script properties. |
| "Verify your email address first" | The account's email is not verified yet. |
| Scores missing on the home page | Rules not published (1.5), or the account is not verified. Scores still stay in that browser. |
| "Could not confirm whether the report was sent" | The browser could not read the mailer's reply (some phones, weak network). The email often still arrives. Check inbox and spam before pressing resend. |
