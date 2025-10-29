require('dotenv').config();
const fs = require('fs');
const logStream = fs.createWriteStream('timetable.log', { flags: 'a' });
function log(message) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ${message}\n`);
}
// for execute at macos
const { exec } = require('child_process'); 

const loginUrl = "https://app.tarc.edu.my/MobileService/login.jsp";
const timetableUrl = "https://app.tarc.edu.my/MobileService/services/AJAXStudentTimetable.jsp?act=get&week=all"
const deviceId = "92542A7E-B31D-461F-8B1C-15215824E3F9"
const deviceModel = "MacBook Air M4 24GB RAM 512GB ROM"
const username = process.env.JIYU_USERNAME;
const password = process.env.JIYU_PASSWORD;

async function login(){
    const loginData = new URLSearchParams({
        username: username,
        password: password,
        deviceid: deviceId,
        devicemodel: deviceModel,
        appversion: "2.0.18"
    });

    const fetchOptions = {
        method: "POST",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
            'Origin': 'ionic://localhost'
        },
        body: loginData.toString()
    };

    try {
        const response = await fetch(loginUrl, fetchOptions);
        const raw = await response.text();

        const jsonStart = raw.lastIndexOf("{");
        if (jsonStart === -1) {
            throw new Error("Login response does not contain JSON");
        }
        const jsonPart = raw.slice(jsonStart);
        const data = JSON.parse(jsonPart);

        if (data.msg === "success" && data.token) {
            log("Login successful");
            return data.token;
        } else {
            throw new Error("Login failed: " + (data.msgdesc || "Unknown error"));
        }
    } catch (error) {
        log("Login error: " + error.message);
        return null;
    }
}

async function getTimetable(token){
    const fetchOptions = {
        method: "POST",
        headers: {
            'X-Auth': token,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
            'Origin': 'ionic://localhost'
        }
    };

    try{
        const response = await fetch(timetableUrl, fetchOptions);
        const raw = await response.text();
        const match = raw.match(/{[\s\S]*}/);
        if (!match) {
            throw new Error("Login response does not contain valid JSON");
        }
        const data = JSON.parse(match[0]);  

        return data;
        
    } catch(error){
        log("Login error: " + error.message);
        return null;
    }
}

async function generateICS(timetable) {
    // Semester start date: week 1 is 2025-02-10 (Monday)
    const semesterStart = extractSemesterStart(timetable.duration);
    const events = [];

    for (const day of timetable.rec) {
        const dow = parseInt(day.dow); // 1=Mon, ..., 7=Sun
        if (!day.class) continue;

        for (const cls of day.class) {
            // Use fweedur if present, otherwise "all"
            const weekList = parseWeeks(cls.fweedur || "all", timetable.weeks);
            for (const week of weekList) {
                // Calculate the date for this week and day of week
                const baseDate = new Date(semesterStart);
                baseDate.setDate(baseDate.getDate() + (week - 1) * 7 + dow);

                const baseDateStr = baseDate.toISOString().split("T")[0];
                const startDateTime = new Date(baseDateStr + "T" + convertTo24Hour(cls.fstart));
                const endDateTime = new Date(baseDateStr + "T" + convertTo24Hour(cls.fend));

                const event = [
                    "BEGIN:VEVENT",
                    `UID:${cls.funits}-W${week}-${day.dow}-${cls.fstart}@timetable.local`,
                    `DTSTAMP:${formatICSDate(new Date())}`,
                    `DTSTART;TZID=Asia/Kuala_Lumpur:${formatICSDate(startDateTime)}`,
                    `DTEND;TZID=Asia/Kuala_Lumpur:${formatICSDate(endDateTime)}`,
                    `SUMMARY:(${cls.fclasstype}) ${cls.fdesc}`,
                    `LOCATION:${cls.froom.trim()}`,
                    `DESCRIPTION:Lecturer: ${cls.fstaffname}\\nSubject Code: ${cls.funits}`,
                    "END:VEVENT"
                ].join("\n");
                events.push(event);
            }
        }
    }

    const icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//TARUMT//Timetable Generator//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        ...events,
        "END:VCALENDAR"
    ].join("\n");

    fs.writeFileSync("timetable.ics", icsContent);
    log("ICS file generated: timetable.ics");
}
// Helper to parse week string, e.g. "all", "1-3,5,7-9"
function parseWeeks(weekStr, allWeeks) {
    if (weekStr === "all") return allWeeks.filter(w => w !== "all").map(Number);
    return weekStr.split(',').flatMap(part => {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            return Array.from({ length: end - start + 1 }, (_, i) => start + i);
        } else {
            return [Number(part)];
        }
    });
}

function formatICSDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = "00";
    return `${yyyy}${mm}${dd}T${hh}${min}${ss}`;
}

function convertTo24Hour(timeStr) {
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (modifier === "PM" && hours !== 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

async function main(){
    //login and get the x-auth-token
    const token = await login();
    if(token){
        //get timetable
        const timetable = await getTimetable(token);
        if (timetable) {
            console.log(JSON.stringify(timetable, null, 2))
            await generateICS(timetable);
            // Only open on macOS when running locally (not in GitHub Actions)
            if (process.platform === 'darwin' && !process.env.GITHUB_ACTIONS) {
                exec('open timetable.ics');
            }
        }
        log("Timetable processing completed");
    }
}

main();

process.on('exit', () => {
    logStream.end();
});

function extractSemesterStart(durationStr) {
    const match = durationStr.match(/^(\d{1,2})\s([A-Za-z]{3})/);
    if (!match) throw new Error("Unable to parse semester start date");
    const day = match[1].padStart(2, '0');
    const month = match[2];
    const year = "2025"; // fallback year if not in string
    return new Date(`${day} ${month} ${year}`);
}