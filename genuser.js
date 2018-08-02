let results = []
var jwt = require('jsonwebtoken')
var fs = require('fs')
let settings = require('./app/config/config')
let startAt = 1000
let users = []
for (var i = 1; i < 500; i++) {
  let id = startAt + i
  results.push(
    `(${id}, 'test${i}', 'test${id}', 'test${id}', '', 'https://lh3.googleusercontent.com/-cmw0IEBNpWA/AAAAAAAAAAI/AAAAAAAAAAA/AAnnY7r74xANCMn7HEbm-P9D93Our7jc-A/mo/photo.jpg', 'user')`
  )
  var token = jwt.sign(JSON.stringify({
    id: id
  }), settings.secret)
  users.push(token)
}
fs.writeFileSync('userTokens.js', 'module.exports = ' + JSON.stringify(users))
console.log(
  'INSERT INTO `users` (`id`, `username`, `name`, `email`, `google_id`, `image_url`, `role`) VALUES ',
  results.join(',')
)
