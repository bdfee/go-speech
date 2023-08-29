# speech go demo

## Prerequisites 
- go 1.16 downloaded and installed

- clone the repo locally

- aquire two (2) openai gpt3.5 turbo tokens

- create .env in root for your gpt3.5 tokens using the following keys:
`GPT_API_KEY` for the conversation
`GPT_API_TEXT_TRANSLATE` for on demand translation

## install dependencies
from the root directory, `$ go mod download`

## usage
from the root directory, `$ go run .`

look for `Listening on :3000...` in terminal

## local address will be
!! http://localhost:3000/static-speech.html

note that http://localhost:3000/ will not work, must visit at '/static-speech.html'
