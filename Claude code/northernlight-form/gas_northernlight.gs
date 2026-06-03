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

// 名簿(イベントシート)の列構成（16列）
//  A申込日時 B名前 C フリガナ D メール E 電話 F 初回追加 G 一般予定人数 H 枚数
//  I 金額 J アップダイヤ K 申込メール L ７日前 M ３日前 N 前日 O 当日感謝 P ７日後
const ROSTER_HEADER = ['申込日時','名前','フリガナ','メールアドレス','電話番号','初回追加','一般予定人数','枚数','金額','アップダイヤ','申込メール','７日前','３日前','前日','当日感謝','７日後'];
// 送信済みフラグの列番号（1始まり）
const FLAG_COL = { receipt: 11, d7before: 12, d3before: 13, d1before: 14, sameday: 15, d7after: 16 };

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
      case 'sendAllToParticipant':    return json(sendAllToParticipant(p));
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
    evSheet.appendRow(ROSTER_HEADER);
    evSheet.getRange(1, 1, 1, ROSTER_HEADER.length).setBackground('#e8f4f8').setFontWeight('bold');
  }

  // イベント作成時にリマインダートリガーを自動確保（権限が無くてもイベント作成は成功させる）
  let trigMsg = 'リマインダーメールも自動設定されました。';
  try {
    ensureReminderTrigger();
  } catch (trigErr) {
    Logger.log('トリガー設定スキップ（script.scriptapp 権限未承認の可能性）: ' + trigErr.toString());
    trigMsg = '（※リマインダー自動送信の有効化にはスクリプトの権限承認が必要です）';
  }

  return { message: 'イベント「' + p.eventName + '（' + Utilities.formatDate(eventDate, 'Asia/Tokyo', 'yyyy/MM/dd') + '）」を作成しました。' + trigMsg };
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
    sheet.appendRow(ROSTER_HEADER);
    sheet.getRange(1, 1, 1, ROSTER_HEADER.length).setBackground('#e8f4f8').setFontWeight('bold');
  }

  const eventInfo = getEventInfoBySheetName(p.sheetName);
  const tnum  = parseInt(String(p.tickets || '').replace(/[^0-9]/g, ''), 10) || 0;
  const price = eventInfo && eventInfo.advancePrice ? eventInfo.advancePrice : 0;
  const total = formatYen(price * tnum);   // I列: 金額 = 前売り単価 × 枚数

  // A申込日時 B名前 C フリガナ D メール E 電話 F 初回 G 予定 H 枚数 I 金額 J アップダイヤ
  sheet.appendRow([
    Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
    p.name || '', p.kana || '', p.email || '', p.phone || '',
    p.firstTime || '', p.note || '', p.tickets || '', total, p.upline || ''
  ]);
  const lastRow = sheet.getLastRow();

  // 申し込み確認メール即時送信 → K列「申込メール」に送信済み記入
  try {
    sendConfirmationEmail(p, eventInfo);
    sheet.getRange(lastRow, FLAG_COL.receipt).setValue('送信済み');
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

  // diff(日数) → テンプレート情報 のマップ（col=送信済みを記入する列番号）
  const allSchedule = {
    '7':  { tpl: '7日前リマインダーメール',  col: FLAG_COL.d7before, hour: times.d7before },
    '3':  { tpl: '3日前リマインダーメール',  col: FLAG_COL.d3before, hour: times.d3before },
    '1':  { tpl: '前日リマインダーメール',    col: FLAG_COL.d1before, hour: times.d1before },
    '0':  { tpl: '当日感謝メール',            col: FLAG_COL.sameday,  hour: times.sameday  },
    '-7': { tpl: '次回リマインドメール',       col: FLAG_COL.d7after,  hour: times.d7after  }
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
      const already = String(row[timing.col - 1] || '');   // 該当種別の列が既に記入済みか
      if (!email.includes('@') || already) continue;

      const data = buildMailData(row, eventDate, eventInfo);
      try {
        MailApp.sendEmail({ to: email, subject: applyTemplate(template.subject, data), htmlBody: applyTemplate(template.body, data) });
        sheet.getRange(i + 1, timing.col).setValue('送信済み');   // 種別ごとの列へ記入
        Logger.log('送信: ' + timing.tpl + ' → ' + email);
      } catch (e) { Logger.log('送信エラー: ' + e + ' [' + email + ']'); }
    }
  });
}

