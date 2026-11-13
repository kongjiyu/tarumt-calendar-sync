try { require('dotenv').config(); } catch {}
const fs = require('fs');
const crypto = require('crypto');

const LOGIN_URL = "https://app.tarc.edu.my/MobileService/studentLogin.jsp";
const TIMETABLE_URL = "https://app.tarc.edu.my/MobileService/services/AJAXStudentTimetable.jsp";
const EXAM_URL = "https://app.tarc.edu.my/MobileService/services/AJAXExamTimetable.jsp";
const USER_AGENT = "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/134.0.6998.39 Mobile Safari/537.36";
const DEVICE_ID = "92542A7E-B31D-461F-8B1C-15215824E3F9";
const DEVICE_MODEL = "MacBook Air M4";
const APP_SECRET = "3f8a7c12d9e54b88b6a2f4d915c3e7a1";

const username = process.env.TARUMT_USERNAME;
const password = process.env.TARUMT_PASSWORD;

function createSignature(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('base64');
}

async function login() {
    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
        username: username,
        password: password,
        deviceid: DEVICE_ID,
        devicemodel: DEVICE_MODEL,
        appversion: "2.0.19",
        fplatform: "ios"
    };

    const paramsString = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
    const signature = createSignature(`${paramsString}|${timestamp}`, APP_SECRET);

    try {
        const response = await fetch(LOGIN_URL, {
            method: "POST",
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': USER_AGENT,
                'Origin': 'ionic://localhost',
                'Referer': 'https://localhost/',
                'X-Signature': signature,
                'X-Timestamp': String(timestamp)
            },
            body: new URLSearchParams(params).toString(),
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const raw = await response.text();
        const jsonStart = raw.lastIndexOf("{");
        if (jsonStart === -1) throw new Error("Login response does not contain JSON");

        const data = JSON.parse(raw.slice(jsonStart));
        if (data.msg === "success" && data.token) {
            console.log("✅ Login successful");
            return data.token;
        }
        throw new Error("Login failed: " + (data.msgdesc || "Unknown error"));
    } catch (error) {
        console.error("❌ Login error: " + error.message);
        return null;
    }
}

