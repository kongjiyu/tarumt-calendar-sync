# 📅 Auto-Updating TARUMT Timetable Generator

> Automatically sync your TARUMT class schedule to any calendar app with daily auto-updates!

This tool generates your TARUMT timetable as a subscribable `.ics` file that automatically updates daily. Once set up, your calendar apps (iPhone, Google Calendar, Outlook, etc.) will always show your latest class schedule.

---

## 🚀 Quick Start Guide

### Step 1: Fork This Repository

1. Click the **Fork** button at the top right of this page
2. This creates your own copy of the repository

### Step 2: Configure GitHub Secrets

Your TARUMT credentials need to be stored securely in GitHub:

1. Go to your **forked repository** on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following two secrets:

   | Secret Name | Value |
   |------------|-------|
   | `TARUMT_USERNAME` | Your TARUMT student ID |
   | `TARUMT_PASSWORD` | Your TARUMT portal password |

   **How to add a secret:**
   - Click "New repository secret"
   - Name: `TARUMT_USERNAME`
   - Secret: Your actual TARUMT username
   - Click "Add secret"
   - Repeat for `TARUMT_PASSWORD`

> ⚠️ **Security Note**: Your credentials are encrypted and never exposed. They're only used by GitHub Actions to fetch your timetable.

### Step 3: Enable GitHub Pages

This makes your timetable file publicly accessible for calendar subscriptions:

1. In your repository, go to **Settings** → **Pages**
2. Under **Source**, select:
   - **Deploy from a branch**
   - Branch: `main`
   - Folder: `/ (root)`
3. Click **Save**
4. Wait ~1 minute for deployment

### Step 4: Get Your Subscription URL

After GitHub Pages is enabled, your calendar subscription URL will be:

```
https://YOUR_GITHUB_USERNAME.github.io/timetable/timetable.ics
```

**Example:**
If your GitHub username is `johnsmith`, the URL would be:
```
https://johnsmith.github.io/timetable/timetable.ics
```

### Step 5: Test the Workflow

Before subscribing, let's make sure everything works:

1. Go to the **Actions** tab in your repository
2. Click on **Update Timetable Daily** workflow
3. Click **Run workflow** → **Run workflow**
4. Wait for it to complete (green checkmark ✅)
5. Check that `timetable.ics` file appears in your repository

---

## 📱 Subscribe to Your Timetable

Once the workflow runs successfully, subscribe in your calendar app:

### Apple Calendar (iPhone/Mac)

**iPhone/iPad:**
1. Open **Settings** → **Calendar** → **Accounts**
2. Tap **Add Account** → **Other** → **Add Subscribed Calendar**
3. Paste your subscription URL
4. Tap **Next** → **Save**
5. Recommended: Set refresh to "Every day"

**Mac:**
1. Open **Calendar** app
2. **File** → **New Calendar Subscription**
3. Paste your subscription URL
4. Click **Subscribe**
5. Set auto-refresh to **Every day**

### Google Calendar

1. Open [Google Calendar](https://calendar.google.com)
2. On the left sidebar, click the **+** next to "Other calendars"
3. Select **From URL**
4. Paste your subscription URL
5. Click **Add calendar**

> Note: Google Calendar may take up to 24 hours to sync

### Microsoft Outlook

**Outlook Desktop:**
1. **File** → **Account Settings** → **Account Settings**
2. **Internet Calendars** tab → **New**
3. Paste your subscription URL → **Add**
4. Give it a name and click **OK**

**Outlook.com:**
1. Click **Add calendar** → **Subscribe from web**
2. Paste your subscription URL
3. Name your calendar and click **Import**

---

## ⚙️ How It Works

### Automatic Updates

The GitHub Action workflow runs automatically:
- **Daily** at **6:00 AM UTC** (2:00 PM Malaysia Time)
- Fetches your latest timetable from TARUMT portal
- Generates an updated `.ics` file
- Publishes it via GitHub Pages

Your calendar apps will automatically refresh and show the latest schedule!

### Manual Updates

You can also trigger an update manually:
1. Go to **Actions** tab
2. Select **Update Timetable Daily**
3. Click **Run workflow** → **Run workflow**

---

## 🛠️ Local Development (Optional)

If you want to test or generate the timetable locally:

### Setup

1. Clone your forked repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/timetable.git
   cd timetable
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the project root:
   ```env
   TARUMT_USERNAME=your_student_id
   TARUMT_PASSWORD=your_password
   ```

### Commands

```bash
# Generate timetable
npm run generate

# Generate exam timetable
npm run generate-exam
```

The generated `.ics` files will open automatically on macOS.

---

## 📂 Generated Files

| File | Description |
|------|-------------|
| `timetable.ics` | Your class timetable (main file to subscribe to) |
| `ce-exam_timetable.ics` | Exam schedule |

---

## 🔧 Troubleshooting

### Workflow fails in GitHub Actions

**Check credentials:**
- Go to **Settings** → **Secrets and variables** → **Actions**
- Verify `TARUMT_USERNAME` and `TARUMT_PASSWORD` are set correctly
- Re-add them if needed

**No timetable data:**
- This is normal if the semester hasn't started yet
- The workflow will complete successfully and generate an empty file
- It will populate automatically once classes are scheduled

### Calendar not updating

**Apple Calendar:**
- Right-click the calendar → **Refresh**
- Check subscription settings (should be set to "Every day")

**Google Calendar:**
- Google refreshes subscribed calendars every 24 hours
- Be patient or remove and re-add the subscription

**Outlook:**
- Right-click the calendar → **Update**

### Can't access subscription URL

**Check GitHub Pages:**
- Settings → Pages → Make sure it's enabled and deployed
- The URL should be: `https://YOUR_USERNAME.github.io/timetable/timetable.ics`

**Repository must be public:**
- Private repositories need GitHub Pro for Pages
- Make sure your repository is set to Public in Settings

---

## 💡 Tips & Best Practices

1. **Keep your repository public** - Required for free GitHub Pages
2. **Don't share your credentials** - They're encrypted in GitHub Secrets
3. **Check Actions tab periodically** - Ensure daily updates are working
4. **Refresh calendar apps manually** - If you need immediate updates after a manual workflow run
5. **Fork, don't clone** - Forking makes it easier to get updates from the original repository

---

## 🤝 Sharing with Classmates

Your classmates can fork this repository and follow the same steps to create their own auto-updating timetable!

Or, if you want to share your timetable with others:
```
https://YOUR_USERNAME.github.io/timetable/timetable.ics
```

They can subscribe to this URL to see your schedule (useful for group projects or study sessions).

---

## 🔒 Privacy & Security

- **Credentials are encrypted** - GitHub Secrets are encrypted and never exposed
- **Timetable is public** - The `.ics` file is publicly accessible via GitHub Pages
- **No sensitive data** - Only class schedules are shared, not grades or personal info
- **You control access** - You can make the repository private anytime (requires GitHub Pro for Pages)

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**What this means:**
- ✅ Free to use, modify, and distribute
- ✅ Can be used for commercial purposes
- ✅ No warranty provided
- ⚠️ Must include the original license and copyright notice

---

## 🆘 Need Help?

- Check the [Troubleshooting](#-troubleshooting) section above
- Review your GitHub Actions logs in the **Actions** tab
- Ensure your TARUMT credentials are correct
- Verify GitHub Pages is enabled and deployed

---

**Made with ❤️ for TARUMT students**
