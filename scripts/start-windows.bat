@echo off

REM Build the Docker image
docker build -t pm-app .

REM Run the container
docker run -d -p 8000:8000 --name pm-container pm-app

echo App started. Visit http://localhost:8000