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
  let sTime = 0;
  let phTime = 0;
  let tInterval = null;
  let isPaused = false;
  let phase = "warmup";

  let baseMph = 0;
  let maxMph = 0;

  // =======================
  // BEEP SOUND
  // =======================
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

  // =======================
  // LOAD SAVED PROFILE
  // =======================
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

  // =======================
  // SAVE PROFILE
  // =======================
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

  // =======================
  // LOG WEIGHT
  // =======================
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

  window._deleteLog = function (i) {
    logs.splice(i, 1);
    localStorage.setItem("logs", JSON.stringify(logs));
    showLogs();
  };

  // =======================
  // SHOW LOGS + CHART
  // =======================
  function showLogs() {
    if (!logs.length) {
      wHist.innerHTML = "<p>No entries yet.</p>";
      return;
    }

    let html = `
      <table>
        <tr>
          <th>Date</th><th>kg</th><th>BMI</th>
          <th>Δkg</th><th>ΔBMI</th><th></th>
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

    const ctx = document.getElementById("bmi-chart").getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: logs.map(l => l.d),
        datasets: [{
          label: "BMI",
          data: logs.map(l => l.bmi),
          borderColor: "#0ea5e9",
          backgroundColor: "rgba(14,165,233,0.25)",
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  // =======================
  // MONTHLY TARGET
  // =======================
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

  // =======================
  // ROUTINE GENERATION
  // =======================
  function genRoutine() {
    if (!profile) return;

    const { sex, age, height, fitnessLevel } = profile;

    const hm = height / 100;
    const strideCm = (hm * (sex === "male" ? 0.415 : 0.413) * 100).toFixed(1);

    const baseMiles =
      age < 60
        ? sex === "male"
          ? 5.6
          : 5.0
        : sex === "male"
        ? 4.3
        : 3.7;

    const startPct = fitnessLevel === "low" ? 0.4 : fitnessLevel === "medium" ? 0.6 : 0.8;
    const inc = fitnessLevel === "low" ? 0.1 : fitnessLevel === "medium" ? 0.05 : 0.025;

    baseMph = fitnessLevel === "low" ? 1.9 : fitnessLevel === "medium" ? 2.5 : 3.1;
    maxMph = baseMph + (fitnessLevel === "low" ? 1.2 : fitnessLevel === "medium" ? 1.9 : 2.5);

    let html = `
      <p>Target distance: ${baseMiles.toFixed(1)} miles/day</p>
      <p>Stride: ${strideCm} cm</p>
      <table>
        <tr><th>Weeks</th><th>Miles</th><th>Minutes</th></tr>
    `;

    let pct = startPct;
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

  // =======================
  // WORKOUT SESSION
  // =======================
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
    if (isPaused) {
      isPaused = false;
      pauseBtn.textContent = "Pause";
      tInterval = setInterval(() => {
        sTime++;
        phTime++;
        updateHUD();
      }, 1000);
    } else {
      isPaused = true;
      pauseBtn.textContent = "Resume";
      clearInterval(tInterval);
    }
  });

  stopBtn.addEventListener("click", () => {
    clearInterval(tInterval);
    hud.style.display = "none";
    startBtn.style.display = "block";
    beep(600, 250, 0.4);
    alert("Workout complete!");
  });

  // =======================
  // UPDATE HUD
  // =======================
  function updateHUD() {
    const mm = String(Math.floor(sTime / 60)).padStart(2, "0");
    const ss = String(sTime % 60).padStart(2, "0");
    timerEl.textContent = `${mm}:${ss}`;

    let speed = baseMph;
    let cue = false;
    let tone = 800;

    if (phase === "warmup") {
      phaseEl.textContent = "Warm-up";
      speed = baseMph + (phTime / 300) * (maxMph - baseMph);

      if (phTime >= 300) {
        phase = "main";
        phTime = 0;
        cue = true;
        tone = 1000;
      }
    }

    else if (phase === "main") {
      phaseEl.textContent = "Main";

      const block = Math.floor(phTime / 60) % 2;
      speed = block === 0 ? maxMph : baseMph + 0.6;

      if (sTime >= 1200) {
        phase = "cooldown";
        phTime = 0;
        cue = true;
        tone = 500;
      }
    }

    else if (phase === "cooldown") {
      phaseEl.textContent = "Cool-down";
      speed = maxMph - (phTime / 300) * (maxMph - baseMph);

      if (phTime >= 300) {
        stopBtn.click();
        return;
      }
    }

    speedEl.textContent = `Speed: ${speed.toFixed(1)} mph`;

    if (cue) {
      beep(tone, 200, 0.35);
      speedEl.classList.add("flash");
      setTimeout(() => speedEl.classList.remove("flash"), 350);
    }
  }

  // INITIAL LOAD
  if (profile) {
    calcTarget();
    genRoutine();
    showLogs();
  }
});
