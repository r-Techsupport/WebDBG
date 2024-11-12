# BSOD-API
A basic API to injest `.dmp` files and return analyzed text.

## Components
- [bsod-api](https://github.com/PipeItToDevNull/bsod-api)
    - Frontend SWA in react
    - Backend API written in JS that sends and recieves results from the Windows SDK.
- [WinDebug-Container](https://github.com/PipeItToDevNull/WinDebug-Container)
    - The base container for the API
    - Windows Core 2022 image containing Windows SDK with only Debugging Tools installed.

## API
### Usage
With a file
```bash
curl.exe -X PUT http://localhost:3000/analyze-dmp -F "dmpFile=@path/to/test.dmp"
```

With a URL
```bash
curl -X PUT http://localhost:3000/analyze-dmp -F "url=http://example.com/file.dmp"
```
## SWA
### Azure deployment method
```bash
az group create --name <your-resource-group> --location eastus2
az deployment group create --resource-group <your-resource-group> --template-file template.json
```
Once deployed, the SWA will now be pointed at your repo and is waiting for a build to be submitted. You must create and configure your own GithubAction for this portion of the deployment.

## Notes
- The `REACT_APP_API_URL` must not end in a trailing slash