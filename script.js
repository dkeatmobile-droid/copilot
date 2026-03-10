document.addEventListener("DOMContentLoaded",()=>{
  // Elements
  const topnav=document.getElementById('topnav');
  const dashScreen=document.getElementById('dashboard-screen');
  const stacked=document.getElementById('stacked-content');

  const latestWeightEl=document.getElementById('latest-weight');
  const latestWeightDateEl=document.getElementById('latest-weight-date');
  const currentBmiEl=document.getElementById('current-bmi');
  const bmiNoteEl=document.getElementById('bmi-note');
  const todayCaloriesEl=document.getElementById('today-calories');
  const calorieNoteEl=document.getElementById('calorie-note');

  const pForm=document.getElementById('profile-form');
  const wForm=document.getElementById('weight-log-form');
  const resetProfileBtn=document.getElementById('reset-profile');
  const resetWeightBtn=document.getElementById('reset-weight-log');

  const mTarget=document.getElementById('monthly-target');
  const wHist=document.getElementById('weight-history');
  const rOut=document.getElementById('routine-output');

  const startBtn=document.getElementById('start-workout');
  const hud=document.getElementById('workout-hud');
  const timerEl=document.getElementById('timer-display');
  const speedEl=document.getElementById('speed-prompt');
  const phaseEl=document.getElementById('phase');
  const pauseBtn=document.getElementById('pause-workout');
  const stopBtn=document.getElementById('stop-workout');

  const activitySelect=document.getElementById('activity-level');
  const bmrOut=document.getElementById('bmr-output');
  const tdeeOut=document.getElementById('tdee-output');
  const def500Out=document.getElementById('def500-output');
  const def750Out=document.getElementById('def750-output');
  const surplus300Out=document.getElementById('surplus300-output');

  const themeToggleTop=document.getElementById('theme-toggle');
  const themeToggleSettings=document.getElementById('theme-toggle-settings');
  const clearAllBtn=document.getElementById('clear-all');

  // State
  let profile=JSON.parse(localStorage.getItem('profile'))||null;
  let logs=JSON.parse(localStorage.getItem('logs'))||[];
  let prefActivity=localStorage.getItem('activityLevel')||'1.55';
  let theme=localStorage.getItem('theme')||'dark';

  let aCtx=null; let sTime=0, phTime=0, tInterval=null, isPaused=false, phase='warmup';
  let baseMph=0, maxMph=0;

  let bmiChartRef=null, dashWeightChart=null, dashBmiChart=null, dashCalorieChart=null, calorieBarRef=null;

  // Theme
  function applyTheme(t){document.body.classList.remove('theme-dark','theme-light');document.body.classList.add(t==='light'?'theme-light':'theme-dark');localStorage.setItem('theme',t);theme=t}
  applyTheme(theme);
  [themeToggleTop,themeToggleSettings].forEach(btn=>{if(!btn)return;btn.addEventListener('click',()=>applyTheme(theme==='dark'?'light':'dark'))});

  // Navigation (Hybrid)
  function showDashboard(){dashScreen.classList.add('active');dashScreen.classList.remove('hidden');stacked.classList.add('hidden');stacked.classList.remove('active')}
  function showStackedAndScrollTo(id){dashScreen.classList.remove('active');dashScreen.classList.add('hidden');stacked.classList.remove('hidden');stacked.classList.add('active');const t=document.getElementById(id);if(t)t.scrollIntoView({behavior:'smooth',block:'start'})}
  topnav.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{const k=btn.dataset.nav; if(k==='dashboard')showDashboard(); else if(k==='profile')showStackedAndScrollTo('profile-section'); else if(k==='logs')showStackedAndScrollTo('logs-section'); else if(k==='routine')showStackedAndScrollTo('routine-section'); else if(k==='calories')showStackedAndScrollTo('calories-section'); else if(k==='settings')showStackedAndScrollTo('settings-section');}));

  // Beep
  function beep(freq=800,dur=150,vol=0.3,type='sine'){if(!aCtx)aCtx=new (window.AudioContext||window.webkitAudioContext)();const o=aCtx.createOscillator(), g=aCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.value=vol;o.connect(g);g.connect(aCtx.destination);const n=aCtx.currentTime;o.start(n);o.stop(n+dur/1000)}

  // Load profile
  if(profile){sex.value=profile.sex;age.value=profile.age;height.value=profile.height;current_weight.value=profile.currentWeight;target_weight.value=profile.targetWeight;fitness_level.value=profile.fitnessLevel}
  if(activitySelect)activitySelect.value=prefActivity;

  // Save profile
  if(pForm){pForm.addEventListener('submit',e=>{e.preventDefault();profile={sex:sex.value,age:Number(age.value),height:Number(height.value),currentWeight:Number(current_weight.value),targetWeight:Number(target_weight.value),fitnessLevel:fitness_level.value};localStorage.setItem('profile',JSON.stringify(profile));calcTarget();genRoutine();showLogs();updateDashboard();calcCalories();alert('Profile saved.');})}

  // Resets
  if(resetProfileBtn){resetProfileBtn.addEventListener('click',()=>{if(!confirm('Reset full profile? This cannot be undone.'))return;localStorage.removeItem('profile');sex.value='male';age.value='';height.value='';current_weight.value='';target_weight.value='';fitness_level.value='low';mTarget.innerHTML='';rOut.innerHTML='';wHist.innerHTML='<p>No entries yet.</p>';profile=null;updateDashboard();calcCalories();alert('Profile reset.');})}
  if(resetWeightBtn){resetWeightBtn.addEventListener('click',()=>{if(!confirm('Reset entire weight log?'))return;logs=[];localStorage.setItem('logs',JSON.stringify(logs));wHist.innerHTML='<p>No entries yet.</p>';if(bmiChartRef){bmiChartRef.destroy();bmiChartRef=null;}const c=document.getElementById('bmi-chart').getContext('2d');c.clearRect(0,0,c.canvas.width,c.canvas.height);updateDashboard();alert('Weight log reset.');})}
  if(clearAllBtn){clearAllBtn.addEventListener('click',()=>{if(!confirm('Clear ALL saved data (profile + logs + prefs)?'))return;localStorage.clear();location.reload();})}

  // Weight log
  if(wForm){wForm.addEventListener('submit',e=>{e.preventDefault();if(!profile){alert('Save your profile first.');return;}const w=Number(log_weight.value);const h=profile.height/100;const bmi=(w/(h*h)).toFixed(2);const d=new Date().toLocaleDateString();logs.push({d,w,bmi});localStorage.setItem('logs',JSON.stringify(logs));log_weight.value='';showLogs();updateDashboard();})}
  window.deleteLog=function(i){logs.splice(i,1);localStorage.setItem('logs',JSON.stringify(logs));showLogs();updateDashboard();}

  function showLogs(){if(!wHist)return;if(!logs.length){wHist.innerHTML='<p>No entries yet.</p>';if(bmiChartRef){bmiChartRef.destroy();bmiChartRef=null;}return;}let html=`<table><tr><th>Date</th><th>kg</th><th>BMI</th><th>Δkg</th><th>ΔBMI</th><th></th></tr>`;logs.forEach((l,i)=>{const p=logs[i-1];const dKg=p?(l.w-p.w).toFixed(2):'';const dBmi=p?(l.bmi-p.bmi).toFixed(2):'';html+=`<tr><td>${l.d}</td><td>${l.w}</td><td>${l.bmi}</td><td>${p?dKg:''}</td><td>${p?dBmi:''}</td><td><button class="delete-btn" onclick="deleteLog(${i})">🗑</button></td></tr>`});html+='</table>';wHist.innerHTML=html;const ctx=document.getElementById('bmi-chart').getContext('2d');if(bmiChartRef)bmiChartRef.destroy();bmiChartRef=new Chart(ctx,{type:'line',data:{labels:logs.map(l=>l.d),datasets:[{label:'BMI',data:logs.map(l=>l.bmi),borderColor:'#0ea5e9',backgroundColor:'rgba(14,165,233,.25)',tension:.25}]},options:{responsive:true,maintainAspectRatio:false}})}

  // Target
  function calcTarget(){if(!profile){mTarget.innerHTML='<p>No loss needed.</p>';return;}const diff=profile.currentWeight-profile.targetWeight;if(diff<=0){mTarget.innerHTML='<p>No loss needed.</p>';return;}const monthly=(0.75*4).toFixed(1);const stages=Math.ceil(diff/5);let h=`<p>Monthly target: ${monthly} kg</p><ul>`;for(let i=1;i<=stages;i++){h+=`<li>Stage ${i}: ${(profile.currentWeight-i*5).toFixed(1)} kg</li>`}h+='</ul>';mTarget.innerHTML=h}

  // Routine
  function genRoutine(){if(!profile){rOut.innerHTML='<p>Save profile to build routine.</p>';return;}const {sex,age,height,fitnessLevel}=profile;const hm=height/100;const strideCm=(hm*(sex==='male'?0.415:sex==='female'?0.413:0.414)*100).toFixed(1);const baseMiles=age<60?(sex==='male'?5.6:5.0):(sex==='male'?4.3:3.7);const startPct=fitnessLevel==='low'?0.4:fitnessLevel==='medium'?0.6:0.8;const inc=fitnessLevel==='low'?0.1:fitnessLevel==='medium'?0.05:0.025;baseMph=fitnessLevel==='low'?1.9:fitnessLevel==='medium'?2.5:3.1;maxMph=baseMph+(fitnessLevel==='low'?1.2:fitnessLevel==='medium'?1.9:2.5);let html=`<p>Target distance: ${baseMiles.toFixed(1)} miles/day</p><p>Stride: ${strideCm} cm</p><table><tr><th>Weeks</th><th>Miles</th><th>Minutes</th></tr>`;let pct=startPct;for(let i=1;i<=12;i+=2){const miles=(baseMiles*pct).toFixed(1);const minutes=Math.round((miles/baseMph)*60);html+=`<tr><td>${i}-${Math.min(i+1,12)}</td><td>${miles}</td><td>${minutes}</td></tr>`;pct=Math.min(1,pct+inc*2)}html+='</table>';rOut.innerHTML=html}

  // Workout HUD
  if(startBtn){startBtn.addEventListener('click',()=>{if(aCtx)aCtx.resume();hud.style.display='block';startBtn.style.display='none';sTime=0;phTime=0;phase='warmup';isPaused=false;updateHUD();tInterval=setInterval(()=>{if(!isPaused){sTime++;phTime++;updateHUD();}},1000)})}
  if(pauseBtn){pauseBtn.addEventListener('click',()=>{if(isPaused){isPaused=false;pauseBtn.textContent='Pause';tInterval=setInterval(()=>{sTime++;phTime++;updateHUD()},1000)}else{isPaused=true;pauseBtn.textContent='Resume';clearInterval(tInterval)}})}
  if(stopBtn){stopBtn.addEventListener('click',()=>{clearInterval(tInterval);hud.style.display='none';startBtn.style.display='block';beep(500,200,0.4);alert('Workout complete!')})}
  function updateHUD(){const mm=String(Math.floor(sTime/60)).padStart(2,'0');const ss=String(sTime%60).padStart(2,'0');timerEl.textContent=`${mm}:${ss}`;let speed=baseMph,cue=false,tone=800;if(phase==='warmup'){phaseEl.textContent='Warm-up';speed=baseMph+(phTime/300)*(maxMph-baseMph);if(phTime>=300){phase='main';phTime=0;cue=true;tone=1000}}else if(phase==='main'){phaseEl.textContent='Main';const block=Math.floor(phTime/60)%2;speed=block===0?maxMph:baseMph+0.6;if(sTime>=1200){phase='cooldown';phTime=0;cue=true;tone=500}}else if(phase==='cooldown'){phaseEl.textContent='Cool-down';speed=maxMph-(phTime/300)*(maxMph-baseMph);if(phTime>=300){stopBtn.click();return}}speedEl.textContent=`Speed: ${speed.toFixed(1)} mph`;if(cue){beep(tone,150,0.33);speedEl.classList.add('flash');setTimeout(()=>speedEl.classList.remove('flash'),350)}}

  // Calories
  function mifflinBMR(sex,weightKg,heightCm,age){const sAdj=sex==='male'?5:sex==='female'?-161:-78;return Math.round(10*weightKg+6.25*heightCm-5*age+sAdj)}
  function calcCalories(){if(!profile){[bmrOut,tdeeOut,def500Out,def750Out,surplus300Out].forEach(el=>{if(el)el.textContent='—'});todayCaloriesEl.textContent='—';calorieNoteEl.textContent='Enter profile + activity';if(calorieBarRef){calorieBarRef.destroy();calorieBarRef=null;}return;}const act=parseFloat(activitySelect.value||prefActivity);localStorage.setItem('activityLevel',act.toString());const w=Number(current_weight.value||profile.currentWeight);const bmr=mifflinBMR(profile.sex,w,profile.height,profile.age);const tdee=Math.round(bmr*act);const d500=max(1000,tdee-500);const d750=max(1000,tdee-750);const s300=tdee+300;if(bmrOut)bmrOut.textContent=bmr;if(tdeeOut)tdeeOut.textContent=tdee;if(def500Out)def500Out.textContent=d500;if(def750Out)def750Out.textContent=d750;if(surplus300Out)surplus300Out.textContent=s300;todayCaloriesEl.textContent=tdee;calorieNoteEl.textContent=`Activity x${act}`;const ctx=document.getElementById('calorie-bar').getContext('2d');if(calorieBarRef)calorieBarRef.destroy();calorieBarRef=new Chart(ctx,{type:'bar',data:{labels:['BMR','TDEE','Lose −500','Lose −750','Gain +300'],datasets:[{label:'kcal/day',backgroundColor:['#64748b','#0ea5e9','#22c55e','#16a34a','#f59e0b'],data:[bmr,tdee,d500,d750,s300],borderRadius:8}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}}}})}
  if(activitySelect)activitySelect.addEventListener('change',()=>{calcCalories();updateDashboard()});

  // Dashboard
  function updateDashboard(){if(logs.length){const last=logs[logs.length-1];latestWeightEl.textContent=Number(last.w).toFixed(1);latestWeightDateEl.textContent=last.d}else if(profile){latestWeightEl.textContent=Number(profile.currentWeight).toFixed(1);latestWeightDateEl.textContent='From profile'}else{latestWeightEl.textContent='—';latestWeightDateEl.textContent='No entries yet'}if(profile){const h=profile.height/100;const w=logs.length?logs[logs.length-1].w:profile.currentWeight||0;const bmi=h?(w/(h*h)):0;currentBmiEl.textContent=bmi?bmi.toFixed(1):'—';bmiNoteEl.textContent=bmi?'Based on latest':'Enter profile to calculate'}else{currentBmiEl.textContent='—';bmiNoteEl.textContent='Enter profile to calculate'}renderDashboardCharts()}

  function renderDashboardCharts(){let labels=[],weights=[],bmis=[],calories=[];const act=parseFloat(activitySelect&&activitySelect.value||prefActivity);if(logs.length&&profile){labels=logs.map(l=>l.d);weights=logs.map(l=>l.w);bmis=logs.map(l=>Number(l.bmi));calories=logs.map(l=>{const b=mifflinBMR(profile.sex,l.w,profile.height,profile.age);return Math.round(b*act)})}else if(profile){labels=['Today'];weights=[profile.currentWeight];const h=profile.height/100;bmis=[Number((profile.currentWeight/(h*h)).toFixed(2))];calories=[Math.round(mifflinBMR(profile.sex,profile.currentWeight,profile.height,profile.age)*act)]}else{labels=['No data'];weights=[0];bmis=[0];calories=[0]}const wctx=document.getElementById('dash-weight-chart').getContext('2d');if(dashWeightChart)dashWeightChart.destroy();dashWeightChart=new Chart(wctx,{type:'line',data:{labels,datasets:[{label:'kg',data:weights,borderColor:'#4cc9ff',backgroundColor:'rgba(76,201,255,.2)',tension:.25}]},options:{responsive:true,maintainAspectRatio:false}});const bctx=document.getElementById('dash-bmi-chart').getContext('2d');if(dashBmiChart)dashBmiChart.destroy();dashBmiChart=new Chart(bctx,{type:'line',data:{labels,datasets:[{label:'BMI',data:bmis,borderColor:'#0ea5e9',backgroundColor:'rgba(14,165,233,.2)',tension:.25}]},options:{responsive:true,maintainAspectRatio:false}});const cctx=document.getElementById('dash-calorie-chart').getContext('2d');if(dashCalorieChart)dashCalorieChart.destroy();dashCalorieChart=new Chart(cctx,{type:'line',data:{labels,datasets:[{label:'kcal/day',data:calories,borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,.25)',tension:.25}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}}}})}

  // SW registration (PWA)
  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('./service-worker.js').catch(console.error);
    });
  }

  // Init
  calcTarget(); genRoutine(); showLogs(); calcCalories(); updateDashboard(); showDashboard();
});
