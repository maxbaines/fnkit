// PHP runtime
// https://github.com/GoogleCloudPlatform/functions-framework-php

import { createRuntime } from './base'

export const php = createRuntime({
  name: 'php',
  displayName: 'PHP',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-php',
  quickstartUrl:
    'https://github.com/GoogleCloudPlatform/functions-framework-php?tab=readme-ov-file#quickstarts',
  checkCommand: 'php',
  checkArgs: ['--version'],
  installHint: 'Install PHP from https://php.net or use: brew install php',
  buildTools: [
    {
      name: 'Composer',
      command: 'composer',
      args: ['--version'],
      installHint:
        'Install Composer from https://getcomposer.org or use: brew install composer',
    },
  ],
  filePatterns: ['composer.json', 'index.php'],
  runCommand: [
    'php',
    '-S',
    'localhost:8080',
    'vendor/google/cloud-functions-framework/router.php',
  ],
  dockerfile: `FROM php:8.2-cli
LABEL fnkit.fn="true"
WORKDIR /app
COPY composer.json composer.lock ./
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
RUN composer install --no-dev
COPY . .
ENV FUNCTION_TARGET=helloHttp
CMD ["php", "-S", "0.0.0.0:8080", "vendor/google/cloud-functions-framework/router.php"]
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

use Psr\\Http\\Message\\ServerRequestInterface;

function helloHttp(ServerRequestInterface $request): string
{
    return "Hello, World!" . PHP_EOL;
}
`,
    },
    postCreate: ['composer install'],
  }),
})
