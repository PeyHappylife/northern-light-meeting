// ============================================================
//  Northern Light Meeting — Google Apps Script (完全版 v2)
//  スプレッドシート構成:
//    「イベント一覧」   : A=日付 B=OPEN時間 C=START時間 D=場所 E=ゲスト F=詳細 G=アニメーション H=イベント名
//    「メール内容」     : A=テンプレート名  B=件名  C=本文（{{name}}等プレースホルダー使用可）
//    「YYYYMMDD ゲスト名」: A=申込日時 B=名前 C=フリガナ D=メール E=電話 F=初回追加 G=一般予定人数 H=枚数 I=アップダイヤ J=メール送信済みフラグ
//
//  メール送信タイミング（デフォルト）:
//    申込受付時  → 即時
//    7日前      → 18:00
//    3日前      → 18:00
//    前日        → 18:00
//    当日        → 22:00
//    7日後       → 18:00
// ============================================================

const SPREADSHEET_ID      = '1CdZSj0xJ56mBN7pSHsnqPm2JRlDxXxZCVTIXNC50LbY';
const EVENT_LIST_SHEET    = 'イベント一覧';
const MAIL_TEMPLATE_SHEET = 'メール内容';

// スタンドアロンスクリプト対応: getActiveSpreadsheet()の代わりにopenByIdを使用
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// ─────────────────────────────────────────────
//  エントリーポイント
// ─────────────────────────────────────────────
function doGet(e) {
  if (!e || !e.parameter) {
    return json({ error: 'Direct execution is not supported. Please access via the deployed web app URL.' });
  }
  const p = e.parameter;
  const action = p.action;
  try {
    switch (action) {
      case 'getEventsList':           return json(getEventsList());
      case 'getUniqueEventNames':     return json(getUniqueValues(EVENT_LIST_SHEET, 7)); // H列: イベント名
      case 'getUniqueGuests':         return json(getUniqueValues(EVENT_LIST_SHEET, 3)); // D列: ゲスト名
      case 'getUniqueVenues':         return json(getUniqueValues(EVENT_LIST_SHEET, 2)); // C列: 開催場所
      case 'getUniqueDetails':        return json(getUniqueDetails());
      case 'getAllEventsListForAdmin': return json(getAllEventsListForAdmin());
      case 'createNewEvent':          return json(createNewEvent(p));
      case 'deleteEvent':             return json(deleteEvent(p));
      case 'registerParticipant':     return json(registerParticipant(p));
      case 'getMailTimes':            return json(getMailTimes());
      case 'setMailTime':             return json(setMailTime(p));
      default:                        return json({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return json({ error: err.toString() });
  }
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────
//  イベント一覧取得（公開フォーム用）
// ─────────────────────────────────────────────
function getEventsList() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(EVENT_LIST_SHEET);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const events = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] || !row[7]) continue;
    const eventDate = row[0] instanceof Date ? row[0] : new Date(row[0]);
    if (isNaN(eventDate.getTime()) || eventDate < today) continue;
    const dateFormatted = Utilities.formatDate(eventDate, 'Asia/Tokyo', 'yyyy/MM/dd');
    const dateKey       = Utilities.formatDate(eventDate, 'Asia/Tokyo', 'yyyyMMdd');
    const dateForBackslash = Utilities.formatDate(eventDate, 'Asia/Tokyo', 'yyyy\\MM/dd');
    events.push({
      id:         'ev_' + i,
      radioLabel: dateForBackslash + ' ' + String(row[7]),
      date:       dateFormatted,
      time:       String(row[1] || 'OPEN 19:00 / START 19:30'),               // B列: 時間(OPEN/START)
      venue:      String(row[2] || ''),                                       // C列: 開催場所
      guest:      String(row[3] || ''),                                       // D列: ゲスト名
      sheetName:  String(row[4] || (dateKey + ' ' + String(row[3] || ''))),   // E列: シート識別名
      details:    String(row[6] || ''),                                       // G列: 詳細
      eventName:  String(row[7]),                                             // H列: イベント名
      animation:  String(row[8] || 'neon'),                                   // I列: アニメーション
      showNote:   String(row[9] || '') !== '無'                              // J列が「無」のときのみ非表示。未設定・既存は表示。
    });
  }
  events.sort(function(a, b) { return a.date.localeCompare(b.date); });
  return events;
}

// ─────────────────────────────────────────────
//  ユニーク値取得（管理画面ドロップダウン用）
// ─────────────────────────────────────────────
function getUniqueValues(sheetName, colIndex) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const seen = {}, result = [];
  for (let i = 1; i < data.length; i++) {
    const val = String(data[i][colIndex] || '').trim();
    if (val && !seen[val]) { seen[val] = true; result.push(val); }
  }
  return result;
}

