var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition;

// layout elements
const nativeLanguage = document.getElementById('native-language')
const languageSelect = document.getElementById('language-select')
const levelSelect = document.getElementById('language-level')
const contextSelect = document.getElementById('conversation-context')
const dialogElement = document.getElementById('dialog')
const beginBtn = document.getElementById('begin-button')
const startBtn = document.getElementById('start-button')
const stopBtn = document.getElementById('stop-button')
const clearBtn = document.getElementById('clear-button')
const statusMessage = document.getElementById('status')

// hacky variables
// disabling onutterance trigger of speech recognition in certain circumstances
let stopConversation = false
// basic count, this is set as a data attribute to each conversation message in the dialog box
let messageIdx = 0

// speech synth is used to get the list of languages
const synth = window.speechSynthesis

// append available langauges from web speech api as option els in conversation params
synth.onvoiceschanged = () => {
  const voices = speechSynthesis.getVoices();
  // map set sort unique voices
  [...new Set(voices
    .map(({ lang }) => lang))]
    .sort()
    .forEach(lang => {
      // create option el per lang
      const option = document.createElement('option')
      option.value = lang
      option.textContent = lang
      // set english to selected lang
      if (lang === "en-US") option.selected = true
      
      // append to language select
      languageSelect.appendChild(option)

      // clone el and append to native language
      const clone = option.cloneNode(true)
      if (clone.value === "en-US") clone.selected = true

      nativeLanguage.appendChild(clone)
  })
}

// speech recognition
const recognition = new SpeechRecognition()
recognition.continuous = false
recognition.lang = languageSelect.value // from language select dropdown
recognition.interimResults = false
recognition.maxAlternatives = 1

recognition.onresult = ({ results }) => {
  const text = results[0][0].transcript
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

recognition.onaudiostart = () => statusMessage.innerHTML = 'Listening'



// layout - listeners & handlers
startBtn.onclick = () => {
  stopConversation = false
  recognition.start()
}

stopBtn.onclick = () => {
  stopConversation = true
  recognition.abort() // won't return a result
  synth.cancel() // stop the browser from speaking
  statusMessage.innerHTML = 'Conversation Paused'
}

clearBtn.onclick = () => {
  stopConversation = true
  messageIdx = 0 // reset message idx
  recognition.abort()
  synth.cancel()
  clearConversation() // fires to the backend
  clearMessages() // remove dom els
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

// this will fire a translation request based on the highlighted text in the dom
// and then append it beneath the corresponding message Idx
dialogElement.addEventListener('mouseup', ({ target }) => {
  const selection = window.getSelection().toString()

  if (selection) translateMessage(selection, target.attributes.messageIdx)
});



// speech synthesis
const speechSynth = (text) => {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text)
    
    // utterance config can go here including voices and playback speed controls
    utterance.lang = languageSelect.value // from ui dropdown
    synth.speak(utterance)

    utterance.onend = () => {
      if (!stopConversation) recognition.start()
    }
  } else {
    console.error('web speech api synth not in window')
  }
}



// dialog
const appendMessage = (text, assistant = false) => {
  messageIdx++

  const paragraphElement = document.createElement('p')
  paragraphElement.textContent = text
  paragraphElement.setAttribute('messageIdx', messageIdx)
  if (assistant) {
    paragraphElement.className = "assistant"
  }

  dialogElement.appendChild(paragraphElement)
}

const clearMessages = () => dialogElement.replaceChildren() // removes everything in the dialog el

const dialogResponse = (text) => {
  statusMessage.innerHTML = 'Speaking'
  appendMessage(text, true)
  speechSynth(text)
}

const dialogInput = (text) => {
  appendMessage(text)
  sendTranscription(text)
}



// translation service outside of conversational context
const translateMessage = async (text, messageIdx) => {
  statusMessage.innerHTML = 'Paused for translation, enable recognition to resume conversation'
  const prompt = `please translate '${text}' from ${languageSelect.value} into ${nativeLanguage.value}.` 
  sendTranslation(prompt, messageIdx)
}

const appendTranslatedMessage = (text, messageIdx) => {
  const targetMessage = dialogElement.querySelector(`p[messageIdx="${messageIdx}"]`);
  
  if (targetMessage) {
    const translation = document.createElement('p');
    translation.className = 'translation';
    translation.textContent = text;
    targetMessage.insertAdjacentElement('afterend', translation);
  }
};



// fetch services

// this is the route for conversation
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

// this is the route for translation outside of the conversation context
const sendTranslation = (textToTranslate) => {
  fetch("/sendTranslation", {
    method: "POST",
    body: JSON.stringify({ textToTranslate }),
    headers: {
      "Content-Type": "application/json"
    }
  }).then(response => {
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status}`)
    }
    return response.json()
  }).then(({ assistantReply }) => appendTranslatedMessage(assistantReply, messageIdx))
}

// this is the route that hits the prompts on the backend to initialize a new conversation
const sendConversationInit = (data) => {

  if (messageIdx) clearConversation() // hacky, clear backend before init a new convo. This is too fragile. 
  
  fetch("/initializeConversation", {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      "Content-Type": "application/json"
    }
  }).then(response => {
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status}`)
    }
    return response.json()
  }).then(({ assistantReply }) => {
    stopConversation = false
    dialogResponse(assistantReply)
  })
}

// this route clears the conversation on the backend
const clearConversation = () => {
  fetch("/clearConversation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  }).then(() => messageIdx = 0)
}

// hacky -- clear the conversation in the backend on initial page load 
clearConversation()