@echo off

REM Stop the container
docker stop pm-container

REM Remove the container
docker rm pm-container

echo App stopped.