// Python runtime
// https://github.com/GoogleCloudPlatform/functions-framework-python

import { createRuntime } from './base'

export const python = createRuntime({
  name: 'python',
  displayName: 'Python',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-python',
  quickstartUrl:
    'https://github.com/GoogleCloudPlatform/functions-framework-python?tab=readme-ov-file#quickstart-http-function-hello-world',
  checkCommand: 'python3',
  checkArgs: ['--version'],
  installHint:
    'Install Python from https://python.org or use: brew install python',
  filePatterns: ['requirements.txt', 'main.py'],
  runCommand: ['functions-framework', '--target=hello', '--debug'],
  devCommand: ['functions-framework', '--target=hello', '--debug'],
  dockerfile: `FROM python:3.11-slim
LABEL fnkit.fn="true"
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
      'main.py': `import flask
import functions_framework


@functions_framework.http
def hello(request: flask.Request) -> flask.typing.ResponseReturnValue:
    """HTTP Cloud Function.

    Args:
        request: The request object.
            <https://flask.palletsprojects.com/en/latest/api/#flask.Request>

    Returns:
        The response text, or any set of values that can be turned into a
        Response object using \`make_response\`.
        <https://flask.palletsprojects.com/en/latest/api/#flask.make_response>
    """
    return "Hello, World!"
`,
    },
    postCreate: ['pip install -r requirements.txt'],
  }),
})