function getUniqueDetails() { return getUniqueValues(EVENT_LIST_SHEET, 6); }

// ─────────────────────────────────────────────
//  管理画面用 全イベント一覧取得
// ─────────────────────────────────────────────
function getAllEventsListForAdmin() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(EVENT_LIST_SHEET);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const events = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] || !row[7]) continue;
    const eventDate = row[0] instanceof Date ? row[0] : new Date(row[0]);
    if (isNaN(eventDate.getTime())) continue;
    const dateFormatted = Utilities.formatDate(eventDate, 'Asia/Tokyo', 'yyyy/MM/dd');
    const dateKey       = Utilities.formatDate(eventDate, 'Asia/Tokyo', 'yyyyMMdd');
    const dateForBackslash = Utilities.formatDate(eventDate, 'Asia/Tokyo', 'yyyy\\MM/dd');
    events.push({
      sheetName:  String(row[4] || (dateKey + ' ' + String(row[3] || ''))),
      radioLabel: dateForBackslash + ' ' + String(row[7])
    });
  }
  return events;
}

// ─────────────────────────────────────────────
//  新規イベント作成（＋トリガー自動設定）
// ─────────────────────────────────────────────
function createNewEvent(p) {
  const ss = getSpreadsheet();
  const listSheet = ss.getSheetByName(EVENT_LIST_SHEET);
  if (!listSheet) throw new Error('イベント一覧シートが見つかりません');
  if (!p.eventName || !p.date || !p.openTime || !p.startTime || !p.venue || !p.guest)
    throw new Error('必須項目が不足しています');

  const eventDate = new Date(p.date);
  const dateKey   = Utilities.formatDate(eventDate, 'Asia/Tokyo', 'yyyyMMdd');
  const dateForm  = Utilities.formatDate(eventDate, 'Asia/Tokyo', 'yyyy/MM/dd');
  const sheetName = dateKey + ' ' + p.guest;
  const timeStr   = 'OPEN ' + p.openTime + ' / START ' + p.startTime;
  const showNote  = (p.showNote === '無') ? '無' : '有';

  // A=日付 B=時間 C=開催場所 D=ゲスト名 E=シート識別名 F=(空) G=詳細 H=イベント名 I=アニメーション J=有無
  listSheet.appendRow([dateForm, timeStr, p.venue, p.guest, sheetName, '', p.details || '', p.eventName, p.animation || 'neon', showNote]);

  if (!ss.getSheetByName(sheetName)) {
    const evSheet = ss.insertSheet(sheetName);
    evSheet.appendRow(['申込日時','名前','フリガナ','メールアドレス','電話番号','初回追加','一般予定人数','枚数','アップダイヤ','メール送信済み']);
    evSheet.getRange(1, 1, 1, 10).setBackground('#e8f4f8').setFontWeight('bold');
  }

  // イベント作成時にリマインダートリガーを自動確保
  ensureReminderTrigger();

  return { message: 'イベント「' + p.eventName + '（' + Utilities.formatDate(eventDate, 'Asia/Tokyo', 'yyyy/MM/dd') + '）」を作成しました。リマインダーメールも自動設定されました。' };
}

// ─────────────────────────────────────────────
//  イベント削除
// ─────────────────────────────────────────────
function deleteEvent(p) {
  if (!p.sheetName) throw new Error('シート名が指定されていません');
  const ss = getSpreadsheet();
  const evSheet = ss.getSheetByName(p.sheetName);
  if (evSheet) ss.deleteSheet(evSheet);

  const listSheet = ss.getSheetByName(EVENT_LIST_SHEET);
  if (listSheet) {
    const data = listSheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][4] || '') === p.sheetName) {   // E列: シート識別名で照合
        listSheet.deleteRow(i + 1); break;
      }
    }
  }
  return { message: '「' + p.sheetName + '」を削除しました。' };
}

// ─────────────────────────────────────────────
//  参加者登録 ＋ 申し込み確認メール即時送信
// ─────────────────────────────────────────────
function registerParticipant(p) {
  if (!p.sheetName) throw new Error('シート名が指定されていません');
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(p.sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(p.sheetName);
    sheet.appendRow(['申込日時','名前','フリガナ','メールアドレス','電話番号','初回追加','一般予定人数','枚数','アップダイヤ','メール送信済み']);
    sheet.getRange(1, 1, 1, 10).setBackground('#e8f4f8').setFontWeight('bold');
  }

  sheet.appendRow([
    Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
    p.name || '', p.kana || '', p.email || '', p.phone || '',
    p.firstTime || '', p.note || '', p.tickets || '', p.upline || '', ''
  ]);

  // 申し込み確認メール即時送信
  try {
    const eventInfo = getEventInfoBySheetName(p.sheetName);
    sendConfirmationEmail(p, eventInfo);
    sheet.getRange(sheet.getLastRow(), 10).setValue('receipt');
  } catch (mailErr) {
    Logger.log('確認メール送信エラー: ' + mailErr.toString());
  }

  return { message: 'お申し込みを受け付けました。確認メールをお送りしました。' };
}

