// Runtime registry - all supported runtimes

import { createRuntime, type Runtime, type RuntimeConfig } from './base'
export type { Runtime, RuntimeConfig }

// Node.js runtime
// https://github.com/GoogleCloudPlatform/functions-framework-nodejs?tab=readme-ov-file#quickstart-set-up-a-new-project
const nodejs = createRuntime({
  name: 'nodejs',
  displayName: 'Node.js',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-nodejs',
  quickstartUrl:
    'https://github.com/GoogleCloudPlatform/functions-framework-nodejs?tab=readme-ov-file#quickstart-set-up-a-new-project',
  checkCommand: 'node',
  checkArgs: ['--version'],
  installHint:
    'Install Node.js from https://nodejs.org or use: brew install node',
  filePatterns: ['package.json'],
  runCommand: ['npm', 'start'],
  devCommand: ['npm', 'start'],
  dockerfile: `FROM node:20-slim
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production
COPY . .
CMD ["npm", "start"]
`,
  template: (projectName: string) => ({
    files: {
      'package.json': JSON.stringify(
        {
          name: projectName,
          version: '1.0.0',
          main: 'index.js',
          scripts: {
            start: 'functions-framework --target=helloWorld',
          },
          dependencies: {
            '@google-cloud/functions-framework': '^3.0.0',
          },
        },
        null,
        2,
      ),
      'index.js': `const functions = require('@google-cloud/functions-framework');

functions.http('helloWorld', (req, res) => {
  res.send('Hello, World!');
});
`,
    },
    postCreate: ['npm install'],
  }),
})

// Python runtime
// https://github.com/GoogleCloudPlatform/functions-framework-python?tab=readme-ov-file#quickstart-set-up-a-new-project
const python = createRuntime({
  name: 'python',
  displayName: 'Python',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-python',
  quickstartUrl:
    'https://github.com/GoogleCloudPlatform/functions-framework-python?tab=readme-ov-file#quickstart-set-up-a-new-project',
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
CMD ["functions-framework", "--target=hello", "--port=8080"]
`,
  template: (projectName: string) => ({
    files: {
      'requirements.txt': `functions-framework==3.*
`,
      'main.py': `import functions_framework

@functions_framework.http
def hello(request):
    """HTTP Cloud Function.
    Args:
        request (flask.Request): The request object.
    Returns:
        The response text, or any set of values that can be turned into a
        Response object using make_response.
    """
    return "Hello, World!"
`,
    },
    postCreate: ['pip install -r requirements.txt'],
  }),
})

// Go runtime
// https://github.com/GoogleCloudPlatform/functions-framework-go?tab=readme-ov-file#quickstart
const go = createRuntime({
  name: 'go',
  displayName: 'Go',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-go',
  quickstartUrl:
    'https://github.com/GoogleCloudPlatform/functions-framework-go?tab=readme-ov-file#quickstart',
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

func helloWorld(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, "Hello, World!")
}
`,
      'cmd/main.go': `package main

import (
	"log"
	"os"

	"github.com/GoogleCloudPlatform/functions-framework-go/funcframework"
	_ "${projectName}"
)

func main() {
	port := "8080"
	if envPort := os.Getenv("PORT"); envPort != "" {
		port = envPort
	}
	if err := funcframework.Start(port); err != nil {
		log.Fatalf("funcframework.Start: %v\\n", err)
	}
}
`,
    },
    postCreate: ['go mod tidy'],
  }),
})

