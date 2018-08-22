import bcrypt from 'bcrypt'
const passport = require('passport')
const {User, AuctionConfigs} = require('../Models/index')
const JwtStrategy = require('passport-jwt').Strategy
var LocalStrategy = require('passport-local').Strategy
var ExtractJwt = require('passport-jwt').ExtractJwt
const config = require('../config/config.js')
var GoogleTokenStrategy = require('passport-google-token').Strategy

require('dotenv').config()
passport.serializeUser(function (user, done) {
  done(null, user.id)
})

passport.deserializeUser(function (id, done) {
  User.findOne({
    where: {
      id: id
    }
  }).then(function (user) {
    done(null, user)
  }).catch(function (err) {
    console.error(err)
  })
})

passport.use(new LocalStrategy(
  function (username, password, done) {
    User.findOne({
      where: {
        username: username
      }
    }).then(user => {
      if (!user) {
        return done(null, false, { message: 'Incorrect username and password' })
      } else {
        // check if password matches
        bcrypt.compare(password, user.password, function (err, result) {
          if (err) { return done(err) }
          if (!result) {
            return done(null, false, { message: 'Incorrect username and password' })
          }
          let now = parseInt(new Date().getTime() / 1000)
          user.logged_at = now
          user.save()
          return done(null, user)
        })
      }
    }).catch(err => {
      console.error(err)
      return done(null, false, { message: 'Incorrect username and password' })
    })
  }
))
//
var opts = {}
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme('jwt')

opts.secretOrKey = config.secret
passport.use(new JwtStrategy(opts, function (jwtPayload, done) {
  User.findOne({
    where: {
      id: jwtPayload.id
    }
  }).then(user => {
    if (user) {
      done(null, user)
    } else {
      done(null, false)
    }
  }).catch(err => {
    return done(err, false)
  })
}))

passport.use(new GoogleTokenStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET
  // callbackURL: `${process.env.ROOT_URL || 'http://localhost:3000'}/auth/google/callback`
},
  function (accessToken, refreshToken, profile, done) {
    console.log(profile)
    var email = profile._json.email
    var domain = profile._json.hd
    var userName = email.replace('@' + domain, '')
    AuctionConfigs.findOne({
      where: {
        key: 'limit_domain'
      }
    }).then(config => {
      if (config && config.raw_value && domain !== config.raw_value) {
        return done(null, false, {message: 'Invalid email domain. Please try again'})
      } else {
        User.findOrCreate({
          where: {
            email: profile._json.email
          },
          defaults: {
            username: userName,
            name: profile.displayName,
            image_url: profile._json.picture,
            google_id: profile.id,
            role: 'user'
          }
        }).spread((user, created) => {
          if (!user) {
            return done(null, false, { message: 'Incorrect username and password' })
          }
          if (created) {
            user.password = bcrypt.hashSync('123456', 10)
          }
          if (user.username !== userName) user.username = userName
          user.name = profile.displayName
          user.image_url = profile._json.picture
          user.google_id = profile.id
          let now = parseInt(new Date().getTime() / 1000)
          user.logged_at = now
          user.save()
          return done(null, user)
        }).catch(err => {
          return done(err, false)
        })
      }
    })
  }
))

module.exports = passport
