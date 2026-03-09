document.addEventListener('DOMContentLoaded', () => {
  const pForm = document.getElementById('profile-form');
  const wForm = document.getElementById('weight-log-form');
  const mTarget = document.getElementById('monthly-target');
  const wHist = document.getElementById('weight-history');
  const rOut = document.getElementById('routine-output');

  const startBtn = document.getElementById('start-workout');
  const hud = document.getElementById('workout-hud');
  const timerEl = document.getElementById('timer-display');
  const speedEl = document.getElementById('speed-prompt');
  const phaseEl = document.getElementById('phase');

  const pauseBtn = document.getElementById('pause-workout');
  const stopBtn = document.getElementById('stop-workout');

  let profile = JSON.parse(localStorage.getItem('p')) || {};
  let logs = JSON.parse(localStorage.getItem('logs')) || [];

  let tInterval, sTime = 0, phTime = 0;
  let phase = 'warmup';
  let baseMph, maxMph;
  let aCtx = null;
  let isPaused = false;

  /* -------------------------------------------------------------
     BEEP SOUND
  ------------------------------------------------------------- */
  function beep(f = 800, d = 150, v = 0.3, t = 'sine') {
    if (!aCtx) aCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = aCtx.createOscillator();
    const g = aCtx.createGain();

    o.connect(g);
    g.connect(aCtx.destination);

    o.type = t;
    o.frequency.value = f;
    g.gain.value = v;

    const now = aCtx.currentTime;
    o.start(now);
    o.stop(now + d / 1000);
  }

  /* -------------------------------------------------------------
     LOAD PROFILE IF EXISTS
  ------------------------------------------------------------- */
  if (Object.keys(profile).length) {
    ['sex','age','height','current-weight','target-weight','fitness-level']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = profile[id.replace(/-/g,'')] || profile[id];
      });

    calcTarget();
    genRoutine();
    showLogs();
  }

  /* -------------------------------------------------------------
     PROFILE FORM
  ------------------------------------------------------------- */
  pForm.onsubmit = e => {
    e.preventDefault();
    profile = {
      sex: document.getElementById('sex').value,
      age: +document.getElementById('age').value,
      height: +document.getElementById('height').value,
      currentWeight: +document.getElementById('current-weight').value,
      targetWeight: +document.getElementById('target-weight').value,
      fitnessLevel: document.getElementById('fitness-level').value
    };

    localStorage.setItem('p', JSON.stringify(profile));

    calcTarget();
    genRoutine();
    logW(profile.currentWeight);
  };

  /* -------------------------------------------------------------
     WEIGHT FORM
  ------------------------------------------------------------- */
  wForm.onsubmit = e => {
    e.preventDefault();
    logW(+document.getElementById('log-weight').value);
    document.getElementById('log-weight').value = '';
  };

  /* -------------------------------------------------------------
     LOG WEIGHT
  ------------------------------------------------------------- */
  function logW(w) {
    const d = new Date().toLocaleDateString();
    const h = profile.height / 100;
    const bmi = (w / (h * h)).toFixed(2);

    logs.push({ d, w, bmi });
    localStorage.setItem('logs', JSON.stringify(logs));
    showLogs();
  }

  /* Attach delete function globally */
  window._deleteLog = function(index) {
    if (confirm('Delete this entry?')) {
      logs.splice(index, 1);
      localStorage.setItem('logs', JSON.stringify(logs));
      showLogs();
    }
  };

  /* -------------------------------------------------------------
     SHOW LOGS + CHART
  ------------------------------------------------------------- */
  function showLogs() {
    if (!logs.length) {
      wHist.innerHTML = '<p>No entries yet.</p>';
      return;
    }

    let h = `
      <div class="table-container">
      <table>
      <tr>
        <th>Date</th><th>kg</th><th>BMI</th><th>Δkg</th><th>ΔBMI</th><th></th>
      </tr>`;

    logs.forEach((l, i) => {
      const p = i ? logs[i - 1] : null;

      h += `
        <tr>
          <td>${l.d}</td>
          <td>${l.w}</td>
          <td>${l.bmi}</td>
          <td>${p ? (l.w > p.w
              ? `<span class="up">↑ +${(l.w - p.w).toFixed(2)}</span>`
              : `<span class="down">↓ ${(l.w - p.w).toFixed(2)}</span>`)
              : ''}</td>

          <td>${p ? (l.bmi > p.bmi
              ? `<span class="up">↑ +${(l.bmi - p.bmi).toFixed(2)}</span>`
              : `<span class="down">↓ ${(l.bmi - p.bmi).toFixed(2)}</span>`)
              : ''}</td>

          <td><button class="delete-btn" onclick="deleteLog(${i})">🗑</button></td>
        </tr>`;
    });

    h += `</table></div>`;
    wHist.innerHTML = h;

    const ctx = document.getElementById('bmi-chart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: logs.map(l => l.d),
        datasets: [{
          label: 'BMI',
          data: logs.map(l => l.bmi),
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14,165,233,0.2)',
          tension: 0.25
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: false } }
      }
    });
  }

  /* -------------------------------------------------------------
     MONTHLY TARGET
  ------------------------------------------------------------- */
  function calcTarget() {
    const n = profile.currentWeight - profile.targetWeight;

    if (n <= 0) {
      mTarget.innerHTML = '<p>No loss needed.</p>';
      return;
    }

    const monthly = (0.75 * 4).toFixed(1);
    const stages = Math.ceil(n / 5);

    let h = `<p>Monthly: ${monthly} kg</p><ul>`;
    for (let i = 1; i <= stages; i++)
      h += `<li>Stage ${i}: ${(profile.currentWeight - i * 5).toFixed(1)} kg</li>`;

    h += '</ul>';
    mTarget.innerHTML = h;
  }

  /* -------------------------------------------------------------
     ROUTINE GENERATOR
  ------------------------------------------------------------- */
  function genRoutine() {
    const { sex, age, height, fitnessLevel: L } = profile;

    const hm = height / 100;
    const k = sex === 'male' ? 0.415 : sex === 'female' ? 0.413 : 0.414;
    const stride = hm * k;

    const targetMiles =
      age < 60
        ? (sex === 'male' ? 5.6 : sex === 'female' ? 5 : 5.3)
        : (sex === 'male' ? 4.3 : sex === 'female' ? 3.7 : 4);

    const startPct = L === 'low' ? 0.4 : L === 'medium' ? 0.6 : 0.8;
    const inc = L === 'low' ? 0.1 : L === 'medium' ? 0.05 : 0.025;

    baseMph = L === 'low' ? 1.9 : L === 'medium' ? 2.5 : 3.1;
    maxMph = baseMph + (L === 'low' ? 1.2 : L === 'medium' ? 1.9 : 2.5);

    let html = `
      <p>Target distance: ${targetMiles.toFixed(1)} miles/day</p>
      <p>Stride: ${(stride * 100).toFixed(1)} cm</p>
      <table>
        <tr><th>Weeks</th><th>Miles</th><th>Time (min)</th></tr>
    `;

    let cp = startPct;
    for (let i = 1; i <= 12; i += 2) {
      const miles = (targetMiles * cp).toFixed(1);
      const time = Math.round((miles / baseMph) * 60);

      html += `
        <tr>
          <td>${i}-${Math.min(i + 1, 12)}</td>
          <td>${miles}</td>
          <td>${time}</td>
        </tr>`;

      cp = Math.min(1, cp + inc * 2);
    }

    html += `</table>
      <p>Speeds: ${baseMph.toFixed(1)}–${maxMph.toFixed(1)} mph</p>
    `;

    rOut.innerHTML = html;
  }

  /* -------------------------------------------------------------
     WORKOUT SESSION
  ------------------------------------------------------------- */
  startBtn.onclick = () => {
    if (aCtx) aCtx.resume();

    hud.style.display = 'block';
    startBtn.style.display = 'none';

    sTime = 0;
    phTime = 0;
    phase = 'warmup';
    isPaused = false;

    pauseBtn.textContent = 'Pause';

    updateH();

    tInterval = setInterval(() => {
      if (!isPaused) {
        sTime++;
        phTime++;
        updateH();
      }
    }, 1000);
  };

  pauseBtn.onclick = () => {
    if (isPaused) {
      tInterval = setInterval(() => {
        sTime++;
        phTime++;
        updateH();
      }, 1000);
      pauseBtn.textContent = 'Pause';
      isPaused = false;
    } else {
      clearInterval(tInterval);
      pauseBtn.textContent = 'Resume';
      isPaused = true;
    }
  };

  stopBtn.onclick = () => {
    clearInterval(tInterval);
    hud.style.display = 'none';
    startBtn.style.display = 'block';

    beep(440, 300, 0.4, 'sine');
    alert('Done!');
  };

  /* -------------------------------------------------------------
     WORKOUT PHASE HANDLER
  ------------------------------------------------------------- */
  function updateH() {
    // Timer
    const m = String(Math.floor(sTime / 60)).padStart(2, '0');
    const s = String(sTime % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;

    let spd, cue = false, freq = 800;

    /* WARMUP */
    if (phase === 'warmup') {
      phaseEl.textContent = 'Warm-up';
      spd = baseMph + (phTime / 300) * (maxMph - baseMph);

      if (phTime >= 300) {
        phase = 'main';
        phTime = 0;
        cue = true;
        freq = 1000;
      } else if (Math.floor(phTime / 60) !== Math.floor((phTime - 1) / 60)) {
        cue = true;
        freq = 700;
      }

    /* MAIN PHASE */
    } else if (phase === 'main') {
      phaseEl.textContent = 'Main';

      const interval = Math.floor(phTime / 60) % 2;
      spd = interval === 0 ? maxMph : baseMph + 0.6;

      if (Math.floor(phTime / 60) !== Math.floor((phTime - 1) / 60)) {
        cue = true;
        freq = interval === 0 ? 950 : 650;
      }

      if (sTime >= 1200) {
        phase = 'cooldown';
        phTime = 0;
        cue = true;
        freq = 400;
      }

    /* COOLDOWN */
    } else if (phase === 'cooldown') {
      phaseEl.textContent = 'Cool-down';
      spd = maxMph - (phTime / 300) * (maxMph - baseMph);

      if (phTime >= 300) return stopBtn.click();
    }

    // Set speed label
    speedEl.textContent = `Speed: ${spd.toFixed(1)} mph`;

    // Cue beep + animation
    if (cue) {
      beep(freq, 180, 0.35, 'sine');
      speedEl.classList.add('flash');
      setTimeout(() => speedEl.classList.remove('flash'), 400);
    }
  }

  /* INIT */
  if (Object.keys(profile).length) {
    calcTarget();
    genRoutine();
    showLogs();
  }
});