// ─────────────────────────────────────────────
//  指定の申込者へ全種別の自動返信を送信（テスト/手動用）
//  対応する各列（K申込メール〜P７日後）に「送信済み」を記入
// ─────────────────────────────────────────────
function sendAllToParticipant(p) {
  if (!p.sheetName) throw new Error('シート名が指定されていません');
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(p.sheetName);
  if (!sheet) throw new Error('名簿シートが見つかりません: ' + p.sheetName);

  const target = String(p.name || p.email || '').trim();
  const eventInfo = getEventInfoBySheetName(p.sheetName);
  const eventDate = new Date(
    parseInt(p.sheetName.substring(0, 4)),
    parseInt(p.sheetName.substring(4, 6)) - 1,
    parseInt(p.sheetName.substring(6, 8))
  );

  const types = [
    { tpl: 'オーダー受付メール',     col: FLAG_COL.receipt  }, // K 申込メール
    { tpl: '7日前リマインダーメール', col: FLAG_COL.d7before }, // L
    { tpl: '3日前リマインダーメール', col: FLAG_COL.d3before }, // M
    { tpl: '前日リマインダーメール',   col: FLAG_COL.d1before }, // N
    { tpl: '当日感謝メール',          col: FLAG_COL.sameday  }, // O
    { tpl: '次回リマインドメール',     col: FLAG_COL.d7after  }  // P
  ];

  const rows = sheet.getDataRange().getValues();
  let people = 0, mails = 0;
  for (let i = 1; i < rows.length; i++) {
    const name  = String(rows[i][1] || '').trim();
    const email = String(rows[i][3] || '');
    if (target && name !== target && email !== target) continue;
    if (!email.includes('@')) continue;
    people++;
    const data = buildMailData(rows[i], eventDate, eventInfo);
    types.forEach(function(t) {
      const tpl = getMailTemplate(t.tpl);
      if (!tpl) { Logger.log('テンプレなし: ' + t.tpl); return; }
      try {
        MailApp.sendEmail({ to: email, subject: applyTemplate(tpl.subject, data), htmlBody: applyTemplate(tpl.body, data) });
        sheet.getRange(i + 1, t.col).setValue('送信済み');
        mails++;
      } catch (e) { Logger.log('送信エラー(' + t.tpl + '): ' + e); }
    });
  }
  if (people === 0) throw new Error('対象の申込者が見つかりません: ' + target);
  return { message: '対象 ' + people + ' 名へ ' + mails + ' 通送信し、各列に「送信済み」を記入しました。' };
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
  const tnum  = parseInt(String(p.tickets || '').replace(/[^0-9]/g, ''), 10) || 0;
  const price = eventInfo && eventInfo.advancePrice ? eventInfo.advancePrice : 0;
  const data = {
    name: p.name || '', kana: p.kana || '', email: email, phone: p.phone || '',
    firstTime: p.firstTime || '', note: showNote ? (p.note || '') : '', tickets: p.tickets || '', upline: p.upline || '',
    fee:       formatYen(price * tnum),   // 金額 = 前売り単価 × 枚数
    date:      eventInfo ? eventInfo.date  : '',
    time:      eventInfo ? eventInfo.time  : '',
    venue:     eventInfo ? eventInfo.venue : '',
    guest:     eventInfo ? eventInfo.guest : '',
    eventName: eventInfo ? eventInfo.eventName : ''
  };
  MailApp.sendEmail({ to: email, subject: applyTemplate(tpl.subject, data), htmlBody: applyTemplate(tpl.body, data) });
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
    const details0 = String(rows[i][6] || '');              // G列: 詳細
    const pm = details0.match(/前売り[^0-9]*([0-9,]+)/);     // G列内の「前売り」価格
    return {
      eventName: String(rows[i][7] || ''),                  // H列
      date:      Utilities.formatDate(ed, 'Asia/Tokyo', 'yyyy/MM/dd'),
      time:      String(rows[i][1] || 'OPEN 19:00 / START 19:30'), // B列: 時間
      venue:     String(rows[i][2] || ''),                  // C列: 開催場所
      guest:     String(rows[i][3] || ''),                  // D列: ゲスト名
      details:   details0,
      advancePrice: pm ? parseInt(pm[1].replace(/,/g, ''), 10) : 0, // 前売り単価
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
    const nm = String(rows[i][0]).trim();
    // 「オーダー受付メール」「オーダー受付メールの件名」どちらの命名でも一致させる
    if (nm === templateName || nm === templateName + 'の件名')
      return { name: rows[i][0], subject: String(rows[i][1] || ''), body: String(rows[i][2] || '') };
  }
  return null;
}

