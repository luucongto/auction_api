
import passport from 'passport'
import AdminService from '../../Services/AdminService'
import AnnouncementSystem from '../../Bot/AnnouncementSystem'
var express = require('express')
var router = express.Router()
let verifyAdmin = (req, res, next) => {
  if (req.user.role === 'admin') {
    next()
  } else {
    res.send(401)
  }
}
router.get('/apisetting', [passport.authenticate('jwt'), verifyAdmin], (req, res, next) => {
  AdminService.get().then(configs => {
    res.send({
      success: true,
      data: configs
    })
  }).catch(error => {
    console.error(error)
    res.send({
      success: false,
      error: error.message
    })
  })
})
router.post('/apisetting', [passport.authenticate('jwt'), verifyAdmin], (req, res, next) => {
  let params = {}
  if (req.body.max_bid !== undefined) params.max_bid = parseInt(req.body.max_bid)
  if (req.body.auto_start !== undefined) params.auto_start = req.body.auto_start
  if (req.body.multi_auction_same_time) params.multi_auction_same_time = parseInt(req.body.multi_auction_same_time)
  AdminService.post(params).then(configs => {
    res.send({
      success: true,
      data: configs
    })
  }).catch(error => {
    console.error(error)
    res.send({
      success: false,
      error: error.message
    })
  })
})

router.post('/announce', [passport.authenticate('jwt'), verifyAdmin], (req, res, next) => {
  let params = {}
  if (req.body.displayTo !== undefined) params.display_to = parseInt(req.body.displayTo)
  if (req.body.message !== undefined) params.message = req.body.message
  params.created_at = Math.floor(new Date().getTime() /1000)
  AdminService.announce(params).then(msg => {
    AnnouncementSystem.addMessage(msg)
    res.send({
      success: true
    })
  }).catch(error => {
    console.error(error)
    res.send({
      success: false,
      error: error.message
    })
  })
})

module.exports = router
