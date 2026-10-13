const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../generateTimetable.js'), 'utf8');
const cls = { fstart: '09:00 AM', fend: '10:00 AM', fclasstype: 'L', fdesc: 'Test Class', froom: 'Room A', fstaffname: 'Test Lecturer', funits: 'TEST101' };
const week = (date, extra = {}) => ({ rec: [{ date, holiday: '', class: [{ ...cls, ...extra }] }] });
const exam = { rec: [{ fexyear: 2026, fexmonth: 'Oct', fexday: 20, ftime: '09:00 AM', fhour: '2', funits: 'TEST101', fdesc: 'Test Exam', fpaptype: 'M', ftosit: 30 }] };
async function run(overview, weeks = {}, exams = exam, options = {}) {
    const files = {}, calls = [];
    const mockProcess = { env: { TARUMT_USERNAME: 'test', TARUMT_PASSWORD: 'test' }, exitCode: 0 };
    const context = {
        URLSearchParams, module: {}, console: { log() {} }, process: mockProcess,
        require: name => name === 'dotenv' ? { config() {} } : name === 'fs' ? {
            createWriteStream: () => ({ write() {}, end() {} }),
            writeFileSync: (name, content) => { files[name] = content; }
        } : require(name),
        fetch: async url => {
            calls.push(url);
            let value = url.includes('studentLogin') ? { msg: 'success', token: 'mock' }
                : url.includes('AJAXExam') ? exams
                : new URL(url).searchParams.get('week') === 'all' ? overview
                : weeks[new URL(url).searchParams.get('week')];
            if (value instanceof Error) throw value;
            return { ok: !options.httpError, status: options.httpError || 200, text: async () => JSON.stringify(value) };
        }
    };
    vm.createContext(context);
    vm.runInContext(source + '\nglobalThis.run = main;', context);
    await context.run();
    const counts = Object.fromEntries(Object.entries(files).map(([name, text]) => [name, (text.match(/BEGIN:VEVENT/g) || []).length]));
    return { files, counts, calls, exitCode: mockProcess.exitCode };
}
function assertFailed(result) {
    assert.equal(result.exitCode, 1);
    assert.deepEqual(result.files, {}, 'failed runs must not overwrite any calendar');
}
test('routes classes, holiday clashes, replacements and exams to separate feeds', async () => {
    const holiday = week('14/10/2026'); holiday.rec[0].holiday = 'Test holiday';
    const r = await run({ rec: [], weeks: ['all', '1', '2', '3'] }, {
        1: week('13/10/2026'), 2: holiday, 3: week('20/10/2026', { replace: 'Y' })
    });
    assert.equal(r.exitCode, 0);
    assert.deepEqual(Object.values(r.counts), [4, 1, 1, 1, 1]);
    assert.match(r.files['timetable_normal.ics'], /DTSTART;TZID=Asia\/Kuala_Lumpur:20261013T090000/);
    const events = text => text.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
    const combined = events(r.files['timetable.ics']);
    const categories = ['normal', 'holidays', 'replacements', 'exams']
        .flatMap(name => events(r.files[`timetable_${name}.ics`]));
    assert.deepEqual(combined, categories);
    assert.equal(new Set(combined.map(event => event.match(/UID:([^\n]+)/)[1])).size, 4);
});
test('one failed week prevents publishing partial calendars', async () => {
    assertFailed(await run({ rec: [], weeks: ['1', '2'] }, { 1: week('13/10/2026'), 2: new Error('timeout') }));
});
test('a malformed week fails instead of publishing an empty calendar', async () => {
    assertFailed(await run({ rec: [], weeks: ['1'] }, { 1: { msg: 'error' } }));
});
test('an exam request failure preserves all published calendars', async () => {
    assertFailed(await run({ rec: [], weeks: [] }, {}, new Error('timeout')));
});
test('valid empty timetable without weeks still generates exams', async () => {
    const r = await run({ rec: [] });
    assert.equal(r.exitCode, 0);
    assert.equal(r.counts['timetable_exams.ics'], 1);
    assert.equal(r.counts['timetable.ics'], 1);
    assert.equal(r.counts['timetable_normal.ics'], 0);
});
test('valid empty semester and exam responses publish empty feeds', async () => {
    const r = await run({ rec: [], weeks: [] }, {}, { rec: [] });
    assert.equal(r.exitCode, 0);
    assert.deepEqual(Object.values(r.counts), [0, 0, 0, 0, 0]);
});
test('failed overview still requests exams but prevents destructive deployment', async () => {
    const r = await run(new Error('timeout'));
    assertFailed(r);
    assert(r.calls.some(url => url.includes('AJAXExam')));
});
test('missing weeks with nonempty data and malformed schemas fail safely', async () => {
    for (const overview of [{ rec: [{}] }, { msg: 'error' }, { rec: [], weeks: 'all' }]) {
        assertFailed(await run(overview));
    }
    assertFailed(await run({ rec: [] }, {}, { msg: 'error' }));
});
test('HTTP failure is not interpreted as valid calendar data', async () => {
    assertFailed(await run({ rec: [] }, {}, exam, { httpError: 503 }));
});
