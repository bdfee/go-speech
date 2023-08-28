var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition

// page elements 
const languageSelect = document.getElementById('language-select')
const levelSelect = document.getElementById('language-level')
const contextSelect = document.getElementById('conversation-context')
const dialogElement = document.getElementById('dialog')
const beginBtn = document.getElementById('begin-button')
const startBtn = document.getElementById('start-button')
const stopBtn = document.getElementById('stop-button')
const clearBtn = document.getElementById('clear-button')
const statusMessage = document.getElementById('status')

let stopConversation = false

// speech synth
const synth = window.speechSynthesis

// append available langauges from web speech api as option els
synth.onvoiceschanged = () => {
  const voices = speechSynthesis.getVoices();
  // map set sort unique voices
  [...new Set(voices
    .map(({ lang }) => lang))]
    .sort()
    .forEach(lang => {
      // create option el per lang
      const option = document.createElement('option');
      option.value = lang;
      option.textContent = lang;
      // set english to selected lang
      if (lang === "en-US") {
        option.setAttribute("selected", true)
      }
      languageSelect.appendChild(option);
  });
};

// recognition
const recognition = new SpeechRecognition();
recognition.continuous = false;
recognition.lang = languageSelect.value;
recognition.interimResults = false;
recognition.maxAlternatives = 1;

recognition.onresult = (event) => {
  const text = event.results[0][0].transcript;
  dialogInput(text)
};

recognition.onnomatch = () => {
  dialogResponse('sorry I did not understand that, will you try again?')
}
recognition.onerror = ({ error }) => {
  if (error === 'aborted') {
    statusMessage.innerHTML = 'Speech recognition and synthesis are disabled, click start to resume conversation'
  } else if (error === 'no-speech') {
    statusMessage.innerHTML = 'Hmmm I did not hear any speech, click start to resume our conversation'
  } else {
    statusMessage.innerHTML = 'Recognition is disabled, click start to resume conversation'
  }
}

recognition.onaudiostart = () => {
  statusMessage.innerHTML = 'Listening'
}

// layout listeners and handlers
startBtn.onclick = () => {
  stopConversation = false
  recognition.start()
}

stopBtn.onclick = () => {
  stopConversation = true
  recognition.abort()
  synth.cancel()
  statusMessage.innerHTML = 'Conversation Paused'
}

clearBtn.onclick = () => {
  stopConversation = true
  recognition.abort()
  synth.cancel()
  clearConversation()
  clearMessages()
  statusMessage.innerHTML = 'Conversation Cleared'
}

languageSelect.addEventListener('change', () =>
  recognition.lang = languageSelect.value
)

const handleConversationInit = (event) => {
  event.preventDefault()

  sendConversationInit({
    Language: languageSelect.value,
    Level: levelSelect.value,
    Context: contextSelect.value
  })
}

// dialog
const appendMessage = (text, assistant = false) => {
  const paragraphElement = document.createElement('p');
  paragraphElement.textContent = text;
  if (assistant) paragraphElement.className = "assistant"
  dialogElement.appendChild(paragraphElement);
}

const clearMessages = () => dialogElement.replaceChildren()

const speechSynth = (text) => {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text)
    
    // utterance config here
    utterance.lang = languageSelect.value
    synth.speak(utterance)
    utterance.onend = () => {
      if (!stopConversation) recognition.start()
    }
  } else {
    console.error('web speech api synth not in window')
  }
}

const dialogResponse = (text) => {
  statusMessage.innerHTML = 'Speaking'
  appendMessage(text, true)
  speechSynth(text)
}

const dialogInput = (text) => {
  appendMessage(text)
  sendTranscription(text)
}


// services
const sendTranscription = (transcribedText) => {
  fetch("/sendTranscription", {
    method: "POST",
    body: JSON.stringify({ transcribedText }),
    headers: {
      "Content-Type": "application/json"
    }
  }).then(response => {
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status}`)
    }
    return response.json()
  }).then(({ assistantReply }) => dialogResponse(assistantReply))
}

const sendConversationInit = (data) => {
  fetch("/initializeConversation", {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      "Content-Type": "application/json"
    }
  }).then(response => {
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status}`);
    }
    return response.json()
  }).then(({ assistantReply }) => dialogResponse(assistantReply))
}

const clearConversation = () => {
  fetch("/clearConversation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  })
}