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
  role: {type: Sequelize.STRING, defaultValue: 'user'}
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
  start_at: {type: Sequelize.INTEGER, defaultValue: 1890691200},
  start_price: {type: Sequelize.INTEGER, defaultValue: 10000},
  step_price: {type: Sequelize.INTEGER, defaultValue: 1000},
  round_time_1: {type: Sequelize.INTEGER, defaultValue: 360},
  round_time_2: {type: Sequelize.INTEGER, defaultValue: 60},
  round_time_3: {type: Sequelize.INTEGER, defaultValue: 30},
  status: {type: Sequelize.INTEGER, defaultValue: 1},
  seller_id: Sequelize.INTEGER,
  winner_id: Sequelize.INTEGER,
  win_price: Sequelize.INTEGER,
  updated_at: Sequelize.INTEGER,
  created_at: Sequelize.INTEGER,
  auto_start: {type: Sequelize.BOOLEAN, defaul: false}
}, {
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['ams_code']
    },
    {name: 'updated_at', fields: ['updated_at']},
    {name: 'start_at', fields: ['start_at']},
    {name: 'status', fields: ['status']},
    {name: 'seller_id', fields: ['seller_id']},
    {name: 'winner_id', fields: ['winner_id']}
  ]
})

const ProductImages = sequelize.define('product_image', {
  product_id: Sequelize.INTEGER,
  src: Sequelize.TEXT,
  caption: Sequelize.TEXT
}, {
  timestamps: false,
  indexes: [
    {name: 'product_id', fields: ['product_id']}
  ]
})

const AuctionBids = sequelize.define('auction_bid', {
  product_id: Sequelize.INTEGER,
  user_id: Sequelize.INTEGER,
  placed_at: Sequelize.INTEGER,
  bid_price: Sequelize.INTEGER
}, {
  timestamps: false,
  indexes: [
    {name: 'product_user', fields: ['product_id', 'user_id']},
    {name: 'price', fields: ['bid_price']}
  ]
})
const AuctionConfigs = sequelize.define('auction_config', {
  key: {type: Sequelize.STRING, primaryKey: true},
  value: Sequelize.INTEGER,
  raw_value: Sequelize.STRING
}, {
  timestamps: false
})
const Notices = sequelize.define('notice', {
  title: Sequelize.STRING,
  start_at: Sequelize.INTEGER,
  content: Sequelize.TEXT
}, {
  timestamps: false,
  indexes: [
    {name: 'start_at', fields: ['start_at']}
  ]
})

const ChatMessage = sequelize.define('chat_message', {
  user_id: Sequelize.INTEGER,
  created_at: Sequelize.INTEGER,
  message: Sequelize.STRING
}, {
  timestamps: false,
  indexes: [
    {name: 'created_at', fields: ['created_at']}
  ]
})

const Announcement = sequelize.define('announcement', {
  display_to: Sequelize.INTEGER,
  created_at: Sequelize.INTEGER,
  message: Sequelize.STRING
}, {
  timestamps: false,
  indexes: [
    {name: 'created_at', fields: ['created_at']},
    {name: 'display_to', fields: ['display_to']}
  ]
})

const AutoBid = sequelize.define('auto_bid', {
  user_id: {type: Sequelize.INTEGER, primaryKey: true},
  product_id: {type: Sequelize.INTEGER, primaryKey: true},
  price: Sequelize.INTEGER
}, {
  timestamps: false
})
module.exports = {
  sequelize,
  User,
  Products,
  ProductImages,
  AuctionBids,
  Notices,
  AuctionConfigs,
  AutoBid,
  Announcement,
  ChatMessage
}
