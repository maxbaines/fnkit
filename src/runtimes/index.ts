// Runtime registry - all supported runtimes

import { createRuntime, type Runtime, type RuntimeConfig } from './base'
export type { Runtime, RuntimeConfig }

// Node.js runtime
const nodejs = createRuntime({
  name: 'nodejs',
  displayName: 'Node.js',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-nodejs.git',
  checkCommand: 'node',
  checkArgs: ['--version'],
  installHint:
    'Install Node.js from https://nodejs.org or use: brew install node',
  filePatterns: ['package.json'],
  runCommand: ['npx', 'functions-framework', '--target=helloWorld'],
  devCommand: ['npx', 'functions-framework', '--target=helloWorld'],
  dockerfile: `FROM node:20-slim
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production
COPY . .
CMD ["npx", "functions-framework", "--target={{ENTRYPOINT}}"]
`,
})

// Python runtime
const python = createRuntime({
  name: 'python',
  displayName: 'Python',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-python.git',
  checkCommand: 'python3',
  checkArgs: ['--version'],
  installHint:
    'Install Python from https://python.org or use: brew install python',
  filePatterns: ['requirements.txt', 'main.py'],
  runCommand: ['functions-framework', '--target=hello', '--debug'],
  devCommand: ['functions-framework', '--target=hello', '--debug'],
  dockerfile: `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["functions-framework", "--target={{ENTRYPOINT}}", "--port=8080"]
`,
})

// Go runtime
const go = createRuntime({
  name: 'go',
  displayName: 'Go',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-go.git',
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
CMD ["/server"]
`,
})

// Java runtime
const java = createRuntime({
  name: 'java',
  displayName: 'Java',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-java.git',
  checkCommand: 'java',
  checkArgs: ['--version'],
  installHint:
    'Install Java JDK from https://adoptium.net or use: brew install openjdk',
  filePatterns: ['pom.xml', 'build.gradle'],
  runCommand: ['mvn', 'function:run'],
  dockerfile: `FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn package -DskipTests

FROM eclipse-temurin:17-jre
COPY --from=builder /app/target/*.jar /app.jar
CMD ["java", "-jar", "/app.jar"]
`,
})

// Ruby runtime
const ruby = createRuntime({
  name: 'ruby',
  displayName: 'Ruby',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-ruby.git',
  checkCommand: 'ruby',
  checkArgs: ['--version'],
  installHint:
    'Install Ruby from https://ruby-lang.org or use: brew install ruby',
  filePatterns: ['Gemfile', 'app.rb'],
  runCommand: ['bundle', 'exec', 'functions-framework-ruby', '--target=hello'],
  dockerfile: `FROM ruby:3.2-slim
WORKDIR /app
COPY Gemfile Gemfile.lock ./
RUN bundle install
COPY . .
CMD ["bundle", "exec", "functions-framework-ruby", "--target={{ENTRYPOINT}}"]
`,
})

// .NET runtime
const dotnet = createRuntime({
  name: 'dotnet',
  displayName: '.NET',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-dotnet.git',
  checkCommand: 'dotnet',
  checkArgs: ['--version'],
  installHint:
    'Install .NET SDK from https://dotnet.microsoft.com or use: brew install dotnet',
  filePatterns: ['*.csproj', '*.fsproj'],
  runCommand: ['dotnet', 'run'],
  dockerfile: `FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY *.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "{{PROJECT_NAME}}.dll"]
`,
})

// PHP runtime
const php = createRuntime({
  name: 'php',
  displayName: 'PHP',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-php.git',
  checkCommand: 'php',
  checkArgs: ['--version'],
  installHint: 'Install PHP from https://php.net or use: brew install php',
  filePatterns: ['composer.json', 'index.php'],
  runCommand: ['php', '-S', 'localhost:8080', 'router.php'],
  dockerfile: `FROM php:8.2-cli
WORKDIR /app
COPY composer.json composer.lock ./
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
RUN composer install --no-dev
COPY . .
CMD ["php", "-S", "0.0.0.0:8080", "router.php"]
`,
})

// Dart runtime
const dart = createRuntime({
  name: 'dart',
  displayName: 'Dart',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-dart.git',
  checkCommand: 'dart',
  checkArgs: ['--version'],
  installHint: 'Install Dart from https://dart.dev or use: brew install dart',
  filePatterns: ['pubspec.yaml'],
  runCommand: ['dart', 'run', 'bin/server.dart'],
  dockerfile: `FROM dart:stable AS build
WORKDIR /app
COPY pubspec.* ./
RUN dart pub get
COPY . .
RUN dart compile exe bin/server.dart -o bin/server

FROM scratch
COPY --from=build /runtime/ /
COPY --from=build /app/bin/server /app/bin/server
CMD ["/app/bin/server"]
`,
})

// C++ runtime
const cpp = createRuntime({
  name: 'cpp',
  displayName: 'C++',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-cpp.git',
  checkCommand: 'g++',
  checkArgs: ['--version'],
  installHint:
    'Install g++ via Xcode Command Line Tools or use: brew install gcc',
  filePatterns: ['CMakeLists.txt', '*.cpp'],
  runCommand: ['./build/main'],
  dockerfile: `FROM gcr.io/cloud-cpp-testing-resources/cpp-build-image:latest AS build
WORKDIR /app
COPY . .
RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
RUN cmake --build build

FROM gcr.io/distroless/cc-debian11
COPY --from=build /app/build/main /main
CMD ["/main"]
`,
})

// Runtime registry
export const runtimes: Record<string, Runtime> = {
  nodejs,
  node: nodejs, // alias
  js: nodejs, // alias
  python,
  py: python, // alias
  go,
  golang: go, // alias
  java,
  ruby,
  rb: ruby, // alias
  dotnet,
  csharp: dotnet, // alias
  cs: dotnet, // alias
  php,
  dart,
  cpp,
  'c++': cpp, // alias
}

export function getRuntime(name: string): Runtime | undefined {
  return runtimes[name.toLowerCase()]
}

export function getAllRuntimes(): Runtime[] {
  // Return unique runtimes (no aliases)
  const seen = new Set<string>()
  return Object.values(runtimes).filter((r) => {
    if (seen.has(r.name)) return false
    seen.add(r.name)
    return true
  })
}

export function getRuntimeNames(): string[] {
  return Object.keys(runtimes)
}
