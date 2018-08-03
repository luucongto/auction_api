var jwt = require('jsonwebtoken')
var fs = require('fs')
let settings = require('../app/config/config')
let startAt = 0
let users = []
let tokens = []
let {User} = require('../app/Models')
for (var i = 1; i < 500; i++) {
  let id = startAt + i
  users.push(User.create({
    username: 'test' + id,
    name: 'test' + id,
    email: id + '@punch.vn',
    image_url: 'https://punch-auction.herokuapp.com/static/media/Punch_Logo.e53b4a96.png',
    role: 'user'
  }))
}
Promise.all(users).then(users => {
  tokens = users.map(user => {
    return jwt.sign(JSON.stringify({
      id: user.id
    }), settings.secret)
  })
  fs.writeFileSync('userTokens.js', 'module.exports = ' + JSON.stringify(tokens))
})
