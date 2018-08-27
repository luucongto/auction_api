import ProductService from '../Services/ProductService'
import { AutoBid } from '../Models'
import Const from '../config/config'
import AuctionBot from './AuctionBot'
const MAX_BID = 1000000000 // 1bil
class SocketManager {
  constructor () {
    // Authenticated client, can make signed calls
    this.io = null
    this.activeUsers = {}
    this.service = new ProductService()
  }
  setIo (io) {
    this.io = io
  }
  removeUser (data) {
    let userId = data.id
    if (this.activeUsers[userId] && this.activeUsers[userId].socket.length) {
      let index = this.activeUsers[userId].socket.indexOf(data.socket)
      if (index >= 0) {
        this.activeUsers[userId].socket.splice(index, 1)
      }
    }
  }
  setUser (data) {
    let self = this
    let userId = data.id
    if (!userId) {
      data.socket.emit('server_message', {type: 'error', msg: 'Please relogin. Your token is expired!!'})
      return
    }

    if (this.activeUsers[userId]) {
      this.activeUsers[userId].socket.push(data.socket)
    } else {
      this.activeUsers[userId] = {
        socket: [data.socket],
        api: null
      }
    }
    console.log(`User ${userId} joined`)
    self._refresh(data.id)
    //listen
    data.socket.on('auction', params => {
      switch (params.command) {
        case 'placeBid':
      //   {product_id: this.props.product.id,
      // bid_price: parseInt(this.state.bidPrice)}
          self._placeBid(data, params)
          break
        case 'placeAutoBid':
          self._placeAutoBid(data, params)
          // will process auto bid on ticker
          break
        case 'refresh':
          self._refresh(data.id)
          break
      }
    })

    data.socket.on('seller', params => {
      switch (params.command) {
        case 'seller_get':
          AuctionBot.sellerGet(data)
          break
        case 'update':
          AuctionBot.sellerUpdate(data, params)
          break
        case 'remove': {
          AuctionBot.sellerUpdate(data, {id: params.id, status: Const.PRODUCT_STATUS.HIDE, user_id: data.id, seller_id: data.id})
          break
        }
        case 'show': {
          AuctionBot.sellerUpdate(data, {id: params.id, status: Const.PRODUCT_STATUS.WAITING, user_id: data.id, seller_id: data.id})
          break
        }
      }
    })
  }

  _refresh (userId) {
    AuctionBot._refresh(userId)
  }

  _placeBid (data, params) {
    let userId = data.id
    let self = this
    if (!userId || !this.activeUsers[userId]) {
      data.socket.emit('server_message', {type: 'error', msg: 'Please relogin. Your token is expired!!'})
      self._emitUser(userId, {success: false}, 'bid_message')
      return false
    }
    if (data.role === 'admin') {
      data.socket.emit('server_message', {type: 'error', msg: 'Admin cannot bid!!'})
      self._emitUser(userId, {success: false}, 'bid_message')
      return false
    }
    params.userId = userId
    AuctionBot.addABid(params)
  }

  _placeAutoBid (data, params) {
    let userId = data.id
    let self = this
    if (!userId || !this.activeUsers[userId]) {
      data.socket.emit('server_message', {type: 'error', msg: 'Please relogin. Your token is expired!!'})
      self._emitUser(userId, {success: false}, 'auto_bid_message')
      return
    }
    params.userId = userId
    AuctionBot.addAutoBid(params)
  }

  _emitUser (userId, products, event = 'auction') {
    if (!userId) {
      console.error('Emit order null userid')
    }
    if (this.activeUsers[userId] && this.activeUsers[userId].socket.length) {
      console.log(new Date(), userId, event, JSON.stringify(products).substring(0, 100))
      this.activeUsers[userId].socket.forEach(socket => socket.emit(event, products))
    } else {
      console.log('Emit non active user or no socket', userId)
    }
  }
  _broadCastToAuctionRoom (data, event = 'auction') {
    if (this.io) {
      console.log('broadcast', event)
      this.io.to('auction_room').emit(event, data)
    } else {
      console.error('Call broadcast BUT NULL IO')
    }
  }
}

const instance = new SocketManager()
// Object.freeze(instance)

export default instance
