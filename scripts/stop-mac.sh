#!/bin/bash

# Stop the container
docker stop pm-container

# Remove the container
docker rm pm-container

echo "App stopped."