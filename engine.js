const TMACA = (() => {

let state = Store.load();

/* -------------------------
   EPISODE GENERATOR
--------------------------*/
function makeEpisode(){
  let n = state.total + 1;

  return {
    id: Math.random() < 0.25
      ? "MAG-" + (n+1).toString().padStart(3,'0')
      : "MAG-" + n.toString().padStart(3,'0'),

    number: n,
    season: 1,
    title: Math.random() < 0.2 ? "" : "Episode " + n
  };
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

  state.current = ep;
  state.total++;

  let result = Validator.validate(ep);

  if(!result.ok) state.failures++;

  log({
    type: "GENERATE",
    episode: ep,
    result
  });
}

/* -------------------------
   FULL CYCLE (GEN → VALIDATE → REPAIR)
--------------------------*/
function cycle(){
  let ep = makeEpisode();

  state.total++;

  let result = Validator.validate(ep);

  if(!result.ok){
    state.failures++;
    ep = Validator.repair(ep, result.error);
    result = Validator.validate(ep);
  }

  state.current = ep;

  log({
    type: "CYCLE",
    episode: ep,
    result
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
    last.result.ok
      ? "<span class='good'>ACCEPTED</span>"
      : "<span class='bad'>REJECTED: " + last.result.error + "</span>";

  let drift = state.failures / (state.total || 1);

  document.getElementById("drift").innerText =
    "Total: " + state.total +
    "\nFailures: " + state.failures +
    "\nDrift: " + drift.toFixed(3) +
    "\nHistory Points: " + (state.driftHistory?.length || 0);

  document.getElementById("log").innerText =
    state.log.slice(-12).map(e =>
      `${e.type} → ${e.result.ok ? "OK" : e.result.error}`
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