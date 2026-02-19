// Ruby runtime
// https://github.com/GoogleCloudPlatform/functions-framework-ruby

import { createRuntime } from './base'

export const ruby = createRuntime({
  name: 'ruby',
  displayName: 'Ruby',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-ruby',
  quickstartUrl:
    'https://github.com/GoogleCloudPlatform/functions-framework-ruby?tab=readme-ov-file#quickstart',
  checkCommand: 'ruby',
  checkArgs: ['--version'],
  installHint:
    'Install Ruby from https://ruby-lang.org or use: brew install ruby',
  buildTools: [
    {
      name: 'Bundler',
      command: 'bundle',
      args: ['--version'],
      installHint: 'Install Bundler: gem install bundler',
    },
  ],
  filePatterns: ['Gemfile', 'app.rb'],
  runCommand: ['bundle', 'exec', 'functions-framework-ruby', '--target=hello'],
  dockerfile: `FROM ruby:3.2
LABEL fnkit.fn="true"
WORKDIR /app
COPY Gemfile Gemfile.lock ./
RUN bundle install
COPY . .
CMD ["bundle", "exec", "functions-framework-ruby", "--target=hello"]
`,
  template: (projectName: string) => ({
    files: {
      Gemfile: `source "https://rubygems.org"

gem "functions_framework", "~> 1.0"
`,
      'app.rb': `require "functions_framework"

FunctionsFramework.http("hello") do |request|
  "Hello, World!\\n"
end
`,
    },
    postCreate: ['bundle install'],
  }),
})
