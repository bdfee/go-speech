var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition

// page elements 
const languageSelect = document.getElementById('language-select');
const levelSelect = document.getElementById('language-level')
const contextSelect = document.getElementById('conversation-context')
const dialogElement = document.getElementById('dialog');
const beginBtn = document.getElementById('begin-button')
const startBtn = document.getElementById('start-button');
const stopBtn = document.getElementById('stop-button');
const clearBtn = document.getElementById('clear-button');
const statusMessage = document.getElementById('status')

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
  sendTranscription(text)
  appendMessage(text)
};

recognition.onnomatch = () => appendMessage("I didn't recognise the speech")
recognition.onerror = (event) => appendMessage('Error occurred in recognition: ' + event.error)

recognition.onaudiostart = () => {
  statusMessage.innerHTML = 'Listening'
}

// layout listeners and handlers
startBtn.onclick = () => {
  recognition.start()
  configureLayout("disableRecognition")
}

stopBtn.onclick = () => {
  recognition.abort()
  synth.cancel()
  configureLayout("enableRecognition")
}

clearBtn.onclick = () => {
  recognition.abort()
  synth.cancel()
  clearConversation()
  clearMessages()
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

  configureLayout("enableRecognition")
}

const configureLayout = (string) => {
  switch (string) {
    case "newConversation": {
      statusMessage.innerHTML = "click new conversation and wait for me to respond"
      beginBtn.removeAttribute('disabled')
      startBtn.setAttribute('disabled', true)
      stopBtn.setAttribute('disabled', true)
      clearBtn.setAttribute('disabled', true)
      break
    }
    case "enableRecognition": {
      statusMessage.innerHTML = "ready to go, click start recognition and wait for me to respond"
      beginBtn.setAttribute('disabled', true)
      startBtn.removeAttribute('disabled')
      stopBtn.setAttribute('disabled', true)
      clearBtn.setAttribute('disabled', true)
      break
    }
    case "disableRecognition": {
      beginBtn.setAttribute('disabled', true)
      startBtn.setAttribute('disabled', true)
      stopBtn.removeAttribute('disabled')
      clearBtn.removeAttribute('disabled')
      break
    }
    default: {
      console.error('something went wrong in the layout switch')
    }
  }
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
    
    // language for utterance
    // utterance.lang = "hi-IN"
    synth.speak(utterance)

  } else {
    console.error('web speech api synth not in window')
  }
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
      throw new Error(`Network response was not ok: ${response.status}`);
    }
    return response.json(); // Parse the JSON response
  }).then(({ assistantReply }) => {
    // Handle the data received from the server
    appendMessage(assistantReply, true)
    speechSynth(assistantReply)
  }).catch(error => {
    console.error("Fetch error:", error);
  });
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
  }).then(({ assistantReply }) => {
    appendMessage(assistantReply, true)
    speechSynth(assistantReply)
  })
}

const clearConversation = () => {
  fetch("/clearConversation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  })
}

configureLayout("newConversation")