require('dotenv').config();
const fs = require('fs');
const { exec } = require('child_process');

const loginUrl = "https://app.tarc.edu.my/MobileService/login.jsp";
const timetableUrl = "https://app.tarc.edu.my/MobileService/services/AJAXExamTimetable.jsp?act=list&mversion=1"
const deviceId = "92542A7E-B31D-461F-8B1C-15215824E3F9"
const deviceModel = "MacBook Air M4 24GB RAM 512GB ROM"
const username = process.env.CE_USERNAME;
const password = process.env.CE_PASSWORD;

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
            console.log("Login successful");
            return data.token;
        } else {
            throw new Error("Login failed: " + (data.msgdesc || "Unknown error"));
        }
    } catch (error) {
        console.error("Login error:", error.message);
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
        console.error("Login error:", error.message);
        return null;
    }
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

async function generateExamICS(timetable) {
    const events = [];
    for (const exam of timetable.rec) {
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
            `UID:${exam.funits}-${start}@exam.local`,
            `DTSTAMP:${formatICSDate(new Date())}`,
            `DTSTART;TZID=Asia/Kuala_Lumpur:${start}`,
            `DTEND;TZID=Asia/Kuala_Lumpur:${end}`,
            `SUMMARY:${exam.fdesc}`,
            `LOCATION:${location}`,
            `DESCRIPTION:Subject Code: ${exam.funits}\\nType: ${exam.fpaptype}\\nSeat Range: 1–${exam.ftosit}`,
            "END:VEVENT"
        ].join("\n");

        events.push(event);
    }

    const icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//TARUMT//Exam Timetable Generator//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        ...events,
        "END:VCALENDAR"
    ].join("\n");

    fs.writeFileSync("ce-exam_timetable.ics", icsContent);
    console.log("ICS file generated: ce-exam_timetable.ics");
}

async function main(){
    //login and get the x-auth-token
    const token = await login();
    if(token){
        //get timetable
        const timetable = await getTimetable(token);
        if (timetable) {
            console.log(timetable)
            await generateExamICS(timetable);
            // exec('open exam_timetable.ics');
        }
    }
}

main();