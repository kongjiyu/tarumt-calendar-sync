require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');

const logStream = fs.createWriteStream('timetable.log', { flags: 'a' });
function log(message) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ${message}\n`);
    console.log(message);
}

const loginUrl = "https://app.tarc.edu.my/MobileService/studentLogin.jsp";
const timetableBaseUrl = "https://app.tarc.edu.my/MobileService/services/AJAXStudentTimetable.jsp";
const examTimetableUrl = "https://app.tarc.edu.my/MobileService/services/AJAXExamTimetable.jsp?act=list&mversion=1";
const deviceId = "92542A7E-B31D-461F-8B1C-15215824E3F9";
const deviceModel = "MacBook Air M4";
const username = process.env.TARUMT_USERNAME;
const password = process.env.TARUMT_PASSWORD;

// Constant static app secret from TARUMT mobile app
const APP_SECRET = "3f8a7c12d9e54b88b6a2f4d915c3e7a1";

function createSignature(data, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data);
    return hmac.digest('base64');
}

async function login() {
    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
        username: username,
        password: password,
        deviceid: deviceId,
        devicemodel: deviceModel,
        appversion: "2.0.19",
        fplatform: "ios"
    };

    const paramsString = Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
    const signatureData = paramsString + '|' + timestamp;
    const signature = createSignature(signatureData, APP_SECRET);

    const loginData = new URLSearchParams(params);

    try {
        const response = await fetch(loginUrl, {
            method: "POST",
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/134.0.6998.39 Mobile Safari/537.36',
                'Origin': 'ionic://localhost',
                'Referer': 'https://localhost/',
                'X-Signature': signature,
                'X-Timestamp': timestamp.toString()
            },
            body: loginData.toString()
        });

        const raw = await response.text();
        const jsonStart = raw.lastIndexOf("{");
        if (jsonStart === -1) {
            throw new Error("Login response does not contain JSON");
        }

        const data = JSON.parse(raw.slice(jsonStart));
        if (data.msg === "success" && data.token) {
            log("✅ Login successful");
            return data.token;
        } else {
            throw new Error("Login failed: " + (data.msgdesc || "Unknown error"));
        }
    } catch (error) {
        log("❌ Login error: " + error.message);
        return null;
    }
}

async function getTimetableByWeek(token, week) {
    const timestamp = Math.floor(Date.now() / 1000);
    const sigData = `act=get&week=${week}|${timestamp}`;
    const signature = createSignature(sigData, APP_SECRET);

    try {
        const response = await fetch(`${timetableBaseUrl}?act=get&week=${week}`, {
            method: "POST",
            headers: {
                'X-Auth': token,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/134.0.6998.39 Mobile Safari/537.36',
                'Origin': 'ionic://localhost',
                'X-Signature': signature,
                'X-Timestamp': timestamp.toString()
            }
        });

        const raw = await response.text();
        const match = raw.match(/{[\s\S]*}/);
        if (!match) throw new Error(`Week ${week} response does not contain valid JSON`);
        return JSON.parse(match[0]);
    } catch (error) {
        log(`❌ Error fetching week ${week}: ` + error.message);
        return null;
    }
}

async function getExamTimetable(token) {
    const timestamp = Math.floor(Date.now() / 1000);
    const sigData = `act=list&mversion=1|${timestamp}`;
    const signature = createSignature(sigData, APP_SECRET);

    try {
        const response = await fetch(examTimetableUrl, {
            method: "POST",
            headers: {
                'X-Auth': token,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/134.0.6998.39 Mobile Safari/537.36',
                'Origin': 'ionic://localhost',
                'X-Signature': signature,
                'X-Timestamp': timestamp.toString()
            }
        });

        const raw = await response.text();
        const match = raw.match(/{[\s\S]*}/);
        if (!match) throw new Error("Exam response does not contain valid JSON");
        return JSON.parse(match[0]);
    } catch (error) {
        log("❌ Error fetching exam timetable: " + error.message);
        return null;
    }
}

function parseTimeToHHMMSS(timeStr) {
    const [time, modifier] = timeStr.trim().split(" ");
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
            log("ERROR: Missing TARUMT_USERNAME or TARUMT_PASSWORD");
            process.exit(0);
        }

        const token = await login();
        if (!token) {
            log("Login failed - exiting.");
            process.exit(0);
        }

        // 1. Discover all active weeks using week=all
        log("Discovering active semester weeks...");
        const overview = await getTimetableByWeek(token, "all");
        if (!overview || !overview.weeks) {
            log("No semester weeks found.");
            process.exit(0);
        }

        const activeWeeks = overview.weeks.filter(w => w !== "all");
        log(`Found ${activeWeeks.length} active weeks: ${activeWeeks.join(', ')}`);

        const normalEvents = [];
        const holidayEvents = [];
        const replacementEvents = [];
        const examEvents = [];

        const nowStamp = formatICSDate(new Date());

        // 2. Fetch each week and categorize events
        for (const week of activeWeeks) {
            log(`Fetching Week ${week}...`);
            const weekData = await getTimetableByWeek(token, week);
            if (!weekData || !weekData.rec) continue;

            for (const day of weekData.rec) {
                if (!day.class || day.class.length === 0) continue;

                // Parse exact date provided by TARUMT (DD/MM/YYYY)
                const [d, m, y] = day.date.split('/');
                const datePrefix = `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}`;
                const isHoliday = day.holiday && day.holiday.trim() !== "";

                for (const cls of day.class) {
                    const startHHMM = parseTimeToHHMMSS(cls.fstart);
                    const endHHMM = parseTimeToHHMMSS(cls.fend);
                    const dtStart = `${datePrefix}T${startHHMM}`;
                    const dtEnd = `${datePrefix}T${endHHMM}`;
                    const summary = `(${cls.fclasstype}) ${cls.fdesc}`;
                    const location = cls.froom.trim();

                    if (isHoliday) {
                        // Holiday Clash Event
                        const description = `Holiday: ${day.holiday.trim()}\\nLecturer: ${cls.fstaffname}\\nSubject Code: ${cls.funits}`;
                        holidayEvents.push([
                            "BEGIN:VEVENT",
                            `UID:holiday-${cls.funits}-${datePrefix}-${startHHMM}@timetable.local`,
                            `DTSTAMP:${nowStamp}`,
                            `DTSTART;TZID=Asia/Kuala_Lumpur:${dtStart}`,
                            `DTEND;TZID=Asia/Kuala_Lumpur:${dtEnd}`,
                            `SUMMARY:${summary}`,
                            `LOCATION:${location}`,
                            `DESCRIPTION:${description}`,
                            "END:VEVENT"
                        ].join("\n"));
                    } else if (cls.replace === "Y") {
                        // Replacement Class Event
                        const description = `Status: Replacement Class\\nLecturer: ${cls.fstaffname}\\nSubject Code: ${cls.funits}`;
                        replacementEvents.push([
                            "BEGIN:VEVENT",
                            `UID:replace-${cls.funits}-${datePrefix}-${startHHMM}@timetable.local`,
                            `DTSTAMP:${nowStamp}`,
                            `DTSTART;TZID=Asia/Kuala_Lumpur:${dtStart}`,
                            `DTEND;TZID=Asia/Kuala_Lumpur:${dtEnd}`,
                            `SUMMARY:${summary}`,
                            `LOCATION:${location}`,
                            `DESCRIPTION:${description}`,
                            "END:VEVENT"
                        ].join("\n"));
                    } else {
                        // Normal Class Event
                        const description = `Lecturer: ${cls.fstaffname}\\nSubject Code: ${cls.funits}`;
                        normalEvents.push([
                            "BEGIN:VEVENT",
                            `UID:normal-${cls.funits}-${datePrefix}-${startHHMM}@timetable.local`,
                            `DTSTAMP:${nowStamp}`,
                            `DTSTART;TZID=Asia/Kuala_Lumpur:${dtStart}`,
                            `DTEND;TZID=Asia/Kuala_Lumpur:${dtEnd}`,
                            `SUMMARY:${summary}`,
                            `LOCATION:${location}`,
                            `DESCRIPTION:${description}`,
                            "END:VEVENT"
                        ].join("\n"));
                    }
                }
            }
        }

        // 3. Fetch Exam Schedule
        log("Fetching exam schedule...");
        const examTimetable = await getExamTimetable(token);
        if (examTimetable && examTimetable.rec && examTimetable.rec.length > 0) {
            for (const exam of examTimetable.rec) {
                const yyyy = exam.fexyear;
                const mm = String(new Date(`${exam.fexmonth} 1`).getMonth() + 1).padStart(2, '0');
                const dd = String(exam.fexday).padStart(2, '0');

                const [hour, minute] = parseTimeToHHMMSS(exam.ftime).match(/(\d{2})(\d{2})/).slice(1);
                const start = `${yyyy}${mm}${dd}T${hour}${minute}00`;
                const endHour = parseInt(hour, 10) + parseInt(exam.fhour, 10);
                const end = `${yyyy}${mm}${dd}T${String(endHour).padStart(2, '0')}${minute}00`;
                const location = exam.fsummary && exam.fsummary.split(',')[1]?.trim() || "TARUMT";

                examEvents.push([
                    "BEGIN:VEVENT",
                    `UID:exam-${exam.funits}-${start}@timetable.local`,
                    `DTSTAMP:${nowStamp}`,
                    `DTSTART;TZID=Asia/Kuala_Lumpur:${start}`,
                    `DTEND;TZID=Asia/Kuala_Lumpur:${end}`,
                    `SUMMARY:📝 EXAM: ${exam.fdesc}`,
                    `LOCATION:${location}`,
                    `DESCRIPTION:Subject Code: ${exam.funits}\\nType: ${exam.fpaptype}\\nSeat Range: 1–${exam.ftosit}`,
                    "END:VEVENT"
                ].join("\n"));
            }
        }

        // 4. Write all 4 calendar files
        fs.writeFileSync("timetable_normal.ics", buildICSContent(normalEvents, "TARUMT - Classes"));
        fs.writeFileSync("timetable_holidays.ics", buildICSContent(holidayEvents, "TARUMT - Holiday Clashes"));
        fs.writeFileSync("timetable_replacements.ics", buildICSContent(replacementEvents, "TARUMT - Replacements"));
        fs.writeFileSync("timetable_exams.ics", buildICSContent(examEvents, "TARUMT - Exams"));

        log(`\n🎉 Calendars successfully generated:`);
        log(`- timetable_normal.ics: ${normalEvents.length} events`);
        log(`- timetable_holidays.ics: ${holidayEvents.length} events`);
        log(`- timetable_replacements.ics: ${replacementEvents.length} events`);
        log(`- timetable_exams.ics: ${examEvents.length} events`);

    } catch (error) {
        log(`❌ Error in main: ${error.message}`);
        process.exit(0);
    }
}

main();

process.on('exit', () => {
    logStream.end();
});
