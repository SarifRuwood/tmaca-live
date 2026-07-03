const TMACA = (() => {

let state = Store.load();

function initializeDatabase(){
  if (!Array.isArray(state.episodes) || state.episodes.length < 200) {
    state.episodes = [];
    state.log = [];
    state.driftHistory = [];
    state.repairHistory = [];
    state.failures = 0;

    for (let i = 1; i <= 200; i++) {
      const ep = Schema.makeCanonicalEpisode(i);
      const validation = Validator.validate(ep);
      if (!validation.ok) state.failures++;
      state.episodes.push(ep);
    }

    state.total = state.episodes.length;
    state.current = state.episodes[state.episodes.length - 1];

    log({
      type: "INIT",
      episode: state.current,
      validation: Validator.validate(state.current),
      generatedCount: state.total
    });
  } else {
    state.total = state.episodes.length;
    if (!state.current) {
      state.current = state.episodes[state.episodes.length - 1];
    }
  }
}

initializeDatabase();

/* -------------------------
   EPISODE GENERATOR
--------------------------*/
function makeEpisode(){
  let n = state.total + 1;
  return Schema.makeCanonicalEpisode(n);
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
  let ep = makeEpisode();

  state.total++;
  state.episodes.push(ep);
  state.current = ep;

  let validation = Validator.validate(ep);
  if(!validation.ok) state.failures++;

  log({
    type: "GENERATE",
    episode: ep,
    validation
  });
}

/* -------------------------
   FULL CYCLE (GEN → VALIDATE → REPAIR)
--------------------------*/
function cycle(){
  let ep = makeEpisode();

  state.total++;
  state.episodes.push(ep);

  let validation = Validator.validate(ep);
  let repairOutcome = null;

  if(!validation.ok){
    state.failures++;
    repairOutcome = Validator.repair(ep, validation.failures);
    ep = repairOutcome.episode;
    validation = Validator.validate(ep);
  }

  state.current = ep;

  log({
    type: "CYCLE",
    episode: ep,
    validation,
    repairs: repairOutcome ? repairOutcome.repairs : []
  });
}

/* -------------------------
   RESET SYSTEM
--------------------------*/
function reset(){
  state = Store.reset();
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

  const datasetSummary = state.episodes.reduce((summary, episode) => {
    const validation = Validator.validate(episode);
    if (!validation.ok) {
      summary.invalid += 1;
      validation.failures.forEach(failure => {
        summary.byCategory[failure.category] = (summary.byCategory[failure.category] || 0) + 1;
      });
    }
    return summary;
  }, { invalid: 0, byCategory: {} });

  const total = state.episodes.length;
  const invalid = datasetSummary.invalid;
  const valid = total - invalid;

  document.getElementById("dataset").innerText =
    `Episodes: ${total}` +
    `\nValid: ${valid}` +
    `\nInvalid: ${invalid}` +
    `\nRepairable: ${invalid}` +
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
    "\nEpisodes: " + state.episodes.length +
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
}

/* initial render */
render();

/* public API */
return {
  generate,
  cycle,
  reset
};

})();