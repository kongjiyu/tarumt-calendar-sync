# Migration Guide: Updated Environment Variables

## 🔄 What Changed?

This repository has been updated to use more general and standardized environment variable names.

### Environment Variable Changes

| **Old Name** | **New Name** | **Purpose** |
|-------------|-------------|------------|
| `JIYU_USERNAME` | `TARUMT_USERNAME` | TARUMT login username |
| `JIYU_PASSWORD` | `TARUMT_PASSWORD` | TARUMT login password |
| `CE_USERNAME` | `TARUMT_USERNAME` | TARUMT login username |
| `CE_PASSWORD` | `TARUMT_PASSWORD` | TARUMT login password |

## 📝 Action Required

### For GitHub Actions (Repository Secrets)

1. Go to your repository on GitHub
2. Navigate to **Settings → Secrets and variables → Actions**
3. **Delete** the old secrets:
   - `JIYU_USERNAME`
   - `JIYU_PASSWORD`
   
4. **Add** the new secrets:
   - `TARUMT_USERNAME` = Your TARUMT username
   - `TARUMT_PASSWORD` = Your TARUMT password

### For Local Development

If you have a `.env` file locally, update it:

**Old:**
```env
JIYU_USERNAME=your_username
JIYU_PASSWORD=your_password
```

**New:**
```env
TARUMT_USERNAME=your_username
TARUMT_PASSWORD=your_password
```

See the README.md for complete setup instructions.

## ✨ New Features

### 1. **Improved Error Handling**
- Scripts now exit gracefully (exit code 0) when encountering errors
- GitHub Actions workflows won't fail when:
  - Credentials are missing
  - Login fails
  - No timetable data is available yet
- Added `continue-on-error: true` to the workflow step

### 2. **Better Error Messages**
- Clear messages when credentials are missing
- Informative messages when no timetable data is available
- Proper logging for debugging

### 3. **Comprehensive README**
- Step-by-step fork and setup guide
- Calendar subscription instructions for all major apps
- Troubleshooting section

## 🧪 Testing

After migration, test locally:

```bash
# Should show error message about missing credentials
node generateTimetable.js

# Set credentials and try again
export TARUMT_USERNAME=your_username
export TARUMT_PASSWORD=your_password
node generateTimetable.js
```

## 💡 Why These Changes?

1. **Consistency**: One set of credentials works for both scripts
2. **Clarity**: `TARUMT_USERNAME` is more descriptive than person-specific names
3. **Reliability**: Graceful error handling prevents workflow failures
4. **Maintainability**: Easier for others to understand and use

## 🆘 Troubleshooting

### GitHub Actions still failing?
- Make sure you've added the new secrets: `TARUMT_USERNAME` and `TARUMT_PASSWORD`
- Check that you deleted the old secrets
- Re-run the workflow manually

### Local script not working?
- Verify your `.env` file uses the new variable names
- Make sure the `.env` file is in the project root directory
- Check that `dotenv` is installed: `npm install`

## 📚 Additional Resources

- See `README.md` for full setup and subscription instructions
- Check the updated workflow at `.github/workflows/update-timetable.yml`
