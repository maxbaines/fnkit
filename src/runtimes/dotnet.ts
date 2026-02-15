// .NET runtime
// https://github.com/GoogleCloudPlatform/functions-framework-dotnet

import { createRuntime } from './base'

export const dotnet = createRuntime({
  name: 'dotnet',
  displayName: '.NET',
  repo: 'https://github.com/GoogleCloudPlatform/functions-framework-dotnet',
  quickstartUrl:
    'https://github.com/GoogleCloudPlatform/functions-framework-dotnet?tab=readme-ov-file#quickstart-hello-world-on-your-local-machine',
  checkCommand: 'dotnet',
  checkArgs: ['--version'],
  installHint:
    'Install .NET SDK from https://dotnet.microsoft.com or use: brew install dotnet',
  filePatterns: ['*.csproj', '*.fsproj'],
  runCommand: ['dotnet', 'run'],
  dockerfile: `FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
LABEL fnkit.fn="true"
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
  template: (projectName: string) => {
    const safeNamespace = projectName.replace(/-/g, '_')
    return {
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

namespace ${safeNamespace};

public class Function : IHttpFunction
{
    public async Task HandleAsync(HttpContext context)
    {
        await context.Response.WriteAsync("Hello, World!");
    }
}
`,
      },
      postCreate: ['dotnet restore'],
    }
  },
})