// Java runtime
// https://github.com/GoogleCloudPlatform/functions-framework-java?tab=readme-ov-file#quickstart
const java = createRuntime({
  name: 'java',
  displayName: 'Java',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-java',
  quickstartUrl:
    'https://github.com/GoogleCloudPlatform/functions-framework-java?tab=readme-ov-file#quickstart',
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
  template: (projectName: string) => ({
    files: {
      'pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <groupId>com.example</groupId>
  <artifactId>${projectName}</artifactId>
  <version>1.0-SNAPSHOT</version>
  <packaging>jar</packaging>

  <properties>
    <maven.compiler.source>17</maven.compiler.source>
    <maven.compiler.target>17</maven.compiler.target>
  </properties>

  <dependencies>
    <dependency>
      <groupId>com.google.cloud.functions</groupId>
      <artifactId>functions-framework-api</artifactId>
      <version>1.1.0</version>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>com.google.cloud.functions</groupId>
        <artifactId>function-maven-plugin</artifactId>
        <version>0.11.0</version>
        <configuration>
          <functionTarget>com.example.HelloWorld</functionTarget>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
`,
      'src/main/java/com/example/HelloWorld.java': `package com.example;

import com.google.cloud.functions.HttpFunction;
import com.google.cloud.functions.HttpRequest;
import com.google.cloud.functions.HttpResponse;
import java.io.BufferedWriter;

public class HelloWorld implements HttpFunction {
  @Override
  public void service(HttpRequest request, HttpResponse response) throws Exception {
    BufferedWriter writer = response.getWriter();
    writer.write("Hello, World!");
  }
}
`,
    },
    postCreate: ['mvn package -DskipTests'],
  }),
})

// Ruby runtime
// https://github.com/GoogleCloudPlatform/functions-framework-ruby?tab=readme-ov-file#quickstart
const ruby = createRuntime({
  name: 'ruby',
  displayName: 'Ruby',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-ruby',
  quickstartUrl:
    'https://github.com/GoogleCloudPlatform/functions-framework-ruby?tab=readme-ov-file#quickstart',
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
CMD ["bundle", "exec", "functions-framework-ruby", "--target=hello"]
`,
  template: (projectName: string) => ({
    files: {
      Gemfile: `source "https://rubygems.org"

gem "functions_framework", "~> 1.4"
`,
      'app.rb': `require "functions_framework"

FunctionsFramework.http "hello" do |request|
  "Hello, World!"
end
`,
    },
    postCreate: ['bundle install'],
  }),
})

// .NET runtime
// https://github.com/GoogleCloudPlatform/functions-framework-dotnet?tab=readme-ov-file#quickstart
const dotnet = createRuntime({
  name: 'dotnet',
  displayName: '.NET',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-dotnet',
  quickstartUrl:
    'https://github.com/GoogleCloudPlatform/functions-framework-dotnet?tab=readme-ov-file#quickstart',
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
  template: (projectName: string) => ({
    files: {
      [`${projectName}.csproj`]: `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Google.Cloud.Functions.Hosting" Version="2.*" />
  </ItemGroup>
</Project>
`,
      'Function.cs': `using Google.Cloud.Functions.Framework;
using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

namespace ${projectName.replace(/-/g, '_')};

public class Function : IHttpFunction
{
    public async Task HandleAsync(HttpContext context)
    {
        await context.Response.WriteAsync("Hello, World!");
    }
}
`,
      'Program.cs': `using Google.Cloud.Functions.Hosting;
using ${projectName.replace(/-/g, '_')};

var host = new HostBuilder()
    .ConfigureFunctionsWebHost()
    .Build();

await host.RunAsync();
`,
    },
    postCreate: ['dotnet restore'],
  }),
})

// PHP runtime
// https://github.com/GoogleCloudPlatform/functions-framework-php?tab=readme-ov-file#quickstart-hello-world-on-your-local-machine
const php = createRuntime({
  name: 'php',
  displayName: 'PHP',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-php',
  quickstartUrl:
    'https://github.com/GoogleCloudPlatform/functions-framework-php?tab=readme-ov-file#quickstart-hello-world-on-your-local-machine',
  checkCommand: 'php',
  checkArgs: ['--version'],
  installHint: 'Install PHP from https://php.net or use: brew install php',
  filePatterns: ['composer.json', 'index.php'],
  runCommand: ['php', '-S', 'localhost:8080', 'vendor/bin/router.php'],
  dockerfile: `FROM php:8.2-cli
WORKDIR /app
COPY composer.json composer.lock ./
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
RUN composer install --no-dev
COPY . .
ENV FUNCTION_TARGET=helloWorld
CMD ["php", "-S", "0.0.0.0:8080", "vendor/bin/router.php"]
`,
  template: (projectName: string) => ({
    files: {
      'composer.json': JSON.stringify(
        {
          name: `example/${projectName}`,
          require: {
            'google/cloud-functions-framework': '^1.1',
          },
        },
        null,
        2,
      ),
      'index.php': `<?php

use Google\\CloudFunctions\\FunctionsFramework;
use Psr\\Http\\Message\\ServerRequestInterface;

FunctionsFramework::http('helloWorld', 'helloWorld');

function helloWorld(ServerRequestInterface $request): string
{
    return "Hello, World!";
}
`,
    },
    postCreate: ['composer install'],
  }),
})

// Dart runtime
// https://github.com/GoogleCloudPlatform/functions-framework-dart?tab=readme-ov-file#quickstart
const dart = createRuntime({
  name: 'dart',
  displayName: 'Dart',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-dart',
  quickstartUrl:
    'https://github.com/GoogleCloudPlatform/functions-framework-dart?tab=readme-ov-file#quickstart',
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
  template: (projectName: string) => ({
    files: {
      'pubspec.yaml': `name: ${projectName.replace(/-/g, '_')}
description: A Google Cloud Function
version: 1.0.0

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  functions_framework: ^0.4.0
  shelf: ^1.4.0
`,
      'bin/server.dart': `import 'package:functions_framework/serve.dart';
import 'package:${projectName.replace(/-/g, '_')}/functions.dart';

Future<void> main(List<String> args) async {
  await serve(args, _nameToFunctionTarget);
}

FunctionTarget? _nameToFunctionTarget(String name) {
  switch (name) {
    case 'function':
      return FunctionTarget.http(function);
    default:
      return null;
  }
}
`,
      'lib/functions.dart': `import 'package:shelf/shelf.dart';

Response function(Request request) {
  return Response.ok('Hello, World!');
}
`,
    },
    postCreate: ['dart pub get'],
  }),
})

// C++ runtime
// https://github.com/GoogleCloudPlatform/functions-framework-cpp?tab=readme-ov-file#quickstart
const cpp = createRuntime({
  name: 'cpp',
  displayName: 'C++',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-cpp',
  quickstartUrl:
    'https://github.com/GoogleCloudPlatform/functions-framework-cpp?tab=readme-ov-file#quickstart',
  checkCommand: 'g++',
  checkArgs: ['--version'],
  installHint:
    'Install g++ via Xcode Command Line Tools or use: brew install gcc',
  filePatterns: ['CMakeLists.txt', '*.cpp'],
  runCommand: ['./build/hello_world'],
  dockerfile: `FROM gcr.io/cloud-cpp-testing-resources/cpp-build-image:latest AS build
WORKDIR /app
COPY . .
RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
RUN cmake --build build

FROM gcr.io/distroless/cc-debian11
COPY --from=build /app/build/hello_world /hello_world
CMD ["/hello_world"]
`,
  template: (projectName: string) => ({
    files: {
      'CMakeLists.txt': `cmake_minimum_required(VERSION 3.10)
project(${projectName})

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(functions_framework_cpp REQUIRED)

add_executable(hello_world hello_world.cc)
target_link_libraries(hello_world functions-framework-cpp::framework)
`,
      'hello_world.cc': `#include <google/cloud/functions/framework.h>

namespace gcf = ::google::cloud::functions;

gcf::HttpResponse HelloWorld(gcf::HttpRequest request) {
  gcf::HttpResponse response;
  response.set_header("Content-Type", "text/plain");
  response.set_payload("Hello, World!");
  return response;
}

int main(int argc, char* argv[]) {
  return gcf::Run(argc, argv, HelloWorld);
}
`,
      'vcpkg.json': JSON.stringify(
        {
          name: projectName,
          version: '1.0.0',
          dependencies: ['functions-framework-cpp'],
        },
        null,
        2,
      ),
    },
    postCreate: [],
  }),
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
