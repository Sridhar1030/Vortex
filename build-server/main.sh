#!/bin/bash

export GIT_REPOSITORY_URL="$GIT_REPOSITORY_URL"
# Clone the repository
git clone "$GIT_REPOSITORY_URL" /home/app/output

exces node script.js