// ─────────────────────────────────────────────
//  メール送信時刻の設定管理（PropertiesService）
// ─────────────────────────────────────────────

// 内部用: 整数時刻を返す
function getMailTimes_internal() {
  const p = PropertiesService.getScriptProperties();
  return {
    d7before: parseInt(p.getProperty('d7before') || '18'),
    d3before: parseInt(p.getProperty('d3before') || '18'),
    d1before: parseInt(p.getProperty('d1before') || '18'),
    sameday:  parseInt(p.getProperty('sameday')  || '22'),
    d7after:  parseInt(p.getProperty('d7after')  || '18')
  };
}

// API: 現在の送信時刻一覧を返す
function getMailTimes() {
  const t = getMailTimes_internal();
  return { receipt: 'immediate', d7before: t.d7before, d3before: t.d3before, d1before: t.d1before, sameday: t.sameday, d7after: t.d7after };
}

// API: 送信時刻を変更して即座にトリガーを再作成
function setMailTime(p) {
  const validKeys = ['d7before', 'd3before', 'd1before', 'sameday', 'd7after'];
  if (!validKeys.includes(p.key)) throw new Error('不正なキー: ' + p.key);
  const hour = parseInt(p.hour);
  if (isNaN(hour) || hour < 0 || hour > 23) throw new Error('不正な時間: ' + p.hour);
  PropertiesService.getScriptProperties().setProperty(p.key, String(hour));
  recreateTriggers();
  return { message: hour + ':00 に更新しました。' };
}

// ─────────────────────────────────────────────
//  リマインダートリガー管理
// ─────────────────────────────────────────────

// 既に存在しなければ作成（イベント作成時に呼ばれる）
function ensureReminderTrigger() {
  const already = ScriptApp.getProjectTriggers().some(function(t) {
    return t.getHandlerFunction() === 'sendScheduledEmails';
  });
  if (!already) recreateTriggers();
}

// 既存トリガーを削除して、設定された時刻ごとにトリガーを再生成
function recreateTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'sendScheduledEmails') ScriptApp.deleteTrigger(t);
  });

  const times = getMailTimes_internal();
  // 同一時刻のトリガーは1つだけ
  const uniqueHours = [];
  [times.d7before, times.d3before, times.d1before, times.sameday, times.d7after].forEach(function(h) {
    if (uniqueHours.indexOf(h) === -1) uniqueHours.push(h);
  });

  uniqueHours.forEach(function(hour) {
    ScriptApp.newTrigger('sendScheduledEmails')
      .timeBased()
      .atHour(hour)
      .everyDays(1)
      .inTimezone('Asia/Tokyo')
      .create();
  });
}

// ─────────────────────────────────────────────
//  毎日自動実行: リマインダーメール一括送信
//  （登録された時刻に一致するスケジュールのみ処理）
// ─────────────────────────────────────────────
function sendScheduledEmails() {
  const ss    = getSpreadsheet();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 現在の実行時刻（日本時間の時）
  const currentHour = parseInt(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'H'));
  const times = getMailTimes_internal();

  // diff(日数) → テンプレート情報 のマップ（当日 diff=0 に変更）
  const allSchedule = {
    '7':  { tpl: '7日前リマインダーメール',  flag: '7daybefore', hour: times.d7before },
    '3':  { tpl: '3日前リマインダーメール',  flag: '3day',       hour: times.d3before },
    '1':  { tpl: '前日リマインダーメール',    flag: '1day',       hour: times.d1before },
    '0':  { tpl: '当日感謝メール',            flag: 'thanks',     hour: times.sameday  },
    '-7': { tpl: '次回リマインドメール',       flag: 'next',       hour: times.d7after  }
  };

  // 今の時刻に送るべき種別だけ抽出
  const schedule = {};
  Object.keys(allSchedule).forEach(function(diff) {
    if (allSchedule[diff].hour === currentHour) schedule[diff] = allSchedule[diff];
  });
  if (Object.keys(schedule).length === 0) return;

  ss.getSheets().forEach(function(sheet) {
    const name = sheet.getName();
    if (!/^\d{8}\s/.test(name)) return;

    const eventDate = new Date(
      parseInt(name.substring(0, 4)),
      parseInt(name.substring(4, 6)) - 1,
      parseInt(name.substring(6, 8))
    );
    eventDate.setHours(0, 0, 0, 0);
    const diff = Math.round((eventDate.getTime() - today.getTime()) / 86400000);

    const timing = schedule[String(diff)];
    if (!timing) return;

    const template = getMailTemplate(timing.tpl);
    if (!template) { Logger.log('テンプレートなし: ' + timing.tpl); return; }

    const eventInfo = getEventInfoBySheetName(name);
    const rows      = sheet.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      const row   = rows[i];
      const email = String(row[3] || '');
      const sent  = String(row[9] || '');
      if (!email.includes('@') || sent.includes(timing.flag)) continue;

      const data = buildMailData(row, eventDate, eventInfo);
      try {
        MailApp.sendEmail({ to: email, subject: applyTemplate(template.subject, data), body: applyTemplate(template.body, data) });
        sheet.getRange(i + 1, 10).setValue(sent ? sent + ',' + timing.flag : timing.flag);
        Logger.log('送信: ' + timing.tpl + ' → ' + email);
      } catch (e) { Logger.log('送信エラー: ' + e + ' [' + email + ']'); }
    }
  });
}

