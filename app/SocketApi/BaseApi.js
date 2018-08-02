import autobind from 'auto-bind'
const randomstring = require('randomstring')
const {User, Room} = require('../Models/index')
class BaseApi {
  constructor (io, socket) {
    if (!socket) throw new Error('No Socket for BaseApi')
    this.socket = socket
    this.io = io
    this.id = socket.id
    let self = this
    User.create({
      username: socket.id,
      socketid: socket.id,
      roomesocketid: null
    }).then(user => {
      self.user = user
      self.setup(self)
    })
    autobind(this)
  }

  _sendPrivate (msg) {
    this.io.to(this.id).emit('private_message', msg)
  }

  leaveRoom () {
    if (this.user.roomsocketid) {
      this.user.roomesocketid = null
      this.user.save()
    }
    if (this.room) {
      this.room.num--
      if (this.room.num <= 0) {
        this.room.destroy()
      } else {
        this.room.save()
      }
    }
  }

  setup () {
    let self = this
    let socket = self.socket
    let io = self.io
    let user = self.user
    socket.on('disconnect', () => {
      self.leaveRoom()
      user.destroy()
    })
    // Create Room
    socket.on('create room', function (data) {
      let room = {
        name: 'room' + data,
        socketid: randomstring.generate(),
        num: 1
      }
      user.update({
        roomesocketid: room.socketid
      })
      Room.create(room).then(room => {
        self.room = room
        socket.join(room.name)
        self._sendPrivate({
          type: 'room',
          message: room
        })
      })
    })
    // list room
    socket.on('list room', function (data) {
      Room.findAll().then(rooms => {
        self._sendPrivate({
          type: 'rooms',
          message: rooms
        })
      })
    })
    // join room
    socket.on('join room', function (data) {
      Room.findOne({where: { socketid: data }}).then(room => {
        if (!room) return
        room.save({
          num: room.num++
        })
        self.room = room
        socket.join(room.socketid)
        self.user.update({
          roomesocketid: room.socketid
        })
        io.to(room.socketid).emit('room_message', {
          type: 'join_room',
          message: 'New Member'
        })
      })
    })

    // Leave
    socket.on('leave room', function (data) {
      this.leaveRoom()
    })
    // Chat in room
    socket.on('chat room', function (message) {
      if (!self.room) return
      io.to(self.room.socketid).emit('room_message', {
        type: 'chat_room',
        message: message
      })
    })
  }
}

module.exports = BaseApi
