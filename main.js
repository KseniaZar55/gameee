const $ = id => document.getElementById(id);
const menu = $("menu"), gameScreen = $("gameScreen"), resultScreen = $("resultScreen");
const boardEl = $("board"), messageEl = $("message");
const DIFFICULTIES = {
  easy: { label: "РАЗМИНКА", clues: 36 },
  medium: { label: "ФОКУС", clues: 30 },
  hard: { label: "МАРАФОН", clues: 25 }
};
let chosenLevel = "easy", puzzle = [], solution = [], fixed = [], notes = [], selected = -1;
let noteMode = false, elapsed = 0, timerId = null, paused = false, errors = new Set(), hintCount = 0;

function shuffle(arr) { for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
function pattern(r,c){return (r*3+Math.floor(r/3)+c)%9;}
function generateSolution(){
  const rows = shuffle([0,1,2]).flatMap(g=>shuffle([0,1,2]).map(r=>g*3+r));
  const cols = shuffle([0,1,2]).flatMap(g=>shuffle([0,1,2]).map(c=>g*3+c));
  const nums = shuffle([1,2,3,4,5,6,7,8,9]);
  const base = Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>nums[pattern(rows[r],cols[c])]));
  // Apply random digit relabeling and valid row/column permutations.
  return base.flat();
}
function makePuzzle(level){
  solution = generateSolution();
  puzzle = [...solution];
  const keep = DIFFICULTIES[level].clues;
  const indices = shuffle(Array.from({length:81},(_,i)=>i));
  for(let i=0;i<81-keep;i++) puzzle[indices[i]]=0;
  fixed = puzzle.map(v=>v!==0);
  notes = Array.from({length:81},()=>new Set());
  errors.clear(); selected=-1; hintCount=0; noteMode=false;
}
function formatTime(seconds){const s=Math.floor(seconds);return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;}
function startTimer(){stopTimer();timerId=setInterval(()=>{if(!paused){elapsed++;$("timer").textContent=formatTime(elapsed);}},1000);}
function stopTimer(){if(timerId){clearInterval(timerId);timerId=null;}}
function saveBest(){try{const key=`sudokuBest_${chosenLevel}`, old=Number(localStorage.getItem(key)||0);if(!old||elapsed<old){localStorage.setItem(key,String(elapsed));$("bestTime").textContent=formatTime(elapsed);}}catch{}}
function updateBest(){try{const v=Number(localStorage.getItem(`sudokuBest_${chosenLevel}`)||0);$("bestTime").textContent=v?formatTime(v):"—";}catch{$("bestTime").textContent="—";}}
function startGame(){
  makePuzzle(chosenLevel);elapsed=0;paused=false;$("timer").textContent="00:00";$("levelLabel").textContent=DIFFICULTIES[chosenLevel].label;
  menu.classList.add("hidden");resultScreen.classList.add("hidden");gameScreen.classList.remove("hidden");$("pauseOverlay").classList.add("hidden");
  $("notesBtn").classList.remove("active");messageEl.textContent="Выбери клетку и введи число.";renderBoard();updateProgress();startTimer();
}
function renderBoard(){
  boardEl.innerHTML="";
  for(let i=0;i<81;i++){
    const r=Math.floor(i/9),c=i%9,btn=document.createElement("button");
    btn.className="cell";btn.type="button";btn.setAttribute("role","gridcell");btn.setAttribute("aria-label",`Строка ${r+1}, столбец ${c+1}${puzzle[i]?`, число ${puzzle[i]}`:""}`);
    if(fixed[i])btn.classList.add("given");
    if(c===2||c===5)btn.classList.add("box-right");if(r===2||r===5)btn.classList.add("box-bottom");
    const related=selected>=0&&(Math.floor(selected/9)===r||selected%9===c||(Math.floor(Math.floor(selected/9)/3)===Math.floor(r/3)&&Math.floor((selected%9)/3)===Math.floor(c/3)));
    if(related)btn.classList.add("related");if(selected===i)btn.classList.add("selected");
    if(selected>=0&&puzzle[selected]&&puzzle[i]===puzzle[selected]&&i!==selected)btn.classList.add("same-number");
    if(errors.has(i))btn.classList.add("error");
    if(puzzle[i])btn.textContent=puzzle[i];
    else if(notes[i].size){const n=document.createElement("span");n.className="notes";for(let v=1;v<=9;v++){const s=document.createElement("span");s.textContent=notes[i].has(v)?v:"";n.appendChild(s);}btn.appendChild(n);}
    btn.addEventListener("click",()=>{selected=i;renderBoard();});
    boardEl.appendChild(btn);
  }
}
function updateProgress(){const count=puzzle.filter(Boolean).length;$("progress").innerHTML=`${count}<span> / 81</span>`;$("progressBar").style.width=`${count/81*100}%`;}
function setMessage(text,type=""){messageEl.textContent=text;messageEl.style.color=type==="error"?"var(--pink)":type==="good"?"var(--lime)":"var(--muted)";}
function enterNumber(n){
  if(paused||menu.classList.contains("hidden")===false||resultScreen.classList.contains("hidden")===false)return;
  if(selected<0){setMessage("Сначала выбери клетку.");return;}if(fixed[selected]){setMessage("Это исходное число — его нельзя менять.");return;}
  if(n===0){puzzle[selected]=0;notes[selected].clear();errors.delete(selected);renderBoard();updateProgress();return;}
  if(noteMode){if(notes[selected].has(n))notes[selected].delete(n);else notes[selected].add(n);renderBoard();return;}
  puzzle[selected]=n;notes[selected].clear();errors.delete(selected);renderBoard();updateProgress();
  if(puzzle.every(Boolean)&&puzzle.every((v,i)=>v===solution[i]))win();
}
function checkBoard(){
  if(selected<0){setMessage("Выбери клетку, чтобы проверить число.");return;}
  errors.clear();let wrong=0;
  for(let i=0;i<81;i++)if(puzzle[i]&&puzzle[i]!==solution[i]){errors.add(i);wrong++;}
  renderBoard();
  if(wrong){setMessage(`Нашлось ошибок: ${wrong}. Подсветила розовым.`, "error");}
  else{setMessage("Все введённые числа пока верны. Продолжай!", "good");if(puzzle.every(Boolean))win();}
}
function hint(){
  if(paused)return;if(selected<0){const candidates=puzzle.map((v,i)=>v===0?i:-1).filter(i=>i>=0);if(!candidates.length)return;selected=candidates[0];}
  if(fixed[selected]){setMessage("Выбери пустую клетку для подсказки.");return;}
  puzzle[selected]=solution[selected];notes[selected].clear();errors.delete(selected);hintCount++;renderBoard();updateProgress();setMessage("Подсказка добавлена. Иногда один шаг — всё, что нужно.","good");
  if(puzzle.every(Boolean)&&puzzle.every((v,i)=>v===solution[i]))win();
}
function win(){stopTimer();saveBest();$("finalTime").textContent=formatTime(elapsed);gameScreen.classList.add("hidden");resultScreen.classList.remove("hidden");}
function togglePause(){if(gameScreen.classList.contains("hidden"))return;paused=!paused;$("pauseOverlay").classList.toggle("hidden",!paused);$("pauseBtn").textContent=paused?"▶ ПРОДОЛЖИТЬ":"Ⅱ ПАУЗА";if(paused)setMessage("Партия на паузе.");}
function backToMenu(){stopTimer();paused=false;gameScreen.classList.add("hidden");resultScreen.classList.add("hidden");menu.classList.remove("hidden");$("pauseOverlay").classList.add("hidden");updateBest();}
document.querySelectorAll(".difficulty-btn").forEach(btn=>btn.addEventListener("click",()=>{chosenLevel=btn.dataset.level;document.querySelectorAll(".difficulty-btn").forEach(b=>b.classList.toggle("selected",b===btn));updateBest();}));
$("startBtn").addEventListener("click",startGame);$("againBtn").addEventListener("click",startGame);$("newGameBtn").addEventListener("click",startGame);
$("notesBtn").addEventListener("click",()=>{noteMode=!noteMode;$("notesBtn").classList.toggle("active",noteMode);setMessage(noteMode?"Режим заметок включён.":"Режим заметок выключен.");});
$("hintBtn").addEventListener("click",hint);$("checkBtn").addEventListener("click",checkBoard);$("eraseBtn").addEventListener("click",()=>enterNumber(0));$("pauseBtn").addEventListener("click",togglePause);$("resumeBtn").addEventListener("click",togglePause);$("menuBtn").addEventListener("click",backToMenu);$("homeBtn").addEventListener("click",e=>{e.preventDefault();backToMenu();});
document.querySelectorAll(".number-pad button").forEach(btn=>btn.addEventListener("click",()=>enterNumber(Number(btn.dataset.num))));
window.addEventListener("keydown",e=>{
  if(e.key==="Escape"){if(!gameScreen.classList.contains("hidden"))togglePause();return;}
  if(paused)return;
  if(/^[1-9]$/.test(e.key)){enterNumber(Number(e.key));}
  else if(e.key==="Backspace"||e.key==="Delete"){e.preventDefault();enterNumber(0);}
  else if(e.key.toLowerCase()==="n"&&!gameScreen.classList.contains("hidden"))$("notesBtn").click();
  else if(e.key.toLowerCase()==="h"&&!gameScreen.classList.contains("hidden"))hint();
  else if(e.key==="Enter"&&!gameScreen.classList.contains("hidden"))checkBoard();
  else if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)&&selected>=0){e.preventDefault();const delta={ArrowUp:-9,ArrowDown:9,ArrowLeft:-1,ArrowRight:1}[e.key];selected=Math.max(0,Math.min(80,selected+delta));renderBoard();}
});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&!gameScreen.classList.contains("hidden")&&!paused)togglePause();});
updateBest();
