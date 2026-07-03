const TMACA = (() => {

let state = Store.load();

function makeEpisodeRecord(number){
  const episode = Schema.makeCanonicalEpisode(number);
  const validation = Validator.validate(episode);
  return {
    id: episode.id,
    episode,
    validation,
    status: validation.ok ? 'valid' : 'invalid',
    repairAttempts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function makeEpisodeRecordFromEpisode(episode){
  const validation = Validator.validate(episode);
  return {
    id: episode.id,
    episode,
    validation,
    status: validation.ok ? 'valid' : 'invalid',
    repairAttempts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function migrateOldEpisodes(){
  if (!Array.isArray(state.episodeRecords) || state.episodeRecords.length === 0) {
    if (Array.isArray(state.episodes) && state.episodes.length > 0) {
      state.episodeRecords = state.episodes.map(ep => makeEpisodeRecordFromEpisode(ep));
    }
  }
}

async function loadScrapedEpisodeData(){
  try {
    const response = await fetch('episodes-scraped.json');
    if (!response.ok) throw new Error('Failed to fetch episodes-scraped.json: ' + response.status);
    const episodes = await response.json();
    if (!Array.isArray(episodes)) throw new Error('Invalid scraped dataset format');
    return episodes;
  } catch (error) {
    console.warn('TMACA: loadScrapedEpisodeData error', error);
    return null;
  }
}

async function loadStaticEpisodeData(){
  try {
    const response = await fetch('episodes.json');
    if (!response.ok) throw new Error('Failed to fetch episodes.json: ' + response.status);
    const episodes = await response.json();
    if (!Array.isArray(episodes)) throw new Error('Invalid static dataset format');
    return episodes;
  } catch (error) {
    console.warn('TMACA: loadStaticEpisodeData error', error);
    return null;
  }
}

function initializeDatabase(){
  migrateOldEpisodes();
  state.episodeRecords = state.episodeRecords || [];
  state.log = state.log || [];
  state.driftHistory = state.driftHistory || [];
  state.repairHistory = state.repairHistory || [];
}

async function loadInitialDataset(){
  initializeDatabase();
  const scrapedEpisodeData = await loadScrapedEpisodeData();
  if (Array.isArray(scrapedEpisodeData) && scrapedEpisodeData.length > 0) {
    state.episodeRecords = scrapedEpisodeData.map(makeEpisodeRecordFromEpisode);
    state.total = state.episodeRecords.length;
    state.failures = state.episodeRecords.filter(record => !record.validation.ok).length;
    state.currentRecordIndex = state.episodeRecords.length - 1;
    state.current = state.episodeRecords[state.currentRecordIndex].episode;
    state.datasetSource = 'scraped-json';

    log({
      type: 'INIT',
      episode: state.current,
      validation: Validator.validate(state.current),
      generatedCount: state.total,
      source: 'scraped-json'
    });
    render();
    return;
  }

  const staticEpisodeData = await loadStaticEpisodeData();

  if (Array.isArray(staticEpisodeData) && staticEpisodeData.length > 0) {
    state.episodeRecords = staticEpisodeData.map(makeEpisodeRecordFromEpisode);
    state.total = state.episodeRecords.length;
    state.failures = state.episodeRecords.filter(record => !record.validation.ok).length;
    state.currentRecordIndex = state.episodeRecords.length - 1;
    state.current = state.episodeRecords[state.currentRecordIndex].episode;
    state.datasetSource = 'static-json';

    log({
      type: 'INIT',
      episode: state.current,
      validation: Validator.validate(state.current),
      generatedCount: state.total,
      source: 'static-json'
    });
    render();
    return;
  }

  if (!Array.isArray(state.episodeRecords) || state.episodeRecords.length < 200) {
    state.episodeRecords = [];
    state.failures = 0;

    for (let i = 1; i <= 200; i++) {
      const record = makeEpisodeRecord(i);
      if (!record.validation.ok) state.failures++;
      state.episodeRecords.push(record);
    }

    state.total = state.episodeRecords.length;
    state.currentRecordIndex = state.episodeRecords.length - 1;
    state.current = state.episodeRecords[state.currentRecordIndex].episode;
    state.datasetSource = 'random-generator';

    log({
      type: 'INIT',
      episode: state.current,
      validation: Validator.validate(state.current),
      generatedCount: state.total,
      source: 'random-generator'
    });
  } else {
    state.total = state.episodeRecords.length;
    if (!Number.isInteger(state.currentRecordIndex)) {
      state.currentRecordIndex = state.episodeRecords.length - 1;
    }
    state.current = state.episodeRecords[state.currentRecordIndex]?.episode || null;
    render();
  }
}

function setDatasetFromEpisodes(episodes, source){
  state.episodeRecords = episodes.map(makeEpisodeRecordFromEpisode);
  state.total = state.episodeRecords.length;
  state.failures = state.episodeRecords.filter(record => !record.validation.ok).length;
  state.currentRecordIndex = state.episodeRecords.length - 1;
  state.current = state.episodeRecords[state.currentRecordIndex].episode;
  state.datasetSource = source;
  state.log = state.log || [];
  state.driftHistory = state.driftHistory || [];
  state.repairHistory = state.repairHistory || [];

  log({
    type: 'DATASET_LOADED',
    episode: state.current,
    validation: Validator.validate(state.current),
    generatedCount: state.total,
    source
  });
}

function exportDataset(){
  const exported = state.episodeRecords.map(record => record.episode);
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'tmaca-episodes-export.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

function displayRecordEditor(){
  const selectedIndex = Number.isInteger(state.currentRecordIndex) ? state.currentRecordIndex : 0;
  const selectedRecord = state.episodeRecords[selectedIndex];
  const editor = document.getElementById('recordEditor');
  editor.value = selectedRecord ? JSON.stringify(selectedRecord.episode, null, 2) : '';
}

function saveRecordEdit(){
  const index = state.currentRecordIndex;
  const editor = document.getElementById('recordEditor');
  try {
    const updatedEpisode = JSON.parse(editor.value);
    const record = makeEpisodeRecordFromEpisode(updatedEpisode);
    record.repairAttempts = state.episodeRecords[index]?.repairAttempts || [];
    record.createdAt = state.episodeRecords[index]?.createdAt || new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    state.episodeRecords[index] = record;
    state.current = record.episode;
    state.failures = state.episodeRecords.filter(r => !r.validation.ok).length;
    log({
      type: 'MANUAL_EDIT',
      episode: record.episode,
      validation: record.validation
    });
    render();
  } catch (error) {
    alert('Invalid JSON in record editor: ' + error.message);
  }
}

function promptImportDataset(){
  document.getElementById('datasetImportInput').click();
}

function importDataset(event){
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) throw new Error('Dataset must be an array');
      setDatasetFromEpisodes(parsed, 'import');
      render();
    } catch (error) {
      alert('Failed to import dataset: ' + error.message);
    }
  };
  reader.readAsText(file);
}

function loadStaticDataset(){
  loadStaticEpisodeData().then(episodes => {
    if (Array.isArray(episodes)) {
      setDatasetFromEpisodes(episodes, 'static-json');
      render();
    } else {
      alert('Unable to load static dataset');
    }
  });
}

function resetToStaticDataset(){
  loadStaticEpisodeData().then(episodes => {
    if (Array.isArray(episodes)) {
      state = Store.reset();
      setDatasetFromEpisodes(episodes, 'static-json-reset');
      render();
    } else {
      alert('Unable to load static dataset for reset');
    }
  });
}

function loadScrapedDataset(){
  loadScrapedEpisodeData().then(episodes => {
    if (Array.isArray(episodes)) {
      setDatasetFromEpisodes(episodes, 'scraped-json');
      render();
    } else {
      alert('Unable to load scraped dataset');
    }
  });
}

function resetToScrapedDataset(){
  loadScrapedEpisodeData().then(episodes => {
    if (Array.isArray(episodes)) {
      state = Store.reset();
      setDatasetFromEpisodes(episodes, 'scraped-json-reset');
      render();
    } else {
      alert('Unable to load scraped dataset for reset');
    }
  });
}

function exportCurrentDataset(){
  exportDataset();
}

async function loadInitialDatasetWrapper(){
  await loadInitialDataset();
}

loadInitialDatasetWrapper();

/* -------------------------
   EPISODE GENERATOR
--------------------------*/
function makeEpisode(){
  let n = state.total + 1;
  return Schema.makeCanonicalEpisode(n);
}

function makeEpisodeDatabaseRecord(number){
  const record = makeEpisodeRecord(number);
  state.episodeRecords.push(record);
  state.total = state.episodeRecords.length;
  return record;
}
function repairRecord(record){
  if (!record || record.status === 'valid') {
    return { record, repairs: [], success: true };
  }

  const repairOutcome = Validator.repair(record.episode, record.validation.failures);
  record.repairAttempts.push(...repairOutcome.repairs);
  record.episode = repairOutcome.episode;
  record.validation = Validator.validate(record.episode);
  record.status = record.validation.ok ? 'repaired' : 'repair_failed';
  record.updatedAt = new Date().toISOString();

  if (record.status === 'repaired') {
    state.failures = Math.max(0, state.failures - 1);
  }

  return {
    record,
    repairs: repairOutcome.repairs,
    success: record.status === 'repaired'
  };
}
/* -------------------------
   EVENT LOGGER
--------------------------*/
function log(event){
  state.log.push(event);

  if (event.repairs && event.repairs.length) {
    event.repairs.forEach(repair => {
      state.repairHistory.push({
        ...repair,
        episode: event.episode.id,
        eventType: event.type,
        timestamp: new Date().toISOString()
      });
    });
  }

  // drift snapshot (time series ready)
  state.driftHistory.push({
    t: Date.now(),
    drift: state.failures / (state.total || 1)
  });

  Store.save(state);
  render();
}

/* -------------------------
   GENERATE ONLY
--------------------------*/
function generate(){
  const record = makeEpisodeDatabaseRecord(state.total + 1);
  const validation = record.validation;
  if(!validation.ok) state.failures++;
  state.currentRecordIndex = state.episodeRecords.length - 1;
  state.current = record.episode;

  log({
    type: "GENERATE",
    episode: record.episode,
    validation
  });
}

/* -------------------------
   FULL CYCLE (GEN → VALIDATE → REPAIR)
--------------------------*/
function cycle(){
  const record = makeEpisodeDatabaseRecord(state.total + 1);
  let validation = record.validation;
  let repairOutcome = null;

  if(!validation.ok){
    state.failures++;
    repairOutcome = Validator.repair(record.episode, validation.failures);
    record.repairAttempts = repairOutcome.repairs;
    record.episode = repairOutcome.episode;
    record.validation = Validator.validate(record.episode);
    record.status = record.validation.ok ? 'repaired' : 'repair_failed';
    record.updatedAt = new Date().toISOString();
    validation = record.validation;
  }

  state.currentRecordIndex = state.episodeRecords.length - 1;
  state.current = record.episode;

  log({
    type: "CYCLE",
    episode: record.episode,
    validation,
    repairs: repairOutcome ? repairOutcome.repairs : []
  });
}

/* -------------------------
   RESET SYSTEM
--------------------------*/
function reset(){
  state = Store.reset();
  initializeDatabase();
  render();
}

/* -------------------------
   RENDER UI
--------------------------*/
function render(){

  document.getElementById("episode").innerText =
    JSON.stringify(state.current || {}, null, 2);

  let last = state.log[state.log.length - 1];

  document.getElementById("validation").innerHTML =
    !last ? "" :
    last.validation.ok
      ? "<span class='good'>ACCEPTED</span>"
      : "<span class='bad'>REJECTED: " + last.validation.failures.map(f => f.rule).join(", ") + "</span>";

  document.getElementById("diagnostics").innerText =
    !last ? "" :
    last.validation.ok
      ? "No failures detected."
      : JSON.stringify(last.validation.failures, null, 2);

  const datasetSummary = state.episodeRecords.reduce((summary, record) => {
    const validation = record.validation;
    if (!validation.ok) {
      summary.invalid += 1;
      validation.failures.forEach(failure => {
        summary.byCategory[failure.category] = (summary.byCategory[failure.category] || 0) + 1;
      });
    }
    return summary;
  }, { invalid: 0, byCategory: {} });

  const total = state.episodeRecords.length;
  const invalid = datasetSummary.invalid;
  const valid = total - invalid;
  const source = state.datasetSource || 'persisted';

  document.getElementById("dataset").innerText =
    `Records: ${total}` +
    `\nValid: ${valid}` +
    `\nInvalid: ${invalid}` +
    `\nRepairable: ${invalid}` +
    `\nSource: ${source}` +
    `\n\nFailure categories:` +
    `\n  structural: ${datasetSummary.byCategory.structural || 0}` +
    `\n  format: ${datasetSummary.byCategory.format || 0}` +
    `\n  semantic: ${datasetSummary.byCategory.semantic || 0}` +
    `\n  referential: ${datasetSummary.byCategory.referential || 0}` +
    `\n  integrity: ${datasetSummary.byCategory.integrity || 0}`;

  let drift = state.failures / (state.total || 1);
  let repairSummary = state.repairHistory.reduce((summary, repair) => {
    summary.total += 1;
    summary.byRule[repair.rule] = (summary.byRule[repair.rule] || 0) + 1;
    summary.byStrategy[repair.strategy] = (summary.byStrategy[repair.strategy] || 0) + 1;
    return summary;
  }, { total: 0, byRule: {}, byStrategy: {} });

  document.getElementById("drift").innerText =
    "Total: " + state.total +
    "\nRecords: " + state.episodeRecords.length +
    "\nFailures: " + state.failures +
    "\nDrift: " + drift.toFixed(3) +
    "\nHistory Points: " + (state.driftHistory?.length || 0);

  document.getElementById("repairs").innerText =
    (repairSummary.total === 0 ? "No repairs recorded yet." :
      [`Repair summary: ${repairSummary.total} repairs`,
       `By rule: ${Object.entries(repairSummary.byRule).map(([rule, count]) => `${rule}=${count}`).join(', ')}`,
       `By strategy: ${Object.entries(repairSummary.byStrategy).map(([sto, count]) => `${sto}=${count}`).join(', ')}`,
       '',
       ...state.repairHistory.slice(-10).map(r =>
         `${r.timestamp} • ${r.eventType} • ${r.episode} • ${r.rule} → ${r.strategy}`
       )].join("\n")
    );

  document.getElementById("log").innerText =
    state.log.slice(-12).map(e =>
      `${e.type} • ${e.validation.ok ? "OK" : e.validation.failures.map(f => f.rule).join(", ")}`
    ).join("\n");

  const selectedIndex = Number.isInteger(state.currentRecordIndex) ? state.currentRecordIndex : 0;
  const selectedRecord = state.episodeRecords[selectedIndex];
  document.getElementById("record").innerText =
    selectedRecord ? JSON.stringify(selectedRecord, null, 2) : "No record selected.";
  document.getElementById("recordIndex").value = selectedIndex + 1;

  const editor = document.getElementById('recordEditor');
  if (editor) {
    editor.value = selectedRecord ? JSON.stringify(selectedRecord.episode, null, 2) : '';
  }

  document.getElementById("recordFilter").value = state.recordFilter || 'all';
  renderRecordBrowser();
}

function getFilteredRecords(){
  const filter = state.recordFilter || 'all';
  return state.episodeRecords.filter(record =>
    filter === 'all' || record.status === filter
  );
}

function renderRecordBrowser(){
  const filtered = getFilteredRecords();
  const rows = filtered.slice(0, 20).map((record, index) => {
    return `${index + 1}. ${record.id} [${record.status}] - ${record.validation.ok ? 'OK' : record.validation.failures.length + ' failures'}`;
  });
  document.getElementById("recordBrowser").innerText =
    `Filtered records: ${filtered.length}` +
    `\nShowing first 20:` +
    `\n` + rows.join("\n");
}

function setRecordFilter(){
  const filter = document.getElementById("recordFilter").value;
  state.recordFilter = filter;
  render();
}

function refreshRecords(){
  render();
}

function datasetSourceLabel(){
  return state.datasetSource || 'persisted';
}

function selectRecord(){
  const input = document.getElementById("recordIndex");
  const index = Number(input.value) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= state.episodeRecords.length) {
    return;
  }
  state.currentRecordIndex = index;
  state.current = state.episodeRecords[index].episode;
  render();
}

function repairSelectedRecord(){
  const index = state.currentRecordIndex;
  const record = state.episodeRecords[index];
  if (!record || record.status === 'valid') return;

  const result = repairRecord(record);

  log({
    type: "REPAIR_SELECTED",
    episode: record.episode,
    validation: record.validation,
    repairs: result.repairs
  });
  render();
}

function saveRecordEdit(){
  const index = state.currentRecordIndex;
  const editor = document.getElementById('recordEditor');
  try {
    const updatedEpisode = JSON.parse(editor.value);
    const record = makeEpisodeRecordFromEpisode(updatedEpisode);
    record.repairAttempts = state.episodeRecords[index]?.repairAttempts || [];
    record.createdAt = state.episodeRecords[index]?.createdAt || new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    state.episodeRecords[index] = record;
    state.current = record.episode;
    state.failures = state.episodeRecords.filter(r => !r.validation.ok).length;
    log({
      type: 'MANUAL_EDIT',
      episode: record.episode,
      validation: record.validation
    });
    render();
  } catch (error) {
    alert('Invalid JSON in record editor: ' + error.message);
  }
}

function repairAllInvalidRecords(){
  const invalidRecords = state.episodeRecords.filter(record => record.status === 'invalid');
  const results = invalidRecords.map(record => repairRecord(record));
  const repairs = results.flatMap(result => result.repairs);
  const successCount = results.filter(result => result.success).length;
  const failedCount = results.length - successCount;

  log({
    type: "AUTO_REPAIR",
    episode: state.current,
    validation: state.current ? Validator.validate(state.current) : { ok: true, failures: [] },
    repairs,
    recordsProcessed: results.length,
    successCount,
    failedCount
  });

  render();
}

/* initial render */
render();

/* public API */
return {
  generate,
  cycle,
  reset,
  selectRecord,
  repairSelectedRecord
};

})();