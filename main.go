package main

import (
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
	openai "github.com/sashabaranov/go-openai"
)

// two clients and structs - one for conversation and the other for on demand text translation
var (
	conversationClient  *openai.Client
	conversation        []openai.ChatCompletionMessage
	textTranslateClient *openai.Client
	translatedText      []openai.ChatCompletionMessage
)

// use godot package to load the .env file
func goDotEnvVariable(key string) string {
	err := godotenv.Load(".env")

	if err != nil {
		log.Fatalf("Error loading .env file")
	}
	return os.Getenv(key)
}

// text translation outside of conversation
func textTranslate(userInput string) (string, error) {

	userMessage := openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: userInput,
	}

	translatedText = append(translatedText, userMessage)

	resp, err := textTranslateClient.CreateChatCompletion(
		context.Background(),
		openai.ChatCompletionRequest{
			Model:    openai.GPT3Dot5Turbo,
			Messages: translatedText,
		},
	)

	if err != nil {
		return "", err
	}

	assistantMessage := resp.Choices[0].Message
	translatedText = []openai.ChatCompletionMessage{}
	return assistantMessage.Content, nil
}

// conversation
func openAI(userInput string) (string, error) {

	userMessage := openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: userInput,
	}

	conversation = append(conversation, userMessage)

	resp, err := conversationClient.CreateChatCompletion(
		context.Background(),
		openai.ChatCompletionRequest{
			Model:    openai.GPT3Dot5Turbo,
			Messages: conversation,
		},
	)

	if err != nil {
		return "", err
	}

	assistantMessage := resp.Choices[0].Message
	conversation = append(conversation, assistantMessage)

	return assistantMessage.Content, nil
}

// this just empties the structs to reset teh conversation
func clearConversation() {
	conversation = []openai.ChatCompletionMessage{}
	translatedText = []openai.ChatCompletionMessage{}
}

// endpoints defined and served here
func main() {

	conversationToken := goDotEnvVariable("GPT_API_KEY")
	conversationClient = openai.NewClient(conversationToken)

	textTranslationToken := goDotEnvVariable("GPT_API_TEXT_TRANSLATE")
	textTranslateClient = openai.NewClient(textTranslationToken)

	fs := http.FileServer(http.Dir("./static"))

	// endpoints
	http.Handle("/static/", http.StripPrefix("/static/", fs))

	http.HandleFunc("/", serveTemplate)

	http.HandleFunc("/initializeConversation", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			var data struct {
				Language string `json:"language"`
				Level    string `json:"level"`
				Context  string `json:"context"`
			}

			if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
				http.Error(w, "Invalid initialization request", http.StatusBadRequest)
				return
			}

			initialPrompt := initializeStringTemplate(data.Language, data.Level, data.Context)

			assistantReply, err := openAI(initialPrompt)

			if err != nil {
				http.Error(w, "Error processing initialization request", http.StatusInternalServerError)
				return
			}

			response := struct {
				AssistantReply string `json:"assistantReply"`
			}{
				AssistantReply: assistantReply,
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}
	})

	// handle user transcription from client
	http.HandleFunc("/sendTranscription", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			var data struct {
				TranscribedText string `json:"transcribedText"`
			}
			// if error
			if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
				http.Error(w, "Invalid transcription request", http.StatusBadRequest)
				return
			}

			assistantReply, err := openAI(data.TranscribedText)

			if err != nil {
				http.Error(w, "Error processing transcribed text", http.StatusInternalServerError)
				return
			}

			response := struct {
				AssistantReply string `json:"assistantReply"`
			}{
				AssistantReply: assistantReply,
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}
	})

	http.HandleFunc("/sendTranslation", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			var data struct {
				TextToTranslate string `json:"textToTranslate"`
			}
			// if error
			if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
				http.Error(w, "Invalid translation request", http.StatusBadRequest)
				return
			}

			assistantReply, err := textTranslate(data.TextToTranslate)

			if err != nil {
				http.Error(w, "Error processing translated text", http.StatusInternalServerError)
				return
			}

			response := struct {
				AssistantReply string `json:"assistantReply"`
			}{
				AssistantReply: assistantReply,
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}
	})

	http.HandleFunc("/clearConversation", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			clearConversation()
		}
	})

	log.Print("Listening on :3000...")

	err := http.ListenAndServe(":3000", nil)

	if err != nil {
		log.Fatal(err)
	}
}

// template literals are not possible in go
func initializeStringTemplate(lang, level, context string) string {
	tmpl := "I would like you to be my conversation partner so that I can practice my %s %s language skills in a %s context. Try to sustain role-playing as my conversation partner for the duration of the conversation. Please respond using %s level %s so that I can practice listening and reading. When you are ready, please ask me a question to begin the conversation"
	return fmt.Sprintf(tmpl, level, lang, context, level, lang)
}

func serveTemplate(w http.ResponseWriter, r *http.Request) {
	lp := filepath.Join("templates", "layout.html")
	fp := filepath.Join("templates", filepath.Clean(r.URL.Path))

	// Return a 404 if the template doesn't exist
	info, err := os.Stat(fp)
	if err != nil {
		if os.IsNotExist(err) {
			http.NotFound(w, r)
			return
		}
	}

	// Return a 404 if the request is for a directory
	if info.IsDir() {
		http.NotFound(w, r)
		return
	}

	tmpl, err := template.ParseFiles(lp, fp)
	if err != nil {
		// Log the detailed error
		log.Print(err.Error())
		// Return a generic "Internal Server Error" message
		http.Error(w, http.StatusText(500), 500)
		return
	}

	err = tmpl.ExecuteTemplate(w, "layout", nil)
	if err != nil {
		log.Print(err.Error())
		http.Error(w, http.StatusText(500), 500)
	}
}