async function fetchService(baseUrl, queryString, token) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createSignature(`${queryString}|${timestamp}`, APP_SECRET);

    const response = await fetch(`${baseUrl}?${queryString}`, {
        method: "POST",
        headers: {
            'X-Auth': token,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT,
            'Origin': 'ionic://localhost',
            'Referer': 'https://localhost/',
            'X-Signature': signature,
            'X-Timestamp': String(timestamp)
        },
        signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.text();
    const match = raw.match(/{[\s\S]*}/);
    if (!match) throw new Error("Response does not contain valid JSON");
    return JSON.parse(match[0]);
}

async function getTimetableByWeek(token, week) {
    try {
        return await fetchService(TIMETABLE_URL, `act=get&week=${week}`, token);
    } catch (error) {
        console.error(`❌ Error fetching week ${week}: ` + error.message);
        return null;
    }
}

async function getExamTimetable(token) {
    try {
        const data = await fetchService(EXAM_URL, "act=list&mversion=1", token);
        if (data.msg === "pending" && data.msgdesc === "Closed!" && data.rec === undefined) {
            console.log("Exam timetable is closed; no exams are currently published.");
            return { ...data, rec: [] };
        }
        return data;
    } catch (error) {
        console.error("❌ Error fetching exam timetable: " + error.message);
        return null;
    }
}

function parseTimeToHHMMSS(timeStr) {
    const [time, modifier] = timeStr.trim().split(/\s+/);
    let [hours, minutes] = time.split(":").map(Number);
    if (modifier === "PM" && hours !== 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}00`;
}

function formatICSDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}${mm}${dd}T${hh}${min}00`;
}

function buildVEvent({ uid, dtStamp, dtStart, dtEnd, summary, location, description }) {
    return [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART;TZID=Asia/Kuala_Lumpur:${dtStart}`,
        `DTEND;TZID=Asia/Kuala_Lumpur:${dtEnd}`,
        `SUMMARY:${summary}`,
        `LOCATION:${location}`,
        `DESCRIPTION:${description}`,
        "END:VEVENT"
    ].join("\n");
}

function buildICSContent(events, calendarName) {
    return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//TARUMT//Timetable Generator//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        `X-WR-CALNAME:${calendarName}`,
        "X-WR-TIMEZONE:Asia/Kuala_Lumpur",
        "BEGIN:VTIMEZONE",
        "TZID:Asia/Kuala_Lumpur",
        "X-LIC-LOCATION:Asia/Kuala_Lumpur",
        "BEGIN:STANDARD",
        "DTSTART:19700101T000000",
        "TZOFFSETFROM:+0800",
        "TZOFFSETTO:+0800",
        "TZNAME:MYT",
        "END:STANDARD",
        "END:VTIMEZONE",
        ...events,
        "END:VCALENDAR"
    ].join("\n");
}

async function main() {
    try {
        if (!username || !password) {
            throw new Error("Missing TARUMT_USERNAME or TARUMT_PASSWORD");
        }

        const token = await login();
        if (!token) {
            throw new Error("Login failed");
        }

        console.log("Discovering active semester weeks...");
        const [overview, examTimetable] = await Promise.all([
            getTimetableByWeek(token, "all"),
            getExamTimetable(token)
        ]);

        if (!overview || !Array.isArray(overview.rec)) {
            throw new Error("Invalid semester overview; keeping the published calendars unchanged");
        }
        if (!examTimetable || !Array.isArray(examTimetable.rec)) {
            throw new Error("Invalid exam response; keeping the published calendars unchanged");
        }
        if (overview.weeks !== undefined && !Array.isArray(overview.weeks)) {
            throw new Error("Invalid semester weeks");
        }
        if (overview.weeks === undefined && overview.rec.length > 0) {
            throw new Error("Semester weeks missing from a non-empty timetable");
        }

        const activeWeeks = (overview.weeks || []).filter(w => w !== "all");
        console.log(`Found ${activeWeeks.length} active weeks: ${activeWeeks.join(', ')}`);

        const normalEvents = [];
        const holidayEvents = [];
        const replacementEvents = [];
        const examEvents = [];
        const nowStamp = formatICSDate(new Date());

        // Fetch weeks in batches of 4 for speed without triggering WAF rate-limits
        const BATCH_SIZE = 4;
        const weekResults = [];
        for (let i = 0; i < activeWeeks.length; i += BATCH_SIZE) {
            const batch = activeWeeks.slice(i, i + BATCH_SIZE);
            console.log(`Fetching Weeks ${batch.join(', ')}...`);
            const batchData = await Promise.all(
                batch.map(async (week) => ({ week, weekData: await getTimetableByWeek(token, week) }))
            );
            weekResults.push(...batchData);
        }

        for (const { week, weekData } of weekResults) {
            if (!weekData || !Array.isArray(weekData.rec)) {
                throw new Error(`Week ${week} could not be fetched; keeping the published calendars unchanged`);
            }

            for (const day of weekData.rec) {
                if (!day.class || day.class.length === 0) continue;

                const [d, m, y] = day.date.split('/');
                const datePrefix = `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}`;
                const isHoliday = day.holiday && day.holiday.trim() !== "";

                for (const cls of day.class) {
                    const startHHMM = parseTimeToHHMMSS(cls.fstart);
                    const endHHMM = parseTimeToHHMMSS(cls.fend);
                    const dtStart = `${datePrefix}T${startHHMM}`;
                    const dtEnd = `${datePrefix}T${endHHMM}`;
                    const summary = `(${cls.fclasstype}) ${cls.fdesc}`;
                    const location = (cls.froom || "TBA").trim();

                    if (isHoliday) {
                        holidayEvents.push(buildVEvent({
                            uid: `holiday-${cls.funits}-${datePrefix}-${startHHMM}@timetable.local`,
                            dtStamp: nowStamp,
                            dtStart,
                            dtEnd,
                            summary,
                            location,
                            description: `Holiday: ${day.holiday.trim()}\\nLecturer: ${cls.fstaffname}\\nSubject Code: ${cls.funits}`
                        }));
                    } else if (cls.replace === "Y") {
                        replacementEvents.push(buildVEvent({
                            uid: `replace-${cls.funits}-${datePrefix}-${startHHMM}@timetable.local`,
                            dtStamp: nowStamp,
                            dtStart,
                            dtEnd,
                            summary,
                            location,
                            description: `Status: Replacement Class\\nLecturer: ${cls.fstaffname}\\nSubject Code: ${cls.funits}`
                        }));
                    } else {
                        normalEvents.push(buildVEvent({
                            uid: `normal-${cls.funits}-${datePrefix}-${startHHMM}@timetable.local`,
                            dtStamp: nowStamp,
                            dtStart,
                            dtEnd,
                            summary,
                            location,
                            description: `Lecturer: ${cls.fstaffname}\\nSubject Code: ${cls.funits}`
                        }));
                    }
                }
            }
        }

        console.log("Processing exam schedule...");
        for (const exam of examTimetable.rec) {
            const yyyy = exam.fexyear;
            const mm = String(new Date(`${exam.fexmonth} 1`).getMonth() + 1).padStart(2, '0');
            const dd = String(exam.fexday).padStart(2, '0');

            const [hour, minute] = parseTimeToHHMMSS(exam.ftime).match(/(\d{2})(\d{2})/).slice(1);
            const start = `${yyyy}${mm}${dd}T${hour}${minute}00`;
            const endTotalMins = parseInt(hour, 10) * 60 + parseInt(minute, 10) + Math.round(parseFloat(exam.fhour) * 60);
            const endHH = String(Math.floor(endTotalMins / 60)).padStart(2, '0');
            const endMM = String(endTotalMins % 60).padStart(2, '0');
            const end = `${yyyy}${mm}${dd}T${endHH}${endMM}00`;
            const location = (exam.fsummary && exam.fsummary.split(',')[1]?.trim()) || "TARUMT";

            examEvents.push(buildVEvent({
                uid: `exam-${exam.funits}-${start}@timetable.local`,
                dtStamp: nowStamp,
                dtStart: start,
                dtEnd: end,
                summary: `📝 EXAM: ${exam.fdesc}`,
                location,
                description: `Subject Code: ${exam.funits}\\nType: ${exam.fpaptype}\\nSeat Range: 1–${exam.ftosit}`
            }));
        }

        const allEvents = [...normalEvents, ...holidayEvents, ...replacementEvents, ...examEvents];
        fs.writeFileSync("timetable.ics", buildICSContent(allEvents, "TARUMT - Timetable"));
        fs.writeFileSync("timetable_normal.ics", buildICSContent(normalEvents, "TARUMT - Classes"));
        fs.writeFileSync("timetable_holidays.ics", buildICSContent(holidayEvents, "TARUMT - Holiday Clashes"));
        fs.writeFileSync("timetable_replacements.ics", buildICSContent(replacementEvents, "TARUMT - Replacements"));
        fs.writeFileSync("timetable_exams.ics", buildICSContent(examEvents, "TARUMT - Exams"));

        console.log("\n🎉 Calendars successfully generated:");
        console.log(`- timetable.ics: ${allEvents.length} events`);
        console.log(`- timetable_normal.ics: ${normalEvents.length} events`);
        console.log(`- timetable_holidays.ics: ${holidayEvents.length} events`);
        console.log(`- timetable_replacements.ics: ${replacementEvents.length} events`);
        console.log(`- timetable_exams.ics: ${examEvents.length} events`);

        return 0;
    } catch (error) {
        console.error(`❌ Error in main: ${error.message}`);
        return 1;
    }
}

if (require.main === module) {
    main().then((exitCode) => process.exit(exitCode));
}
