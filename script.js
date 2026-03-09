document.addEventListener("DOMContentLoaded", () => {
  // ELEMENT REFERENCES
  const pForm = document.getElementById("profile-form");
  const wForm = document.getElementById("weight-log-form");

  const mTarget = document.getElementById("monthly-target");
  const wHist = document.getElementById("weight-history");
  const rOut = document.getElementById("routine-output");

  const startBtn = document.getElementById("start-workout");
  const hud = document.getElementById("workout-hud");
  const timerEl = document.getElementById("timer-display");
  const speedEl = document.getElementById("speed-prompt");
  const phaseEl = document.getElementById("phase");

  const pauseBtn = document.getElementById("pause-workout");
  const stopBtn = document.getElementById("stop-workout");

  // STATE
  let profile = JSON.parse(localStorage.getItem("profile")) || null;
  let logs = JSON.parse(localStorage.getItem("logs")) || [];

  let aCtx = null;
  let sTime = 0;       // total session seconds
  let phTime = 0;      // phase timer
  let tInterval = null;
  let isPaused = false;
  let phase = "warmup";

  let baseMph = 0;
  let maxMph = 0;

  // BEEP HELPER
  function beep(freq = 800, dur = 150, vol = 0.3, type = "sine") {
    if (!aCtx) aCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = aCtx.createOscillator();
    const gain = aCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;

    osc.connect(gain);
    gain.connect(aCtx.destination);

    const now = aCtx.currentTime;
    osc.start(now);
    osc.stop(now + dur / 1000);
  }

  // ============================
  // LOAD EXISTING PROFILE
  // ============================
  if (profile) {
    sex.value = profile.sex;
    age.value = profile.age;
    height.value = profile.height;
    current_weight.value = profile.currentWeight;
    target_weight.value = profile.targetWeight;
    fitness_level.value = profile.fitnessLevel;

    calcTarget();
    genRoutine();
    showLogs();
  }

  // ============================
  // SAVE PROFILE
  // ============================
  pForm.addEventListener("submit", (e) => {
    e.preventDefault();

    profile = {
      sex: sex.value,
      age: Number(age.value),
      height: Number(height.value),
      currentWeight: Number(current_weight.value),
      targetWeight: Number(target_weight.value),
      fitnessLevel: fitness_level.value
    };

    localStorage.setItem("profile", JSON.stringify(profile));

    calcTarget();
    genRoutine();
    logWeight(profile.currentWeight);
  });

  // ============================
  // LOG WEIGHT
  // ============================
  wForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const w = Number(log_weight.value);
    logWeight(w);
    log_weight.value = "";
  });

  function logWeight(w) {
    if (!profile) return;
    const h = profile.height / 100;
    const bmi = (w / (h * h)).toFixed(2);
    const d = new Date().toLocaleDateString();

    logs.push({ d, w, bmi });
    localStorage.setItem("logs", JSON.stringify(logs));
    showLogs();
  }

  // DELETE
  window._deleteLog = function (index) {
    logs.splice(index, 1);
    localStorage.setItem("logs", JSON.stringify(logs));
    showLogs();
  };

  // ============================
  // SHOW LOGS + BMI CHART
  // ============================
  function showLogs() {
    if (!logs.length) {
      wHist.innerHTML = "<p>No entries yet.</p>";
      return;
    }

    let html = `
      <table>
        <tr>
          <th>Date</th><th>kg</th><th>BMI</th><th>Δkg</th><th>ΔBMI</th><th></th>
        </tr>
    `;

    logs.forEach((l, i) => {
      const prev = logs[i - 1];
      const dKg = prev ? (l.w - prev.w).toFixed(2) : "";
      const dBmi = prev ? (l.bmi - prev.bmi).toFixed(2) : "";

      html += `
        <tr>
          <td>${l.d}</td>
          <td>${l.w}</td>
          <td>${l.bmi}</td>
          <td>${prev ? (dKg > 0 ? `↑ +${dKg}` : `↓ ${dKg}`) : ""}</td>
          <td>${prev ? (dBmi > 0 ? `↑ +${dBmi}` : `↓ ${dBmi}`) : ""}</td>
          <td><button class="delete-btn" onclick="deleteLog(${i})">🗑</button></td>
        </tr>
      `;
    });

    html += "</table>";
    wHist.innerHTML = html;

    // CHART
    const ctx = document.getElementById("bmi-chart").getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: logs.map((l) => l.d),
        datasets: [
          {
            label: "BMI",
            data: logs.map((l) => l.bmi),
            borderColor: "#0ea5e9",
            backgroundColor: "rgba(14,165,233,0.25)",
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  // ============================
  // MONTHLY TARGET
  // ============================
  function calcTarget() {
    if (!profile) return;
    const diff = profile.currentWeight - profile.targetWeight;

    if (diff <= 0) {
      mTarget.innerHTML = "<p>No loss needed.</p>";
      return;
    }

    const monthly = (0.75 * 4).toFixed(1);
    const stages = Math.ceil(diff / 5);

    let html = `<p>Monthly: ${monthly} kg</p><ul>`;
    for (let i = 1; i <= stages; i++) {
      html += `<li>Stage ${i}: ${(profile.currentWeight - i * 5).toFixed(1)} kg</li>`;
    }
    html += "</ul>";
    mTarget.innerHTML = html;
  }

  // ============================
  // ROUTINE GENERATOR
  // ============================
  function genRoutine() {
    if (!profile) return;
    const { sex, age, height, fitnessLevel } = profile;

    const hm = height / 100;
    const k = sex === "male" ? 0.415 : sex === "female" ? 0.413 : 0.414;
    const stride = (hm * k * 100).toFixed(1);

    const baseMiles =
      age < 60
        ? sex === "male"
          ? 5.6
          : sex === "female"
          ? 5
          : 5.3
        : sex === "male"
        ? 4.3
        : sex === "female"
        ? 3.7
        : 4;

    const lvl = fitnessLevel;
    const start = lvl === "low" ? 0.4 : lvl === "medium" ? 0.6 : 0.8;
    const inc = lvl === "low" ? 0.1 : lvl === "medium" ? 0.05 : 0.025;

    baseMph = lvl === "low" ? 1.9 : lvl === "medium" ? 2.5 : 3.1;
    maxMph = baseMph + (lvl === "low" ? 1.2 : lvl === "medium" ? 1.9 : 2.5);

    let html = `
      <p>Target distance: ${baseMiles.toFixed(1)} miles/day</p>
      <p>Stride: ${stride} cm</p>
      <table>
        <tr><th>Weeks</th><th>Miles</th><th>Time (min)</th></tr>
    `;

    let pct = start;
    for (let w = 1; w <= 12; w += 2) {
      const miles = (baseMiles * pct).toFixed(1);
      const minutes = Math.round((miles / baseMph) * 60);

      html += `
        <tr>
          <td>${w}-${w + 1}</td>
          <td>${miles}</td>
          <td>${minutes}</td>
        </tr>
      `;

      pct = Math.min(1, pct + inc * 2);
    }

    html += "</table>";
    rOut.innerHTML = html;
  }

  // ============================
  // WORKOUT TIMER
  // ============================
  startBtn.addEventListener("click", () => {
    if (aCtx) aCtx.resume();
    hud.style.display = "block";
    startBtn.style.display = "none";

    sTime = 0;
    phTime = 0;
    phase = "warmup";
    isPaused = false;

    updateHUD();

    tInterval = setInterval(() => {
      if (!isPaused) {
        sTime++;
        phTime++;
        updateHUD();
      }
    }, 1000);
  });

  pauseBtn.addEventListener("click", () => {
