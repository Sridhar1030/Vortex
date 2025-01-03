#!/bin/bash

export GIT_REPOSITORY_URL="$GIT_REPOSITORY__URL"
# Clone the repository
git clone "$GIT_REPOSITORY__URL" /home/app/output
exec node script.js