var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition
let languageSelect = document.getElementById('language-select');

window.speechSynthesis.onvoiceschanged = function() {
  var voices = speechSynthesis.getVoices();

  var supportedLanguages = voices.map(function(voice) {
    return voice.lang;
  });

  var uniqueSupportedLanguages = [...new Set(supportedLanguages)].sort();

  var languageSelect = document.getElementById('language-select');

  uniqueSupportedLanguages.forEach(lang => {
    var option = document.createElement('option');
    option.textContent = lang;
    if (lang === "en-US") {
      option.setAttribute("selected", true)
    }
    languageSelect.appendChild(option);
  });
};

const recognition = new SpeechRecognition();

recognition.continuous = false;
recognition.lang = languageSelect.value;
recognition.interimResults = false;
recognition.maxAlternatives = 1;

const startBtn = document.getElementById('start-button');
const stopBtn = document.getElementById('stop-button');
let output = document.getElementById('output');

startBtn.onclick = function() {
  recognition.start();
};

stopBtn.onclick = function() {
  recognition.stop();
};

languageSelect.addEventListener('change', function() {
  recognition.lang = languageSelect.value;
  console.log('Language changed to: ' + recognition.lang);
});

recognition.onresult = function() {
  const text = event.results[0][0].transcript;
  output.textContent = 'Result received: ' + text + '.';
};

recognition.onnomatch = function() {
  output.textContent = "I didn't recognise the speech";
};

recognition.onerror = function(event) {
  output.textContent = 'Error occurred in recognition: ' + event.error;
};