// 数値を「1,500円」形式に整形
function formatYen(n) {
  if (!n || isNaN(n)) return '';
  return Number(n).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '円';
}

function applyTemplate(template, data) {
  let r = String(template || '');
  // 一般予定人数(note)が空のときは、その語を含む断片(改行/<br>区切り)ごと削除
  if (!data.note) {
    r = r.split(/(?:<br\s*\/?>|\n)/i).filter(function(seg) {
      return !/\{\{note\}\}|\[一般予定人数\]|\[予定人数\]/.test(seg);
    }).join('<br>');
  }
  // {{key}} 形式の置換
  Object.keys(data).forEach(function(k) {
    r = r.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), data[k] == null ? '' : data[k]);
  });
  // [日本語] 形式の置換（既存テンプレ互換）
  const jpMap = {
    '名前': 'name', 'フルネーム': 'name', 'フリガナ': 'kana',
    'メール': 'email', 'メールアドレス': 'email', '電話': 'phone', '電話番号': 'phone',
    '一般予定人数': 'note', '予定人数': 'note', '枚数': 'tickets', '金額': 'fee', 'アップダイヤ': 'upline',
    '日付': 'date', '開催日': 'date', '日時': 'time', '時間': 'time',
    '会場': 'venue', '開催場所': 'venue', 'ゲスト': 'guest', 'ゲスト名': 'guest', 'イベント名': 'eventName'
  };
  Object.keys(jpMap).forEach(function(jp) {
    const v = data[jpMap[jp]];
    r = r.replace(new RegExp('\\[' + jp + '\\]', 'g'), v == null ? '' : v);
  });
  return r;
}

function buildMailData(row, eventDate, info) {
  const showNote = !(info && info.showNote === false);
  const tnum  = parseInt(String(row[7] || '').replace(/[^0-9]/g, ''), 10) || 0; // 枚数
  const price = info && info.advancePrice ? info.advancePrice : 0;              // 前売り単価
  return {
    name:      String(row[1] || ''), kana:  String(row[2] || ''),
    email:     String(row[3] || ''), phone: String(row[4] || ''),
    firstTime: String(row[5] || ''), note:  showNote ? String(row[6] || '') : '',
    tickets:   String(row[7] || ''), upline:String(row[9] || ''),   // J列: アップダイヤ
    fee:       formatYen(price * tnum),   // 金額 = 前売り単価 × 枚数
    date:      Utilities.formatDate(eventDate, 'Asia/Tokyo', 'yyyy年MM月dd日'),
    dateSlash: Utilities.formatDate(eventDate, 'Asia/Tokyo', 'yyyy/MM/dd'),
    time:      info ? info.time      : '',
    venue:     info ? info.venue     : '',
    guest:     info ? info.guest     : '',
    eventName: info ? info.eventName : ''
  };
}
