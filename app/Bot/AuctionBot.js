import ProductService from '../Services/ProductService'
import { AuctionBids, AuctionConfigs, Products, User, AutoBid } from '../Models'
import underscore from 'underscore'
import Const from '../config/config'
import SocketManager from './SocketManager'

const MAX_BID = 1000000000 // 1bil
class AuctionBot {
  constructor () {
    // Authenticated client, can make signed calls
    this.userDB = {}
    this.products = {}
    this.activeAuctions = []
    this.auctionConfigs = {}
    this.tickerHandler = false
    this.bidQueue = []
    this.autoBidQueues = {}
    this.service = new ProductService()
    let self = this
    setTimeout(() => {
      self.start()
    }, 2000)
  }
  restart () {
    this.activeAuctions = []
    this.bidQueue = []
    this.products = {}
    clearTimeout(this.tickerHandler)
    this.start()
  }

  _refresh (userId) {
    let self = this
    self._emitUser(userId, Object.values(self.products))
    AutoBid.findAll({
      where: {
        user_id: userId
      }
    }).then(autoBids => {
      self._emitUser(userId, autoBids, 'autoBids')
    })
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

  _emitUser (userId, data, event = 'auction') {
    SocketManager._emitUser(userId, data, event)
  }
  _broadCastToAuctionRoom (data, event = 'auction') {
    SocketManager._broadCastToAuctionRoom(data, event)
  }
  start () {
    console.log('Initializing....')
    let self = this
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
      self.service.botGetSelling().then(products => {
        let queries = products.map(product => {
          return self._addProductToQueue(product)
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
  addABid (params) {
    let self = this
    let userId = params.userId
    let now = parseInt(new Date().getTime() / 1000)
    let product = self.products[params.product_id]
    if (userId === product.seller_id) {
      self._emitUser(userId, {type: 'error', msg: 'You can\'t bid your product!'}, 'server_message')
      self._emitUser(userId, {success: false}, 'bid_message')
      return false
    }
    if (!product || product.start_at >= now) {
      self._emitUser(userId, {type: 'error', msg: 'Product is not valid!!!'}, 'server_message')
      self._emitUser(userId, {success: false}, 'bid_message')
      return false
    } else if (product.finished) {
      self._emitUser(userId, {type: 'error', msg: 'Product has been sold!!!'}, 'server_message')
      self._emitUser(userId, {success: false, productId: product.id}, 'bid_message')
      return false
    }
    params.bid_price = parseInt(params.bid_price)
    params.bid_price = params.bid_price - params.bid_price % product.step_price
    if (params.bid_price > (self.auctionConfigs['max_bid'] || MAX_BID)) {
      self._emitUser(userId, { type: 'error', msg: 'you_bid_too_much', msgParams: {max: self.auctionConfigs['max_bid'] || MAX_BID} }, 'server_message')
      self._emitUser(userId, {success: false, productId: product.id}, 'bid_message')
      return false
    }
    self.bidQueue.push(params)
    return true
  }

  addAutoBid (params) {
    let self = this
    let userId = params.userId
    let now = parseInt(new Date().getTime() / 1000)
    let product = self.products[params.product_id]
    if (userId === product.seller_id) {
      self._emitUser(userId, {type: 'error', msg: 'You can\'t bid your product!'}, 'server_message')
      self._emitUser(userId, {success: false}, 'auto_bid_message')
      return
    }
    if (!product) {
      self._emitUser(userId, {type: 'error', msg: 'Product is not valid!!!'}, 'server_message')
      self._emitUser(userId, {success: false}, 'auto_bid_message')
      return
    } else if (product.finished) {
      self._emitUser(userId, {type: 'error', msg: 'Product has been sold!!!'}, 'server_message')
      self._emitUser(userId, {success: false, productId: product.id}, 'auto_bid_message')
      return
    }
    params.auto_bid_price = parseInt(params.auto_bid_price)
    params.auto_bid_price = params.auto_bid_price - params.auto_bid_price % product.step_price
    if (params.auto_bid_price > (self.auctionConfigs['max_bid'] || MAX_BID)) {
      self._emitUser(userId, { type: 'error', msg: 'you_bid_too_much', msgParams: {max: self.auctionConfigs['max_bid'] || MAX_BID} }, 'server_message')
      self._emitUser(userId, {success: false, productId: product.id}, 'auto_bid_message')
      return
    }
    if(params.auto_bid_price < product.start_price) {
      self._emitUser(userId, { type: 'error', msg: 'you_should_autobid_at_least', msgParams: {value: product.start_price} }, 'server_message')
      self._emitUser(userId, {success: false, productId: product.id}, 'auto_bid_message')
      return
    }
    let data = {
      user_id: userId,
      product_id: product.id,
      price: params.auto_bid_price
    }

    AutoBid.upsert(data).then((autoBid) => {
      if (!self.autoBidQueues[product.id]) {
        self.autoBidQueues[product.id] = []
      }
      self._emitUser(userId, {type: 'info', msg: 'autobid_is_placed'}, 'server_message')
      self._emitUser(userId, {success: true, productId: product.id}, 'auto_bid_message')
      self._emitUser(userId, [data], 'autoBids')
      self.autoBidQueues[product.id].push(data)
    })
    return true
  }
  _placeAutoBidToBidQueue (productId) {
    let self = this
    if (self.autoBidQueues[productId]) {
      // Remove small price auto bid
      let stop = false
      while (!stop) {
        let product = self.products[productId]
        let nextPrice = (product.round ? product.round.bid_price  + product.step_price : product.start_price)
        self.autoBidQueues[productId] = self.autoBidQueues[productId].filter(bid => bid.price >= nextPrice)
        let bids = self.autoBidQueues[productId].filter(bid => !product.round || bid.user_id !== product.round.bidder)
        if (bids.length) {
          let bid = bids[0]
          stop = self.addABid({
            userId: bid.user_id,
            bid_price: nextPrice,
            product_id: productId
          })
        } else {
          if(self.autoBidQueues[productId].length > 0){
            console.log('productId nonvalid at price', nextPrice, JSON.stringify(self.autoBidQueues[productId]) )
          }
          stop = true
        }
      }
    }
  }
  _addProductToQueue (product) {
    let self = this
    AutoBid.findAll({
      where: {
        product_id: product.id
      }
    }).then(autobids => {
      if (!self.autoBidQueues[product.id]) {
        self.autoBidQueues[product.id] = []
      }
      self.autoBidQueues[product.id] = self.autoBidQueues[product.id].concat(autobids)
      return AuctionBids.findAll({
        where: {
          product_id: product.id
        },
        order: [
          ['bid_price', 'desc']
        ]
      })
    }).then(bids => {
      product.bidders = []
      if (bids.length) {
        product.bidders = underscore.uniq(bids.map(bid => bid.user_id))
        product.bids = bids.slice(0, 4)

        product.round = {
          bidder: bids[0].user_id,
          bid_price: bids[0].bid_price,
          num: 1,
          end_at: bids[0].placed_at + self._getRoundTime(product, 1)
        }
      }
      console.log('Add Product:', product.id, JSON.stringify(product.name), JSON.stringify(product.ams_code), self.autoBidQueues[product.id].length)
      self.products[product.id] = product
      return product
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
  _processBids () {
    while (this.bidQueue.length) {
      let bid = this.bidQueue.shift()
      this._processABid(bid)
    }
  }
  _processABid (params) {
    let self = this
    let now = parseInt(new Date().getTime() / 1000)
    let product = self.products[params.product_id]
    let isValidBid = false
    let bids = product.bids || []
    let msg = 'Invalid Bid'
    let userId = params.userId
    if (!userId) return
    if (bids.length) {
      let maxPrice = bids[0].bid_price + product.step_price
      if (maxPrice <= params.bid_price) {
        isValidBid = true
      } else {
        msg = 'You should bid at least ' + maxPrice
      }
    } else if (params.bid_price >= product.start_price) {
      isValidBid = true
    } else {
      msg = 'You should bid at least ' + product.start_price
    }
    if (isValidBid) {
      Products.update({
        updated_at: now,
        status: Const.PRODUCT_STATUS.BIDDING
      }, {where: {
        id: product.id
      }})
      product.status = Const.PRODUCT_STATUS.BIDDING
      if (product.round) {
        product.round.end_at = now + this._getRoundTime(product, 1)
        product.round.num = 1
        product.round.bidder = userId
        product.round.bid_price = params.bid_price
      } else {
        product.round = {
          num: 1,
          bidder: userId,
          bid_price: params.bid_price,
          end_at: now + this._getRoundTime(product, 1)
        }
      }
      bids.unshift({
        user_id: userId,
        product_id: params.product_id,
        bid_price: params.bid_price,
        placed_at: now
      })
      if (product.bidders.indexOf(userId) < 0) {
        product.bidders.push(userId)
      }
      product.bids = bids.slice(0, 4)
      self.products[params.product_id] = product
      self._emitUser(userId, {success: true, productId: product.id}, 'bid_message')
      self._broadCastToAuctionRoom([self.products[params.product_id]])
      AuctionBids.create({
        user_id: userId,
        product_id: params.product_id,
        bid_price: params.bid_price,
        placed_at: now
      }).then(bid => {
        console.warn('BID PLACED', JSON.stringify(bid.get()))
      })
    } else {
      console.warn('wrong bid', userId, JSON.stringify(params))
      self._emitUser(userId, {type: 'error', msg: msg}, 'server_message')
      self._emitUser(userId, {success: false, productId: product.id}, 'bid_message')
    }
  }
  _proccessAuction (callback) {
    this._processBids()
    let self = this
    let parallelFuncs = Object.keys(this.products).map(productId => {
      return new Promise((resolve, reject) => {
        let result = self._processAProduct(productId)
        resolve(result)
      })
    })
    Promise.all(parallelFuncs).then(result => {
      let needBroadCastProducts = result.filter(e => e)
      if (needBroadCastProducts.length > 0) {
        // console.log('needBroadCastProducts', needBroadCastProducts.length)
        this._broadCastToAuctionRoom(needBroadCastProducts)
        needBroadCastProducts = []
      }
      callback()
    })
  }

  _processAProduct (productId) {
    let now = parseInt(new Date().getTime() / 1000)
    let self = this
    let product = self.products[productId]

    if (!product || product.start_at > now) {
            // not started or done
      return null
    }
    let index = self.activeAuctions.indexOf(product.id)
    if (product.status === Const.PRODUCT_STATUS.FINISHED || product.status === Const.PRODUCT_STATUS.REMOVED || product.status === Const.PRODUCT_STATUS.HIDE) {
            // remove from mem

      if (index >= 0) {
        self.activeAuctions.splice(index, 1)
      }
      delete self.products[product.id]
      return null
    }
          // if single auction and there is ongoing auction
    let maxAuction = self.auctionConfigs['multi_auction_same_time'] || 1

    let needBroadcast = false
    if ((product.status === Const.PRODUCT_STATUS.BIDDING || product.status === Const.PRODUCT_STATUS.AUCTIONING) && index < 0) {
      console.log(`Active Status ${product.id}`)
      self.activeAuctions.push(product.id)
    } else if (self.activeAuctions.length >= maxAuction && index < 0) {
      return null
    } else if (self.activeAuctions.length < maxAuction && index < 0 && product.status === Const.PRODUCT_STATUS.WAITING) {
      console.log(`Active Status ${product.id}`)
      self.activeAuctions.push(product.id)
      product.status = Const.PRODUCT_STATUS.AUCTIONING
      product.updated_at = now
      Products.update({
        updated_at: now,
        status: Const.PRODUCT_STATUS.AUCTIONING
      }, {where: {
        id: product.id
      }})
      needBroadcast = true
    }
    if ((product.auto_start || self.auctionConfigs['auto_start']) && !product.round) {
      product.round = {
        bidder: 0,
        bid_price: 0,
        num: 1,
        end_at: now + self._getRoundTime(product, 1)
      }
      product.status = Const.PRODUCT_STATUS.BIDDING
      Products.update({
        updated_at: now,
        status: Const.PRODUCT_STATUS.BIDDING
      }, {where: {
        id: product.id
      }})
      needBroadcast = true
    }
          // if round is activating
    if (product.round) {
            // if this round is end, go to next round
      if (product.round.end_at < now) {
        product.round.num++
        self._placeAutoBidToBidQueue(product.id)
        needBroadcast = true
      } else if (!needBroadcast) {
        return null
      }
            // if next round has life time
      if (self._getRoundTime(product, product.round.num)) {
        product.round.end_at = now + self._getRoundTime(product, product.round.num)

        needBroadcast = true
              // console.log('change rouyntTime')
      } else {
              // end of round, finish auction
        this.activeAuctions.splice(index, 1)
              // console.log('change finished', this.activeAuctions)
        product.status = Const.PRODUCT_STATUS.FINISHED
        product.winner_id = product.round.bidder
        product.win_price = product.round.bid_price
        Products.update({
          updated_at: now,
          status: Const.PRODUCT_STATUS.FINISHED,
          winner_id: product.round.bidder,
          win_price: product.round.bid_price
        }, {where: {
          id: product.id
        }})
        needBroadcast = true
      }
    } else {
            // no one bid
      self._placeAutoBidToBidQueue(product.id)
    }
    if (needBroadcast) {
      return product
    } return null
  }

  // seller
  sellerGet (data) {
    let self = this
    self.service.getProductsBySeller(data.id, data.role === 'admin').then(result => {
      self._emitUser(data.id, {success: true, products: result}, 'seller_message')
    })
  }

  sellerUpdate (data, params) {
    let self = this
    params.user_id = data.id
    self.service.update(params).then(result => {
      if (result instanceof Error) {
        self._emitUser(data.id, {success: false, msg: result.message}, 'seller_message')
        return
      }
      console.log('result', JSON.stringify(result))
      let product = result
      self._addProductToQueue(product)
      self._broadCastToAuctionRoom([product])
      self._emitUser(data.id, {success: true, msg: 'update_product_success', msgParams: {id: params.id}, product}, 'seller_message')
    }).catch(error => {
      console.error(error)
      self._emitUser(data.id, {success: false, msg: error.message}, 'seller_message')
    })
  }
}

const instance = new AuctionBot()
// Object.freeze(instance)

export default instance
