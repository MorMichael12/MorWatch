'use strict';
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const clock=n=>`${pad(Math.floor(n/60))}:${pad(n%60)}`;
const hms=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return `${pad(Math.floor(s/3600))}:${pad(Math.floor(s%3600/60))}:${pad(s%60)}`};
const values={diffStart:510,diffEnd:1005,futureStart:823,futureDuration:245,countDuration:5,targetTime:1080};
const titles={diffStart:'שעת התחלה',diffEnd:'שעת סיום',futureStart:'שעה התחלתית',futureDuration:'משך הזמן',countDuration:'משך זמן',targetTime:'שעת יעד'};
const durationKeys=new Set(['futureDuration','countDuration']);
let pickerKey=null, pickerHour=0,pickerMinute=0, audio=null,wakeLock=null;
const timers={count:{remaining:0,end:0,state:'idle'},target:{remaining:0,end:0,state:'idle'}};
function go(page){document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===page));$('drawer').hidden=true;window.scrollTo(0,0)}
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
$('menuBtn').onclick=()=>{$('drawer').hidden=!$('drawer').hidden};$('homeBtn').onclick=()=>go('home');
function renderSelections(){document.querySelectorAll('[data-picker]').forEach(b=>b.textContent=clock(values[b.dataset.picker]))}
function wheelFill(el,max,selected){el.innerHTML='';for(let i=0;i<2;i++){const d=document.createElement('div');d.className='wheel-item';d.setAttribute('aria-hidden','true');el.append(d)}for(let i=0;i<=max;i++){const d=document.createElement('div');d.className='wheel-item';d.textContent=pad(i);d.dataset.value=i;el.append(d)}for(let i=0;i<2;i++){const d=document.createElement('div');d.className='wheel-item';d.setAttribute('aria-hidden','true');el.append(d)}el.scrollTop=selected*44;markWheel(el)}
function wheelValue(el,max){return Math.max(0,Math.min(max,Math.round(el.scrollTop/44)))}
function markWheel(el){const max=el.id==='minutesWheel'?59:(durationKeys.has(pickerKey)?99:23);const val=wheelValue(el,max);el.querySelectorAll('[data-value]').forEach(d=>d.classList.toggle('selected',Number(d.dataset.value)===val))}
function openPicker(key){pickerKey=key;pickerHour=Math.floor(values[key]/60);pickerMinute=values[key]%60;$('pickerTitle').textContent=titles[key];$('pickerModal').hidden=false;wheelFill($('hoursWheel'),durationKeys.has(key)?99:23,pickerHour);wheelFill($('minutesWheel'),59,pickerMinute)}
document.querySelectorAll('[data-picker]').forEach(b=>b.onclick=()=>{if((b.dataset.picker==='countDuration'&&timers.count.state!=='idle')||(b.dataset.picker==='targetTime'&&timers.target.state!=='idle'))return;openPicker(b.dataset.picker)});
for(const id of ['hoursWheel','minutesWheel']){const el=$(id);let debounce;el.addEventListener('scroll',()=>{markWheel(el);clearTimeout(debounce);debounce=setTimeout(()=>{if(!$('pickerModal').hidden){const max=id==='minutesWheel'?59:(durationKeys.has(pickerKey)?99:23);el.scrollTo({top:wheelValue(el,max)*44,behavior:'smooth'})}},90)},{passive:true})}
function closePicker(){$('pickerModal').hidden=true;pickerKey=null}
$('pickerCancel').onclick=closePicker;$('pickerDone').onclick=()=>{if(!pickerKey)return;const key=pickerKey;values[key]=wheelValue($('hoursWheel'),durationKeys.has(key)?99:23)*60+wheelValue($('minutesWheel'),59);closePicker();renderSelections();if(key==='countDuration'){$('countDisplay').textContent=hms(values.countDuration*60000)}if(key==='targetTime'){$('targetDisplay').textContent='00:00:00'}};
$('pickerModal').addEventListener('click',e=>{if(e.target===$('pickerModal'))closePicker()});
$('diffCalc').onclick=()=>{const a=values.diffStart,b=values.diffEnd;const diff=b>=a?b-a:1440-a+b;$('diffResult').textContent=hms(diff*60000)};
$('futureCalc').onclick=()=>{const total=values.futureStart+values.futureDuration;const days=Math.floor(total/1440);$('futureResult').textContent=clock(total%1440);$('futureDay').textContent=days===0?'':days===1?'ביום הבא':`בעוד ${days} ימים`};
function primeAudio(){try{if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{})}catch(e){}}
function beep(){if(!audio)return;const now=audio.currentTime;for(let i=0;i<3;i++){const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=880;gain.gain.setValueAtTime(.0001,now+i*.45);gain.gain.exponentialRampToValueAtTime(.2,now+i*.45+.025);gain.gain.exponentialRampToValueAtTime(.0001,now+i*.45+.3);osc.connect(gain);gain.connect(audio.destination);osc.start(now+i*.45);osc.stop(now+i*.45+.32)}}
async function requestWake(){try{if('wakeLock'in navigator&&document.visibilityState==='visible'&&!wakeLock)wakeLock=await navigator.wakeLock.request('screen')}catch(e){}}
function releaseWake(){if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null}}
function syncWake(){if(Object.values(timers).some(t=>t.state==='running'))requestWake();else releaseWake()}
function setControls(kind){const t=timers[kind],running=t.state==='running',paused=t.state==='paused';$(kind+'Start').disabled=running||paused;$(kind+'Pause').disabled=t.state==='idle';$(kind+'Pause').textContent=paused?'המשך':'השהה';$(kind+'Reset').disabled=t.state==='idle';const picker=kind==='count'?'countDuration':'targetTime';document.querySelector(`[data-picker="${picker}"]`).disabled=t.state!=='idle'}
function renderTimer(kind){const t=timers[kind];$(kind+'Display').textContent=hms(t.remaining);const messages={idle:kind==='count'?'מוכן להפעלה':'אם השעה חלפה, היעד יהיה מחר',running:'הטיימר פועל',paused:'הטיימר מושהה'};$(kind+'Status').textContent=messages[t.state];setControls(kind)}
function start(kind){primeAudio();const t=timers[kind];if(kind==='count'){t.remaining=values.countDuration*60000;if(t.remaining===0){$('countStatus').textContent='בחר משך זמן גדול מאפס';return}}else{const now=new Date(),target=new Date(now);target.setHours(Math.floor(values.targetTime/60),values.targetTime%60,0,0);if(target<=now)target.setDate(target.getDate()+1);t.remaining=target.getTime()-now.getTime()}t.end=Date.now()+t.remaining;t.state='running';renderTimer(kind);syncWake()}
function toggle(kind){const t=timers[kind];if(t.state==='running'){t.remaining=Math.max(0,t.end-Date.now());t.state='paused'}else if(t.state==='paused'){primeAudio();t.end=Date.now()+t.remaining;t.state='running'}renderTimer(kind);syncWake()}
function reset(kind){const t=timers[kind];t.state='idle';t.end=0;t.remaining=kind==='count'?values.countDuration*60000:0;renderTimer(kind);syncWake()}
for(const kind of ['count','target']){$(kind+'Start').onclick=()=>start(kind);$(kind+'Pause').onclick=()=>toggle(kind);$(kind+'Reset').onclick=()=>reset(kind)}
function finish(kind){const t=timers[kind];t.state='idle';t.remaining=0;t.end=0;renderTimer(kind);syncWake();$('alertModal').hidden=false;beep();if(navigator.vibrate)navigator.vibrate([250,100,250])}
function tick(){for(const kind of ['count','target']){const t=timers[kind];if(t.state==='running'){t.remaining=Math.max(0,t.end-Date.now());if(t.remaining===0)finish(kind);else $(kind+'Display').textContent=hms(t.remaining)}}}
$('alertClose').onclick=()=>{$('alertModal').hidden=true};document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){tick();syncWake()}});
renderSelections();renderTimer('count');renderTimer('target');$('diffCalc').click();$('futureCalc').click();setInterval(tick,200);
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
