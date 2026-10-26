const FIRST_ROW = 7;
const MAX_DAYS = 31;
const DEFAULT_LUNCH_MIN = 60;
const SHORT_DAY_MIN = 480;
const OVERTIME_MIN = 480;
const LATE_AFTER_MIN = 540;
const OVERTIME_COLOR = '#0c68f1';
const WEEKEND_COLOR = '#ff0000';
const HEADER_PERIOD = { row: 4, col: 9 };
const REKAP_TITLE = 'Keterangan';
const REKAP_FIRST_COL = 3;
const REKAP_MONTHS = 12;
const REKAP_ROWS = 9;
const HOLIDAY_SHEET = 'Libur';
const HOLIDAY_FLAG_COL = 20;

const COL = { NO: 1, DATE: 2, HADIR: 3, START: 4, END: 5, LUNCH: 6, TOTAL: 7, NOTE: 8 };

const ABSENCE_NOTE = { sakit: 'IZIN SAKIT', izin: 'IZIN', cuti: 'CUTI' };

const HELP_TEXT = [
  'masuk 08.00',
  'keluar 17.00',
  'kegiatan <teks>',
  'sakit | izin | cuti',
  'rekap',
  '',
  'Tanggal lain: kemarin masuk 08.00, 13/10 keluar 17.00'
].join('\n');

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function parseTime(s) {
  const m = /^(\d{1,2})[.:](\d{2})$/.exec(s) || /^(\d{2})(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

function parseDisplayTime(s) {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(String(s).trim());
  if (!m) return null;
  let h = Number(m[1]);
  const marker = m[3] && m[3].toUpperCase();
  if (marker === 'PM' && h < 12) h += 12;
  if (marker === 'AM' && h === 12) h = 0;
  return h * 60 + Number(m[2]);
}

function addDays(date, n) {
  const t = new Date(Date.UTC(date.y, date.m - 1, date.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function parseDateToken(token, today) {
  if (token === 'kemarin') return addDays(today, -1);
  const m = /^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2}|\d{4}))?$/.exec(token);
  if (!m) return null;
  let y = today.y;
  if (m[3]) y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const date = { y, m: Number(m[2]), d: Number(m[1]) };
  const check = new Date(Date.UTC(date.y, date.m - 1, date.d));
  const valid = check.getUTCFullYear() === date.y && check.getUTCMonth() === date.m - 1 && check.getUTCDate() === date.d;
  return valid ? date : null;
}

function splitFirst(s) {
  const m = /^(\S+)(?:\s+([\s\S]*))?$/.exec(s);
  return m ? [m[1], (m[2] || '').trim()] : ['', ''];
}

function parseCommand(text, today) {
  const input = String(text || '').trim();
  if (!input) return { type: 'unknown' };

  let [head, rest] = splitFirst(input);
  let date = today;
  const dated = parseDateToken(head.toLowerCase(), today);
  if (dated) {
    date = dated;
    [head, rest] = splitFirst(rest);
  }

  const cmd = head.toLowerCase().replace(/^\//, '').replace(/@\w+$/, '');

  switch (cmd) {
    case 'masuk':
    case 'keluar': {
      const time = parseTime(rest);
      if (time === null) return { type: 'error', message: 'Jam tidak valid. Contoh: ' + cmd + ' 08.00' };
      return { type: cmd, date, time };
    }
    case 'kegiatan':
      if (!rest) return { type: 'error', message: 'Isi kegiatan kosong. Contoh: kegiatan 2 reprint and 1 doc printing development' };
      return { type: 'kegiatan', date, text: rest };
    case 'sakit':
    case 'izin':
    case 'cuti':
      return { type: 'absen', date, kind: cmd };
    case 'rekap':
      return { type: 'rekap', date, today };
    case 'start':
    case 'help':
    case 'bantuan':
      return { type: 'help' };
    default:
      return { type: 'unknown' };
  }
}

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function dayOfWeek(date) {
  return new Date(Date.UTC(date.y, date.m - 1, date.d)).getUTCDay();
}

function dateNumber(date) {
  return date.y * 10000 + date.m * 100 + date.d;
}

function formatDate(date) {
  return DAY_NAMES[dayOfWeek(date)] + ' ' + date.d + ' ' + MONTH_NAMES[date.m - 1];
}

function formatClock(min) {
  return pad2(Math.floor(min / 60)) + '.' + pad2(min % 60);
}

function formatTotal(min) {
  return Math.floor(min / 60) + '.' + pad2(min % 60);
}

function workedMinutes(row) {
  if (row.start === null || row.end === null) return null;
  const min = row.end - row.start - (row.lunch === null ? 0 : row.lunch);
  return min < 0 ? null : min;
}

function rowFromDisplay(cells) {
  const hadir = String(cells[COL.HADIR - 1]).trim().toUpperCase();
  return {
    hadir: hadir === 'Y' || hadir === 'N' ? hadir : '',
    start: parseDisplayTime(cells[COL.START - 1]),
    end: parseDisplayTime(cells[COL.END - 1]),
    lunch: parseDisplayTime(cells[COL.LUNCH - 1]),
    note: String(cells[COL.NOTE - 1])
  };
}

function summarize(date, row) {
  const parts = [formatDate(date)];
  if (row.hadir === 'N') {
    parts.push(row.note || 'tidak hadir');
    return parts.join(' · ');
  }
  parts.push('masuk ' + (row.start === null ? '-' : formatClock(row.start)));
  parts.push('keluar ' + (row.end === null ? '-' : formatClock(row.end)));
  const worked = workedMinutes(row);
  if (worked !== null) parts.push('total ' + formatTotal(worked));
  if (row.note) parts.push(row.note);
  return parts.join(' · ');
}

function applyEntry(cmd, store) {
  const ref = store.findRow(cmd.date);
  if (ref === null) return 'Tanggal ' + formatDate(cmd.date) + ' tidak ada di sheet.';

  const current = store.read(ref);
  const patch = {};

  if (cmd.type === 'masuk' || cmd.type === 'keluar') {
    patch.hadir = 'Y';
    patch[cmd.type === 'masuk' ? 'start' : 'end'] = cmd.time;
    if (current.lunch === null) patch.lunch = DEFAULT_LUNCH_MIN;
    if (current.hadir === 'N') patch.note = '';
  } else if (cmd.type === 'kegiatan') {
    if (current.hadir === 'N') {
      return formatDate(cmd.date) + ' sudah ditandai ' + (current.note || 'tidak hadir') + '. Ketik masuk dulu untuk membatalkan.';
    }
    if (current.hadir === '') patch.hadir = 'Y';
    patch.note = cmd.text;
  } else {
    patch.hadir = 'N';
    patch.clearTimes = true;
    patch.note = ABSENCE_NOTE[cmd.kind];
  }

  store.write(ref, patch);
  return summarize(cmd.date, store.read(ref));
}

function countMonth(days, today, holidays) {
  const count = { workdays: 0, hadir: 0, sakit: 0, izin: 0, cuti: 0, kosong: 0, late: 0, short: 0, over: 0 };

  days.forEach(function (day) {
    const dow = dayOfWeek(day.date);
    const weekday = dow !== 0 && dow !== 6 && !holidays[isoDate(day.date)];
    const row = day.row;
    if (weekday) count.workdays++;

    if (row.hadir === 'Y') {
      count.hadir++;
      if (row.start !== null && row.start > LATE_AFTER_MIN) count.late++;
      const worked = workedMinutes(row);
      if (worked !== null) {
        if (worked < SHORT_DAY_MIN) count.short++;
        if (worked > OVERTIME_MIN) count.over++;
      }
    } else if (row.hadir === 'N') {
      const note = row.note.toUpperCase();
      if (note.indexOf('CUTI') >= 0) count.cuti++;
      else if (note.indexOf('SAKIT') >= 0) count.sakit++;
      else count.izin++;
    } else if (weekday && dateNumber(day.date) <= dateNumber(today)) {
      count.kosong++;
    }
  });

  return count;
}

function buildRekap(cmd, store) {
  const count = countMonth(store.readMonth(cmd.date), cmd.today, store.holidays());

  return [
    'Rekap ' + MONTH_NAMES[cmd.date.m - 1] + ' ' + cmd.date.y,
    'Hari kerja ' + count.workdays + ' · hadir ' + count.hadir,
    'Sakit ' + count.sakit + ' · izin ' + count.izin + ' · cuti ' + count.cuti,
    'Belum diisi ' + count.kosong,
    'Masuk lewat 09.00: ' + count.late,
    'Kurang dari 8 jam: ' + count.short,
    'Lebih dari 8 jam: ' + count.over
  ].join('\n');
}

function handle(cmd, store) {
  switch (cmd.type) {
    case 'help':
      return HELP_TEXT;
    case 'error':
      return cmd.message;
    case 'rekap':
      return buildRekap(cmd, store);
    case 'masuk':
    case 'keluar':
    case 'kegiatan':
    case 'absen':
      return applyEntry(cmd, store);
    default:
      return 'Perintah tidak dikenal.\n\n' + HELP_TEXT;
  }
}

function cellDate(value, tz) {
  const parts = Utilities.formatDate(value, tz, 'yyyy-MM-dd').split('-').map(Number);
  return { y: parts[0], m: parts[1], d: parts[2] };
}

function daysInMonth(date) {
  return new Date(Date.UTC(date.y, date.m, 0)).getUTCDate();
}

function tableDays(sheet) {
  const values = sheet.getRange(FIRST_ROW, COL.DATE, MAX_DAYS, 1).getValues();
  let n = 0;
  while (n < values.length && values[n][0] instanceof Date) n++;
  return n;
}

function latestTabBefore(ss, name) {
  const names = ss.getSheets()
    .map(function (sheet) { return sheet.getName(); })
    .filter(function (n) { return /^\d{4}-\d{2}$/.test(n) && n < name; })
    .sort();
  return names.length ? ss.getSheetByName(names[names.length - 1]) : null;
}

function ensureHolidaySheet(ss) {
  let sheet = ss.getSheetByName(HOLIDAY_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(HOLIDAY_SHEET);
    sheet.getRange(1, 1).setValue('Tanggal libur');
    sheet.getRange(2, 1, 100, 1).setNumberFormat('dd-mmm-yy');
  }
  return sheet;
}

function columnLetter(n) {
  let s = '';
  while (n > 0) {
    s = String.fromCharCode(65 + (n - 1) % 26) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function updateRekap(source, sheet, date, sourceDays, days) {
  const header = FIRST_ROW + days + 2;
  const sourceHeader = FIRST_ROW + sourceDays + 2;
  if (String(sheet.getRange(header, 1).getValue()) !== REKAP_TITLE) return;

  const body = sheet.getRange(header + 1, REKAP_FIRST_COL, REKAP_ROWS, REKAP_MONTHS);
  if (Number(source.getName().slice(0, 4)) === date.y) {
    body.setValues(source.getRange(sourceHeader + 1, REKAP_FIRST_COL, REKAP_ROWS, REKAP_MONTHS).getValues());
  } else {
    body.clearContent();
  }

  const col = REKAP_FIRST_COL + date.m - 1;
  if (col > REKAP_FIRST_COL && String(sheet.getRange(header, col).getValue()) === '') {
    sheet.getRange(header, col - 1, REKAP_ROWS + 1, 1).copyTo(sheet.getRange(header, col));
    sheet.getRange(header, col).setValue(MONTH_LONG[date.m - 1]);
  }

  const first = FIRST_ROW;
  const last = FIRST_ROW + days - 1;
  const span = function (c) { return '$' + c + '$' + first + ':$' + c + '$' + last; };
  const letter = columnLetter(col);
  const cell = function (n) { return letter + (header + n); };
  const holidays = HOLIDAY_SHEET + '!$A$2:$A';
  const B = span('B');
  const C = span('C');
  const D = span('D');
  const E = span('E');
  const F = span('F');
  const H = span('H');
  const late = 'TIME(' + Math.floor(LATE_AFTER_MIN / 60) + ',' + (LATE_AFTER_MIN % 60) + ',0)';

  const formulas = [
    '=NETWORKDAYS($B$' + first + ',$B$' + last + ',' + holidays + ')',
    '=COUNTIF(' + C + ',"Y")',
    '=COUNTIF(' + C + ',"N")-' + cell(4) + '-' + cell(5),
    '=COUNTIFS(' + C + ',"N",' + H + ',"*SAKIT*",' + H + ',"<>*CUTI*")',
    '=COUNTIFS(' + C + ',"N",' + H + ',"*CUTI*")',
    '=SUMPRODUCT((' + C + '="")*(WEEKDAY(' + B + ',2)<6)*(' + B + '<=TODAY())*(COUNTIF(' + holidays + ',' + B + ')=0))',
    '=COUNTIFS(' + C + ',"Y",' + D + ',">"&' + late + ')',
    '=SUMPRODUCT((' + C + '="Y")*ISNUMBER(' + D + ')*ISNUMBER(' + E + ')*(ROUND((' + E + '-' + D + '-' + F + ')*1440,0)<' + SHORT_DAY_MIN + '))'
  ];
  sheet.getRange(header + 1, col, formulas.length, 1).setFormulas(formulas.map(function (f) { return [f]; }));
  sheet.getRange(header + REKAP_ROWS, col).setValue(0);
}

function createMonthTab(ss, date, tz) {
  const name = date.y + '-' + pad2(date.m);
  const source = latestTabBefore(ss, name);
  if (source === null) return null;

  const sourceDays = tableDays(source);
  if (sourceDays === 0) return null;

  const days = daysInMonth(date);
  const sheet = source.copyTo(ss);
  sheet.setName(name);

  const oldDates = sheet.getRange(FIRST_ROW, COL.DATE, sourceDays, 1).getValues();
  let reference = FIRST_ROW;
  for (let i = 0; i < oldDates.length; i++) {
    const dow = dayOfWeek(cellDate(oldDates[i][0], tz));
    if (dow !== 0 && dow !== 6) {
      reference = FIRST_ROW + i;
      break;
    }
  }

  if (days > sourceDays) {
    sheet.insertRowsAfter(FIRST_ROW + sourceDays - 1, days - sourceDays);
  } else if (days < sourceDays) {
    sheet.deleteRows(FIRST_ROW + days, sourceDays - days);
  }

  const referenceRow = sheet.getRange(reference, 1, 1, COL.NOTE + 1);
  for (let r = FIRST_ROW; r < FIRST_ROW + days; r++) {
    if (r !== reference) referenceRow.copyTo(sheet.getRange(r, 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  }

  sheet.getRange(FIRST_ROW, COL.HADIR, days, COL.NOTE - COL.HADIR + 1).clearContent();
  const numbers = [];
  const dates = [];
  for (let d = 1; d <= days; d++) {
    numbers.push([d]);
    dates.push([Utilities.parseDate(date.y + '-' + pad2(date.m) + '-' + pad2(d), tz, 'yyyy-MM-dd')]);
  }
  sheet.getRange(FIRST_ROW, COL.NO, days, 1).setValues(numbers);
  sheet.getRange(FIRST_ROW, COL.DATE, days, 1).setValues(dates);

  sheet.getRange(HEADER_PERIOD.row, HEADER_PERIOD.col)
    .setValue(Utilities.parseDate(date.y + '-' + pad2(date.m) + '-01', tz, 'yyyy-MM-dd'))
    .setNumberFormat('mmm-yy');

  ensureHolidaySheet(ss);
  updateRekap(source, sheet, date, sourceDays, days);
  applyRowRules(sheet);
  return sheet;
}

function createSheetStore(ss) {
  const tz = ss.getSpreadsheetTimeZone();
  const today = todayIn(LOCAL_TZ);
  const tabCache = {};

  function tabName(date) {
    return date.y + '-' + pad2(date.m);
  }

  function dateKey(date) {
    return date.y + '-' + pad2(date.m) + '-' + pad2(date.d);
  }

  function sheetFor(date) {
    const name = tabName(date);
    if (!tabCache[name]) {
      let sheet = ss.getSheetByName(name);
      if (!sheet && name === tabName(today)) {
        sheet = createMonthTab(ss, date, tz);
        if (!sheet) throw new Error('Tab ' + name + ' belum ada dan tidak ada tab bernama YYYY-MM (misalnya 2026-09) untuk disalin.');
      }
      if (!sheet) throw new Error('Tab ' + name + ' belum ada di spreadsheet.');
      tabCache[name] = sheet;
    }
    return tabCache[name];
  }

  function dateOf(value) {
    return cellDate(value, tz);
  }

  function holidays() {
    const keys = {};
    const sheet = ss.getSheetByName(HOLIDAY_SHEET);
    if (sheet === null) return keys;
    const values = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
    values.forEach(function (row) {
      if (row[0] instanceof Date) keys[isoDate(dateOf(row[0]))] = true;
    });
    return keys;
  }

  function findRow(date) {
    const sheet = sheetFor(date);
    const values = sheet.getRange(FIRST_ROW, COL.DATE, MAX_DAYS, 1).getValues();
    for (let i = 0; i < values.length; i++) {
      const cell = values[i][0];
      if (cell instanceof Date && dateKey(dateOf(cell)) === dateKey(date)) {
        return { sheet: sheet, row: FIRST_ROW + i };
      }
    }
    return null;
  }

  function read(ref) {
    const cells = ref.sheet.getRange(ref.row, 1, 1, COL.NOTE).getDisplayValues()[0];
    return rowFromDisplay(cells);
  }

  function readMonth(date) {
    const sheet = sheetFor(date);
    const dates = sheet.getRange(FIRST_ROW, COL.DATE, MAX_DAYS, 1).getValues();
    const cells = sheet.getRange(FIRST_ROW, 1, MAX_DAYS, COL.NOTE).getDisplayValues();
    const days = [];
    for (let i = 0; i < dates.length; i++) {
      if (dates[i][0] instanceof Date) {
        days.push({ date: dateOf(dates[i][0]), row: rowFromDisplay(cells[i]) });
      }
    }
    return days;
  }

  function setClock(sheet, row, col, min) {
    const cell = sheet.getRange(row, col);
    cell.setNumberFormat('H:mm');
    cell.setValue(min / 1440);
  }

  function refreshTotal(sheet, row) {
    const times = sheet.getRange(row, COL.START, 1, 2).getValues()[0];
    const total = sheet.getRange(row, COL.TOTAL);
    if (times[0] === '' || times[1] === '') {
      total.clearContent();
      return;
    }
    const minutes = 'ROUND((E' + row + '-D' + row + '-F' + row + ')*1440,0)';
    total.setFormula('=IF(' + minutes + '<0,NA(),INT(' + minutes + '/60)&"."&TEXT(MOD(' + minutes + ',60),"00"))');
  }

  function write(ref, patch) {
    const sheet = ref.sheet;
    const row = ref.row;
    if (patch.clearTimes) sheet.getRange(row, COL.START, 1, 4).clearContent();
    if (patch.hadir !== undefined) sheet.getRange(row, COL.HADIR).setValue(patch.hadir);
    if (patch.start !== undefined) setClock(sheet, row, COL.START, patch.start);
    if (patch.end !== undefined) setClock(sheet, row, COL.END, patch.end);
    if (patch.lunch !== undefined) setClock(sheet, row, COL.LUNCH, patch.lunch);
    if (patch.note !== undefined) sheet.getRange(row, COL.NOTE).setValue(patch.note);
    refreshTotal(sheet, row);
  }

  return { findRow: findRow, read: read, readMonth: readMonth, write: write, holidays: holidays };
}

function scriptProps() {
  return PropertiesService.getScriptProperties();
}

function reply(chatId, text) {
  UrlFetchApp.fetch('https://api.telegram.org/bot' + scriptProps().getProperty('TELEGRAM_TOKEN') + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: text }),
    muteHttpExceptions: true
  });
}

function acknowledged() {
  return ContentService.createTextOutput('ok');
}

function alreadyHandled(updateId) {
  const cache = CacheService.getScriptCache();
  const key = 'update-' + updateId;
  if (cache.get(key)) return true;
  cache.put(key, '1', 600);
  return false;
}

const LOCAL_TZ = 'Asia/Jakarta';

function todayIn(tz) {
  const parts = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd').split('-').map(Number);
  return { y: parts[0], m: parts[1], d: parts[2] };
}

function runCommand(text) {
  const ss = SpreadsheetApp.openById(scriptProps().getProperty('SPREADSHEET_ID'));
  const cmd = parseCommand(text, todayIn(LOCAL_TZ));
  const answer = handle(cmd, createSheetStore(ss));
  SpreadsheetApp.flush();
  return answer;
}

function withScriptLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function jsonOutput(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function parseIsoDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return null;
  const date = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  const check = addDays(date, 0);
  return check.y === date.y && check.m === date.m && check.d === date.d ? date : null;
}

function isoDate(date) {
  return date.y + '-' + pad2(date.m) + '-' + pad2(date.d);
}

function entryCommand(body, date) {
  switch (body.type) {
    case 'masuk':
    case 'keluar': {
      const time = Number(body.time);
      if (!Number.isInteger(time) || time < 0 || time > 1439) return null;
      return { type: body.type, date: date, time: time };
    }
    case 'kegiatan': {
      const text = String(body.text || '').trim();
      return text ? { type: 'kegiatan', date: date, text: text } : null;
    }
    case 'absen':
      return Object.prototype.hasOwnProperty.call(ABSENCE_NOTE, body.kind) ? { type: 'absen', date: date, kind: body.kind } : null;
    default:
      return null;
  }
}

function monthPayload(date, store, today) {
  const days = store.readMonth(date);
  const holidays = store.holidays();
  return {
    year: date.y,
    month: date.m,
    overtimeMin: OVERTIME_MIN,
    days: days.map(function (day) {
      return {
        date: isoDate(day.date),
        weekday: dayOfWeek(day.date),
        holiday: holidays[isoDate(day.date)] === true,
        hadir: day.row.hadir,
        start: day.row.start,
        end: day.row.end,
        lunch: day.row.lunch,
        worked: workedMinutes(day.row),
        note: day.row.note
      };
    }),
    count: countMonth(days, today, holidays)
  };
}

function runApi(body) {
  const ss = SpreadsheetApp.openById(scriptProps().getProperty('SPREADSHEET_ID'));
  const store = createSheetStore(ss);
  const today = todayIn(LOCAL_TZ);
  const date = parseIsoDate(body.date);
  if (date === null) return { error: 'Tanggal tidak valid.' };

  if (body.action === 'month') {
    return { today: isoDate(today), month: monthPayload(date, store, today) };
  }

  if (body.action === 'entry') {
    const cmd = entryCommand(body, date);
    if (cmd === null) return { error: 'Isian tidak valid.' };
    const message = applyEntry(cmd, store);
    SpreadsheetApp.flush();
    return { message: message, today: isoDate(today), month: monthPayload(date, store, today) };
  }

  return { error: 'Aksi tidak dikenal.' };
}

function apiRequest(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOutput({ error: 'Body bukan JSON.' });
  }

  const apiKey = scriptProps().getProperty('API_KEY');
  if (!apiKey || !body || body.apiKey !== apiKey) return jsonOutput({ error: 'Kunci tidak valid.' });

  try {
    return jsonOutput(withScriptLock(function () { return runApi(body); }));
  } catch (err) {
    return jsonOutput({ error: err.message });
  }
}

function doPost(e) {
  if (e.parameter && e.parameter.key) return telegramUpdate(e);
  return apiRequest(e);
}

function telegramUpdate(e) {
  const props = scriptProps();
  if (e.parameter.key !== props.getProperty('WEBHOOK_KEY')) return acknowledged();

  let update;
  try {
    update = JSON.parse(e.postData.contents);
  } catch (err) {
    return acknowledged();
  }

  const message = update.message;
  if (!message || !message.text) return acknowledged();

  const allowedChat = props.getProperty('ALLOWED_CHAT_ID');
  if (!allowedChat) {
    reply(message.chat.id, 'Chat ID: ' + message.chat.id);
    return acknowledged();
  }
  if (String(message.chat.id) !== allowedChat) return acknowledged();
  if (alreadyHandled(update.update_id)) return acknowledged();

  let answer;
  try {
    answer = withScriptLock(function () { return runCommand(message.text); });
  } catch (err) {
    answer = 'Gagal: ' + err.message;
  }

  reply(message.chat.id, answer);
  return acknowledged();
}

function setWebhook() {
  const props = scriptProps();
  const url = props.getProperty('WEBAPP_URL') + '?key=' + encodeURIComponent(props.getProperty('WEBHOOK_KEY'));
  const response = UrlFetchApp.fetch('https://api.telegram.org/bot' + props.getProperty('TELEGRAM_TOKEN') + '/setWebhook', {
    method: 'post',
    payload: { url: url, allowed_updates: JSON.stringify(['message']) },
    muteHttpExceptions: true
  });
  Logger.log(response.getContentText());
}

function matchesRule(rule, pattern) {
  const condition = rule.getBooleanCondition();
  if (!condition || condition.getCriteriaType() !== SpreadsheetApp.BooleanCriteria.CUSTOM_FORMULA) return false;
  return pattern.test(String(condition.getCriteriaValues()[0]));
}

function isOvertimeRule(rule) {
  return matchesRule(rule, /\*1440(,0\))?>/);
}

function isWeekendRule(rule) {
  return matchesRule(rule, /^=WEEKDAY\(\$B/);
}

function isHolidayRule(rule) {
  return matchesRule(rule, /INDIRECT\("Libur!/) ||
    matchesRule(rule, new RegExp('^=\\$' + columnLetter(HOLIDAY_FLAG_COL) + '\\d+=TRUE$'));
}

function markHolidays(sheet, rows) {
  if (sheet.getMaxColumns() < HOLIDAY_FLAG_COL) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), HOLIDAY_FLAG_COL - sheet.getMaxColumns());
  }
  const flags = [];
  for (let r = FIRST_ROW; r < FIRST_ROW + rows; r++) {
    flags.push(['=IF(ISNUMBER($B' + r + '),COUNTIF(' + HOLIDAY_SHEET + '!$A$2:$A,$B' + r + ')>0,FALSE)']);
  }
  sheet.getRange(FIRST_ROW, HOLIDAY_FLAG_COL, rows, 1).setFormulas(flags);
  sheet.hideColumns(HOLIDAY_FLAG_COL);
}

function applyRowRules(sheet) {
  const rows = tableDays(sheet) || MAX_DAYS;
  ensureHolidaySheet(sheet.getParent());
  markHolidays(sheet, rows);
  const range = sheet.getRange(FIRST_ROW, 1, rows, COL.NOTE + 1);
  const rules = sheet.getConditionalFormatRules().filter(function (rule) {
    return !isOvertimeRule(rule) && !isWeekendRule(rule) && !isHolidayRule(rule);
  });
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(ISNUMBER($D' + FIRST_ROW + '),ISNUMBER($E' + FIRST_ROW + '),ROUND(($E' + FIRST_ROW + '-$D' + FIRST_ROW + '-N($F' + FIRST_ROW + '))*1440,0)>' + OVERTIME_MIN + ')')
      .setBackground(OVERTIME_COLOR)
      .setRanges([range])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=WEEKDAY($B' + FIRST_ROW + ',2)>5')
      .setBackground(WEEKEND_COLOR)
      .setRanges([range])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$' + columnLetter(HOLIDAY_FLAG_COL) + FIRST_ROW + '=TRUE')
      .setBackground(WEEKEND_COLOR)
      .setRanges([range])
      .build()
  );
  sheet.setConditionalFormatRules(rules);
}

function applyOvertimeFormatting() {
  const ss = SpreadsheetApp.openById(scriptProps().getProperty('SPREADSHEET_ID'));
  ss.getSheets()
    .filter(function (sheet) { return /^\d{4}-\d{2}$/.test(sheet.getName()); })
    .forEach(applyRowRules);
}

