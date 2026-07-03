const TMACA = (() => {

let state = Store.load();

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

  let drift = state.failures / (state.total || 1);

  document.getElementById("drift").innerText =
    "Total: " + state.total +
    "\nFailures: " + state.failures +
    "\nDrift: " + drift.toFixed(3) +
    "\nHistory Points: " + (state.driftHistory?.length || 0);

  document.getElementById("log").innerText =
    state.log.slice(-12).map(e =>
      `${e.type} → ${e.validation.ok ? "OK" : e.validation.failures.map(f => f.rule).join(", ")}`
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