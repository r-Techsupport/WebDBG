# BSOD-API

A basic API to injest `.dmp` files and return a UUID in JSON associated with the results. Fetching the UUID will return the associated result in JSON.

## Usage
With a file
```bash
curl.exe -X PUT http://localhost:3000/analyze-dmp -F "dmpFile=@path/to/test.dmp"
```

With a URL
```bash
curl -X PUT http://localhost:3000/analyze-dmp -F "url=http://example.com/file.dmp"
```

Retrieve result JSON
```bash
curl -X GET http://chakotay.dev0.sh:3001/<uuid>
```