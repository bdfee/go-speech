package main

import (
	"context"
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
	openai "github.com/sashabaranov/go-openai"
)

var conversation []openai.ChatCompletionMessage

// use godot package to load/read the .env file and
// return the value of the key
func goDotEnvVariable(key string) string {
	err := godotenv.Load(".env")

	if err != nil {
		log.Fatalf("Error loading .env file")
	}

	return os.Getenv(key)
}

func openAI(userInput string) (string, error) {
	token := goDotEnvVariable("GPT_API_KEY")
	client := openai.NewClient(token)

	userMessage := openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: userInput,
	}

	conversation = append(conversation, userMessage)

	resp, err := client.CreateChatCompletion(
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
	log.Println(assistantMessage.Content)
	return assistantMessage.Content, nil
}

// func clearConversation() {
// 	conversation = []openai.ChatCompletionMessage{}
// }

// func openAi() {
// 	token := goDotEnvVariable("GPT_API_KEY")
// 	client := openai.NewClient(token)
// 	resp, err := client.CreateChatCompletion(
// 		context.Background(),
// 		openai.ChatCompletionRequest{
// 			Model: openai.GPT3Dot5Turbo,
// 			Messages: []openai.ChatCompletionMessage{
// 				{
// 					Role:    openai.ChatMessageRoleUser,
// 					Content: "I am practicing the english langauge in a business context. Is the following text appropriate for a business context? 'Sure man, I'll be there later get off my back'",
// 				},
// 			},
// 		},
// 	)

// 	if err != nil {
// 		log.Printf("ChatCompletion error: %v\n", err)
// 		return
// 	}

// 	if len(resp.Choices) > 0 {
// 		log.Printf("Generated Text: %s", resp.Choices[0].Message.Content)
// 	} else {
// 		log.Println("No choices generated.")
// 	}
// }

func main() {
	fs := http.FileServer(http.Dir("./static"))

	// endpoints
	// strip prefix and serve root
	http.Handle("/static/", http.StripPrefix("/static/", fs))
	http.HandleFunc("/", serveTemplate)

	// handle user transcription from client
	http.HandleFunc("/sendTranscription", func(w http.ResponseWriter, r *http.Request) {
		// if post is recieved at endpoint define structure of incoming data
		if r.Method == http.MethodPost {
			var data struct {
				TranscribedText string `json:"transcribedText"`
			}
			// if error
			if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
				http.Error(w, "Invalid request", http.StatusBadRequest)
				return
			}

			log.Println("/sendTranscription", data)

			// send to openAI
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

	log.Print("Listening on :3000...")

	openAI("I am practicing business english, will you evalute my text for appropriateness in a business context?")

	err := http.ListenAndServe(":3000", nil)

	if err != nil {
		log.Fatal(err)
	}
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
