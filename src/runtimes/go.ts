// Go runtime
// https://github.com/GoogleCloudPlatform/functions-framework-go

import { createRuntime } from './base'

export const go = createRuntime({
  name: 'go',
  displayName: 'Go',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-go',
  quickstartUrl:
    'https://github.com/GoogleCloudPlatform/functions-framework-go?tab=readme-ov-file#quickstart-hello-world-on-your-local-machine',
  checkCommand: 'go',
  checkArgs: ['version'],
  installHint: 'Install Go from https://go.dev or use: brew install go',
  filePatterns: ['go.mod', 'go.sum'],
  runCommand: ['go', 'run', './cmd/main.go'],
  dockerfile: `FROM golang:1.21 AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/main.go

FROM gcr.io/distroless/static-debian11
COPY --from=builder /app/server /server
ENV FUNCTION_TARGET=HelloWorld
EXPOSE 8080
CMD ["/server"]
`,
  template: (projectName: string) => ({
    files: {
      'go.mod': `module ${projectName}

go 1.21

require github.com/GoogleCloudPlatform/functions-framework-go v1.8.0
`,
      'function.go': `package function

import (
	"fmt"
	"net/http"

	"github.com/GoogleCloudPlatform/functions-framework-go/functions"
)

func init() {
	functions.HTTP("HelloWorld", helloWorld)
}

// helloWorld writes "Hello, World!" to the HTTP response.
func helloWorld(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "Hello, World!")
}
`,
      'cmd/main.go': `package main

import (
	"log"
	"os"

	// Blank-import the function package so the init() runs
	_ "${projectName}"
	"github.com/GoogleCloudPlatform/functions-framework-go/funcframework"
)

func main() {
	// Use PORT environment variable, or default to 8080.
	port := "8080"
	if envPort := os.Getenv("PORT"); envPort != "" {
		port = envPort
	}

	// By default, listen on all interfaces. If testing locally, run with
	// LOCAL_ONLY=true to avoid triggering firewall warnings and
	// exposing the server outside of your own machine.
	hostname := ""
	if localOnly := os.Getenv("LOCAL_ONLY"); localOnly == "true" {
		hostname = "127.0.0.1"
	}
	if err := funcframework.StartHostPort(hostname, port); err != nil {
		log.Fatalf("funcframework.StartHostPort: %v\\n", err)
	}
}
`,
    },
    postCreate: ['go mod tidy'],
  }),
})
