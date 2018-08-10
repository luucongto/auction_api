require('dotenv').config()
const Sequelize = require('sequelize')
const connectionString = process.env.CLEARDB_DATABASE_URL || 'mysql://root@localhost:3306/auction?reconnect=true'
const sequelize = new Sequelize(connectionString, {
  logging: false
})

// const sequelize = new Sequelize('socket', 'root', '', {
//   host: 'localhost',
//   port: 33306,
//   dialect: 'mysql',
//   pool: {
//     max: 5,
//     min: 0,
//     acquire: 30000,
//     idle: 10000
//   },
//   operatorsAliases: false
// })

const User = sequelize.define('user', {
  username: Sequelize.STRING,
  name: Sequelize.STRING,
  email: Sequelize.STRING,
  google_id: Sequelize.STRING,
  image_url: Sequelize.STRING,
  logged_at: Sequelize.INTEGER,
  password: Sequelize.STRING,
  socketid: Sequelize.STRING,
  roomsocketid: Sequelize.STRING,
  role: {type: Sequelize.STRING, default: 'user'}
}, {
  indexes: [
    // Create a unique index on email
    {
      unique: true,
      fields: ['email', 'username', 'google_id']
    },
    { name: 'username', fields: ['username'] },
    { name: 'email', fields: ['email'] },
    { name: 'google_id', fields: ['google_id'] }
  ]
})

const Products = sequelize.define('product', {
  name: Sequelize.STRING,
  category: Sequelize.STRING,
  ams_code: Sequelize.STRING,
  start_at: {type: Sequelize.INTEGER, default: 0},
  start_price: {type: Sequelize.INTEGER, default: 10000},
  step_price: {type: Sequelize.INTEGER, default: 1000},
  round_time_1: {type: Sequelize.INTEGER, default: 360},
  round_time_2: {type: Sequelize.INTEGER, default: 60},
  round_time_3: {type: Sequelize.INTEGER, default: 30},
  status: {type: Sequelize.STRING, default: 'waiting'},
  seller_id: Sequelize.INTEGER,
  winner_id: Sequelize.INTEGER,
  win_price: Sequelize.INTEGER,
  updated_at: Sequelize.INTEGER
}, {
  indexes: [
    {name: 'updated_at', fields: ['updated_at']}
  ]
})

const ProductImages = sequelize.define('product_image', {
  product_id: Sequelize.INTEGER,
  src: Sequelize.TEXT,
  caption: Sequelize.TEXT
})

const AuctionBids = sequelize.define('auction_bid', {
  product_id: Sequelize.INTEGER,
  user_id: Sequelize.INTEGER,
  placed_at: Sequelize.INTEGER,
  bid_price: Sequelize.INTEGER
}, {
  indexes: [
    {name: 'product_user', fields: ['product_id', 'user_id']},
    {name: 'price', fields: ['bid_price']}
  ]
})
const AuctionConfigs = sequelize.define('auction_config', {
  key: Sequelize.STRING,
  value: Sequelize.INTEGER
})
const Notices = sequelize.define('notice', {
  title: Sequelize.STRING,
  start_at: Sequelize.INTEGER,
  content: Sequelize.TEXT
}, {
  indexes: [
    {name: 'start_at', fields: ['start_at']}
  ]
})
module.exports = {
  sequelize,
  User,
  Products,
  ProductImages,
  AuctionBids,
  Notices,
  AuctionConfigs
}
