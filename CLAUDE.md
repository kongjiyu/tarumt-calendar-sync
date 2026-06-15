# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TARUMT Timetable Generator — auto-syncs TARUMT (Tunku Abdul Rahman University of Management and Technology) class schedules and exam timetables to any calendar app via `.ics` files. Runs daily via GitHub Actions and publishes to GitHub Pages.

## Development Commands

```bash
npm install              # Install dependencies (dotenv is the only dep)
npm run generate         # Generate combined timetable.ics (classes + exams)
npm run generate-exam    # Generate exam_timetable.ics only (legacy)
node test-api.js         # Interactive API tester (requires node-fetch)
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TARUMT_USERNAME` | Student ID (e.g. 2500001) | Yes |
| `TARUMT_PASSWORD` | TARUMT portal password | Yes |
| `APP_SECRET` | HMAC signing secret for API requests | No (has fallback for local dev) |

For local development, create a `.env` file in the project root.

## Architecture

**Two-script design:**

- `generateTimetable.js` — Main script. Fetches both class and exam timetables, combines them into a single `timetable.ics` file. This is what GitHub Actions runs daily.
- `generateExamTimetable.js` — Legacy script for exam-only generation. Uses older API endpoint (`login.jsp`) without HMAC signature verification.
- `test-api.js` — Interactive API tester for debugging TARUMT's mobile API (login, attendance, exam endpoints).

**TARUMT Mobile API:**

The app reverse-engineers TARUMT's official mobile app API. Key details:

- **Base URL:** `https://app.tarc.edu.my/MobileService/`
- **Auth:** POST to `studentLogin.jsp`, returns an `X-Auth` token in response JSON
- **Request signing:** HMAC-SHA256 signature over `key=value&...|unix_timestamp` using `APP_SECRET`, sent as `X-Signature` header with `X-Timestamp`
- **Endpoints:**
  - Class timetable: `services/AJAXStudentTimetable.jsp?act=get&week=all`
  - Exam timetable: `services/AJAXExamTimetable.jsp?act=list&mversion=1`
  - Attendance: `services/AJAXAttendance.jsp?act=get-today-list` (GET), `?act=insert` (POST)
- **User-Agent:** Android Chrome mobile (required — API rejects non-mobile UAs)

**ICS Generation:**

Events are constructed as raw ICS strings (no library). Each event uses `TZID=Asia/Kuala_Lumpur`. Class events repeat weekly based on `fweedur` field (supports "all" or comma/range notation like "1-3,5,7-9"). Exam events are single occurrences.

**GitHub Actions Workflow** (`.github/workflows/update-timetable.yml`):

- Triggers: daily cron (6:00 AM MYT), manual dispatch, push to main
- Runs `node generateTimetable.js` with `continue-on-error: true`
- Commits `timetable.ics` only if changed
- Credentials stored in GitHub Secrets (`TARUMT_USERNAME`, `TARUMT_PASSWORD`)

## Key Conventions

- All timestamps use Malaysia timezone (`Asia/Kuala_Lumpur`)
- Script exits with code 0 on errors to avoid failing GitHub Actions (logs errors instead)
- `timetable.log` is written as append-only log during generation
- On macOS local runs, the generated `.ics` file auto-opens via `open` command
- Semester start date is parsed from `classTimetable.duration` field (format: "1 Jan" style)
- Current year is always used for semester start (TARUMT always returns active semester)
