# WebDBG
A React Static Web App (SWA) frontend with a containerized Javascript API backend that injests `.dmp` files and returns analyzed text.

## Public Site
This project is hosted publicly on a best effort basis at https://webdbg.rtech.support as a service by the [r/Techsupport Discord Server](https://rtech.support/discord).

## Components
- [WebDBG](https://github.com/r-Techsupport/WebDBG)
    - Frontend SWA in react.
    - Backend API written in JS that sends and recieves results from the Windows SDK container.
- [WinDebug-Container](https://github.com/PipeItToDevNull/WinDebug-Container)
    - The base container for the API.
    - Windows Core 2022 image containing Windows SDK with only Debugging Tools installed.
- [Debug-Dmps](https://github.com/PipeItToDevNull/Debug-Dmps)
    - The current PowerShell based backend processor.
    - There is an [open issue](https://github.com/r-Techsupport/WebDBG/issues/13) to rewrite the backend in JS.

## SWA
Configure the SWA by copying `env.example` to `.env` and configuring appropriately.
- The `REACT_APP_API_URL` must not end in a trailing slash

### Local development
From inside the `swa` directory run `npm start` to launch the development server.

### Azure deployment method
Configure the Azure deployment by copying `template.json.example` to `template.json` and configuring appropriately.

```bash
az group create --name <your-resource-group> --location eastus2
az deployment group create --resource-group <your-resource-group> --template-file template.json
```
Once deployed, the SWA will now be pointed at your repo and is waiting for a build to be submitted. You must create and configure your own GithubAction and repository secrets and variables for this portion of the deployment.

The following Secrets and Variables must be configured under the "Actions" context:
- AZURE_STATIC_WEB_APPS_API_TOKEN
- REACT_APP_API_URL
- REACT_APP_REPO_URL
- REACT_APP_SITE_NAME

## API
### Local development
On a Windows host with Docker installed and using Windows containers execute the following from inside the `api` directory to build and launch the [WinDebug-Container](https://github.com/PipeItToDevNull/WinDebug-Container) based API.

```bash
docker build -t api . ; docker run --rm -it -p 3000:3000 api
```

Once launched use `REACT_APP_API_URL=http://localhost:3000` in your `.env` and launch your local development SWA.

### PUT endpoint usage
With a file
```bash
curl.exe -X PUT http://localhost:3000/analyze-dmp -F "dmpFile=@path/to/test.dmp"
```

With a URL
```bash
curl -X PUT http://localhost:3000/analyze-dmp -F "url=http://example.com/file.dmp"
```
