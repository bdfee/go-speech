package main

import (
	// "context"
	// "fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	// "github.com/joho/godotenv"
	// openai "github.com/sashabaranov/go-openai"
)

// use godot package to load/read the .env file and
// return the value of the key
// func goDotEnvVariable(key string) string {

// 	// load .env file
// 	err := godotenv.Load(".env")

// 	if err != nil {
// 		log.Fatalf("Error loading .env file")
// 	}

// 	return os.Getenv(key)
// }

// func openAi() {
// 	client := openai.NewClient(goDotEnvVariable("GPT_API_KEY"))
// 	ctx := context.Background()

// 	req := openai.AudioRequest{
// 		Model:    openai.Whisper1,
// 		FilePath: "recording.mp3",
// 	}

// 	resp, err := client.CreateTranscription(ctx, req)

// 		if err != nil {
// 		log.Printf("Transcription error: %v\n", err)
// 		return
// 	}
// 	log.Println(resp.Text)

// }

func main() {
	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))
	http.HandleFunc("/", serveTemplate)
	log.Print("Listening on :3000...")
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
