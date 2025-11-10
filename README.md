# WebDBG
A React Static Web App (SWA) frontend with a containerized Javascript API backend that injests `.dmp` files and returns analyzed text.

## Analysis
By default `!analyze -v` is executed against each dump and the results are returned. Advanced post-processing can be configured in `/api/post-process.js` in `bugcheckCommands`. 

Specify any Bugcheck you want to act up and define the comamnd that should be run against that dump. This app is limited to one additional command per dump, additional commands would require additional logic. Please open an issue if this is required.

## Public Site
This project is hosted publicly on a best effort basis at https://webdbg.rtech.support as a service by the [r/Techsupport Discord Server](https://rtech.support/discord).

## Components
- [WebDBG](https://github.com/r-Techsupport/WebDBG)
    - Frontend SWA in react.
    - Backend API written in JS that sends and recieves results from the Windows SDK container.
- [WinDebug-Container](https://github.com/PipeItToDevNull/WinDebug-Container)
    - The base container for the API.
    - Windows Core 2022 image containing Windows SDK with only Debugging Tools installed.

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
### Variables

|   Variable   |     Value    |
| ------------ | ------------ |
| ENABLE_CORS  | Default is false, set to true when testing otherwise you will get CORS failures. In prod this should be handled by your proxy |
| RATE_LIMIT_S | The duration of your rate limit expressed in seconds |
RATE_LIMIT_MAX | How many requests a client can make in RATE_LIMIT_S before being blocked |
| FILE_SIZE_MB | How large of a file can be processed. This same size should be configured on your proxy for a more reliable failure. |

### Local development
On a Windows host with Docker installed and using Windows containers execute the following from inside the `api` directory to build and launch the [WinDebug-Container](https://github.com/PipeItToDevNull/WinDebug-Container) based API.

```bash
docker build -t api . ; docker run --rm -it -e ENABLE_CORS=true -e FILE_SIZE_MB=15 -e RATE_LIMIT_S=60 -e RATE_LIMIT_MAX=10 -p 3001:3000 api
```

You may need process isolation if you get the error `hcs::CreateComputeSystem \\: The request is not supported.`

```bash
docker build --isolation=process -t api . ; docker run --isolation=process --rm -it -e ENABLE_CORS=true -e FILE_SIZE_MB=15 -e RATE_LIMIT_S=60 -e RATE_LIMIT_MAX=10 -p 3001:3000 api
```

Once launched use `REACT_APP_API_URL=http://localhost:3000` in your `.env` and launch your local development SWA.

### Deployment
Using an nginx reverse proxy to apply CORS (don't run ENABLE_CORS=true in prod) and SSL is the best method, the nginx default max client upload size of 10MB is fine for this appliction.

You want to declare a volume for `C:\app\results`, an example command for deployment is below.

```bash
docker run -d --restart unless-stopped --name webdbg-api -v webdbg-results:C:\app\results -p 3000:3000 ghcr.io/r-techsupport/webdbg-api:latest
```

### PUT endpoint usage
With a file
```bash
curl.exe -X PUT http://localhost:3000/analyze-dmp -F "dmpFile=@path/to/test.dmp"
```

With a URL
```bash
curl -X PUT http://localhost:3000/analyze-dmp -F "url=http://example.com/file.dmp"
```

## Credits
Testing
- @TheKrol

Naming
- @Daspletosaurid

Development advisories
- @zleyyij
- @sealsrock12
