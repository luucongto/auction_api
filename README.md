Punch Auction Server-Side

# Setup

Env variables are setup in .env file at the root folder. Please copy `.env.example` to `.env` and edit as your setting.
Default server api url will be `http://localhost:3000`
`REACT_APP_GOOGLE_CLIENT_ID` is required if you want to use google auth feature
`CLEARDB_DATABASE_URL` is required if you do not use the default mysql connection `mysql://root@localhost:3306/auction?reconnect=true`. Please Create database `auction` before run. Code will automatic create table if it does not exist. 
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` is necessary if you want to use Google Oauth
# Install
You need to install modules before starts.

    npm install
  
# Run Dev
To run with nodemon (watch and restart whenever you change code)

    npm run localstart

Run normal

    npm start

