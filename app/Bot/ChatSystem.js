import {ChatMessage} from '../Models'
import {Op} from 'sequelize'
class ChatSystem {
  constructor () {
    // Authenticated client, can make signed calls
    this.io = null
  }
  setIo (io) {
    this.io = io
  }
  setUser (data) {
    let self = this
    let userId = data.id
    if (!userId) {
      data.socket.emit('server_message', {type: 'error', msg: 'Please relogin. Your token is expired!!'})
      return
    }
    let today = Math.floor(new Date().getTime() / 1000) - 86400
    setTimeout(() => {
      ChatMessage.findAll({
        where: {
          created_at: {
            [Op.gt]: today
          }
        },
        order: [
          ['created_at', 'asc']
        ]
      }).then(messages => {
        data.socket.emit('chat_message' , {messages})
      })
    }, 3000)

    data.socket.on('chat_message', params => {
      switch (params.command) {
        case 'newMessage':
          if (data.role !== 'admin') {
            data.socket.emit('server_message', {type: 'error', msg: 'Unauthorized'})
            return
          }
          if (params.message.length > 255) {
            data.socket.emit('server_message', {type: 'error', msg: 'Message too long'})
            return
          }
          let msg = {
            user_id: data.id,
            created_at: Math.floor(new Date().getTime() / 1000),
            message: params.message
          }
          if (data.role === 'admin') {
            ChatMessage.create(msg)
          }

          self._broadCastToAuctionRoom({messages: [msg]}, 'chat_message')
          break
      }
    })
  }

  _broadCastToAuctionRoom (data, event = 'auction') {
    if (this.io) {
      console.log('broadcast', event)
      this.io.to('chat_room').emit(event, data)
    }
  }
}

const instance = new ChatSystem()
// Object.freeze(instance)

export default instance