// ─────────────────────────────────────────────
//  申し込み確認メール即時送信
// ─────────────────────────────────────────────
function sendConfirmationEmail(p, eventInfo) {
  const email = String(p.email || '');
  if (!email.includes('@')) return;
  const tpl = getMailTemplate('オーダー受付メール');
  if (!tpl) { Logger.log('オーダー受付メールテンプレートなし'); return; }

  const showNote = !(eventInfo && eventInfo.showNote === false);
  const data = {
    name: p.name || '', kana: p.kana || '', email: email, phone: p.phone || '',
    firstTime: p.firstTime || '', note: showNote ? (p.note || '') : '', tickets: p.tickets || '', upline: p.upline || '',
    date:      eventInfo ? eventInfo.date  : '',
    time:      eventInfo ? eventInfo.time  : '',
    venue:     eventInfo ? eventInfo.venue : '',
    guest:     eventInfo ? eventInfo.guest : '',
    eventName: eventInfo ? eventInfo.eventName : ''
  };
  MailApp.sendEmail({ to: email, subject: applyTemplate(tpl.subject, data), body: applyTemplate(tpl.body, data) });
}

// ─────────────────────────────────────────────
//  ユーティリティ
// ─────────────────────────────────────────────

function getEventInfoBySheetName(sheetName) {
  const ss = getSpreadsheet();
  const ls = ss.getSheetByName(EVENT_LIST_SHEET);
  if (!ls) return null;
  const rows = ls.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const ed = rows[i][0] instanceof Date ? rows[i][0] : new Date(rows[i][0]);
    if (isNaN(ed.getTime())) continue;
    if (String(rows[i][4] || '') !== sheetName) continue;   // E列: シート識別名で照合
    return {
      eventName: String(rows[i][7] || ''),                  // H列
      date:      Utilities.formatDate(ed, 'Asia/Tokyo', 'yyyy/MM/dd'),
      time:      String(rows[i][1] || 'OPEN 19:00 / START 19:30'), // B列: 時間
      venue:     String(rows[i][2] || ''),                  // C列: 開催場所
      guest:     String(rows[i][3] || ''),                  // D列: ゲスト名
      details:   String(rows[i][6] || ''),                  // G列: 詳細
      showNote:  String(rows[i][9] || '') !== '無'         // J列: 有無
    };
  }
  return null;
}

function getMailTemplate(templateName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(MAIL_TEMPLATE_SHEET);
  if (!sheet) { Logger.log('メール内容シートなし'); return null; }
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === templateName)
      return { name: rows[i][0], subject: String(rows[i][1] || ''), body: String(rows[i][2] || '') };
  }
  return null;
}

function applyTemplate(template, data) {
  let r = String(template || '');
  // note が空（＝「無」設定 or 未入力）の場合は {{note}} を含む行ごと削除
  if (!data.note) {
    r = r.split('\n').filter(function(line) { return line.indexOf('{{note}}') === -1; }).join('\n');
  }
  Object.keys(data).forEach(function(k) {
    r = r.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), data[k] || '');
  });
  return r;
}

function buildMailData(row, eventDate, info) {
  const showNote = !(info && info.showNote === false);
  return {
    name:      String(row[1] || ''), kana:  String(row[2] || ''),
    email:     String(row[3] || ''), phone: String(row[4] || ''),
    firstTime: String(row[5] || ''), note:  showNote ? String(row[6] || '') : '',
    tickets:   String(row[7] || ''), upline:String(row[8] || ''),
    date:      Utilities.formatDate(eventDate, 'Asia/Tokyo', 'yyyy年MM月dd日'),
    dateSlash: Utilities.formatDate(eventDate, 'Asia/Tokyo', 'yyyy/MM/dd'),
    time:      info ? info.time      : '',
    venue:     info ? info.venue     : '',
    guest:     info ? info.guest     : '',
    eventName: info ? info.eventName : ''
  };
}
