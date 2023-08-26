var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition
const languageSelect = document.getElementById('language-select');

// append langauge select options to the html
window.speechSynthesis.onvoiceschanged = function() {
  const voices = speechSynthesis.getVoices();

  const supportedLanguages = voices.map(function(voice) {
    return voice.lang;
  });

  const uniqueSupportedLanguages = [...new Set(supportedLanguages)].sort();

  uniqueSupportedLanguages.forEach(lang => {
    const option = document.createElement('option');
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

recognition.onresult = function(event) {
  const text = event.results[0][0].transcript;
  sendTranscription(text)
  output.textContent = text;
};

recognition.onnomatch = function() {
  output.textContent = "I didn't recognise the speech";
};

recognition.onerror = function(event) {
  output.textContent = 'Error occurred in recognition: ' + event.error;
};

const sendTranscription = (transcribedText) => {
  fetch("/sendTranscription", {
    method: "POST",
    body: JSON.stringify({ transcribedText }),
    headers: {
      "Content-Type": "application/json"
    }
  }).then(response => {
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status}`);
    }
    return response.json(); // Parse the JSON response
  }).then(({ assistantReply }) => {
    // Handle the data received from the server
    const dialogElement = document.getElementById('dialog');
    const paragraphElement = document.createElement('p');
    paragraphElement.textContent = assistantReply;
    dialogElement.appendChild(paragraphElement);
    speechSynth(assistantReply)
    console.log("Assistant's reply:", assistantReply);
  }).catch(error => {
    console.error("Fetch error:", error);
  });
}

const speechSynth = (text) => {
  if ('speechSynthesis' in window) {
    const synth = window.speechSynthesis
    const utterance = new SpeechSynthesisUtterance(text)
    // utterance.lang = "hi-IN"
    synth.speak(utterance)
  } else {
    console.error('web speech api synth not in window')
  }
}


const sendConversationInit = (data) => {
  fetch("initializeConversation", {
    method: "POST",
    body: JSON.stringify({ data }),
    headers: {
      "Content-Type": "application/json"
    }
  })
}

const handleSubmit = (event) => {
  event.preventDefault()

  sendConversationInit({
    language: languageSelect.value,
    conversationContext: document.getElementById('conversation-context')
  })

}