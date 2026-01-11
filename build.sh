#!/bin/bash
set -e

# Create .npmrc with the token from environment
echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > .npmrc

# Install and build
npm ci
npm run build:prod
