import ProductService from '../Services/ProductService'
import { AuctionBids, AuctionConfigs, Products, User } from '../Models'
import {Op} from 'sequelize'
import underscore from 'underscore'

const MAX_BID = 1000000000 // 1bil
class AuctionBot {
  constructor () {
    // Authenticated client, can make signed calls
    this.io = null
    this.watchingSockets = {}
    this.activeUsers = {}
    this.userDB = {}
    this.products = {}
    this.activeAuctions = []
    this.auctionConfigs = {}
    this.tickerHandler = false
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
    if (this.activeUsers[userId]) {
      this.activeUsers[userId].socket.push(data.socket)
    } else {
      this.activeUsers[userId] = {
        socket: [data.socket],
        api: null
      }
    }

    this._refresh(userId)
    data.socket.on('auction', params => {
      switch (params.command) {
        case 'placeBid':
          let now = parseInt(new Date().getTime() / 1000)
          let product = self.products[params.product_id]
          if (!product || product.start_at >= now) {
            self._emitUser(data.id, {type: 'error', msg: 'Product is not valid!!!'}, 'server_message')
            self._emitUser(data.id, {success: false, productId: product.id}, 'bid_message')
            return
          } else if (product.finished) {
            self._emitUser(data.id, {type: 'error', msg: 'Product has been sold!!!'}, 'server_message')
            self._emitUser(data.id, {success: false, productId: product.id}, 'bid_message')
            return
          }
          let bidPrice = parseInt(params.bid_price)
          bidPrice = bidPrice - bidPrice % product.step_price
          if (bidPrice > (self.auctionConfigs['max_bid'] || MAX_BID)) {
            self._emitUser(data.id, { type: 'error', msg: 'You bidded too big!!! Max:' + (self.auctionConfigs['max_bid'] || MAX_BID) }, 'server_message')
            self._emitUser(data.id, {success: false, productId: product.id}, 'bid_message')
            return
          }
          let isValidBid = false
          let bids = product.bids || []
          let msg = 'Invalid Bid'
          if (bids.length) {
            let maxPrice = bids[0].bid_price + product.step_price
            console.log(userId, product.id, bidPrice, maxPrice)
            if (maxPrice <= bidPrice) {
              isValidBid = true
            } else {
              msg = 'You should bid at least ' + maxPrice
            }
          } else if (bidPrice >= product.start_price) {
            console.log(userId, product.id, bidPrice)
            isValidBid = true
          } else {
            msg = 'You should bid at least ' + product.start_price
          }
          if (isValidBid) {
            if (product.round) {
              product.round.end_at = now + this._getRoundTime(product, 1)
              product.round.num = 1
              product.round.bidder = userId
              product.round.bid_price = bidPrice
            } else {
              product.round = {
                num: 1,
                bidder: userId,
                bid_price: bidPrice,
                end_at: now + this._getRoundTime(product, 1)
              }
            }
            bids.unshift({
              user_id: data.id,
              product_id: params.product_id,
              bid_price: bidPrice,
              placed_at: now
            })
            if (product.bidders.indexOf(data.id) < 0) {
              product.bidders.push(data.id)
            }
            product.bids = bids.slice(0, 4)
            self.products[params.product_id] = product
            AuctionBids.create({
              user_id: data.id,
              product_id: params.product_id,
              bid_price: bidPrice,
              placed_at: now
            }).then(bid => {
              self._emitUser(data.id, {success: true, productId: product.id}, 'bid_message')
              self._broadCastToAuctionRoom([self.products[params.product_id]])
            })
          } else {
            console.warn('wrong bid', data.id, params)
            self._emitUser(data.id, {type: 'error', msg: msg}, 'server_message')
            self._emitUser(data.id, {success: false, productId: product.id}, 'bid_message')
          }
          break
        case 'refresh':
          self._refresh(data.id)
          break
      }
    })
  }
  restart () {
    this.activeAuctions = []
    this.products = {}
    clearTimeout(this.tickerHandler)
    this.start()
  }
  _refresh (userId) {
    let self = this
    self._emitUser(userId, Object.values(self.products))
    if (!self.userDB[userId]) {
      User.findById(userId).then(user => {
        if (!user) return null
        self.userDB[userId] = {
          name: user.name,
          image_url: user.image_url
        }
        self._broadCastToAuctionRoom(self.userDB, 'users')
      })
    }
    self._emitUser(userId, self.userDB, 'users')
  }

