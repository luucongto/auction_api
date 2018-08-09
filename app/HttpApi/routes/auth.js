
import passport from 'passport'
var User = require('../../Models').User
var settings = require('../../config/config')
var jwt = require('jsonwebtoken')
var express = require('express')

var router = express.Router()
var createToken = function (auth) {
  var token = jwt.sign(JSON.stringify({
    id: auth.id,
    logged_at: auth.logged_at
  }), settings.secret)
  return token
}

var generateToken = function (req, res, next) {
  req.token = createToken(req.auth)
  return next()
}
var sendToken = function (req, res) {
  return res.json({
    success: true,
    token: req.token,
    id: req.user.id,
    name: req.user.name,
    isSeller: req.user.role === 'seller' || req.user.role === 'admin',
    isAdmin: req.user.role === 'admin'
  })
}

router.post('/login',
  passport.authenticate('local'),
  function (req, res, next) {
    if (!req.user) {
      return res.send(401, 'User Not Authenticated')
    }
    req.auth = {
      id: req.user.id,
      logged_at: req.user.logged_at
    }
    next()
  }, generateToken, sendToken
)

router.post('/auth/google',
  passport.authenticate('google-token', {session: false}),
  function (req, res, next) {
    if (!req.user) {
      return res.send(401, 'User Not Authenticated')
    }
    req.auth = {
      id: req.user.id,
      logged_at: req.user.logged_at
    }

    next()
  }, generateToken, sendToken
)

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect('/')
  }
)

router.get('/logout', [passport.authenticate('jwt')], (req, res) => {
  User.findOne({
    where: {
      id: req.user.id
    }
  }).then(user => {
    user.logged_at = new Date().getTime()
    user.save()
    req.logout()
    res.send({
      success: true,
      data: 'Logged out'
    })
  })
})

module.exports = router
