const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function generateNotes(lowMidi, highMidi) {
  const arr = [];
  for (let m = lowMidi; m <= highMidi; m++) {
    const octave = Math.floor(m / 12) - 1;
    const name = NOTE_NAMES[m % 12] + octave;
    const freq = 440 * Math.pow(2, (m - 69) / 12);
    arr.push({ name, freq });
  }
  return arr;
}

function populateNoteSelects(notes, lowSel, highSel, defaultLow, defaultHigh) {
  notes.forEach((n, i) => {
    const optL = document.createElement("option");
    optL.value = i;
    optL.textContent = n.name;
    const optH = document.createElement("option");
    optH.value = i;
    optH.textContent = n.name;
    lowSel.appendChild(optL);
    highSel.appendChild(optH);
  });
  const lowIdx = notes.findIndex(n => n.name === defaultLow);
  const highIdx = notes.findIndex(n => n.name === defaultHigh);
  if (lowIdx !== -1) lowSel.value = lowIdx;
  if (highIdx !== -1) highSel.value = highIdx;
}

function renderKeyboard(notes, container, onClick) {
  container.innerHTML = "";
  const keys = [];
  notes.forEach((n, i) => {
    const div = document.createElement("div");
    div.classList.add("key");
    if (n.name.includes("#")) div.classList.add("black-key");
    else div.classList.add("white-key");
    if (onClick) div.addEventListener("click", () => onClick(i));

    const addHover = () => div.classList.add("hover");
    const removeHover = () => div.classList.remove("hover");
    div.addEventListener("pointerenter", addHover);
    div.addEventListener("pointerleave", removeHover);
    div.addEventListener("pointerdown", addHover);
    ["pointerup", "pointercancel"].forEach(evt =>
      div.addEventListener(evt, removeHover)
    );
    container.appendChild(div);
    keys.push(div);
  });
  return keys;
}
