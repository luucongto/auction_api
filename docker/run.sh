#!/bin/bash

npm install npm install -g pm2
npm install
pm2 start startSOCKET.sh
pm2 start startHTTP.sh
pm2 start startBouncy.sh
pm2 log