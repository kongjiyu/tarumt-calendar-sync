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
const classTimetableUrl = "https://app.tarc.edu.my/MobileService/services/AJAXStudentTimetable.jsp?act=get&week=all"
const examTimetableUrl = "https://app.tarc.edu.my/MobileService/services/AJAXExamTimetable.jsp?act=list&mversion=1"
const deviceId = "92542A7E-B31D-461F-8B1C-15215824E3F9"
const deviceModel = "MacBook Air M4 24GB RAM 512GB ROM"
const username = process.env.TARUMT_USERNAME;
const password = process.env.TARUMT_PASSWORD;

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

async function getClassTimetable(token){
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
        const response = await fetch(classTimetableUrl, fetchOptions);
        const raw = await response.text();
        const match = raw.match(/{[\s\S]*}/);
        if (!match) {
            throw new Error("Class timetable response does not contain valid JSON");
        }
        const data = JSON.parse(match[0]);  

        return data;
        
    } catch(error){
        log("Get class timetable error: " + error.message);
        return null;
    }
}

async function getExamTimetable(token){
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
        const response = await fetch(examTimetableUrl, fetchOptions);
        const raw = await response.text();
        const match = raw.match(/{[\s\S]*}/);
        if (!match) {
            throw new Error("Exam timetable response does not contain valid JSON");
        }
        const data = JSON.parse(match[0]);  

        return data;
        
    } catch(error){
        log("Get exam timetable error: " + error.message);
        return null;
    }
}

async function generateICS(classTimetable, examTimetable) {
    const events = [];
    
    // Process class timetable
    if (classTimetable && classTimetable.duration && classTimetable.duration.trim() !== "" && classTimetable.rec && classTimetable.rec.length > 0) {
        log("Processing class timetable data...");
        const semesterStart = extractSemesterStart(classTimetable.duration);
        
        for (const day of classTimetable.rec) {
            const dow = parseInt(day.dow); // 1=Mon, ..., 7=Sun
            if (!day.class) continue;

            for (const cls of day.class) {
                // Use fweedur if present, otherwise "all"
                const weekList = parseWeeks(cls.fweedur || "all", classTimetable.weeks);
                for (const week of weekList) {
                    // Calculate the date for this week and day of week
                    const baseDate = new Date(semesterStart);
                    baseDate.setDate(baseDate.getDate() + (week - 1) * 7 + dow);

                    const baseDateStr = baseDate.toISOString().split("T")[0];
                    const startDateTime = new Date(baseDateStr + "T" + convertTo24Hour(cls.fstart));
                    const endDateTime = new Date(baseDateStr + "T" + convertTo24Hour(cls.fend));

                    const event = [
                        "BEGIN:VEVENT",
                        `UID:class-${cls.funits}-W${week}-${day.dow}-${cls.fstart}@timetable.local`,
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
        log(`Added ${events.length} class events`);
    } else {
        log("No class timetable data available yet. Skipping class schedule.");
        console.log("No class timetable data available yet. The semester may not have started or no classes are scheduled.");
    }

    // Process exam timetable
    if (examTimetable && examTimetable.rec && examTimetable.rec.length > 0) {
        log("Processing exam timetable data...");
        const examEventsCount = examTimetable.rec.length;
        
        for (const exam of examTimetable.rec) {
            const yyyy = exam.fexyear;
            const mm = String(new Date(`${exam.fexmonth} 1`).getMonth() + 1).padStart(2, '0');
            const dd = String(exam.fexday).padStart(2, '0');

            const [hour, minute] = convertTo24Hour(exam.ftime).split(':');
            const start = `${yyyy}${mm}${dd}T${hour}${minute}00`;

            const endHour = parseInt(hour, 10) + parseInt(exam.fhour, 10);
            const end = `${yyyy}${mm}${dd}T${String(endHour).padStart(2, '0')}${minute}00`;

            const location = exam.fsummary && exam.fsummary.split(',')[1]?.trim() || "TARUMT";

            const event = [
                "BEGIN:VEVENT",
                `UID:exam-${exam.funits}-${start}@timetable.local`,
                `DTSTAMP:${formatICSDate(new Date())}`,
                `DTSTART;TZID=Asia/Kuala_Lumpur:${start}`,
                `DTEND;TZID=Asia/Kuala_Lumpur:${end}`,
                `SUMMARY:📝 EXAM: ${exam.fdesc}`,
                `LOCATION:${location}`,
                `DESCRIPTION:Subject Code: ${exam.funits}\\nType: ${exam.fpaptype}\\nSeat Range: 1–${exam.ftosit}`,
                "END:VEVENT"
            ].join("\n");
            events.push(event);
        }
        log(`Added ${examEventsCount} exam events`);
        console.log(`Added ${examEventsCount} exam(s) to timetable`);
    } else {
        log("No exam timetable data available yet. Skipping exam schedule.");
        console.log("No exam timetable data available yet. Exams may not be scheduled.");
    }

    // Only generate ICS file if we have at least some events
    if (events.length > 0) {
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
        log(`ICS file generated: timetable.ics (${events.length} total events)`);
        console.log(`✅ Generated timetable.ics with ${events.length} event(s)`);
    } else {
        log("No events to generate. Skipping ICS file creation.");
        console.log("⚠️ No timetable or exam data available. No ICS file generated.");
    }
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
    try {
        // Validate credentials
        if (!username || !password) {
            log("ERROR: Missing credentials. Please set TARUMT_USERNAME and TARUMT_PASSWORD environment variables.");
            console.error("ERROR: Missing credentials. Please set TARUMT_USERNAME and TARUMT_PASSWORD environment variables.");
            process.exit(0); // Exit gracefully to avoid failing GitHub Actions
        }

        //login and get the x-auth-token
        const token = await login();
        if(token){
            // Get both class and exam timetables
            const classTimetable = await getClassTimetable(token);
            const examTimetable = await getExamTimetable(token);
            
            if (classTimetable) {
                console.log("Class Timetable Data:");
                console.log(JSON.stringify(classTimetable, null, 2));
            }
            
            if (examTimetable) {
                console.log("\nExam Timetable Data:");
                console.log(JSON.stringify(examTimetable, null, 2));
            }
            
            // Generate combined ICS file
            await generateICS(classTimetable, examTimetable);
            
            // Only open on macOS when running locally (not in GitHub Actions)
            if (process.platform === 'darwin' && !process.env.GITHUB_ACTIONS) {
                exec('open timetable.ics');
            }
            
            log("Timetable processing completed successfully");
        } else {
            log("Login failed - unable to retrieve authentication token");
            console.error("Login failed. Please check your credentials.");
            process.exit(0); // Exit gracefully
        }
    } catch (error) {
        log(`ERROR in main: ${error.message}`);
        console.error(`ERROR: ${error.message}`);
        process.exit(0); // Exit gracefully to avoid failing GitHub Actions
    }
}

main();

process.on('exit', () => {
    logStream.end();
});

function extractSemesterStart(durationStr) {
    if (!durationStr || durationStr.trim() === "") {
        throw new Error("Duration string is empty - no timetable data available");
    }
    const match = durationStr.match(/^(\d{1,2})\s([A-Za-z]{3})/);
    if (!match) {
        throw new Error(`Unable to parse semester start date from: "${durationStr}"`);
    }
    const day = parseInt(match[1], 10);
    const month = match[2];
    const year = "2025"; // fallback year if not in string
    
    // Parse month name to month number
    const monthMap = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    // Create date using UTC to avoid timezone issues
    const date = new Date(year, monthMap[month], day);
    return date;
}