/* Browser-local decision records. No network, storage, DOM, or trade logic. */
(function (root) {
  'use strict';
  const schema = 'amalgam.decision-journal.v1';
  const fields = Object.freeze(['ticker', 'recordType', 'outcome', 'reason', 'evidence', 'checklist', 'entryRule', 'size', 'exitRule', 'execution', 'exitReason', 'adherence', 'lesson']);
  const types = Object.freeze(['Retrospective', 'Plan recorded now']);
  const outcomes = Object.freeze(['Closed', 'Decided against trading', 'Considering', 'Open (self-reported)']);
  const adherences = Object.freeze(['Unresolved', 'Yes (self-reported)', 'No (self-reported)', 'Not applicable']);
  const maxBackupBytes = 5_000_000;
  const validTime = t => typeof t === 'string' && /^\d{4}-\d\d-\d\dT/.test(t) && Number.isFinite(Date.parse(t));
  const exactKeys = (o, keys) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));

  function validate(data) {
    if (!exactKeys(data, ['schema', 'cards']) || data.schema !== schema || !Array.isArray(data.cards) || data.cards.length > 500) {
      throw Error('Unsupported backup or more than 500 cards.');
    }
    const ids = new Set();
    return data.cards.map(c => {
      if (!exactKeys(c, ['id', 'savedAt', ...fields, 'amendments']) || typeof c.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(c.id) || ids.has(c.id) || !validTime(c.savedAt) || !fields.every(f => typeof c[f] === 'string' && c[f].length <= (f === 'ticker' ? 20 : 4000)) || !c.ticker.trim() || !c.reason.trim() || !types.includes(c.recordType) || !outcomes.includes(c.outcome) || !adherences.includes(c.adherence) || !Array.isArray(c.amendments) || c.amendments.length > 200) {
        throw Error('Invalid decision card.');
      }
      ids.add(c.id);
      const card = { id: c.id, savedAt: c.savedAt };
      for (const f of fields) card[f] = c[f];
      card.amendments = c.amendments.map(a => {
        if (!exactKeys(a, ['savedAt', 'change', 'reason', 'planned', 'adherence']) || !validTime(a.savedAt) || !['change', 'reason'].every(k => typeof a[k] === 'string' && a[k].trim() && a[k].length <= 4000) || !['Yes', 'No', 'Unknown'].includes(a.planned) || !adherences.includes(a.adherence)) {
          throw Error('Invalid amendment.');
        }
        return { savedAt: a.savedAt, change: a.change, reason: a.reason, planned: a.planned, adherence: a.adherence };
      });
      return card;
    });
  }

  function backupText(cards) {
    const text = JSON.stringify({ schema, cards: validate({ schema, cards }) }, null, 2);
    if (new TextEncoder().encode(text).length > maxBackupBytes) {
      throw Error('Records exceed the 5 MB backup limit. Export existing cards before starting a separate archive.');
    }
    return text;
  }

  function mergeCards(existing, incoming) {
    const current = validate({ schema, cards: existing });
    const imported = validate({ schema, cards: incoming });
    const map = new Map(current.map(c => [c.id, c]));
    let added = 0;
    for (const card of imported) {
      if (map.has(card.id)) {
        if (JSON.stringify(map.get(card.id)) !== JSON.stringify(card)) {
          throw Error('Conflicting versions of a card. Existing records were kept; nothing imported.');
        }
      } else {
        map.set(card.id, card);
        added++;
      }
    }
    const cards = validate({ schema, cards: [...map.values()] });
    backupText(cards); // Anything accepted by restore must itself be exportable.
    return { cards, added };
  }

  function csvCell(value) {
    let text = String(value ?? '');
    if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }

  function csvText(cards) {
    const columns = ['id', 'savedAt', ...fields, 'amendments'];
    const rows = [columns, ...validate({ schema, cards }).map(c => columns.map(k => k === 'amendments' ? JSON.stringify(c.amendments) : c[k]))];
    return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  }

  const api = Object.freeze({ schema, fields, types, outcomes, adherences, maxBackupBytes, validTime, exactKeys, validate, backupText, mergeCards, csvCell, csvText });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AmalgamJournal = api;
})(globalThis);
