# From https://github.com/PipeItToDevNull/WinDebug-Container
FROM ghcr.io/pipeittodevnull/windebug-container:latest

# Install Chocolatey
RUN powershell -Command "iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))"

# Install Node.js using Chocolatey
RUN choco install nodejs-lts -y

# Set the working directory
WORKDIR C:\\app

# Copy application files
COPY . .

# Install application dependencies
RUN npm install

# Declare a volume for results so they persist
VOLUME C:\\app\\results

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", "api.js"]

LABEL org.opencontainers.image.source https://github.com/r-Techsupport/WebDBG
LABEL org.opencontainers.image.description A BSOD debug API using WinDebug-Container 
