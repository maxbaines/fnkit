// Node.js MQTT runtime
// https://github.com/functionkit/function-framework-nodejs

import { createRuntime } from './base'

export const nodejsMqtt = createRuntime({
  name: 'nodejs-mqtt',
  displayName: 'Node.js (MQTT)',
  repo: 'https://github.com/functionkit/function-framework-nodejs',
  quickstartUrl:
    'https://github.com/functionkit/function-framework-nodejs#readme',
  checkCommand: 'node',
  checkArgs: ['--version'],
  installHint:
    'Install Node.js from https://nodejs.org or use: brew install node',
  filePatterns: ['package.json'],
  runCommand: ['npm', 'start'],
  devCommand: ['npm', 'start'],
  dockerfile: `FROM node:20-slim
LABEL fnkit.fn="true"
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production
COPY . .

# MQTT broker connection
ENV MQTT_BROKER=mqtt://localhost:1883
# Function target name
ENV FUNCTION_TARGET=helloWorld
# Topic prefix (subscribes to {prefix}/{target})
ENV MQTT_TOPIC_PREFIX=fnkit
# MQTT QoS level (0, 1, or 2)
ENV MQTT_QOS=1
# MQTT client identifier (auto-generated if empty)
ENV MQTT_CLIENT_ID=
# MQTT broker authentication
ENV MQTT_USERNAME=
ENV MQTT_PASSWORD=
# TLS: path to CA certificate
ENV MQTT_CA=
# mTLS: path to client certificate and key
ENV MQTT_CERT=
ENV MQTT_KEY=
# Whether to reject unauthorized TLS certificates
ENV MQTT_REJECT_UNAUTHORIZED=true

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
            start: 'fnkit --target=helloWorld',
          },
          dependencies: {
            '@functionkit/functions-framework': '^0.1.0',
          },
        },
        null,
        2,
      ),
      'index.js': `const fnkit = require('@functionkit/functions-framework');

fnkit.mqtt('helloWorld', (req, res) => {
  const name = req.body?.name || 'World';
  res.send({ message: \`Hello, \${name}!\` });
});
`,
      '.env.example': `# MQTT broker connection
MQTT_BROKER=mqtt://localhost:1883

# Function target name
FUNCTION_TARGET=helloWorld

# Topic prefix (subscribes to {prefix}/{target})
MQTT_TOPIC_PREFIX=fnkit

# MQTT QoS level (0, 1, or 2)
MQTT_QOS=1

# MQTT client identifier (auto-generated if empty)
MQTT_CLIENT_ID=

# MQTT broker authentication
MQTT_USERNAME=
MQTT_PASSWORD=

# TLS: path to CA certificate
MQTT_CA=

# mTLS: path to client certificate and key
MQTT_CERT=
MQTT_KEY=

# Whether to reject unauthorized TLS certificates
MQTT_REJECT_UNAUTHORIZED=true
`,
    },
    postCreate: ['npm install'],
  }),
})
