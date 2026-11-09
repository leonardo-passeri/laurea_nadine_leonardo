// Salva le risposte dei moduli "Ci sarai?" nel foglio Google a cui è collegato questo script.
// Installazione: Estensioni → Apps Script nel foglio, incolla questo file,
// poi Esegui il deployment → Nuovo deployment → App web (Esegui come: Me, Chi ha accesso: Chiunque).

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Risposte') || ss.insertSheet('Risposte');
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Data', 'Evento', 'Nome', 'Ci sarà?', 'Messaggio']);
      sheet.setFrozenRows(1);
    }
    var p = e.parameter || {};
    sheet.appendRow([
      new Date(),
      clean(p.evento, 30),
      clean(p.nome, 80),
      clean(p.presenza, 5),
      clean(p.messaggio, 1000)
    ]);
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

// Taglia i testi troppo lunghi e impedisce che un testo venga letto come formula (=, +, -, @)
function clean(value, max) {
  var s = String(value || '').slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
