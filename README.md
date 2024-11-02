# BSOD-API
A basic API to injest `.dmp` files and return analyzed text.

## Components
- [bsod-api](https://github.com/PipeItToDevNull/bsod-api)
    - Frontend SWA in react
    - Backend API written in JS that sends and recieves results from the Windows SDK.
- [WinDebug-Container](https://github.com/PipeItToDevNull/WinDebug-Container)
    - The base container for the API
    - Windows Core 2022 image containing Windows SDK with only Debugging Tools installed.

## API Usage
With a file
```bash
curl.exe -X PUT http://localhost:3000/analyze-dmp -F "dmpFile=@path/to/test.dmp"
```

With a URL
```bash
curl -X PUT http://localhost:3000/analyze-dmp -F "url=http://example.com/file.dmp"
```