  _emitUser (userId, products, event = 'auction') {
    if (!userId) {
      console.error('Emit order null userid')
    }
    if (this.activeUsers[userId] && this.activeUsers[userId].socket.length) {
      console.log(new Date(), userId, event, JSON.stringify(products).substring(0, 100))
      this.activeUsers[userId].socket.forEach(socket => socket.emit(event, products))
    }
  }
  _broadCastToAuctionRoom (data, event = 'auction') {
    if (this.io) {
      console.log('broadcast', event)
      this.io.to('auction_room').emit(event, data)
    }
  }
  start () {
    console.log('Initializing....')
    let self = this
    let service = new ProductService()
    let now = parseInt(new Date().getTime() / 1000)
    User.findAll().then(users => {
      users.forEach(user => {
        self.userDB[user.id] = {
          name: user.name,
          image_url: user.image_url
        }
      })
    })

    AuctionConfigs.findAll().then(result => {
      result.forEach(config => {
        self.auctionConfigs[config.key] = config.value
      })
      // console.log('Config:', self.auctionConfigs)
      service.getSelling().then(products => {
        let queries = products.map(product => {
          return AuctionBids.findAll({
            where: {
              product_id: product.id
            },
            order: [
              ['bid_price', 'desc']
            ]
          }).then(bids => {
            let p = product
            p.bidders = []
            if (bids.length) {
              p.bidders = underscore.uniq(bids.map(bid => bid.user_id))
              p.bids = bids.slice(0, 4)

              p.round = {
                bidder: bids[0].user_id,
                bid_price: bids[0].bid_price,
                num: 1,
                end_at: bids[0].placed_at + self._getRoundTime(p, 1)
              }
            }
            self.products[p.id] = p
            return p
          })
        })
        Promise.all(queries).then(ps => {
          console.log(`
Initialized. Start Processing Auctions.
          Configs[${JSON.stringify(self.auctionConfigs)}] 
          Products[${Object.keys(self.products).length}] 
          Users[${Object.keys(self.userDB).length}]`)
          self._broadCastToAuctionRoom(Object.values(self.products))
          self._startTicker()
        })
      })
    })
  }
  _getRoundTime (product, num) {
    return product['round_time_' + num] || this.auctionConfigs['round_time_' + num]
  }
  _startTicker () {
    let self = this
    this.tickerHandler = setTimeout(() => {
      self._proccessAuction(self._startTicker.bind(this))
    }, 1000)
  }
  _proccessAuction (callback) {
    let self = this
    let now = parseInt(new Date().getTime() / 1000)
    let needBroadCastProducts = []
    Object.values(this.products).forEach(product => {
      if (product.start_at > now || product.status === 'finished') {
        // not started or done
        // can validated data
        return
      }
      // if single auction and there is ongoing auction
      let maxAuction = self.auctionConfigs['multi_auction_same_time'] || 1
      if (self.activeAuctions.length >= maxAuction && self.activeAuctions.indexOf(product.id) < 0) {
        return
      }

      let needBroadcast = false
      if (product.status === 'waiting') {
        self.activeAuctions.push(product.id)
        product.status = 'bidding'
        needBroadcast = true
        // console.log('changeStatus')
      }
      if (self.auctionConfigs['auto_start'] && !product.round) {
        product.round = {
          bidder: 0,
          bid_price: 0,
          num: 1,
          end_at: now + self._getRoundTime(product, 1)
        }
        needBroadcast = true
      }
      // if round is activating
      if (product.round) {
        // if this round is end, go to next round
        if (product.round.end_at < now) {
          product.round.num++
          // console.log('change round')
          needBroadcast = true
        } else if (!needBroadcast) {
          return
        }
        // if next round has life time
        if (self._getRoundTime(product, product.round.num)) {
          product.round.end_at = now + self._getRoundTime(product, product.round.num)

          needBroadcast = true
          // console.log('change rouyntTime')
        } else {
          // end of round, finish auction
          this.activeAuctions.splice(this.activeAuctions.indexOf(product.id), 1)
          // console.log('change finished', this.activeAuctions)
          product.status = 'finished'
          product.winner_id = product.round.bidder
          product.win_price = product.round.bid_price
          Products.update({
            updated_at: now,
            status: 'finished',
            winner_id: product.round.bidder,
            win_price: product.round.bid_price
          }, {where: {
            id: product.id
          }})
          needBroadcast = true
        }
      } else {
        // no one bid
      }
      if (needBroadcast) {
        needBroadCastProducts.push(product)
      }
    })
    if (needBroadCastProducts.length > 0) {
      // console.log('needBroadCastProducts', needBroadCastProducts.length)
      this._broadCastToAuctionRoom(needBroadCastProducts)
      needBroadCastProducts = []
    }
    callback()
  }
}

const instance = new AuctionBot()
// Object.freeze(instance)

export default instance
