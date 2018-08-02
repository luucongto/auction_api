import ProductService from '../Services/ProductService'
import { AuctionBids, AuctionConfigs, Products, User } from '../Models'
import {Op} from 'sequelize'
import underscore from 'underscore'
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
  }
  setIo (io) {
    this.io = io
  }
  setUser (data) {
    let self = this
    let userId = data.id
    if (this.activeUsers[userId]) {
      this.activeUsers[userId].socket = data.socket
    } else {
      this.activeUsers[userId] = {
        socket: data.socket,
        api: null
      }
    }

    this._refresh(userId)
    data.socket.on('auction', params => {
      switch (params.command) {
        case 'placeBid':
          let now = parseInt(new Date().getTime() / 1000)
          let product = self.products[params.product_id]
          if (!product || product.start_at >= now || product.finished) return
          let bidPrice = parseInt(params.bid_price)
          let isValidBid = false
          let bids = product.bids || []
          if (bids.length) {
            if ((bids[0].bid_price + product.step_price) <= bidPrice) {
              isValidBid = true
            }
          } else if (bidPrice >= product.start_price) {
            isValidBid = true
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
              bid_price: params.bid_price,
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
              bid_price: params.bid_price,
              placed_at: now
            }).then(bid => {
              self.broadCast([self.products[params.product_id]])
            })
          }

          break
        case 'refresh':
          self._refresh(data.id)
          break
      }
    })
  }

  _refresh (userId) {
    let self = this
    self.emitUser(userId, Object.values(self.products))
    if (!self.userDB[userId]) {
      User.findById(userId).then(user => {
        if (!user) return null
        self.userDB[userId] = {
          name: user.name,
          image_url: user.image_url
        }
        self.broadCast(self.userDB, 'users')
      })
    }
    self.emitUser(userId, self.userDB, 'users')
  }

  emitUser (userId, products, event = 'auction') {
    if (!userId) {
      console.error('Emit order null userid')
    }
    if (this.activeUsers[userId] && this.activeUsers[userId].socket) {
      this.activeUsers[userId].socket.emit(event, products)
    }
  }
  broadCast (data, event = 'auction') {
    if (this.io) {
      console.log('broadcast', event, JSON.stringify(data))
      this.io.to('auction_room').emit(event, data)
    }
  }
  start () {
    console.log('Initializing.... REAL: ' + process.env.REAL_API)
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
      console.log('Config:', self.auctionConfigs)
      service.getAll().then(products => {
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
            } else if (self.auctionConfigs['auto_start']) {
              p.round = {
                bidder: 0,
                bid_price: 0,
                num: 1,
                end_at: now + self._getRoundTime(p, 1)
              }
            }
            self.products[p.id] = p
            return p
          })
        })
        Promise.all(queries).then(ps => {
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
    setTimeout(() => {
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
        console.log('changeStatus')
      }
      // if round is activating
      if (product.round) {
        // if this round is end, go to next round
        if (product.round.end_at < now) {
          product.round.num++
          console.log('change round')
          needBroadcast = true
        } else {
          return
        }
        // if next round has life time
        if (self._getRoundTime(product, product.round.num)) {
          product.round.end_at = now + self._getRoundTime(product, product.round.num)

          needBroadcast = true
          console.log('change rouyntTime')
        } else {
          // end of round, finish auction
          this.activeAuctions.splice(this.activeAuctions.indexOf(product.id), 1)
          console.log('change finished', this.activeAuctions)
          product.status = 'finished'
          product.winner_id = product.round.bidder
          product.win_price = product.round.bid_price
          Products.update({
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
      console.log('needBroadCastProducts', needBroadCastProducts.length)
      this.broadCast(needBroadCastProducts)
      needBroadCastProducts = []
    }
    callback()
  }
}

const instance = new AuctionBot()
// Object.freeze(instance)

export default instance
