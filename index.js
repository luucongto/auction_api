'use strict'
import passport from './app/HttpApi/passport'
import socketJwtAuth from './app/SocketApi/jwtAuth'

import {auth, baseRoutes, accountRoutes, productRoutes, adminRoutes, noticeRoutes} from './app/HttpApi/routes'
import {sequelize, User} from './app/Models'
import SocketManager from './app/Bot/SocketManager'
import ChatSystem from './app/Bot/ChatSystem'
import AnnouncementSystem from './app/Bot/AnnouncementSystem'
import bcrypt from 'bcrypt'
require('dotenv').config()
const express = require('express')
const PORT = process.env.PORT || 3000
// init db
sequelize.sync().then(() => {
  User.findOrCreate({
    where: {
      username: 'iamadmin'
    },
    defaults: {
      password: bcrypt.hashSync('very_complex_password', 10),
      name: 'Admin',
      email: null,
      logged_at: parseInt(new Date().getTime() / 1000),
      role: 'admin'
    }
  }).spread((user, create) => {
    // startBot
  })
})
// Http Server
var app = express()
var session = require('express-session')
var bodyParser = require('body-parser')
var createError = require('http-errors')
var path = require('path')
var cookieParser = require('cookie-parser')
var logger = require('morgan')

// view engine setup
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.use(session({
  secret: 'secret',
  saveUninitialized: true,
  resave: true
}))

app.use(passport.initialize())
app.use(passport.session())
var allowCrossDomain = function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  next()
}
app.use(allowCrossDomain)

app.use('/', baseRoutes)
app.use('/', auth)
app.use('/product', productRoutes)
app.use('/account', accountRoutes)
app.use('/admin', adminRoutes)
app.use('/notice', noticeRoutes)
// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404))
})

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}
  // render the error page
  res.status(err.status || 500)
  res.render('error')
})

// IO server
var server = require('http').createServer(app)
const socketIO = require('socket.io')
const io = socketIO().listen(server)

io.use(socketJwtAuth)
SocketManager.setIo(io)
ChatSystem.setIo(io)
AnnouncementSystem.setIo(io)
let connectCounter = 0
io.on('connection', (socket) => {
  socket.on('connect', function () { connectCounter++ })
  socket.on('disconnect', function () {
    connectCounter--
    if (socket.request.user) {
      SocketManager.removeUser({
        id: socket.request.user.id,
        socket: socket
      })
    }
  })
  if (socket.request.user && socket.request.user.id) {
    let user = {
      id: socket.request.user.id,
      role: socket.request.user.role,
      socket: socket
    }
    socket.join('chat_room', () => {
      ChatSystem.setUser(user)
    })

    socket.join('auction_room', () => {
      connectCounter++
      AnnouncementSystem.setUser(user)
      SocketManager.setUser(user)
    })
  } else {
    console.error('Socket Unauthorized!!')
  }
})

setInterval(() => io.emit('server_setting', {
  time: new Date().getTime() / 1000,
  type: process.env.REAL_API,
  clients: connectCounter
}))
server.listen(PORT, () => console.log(`Listening RESTFUL on ${PORT}`))
module.exports = app
