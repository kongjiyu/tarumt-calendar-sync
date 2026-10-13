# Project guidance

TARUMT calendar sync generates four public subscription feeds: timetable_normal.ics,
timetable_holidays.ics, timetable_replacements.ics, and timetable_exams.ics.

- `npm install`: install dotenv (Node.js 18+).
- `npm run generate`: fetch current data using TARUMT_USERNAME and TARUMT_PASSWORD.
- `npm test`: run isolated API fixture tests without credentials or network access.
- generateTimetable.js authenticates, discovers weeks, fetches each week, and builds the feeds.
- Empty timetable responses may omit weeks; exams must still be fetched.
- Failed requests or malformed data must set a nonzero exit code before publishing any files.
- The workflow deploys all four files as one Pages artifact. Set Pages source to GitHub Actions.
- Generated calendars are ignored by Git. Do not commit personal schedules.
- Calendar event times use Asia/Kuala_Lumpur. Preserve API request signing and mobile headers.
- The old timetable.ics subscription is retired; see both READMEs for migration steps.
