
import passport from 'passport'
import NoticeService from '../../Services/NoticeService'
var express = require('express')
var router = express.Router()
let verifyAdmin = (req, res, next) => {
  if (req.user.role === 'admin') {
    next()
  } else {
    res.send(401)
  }
}
router.get('/all', [passport.authenticate('jwt')], (req, res, next) => {
  NoticeService.get().then(notices => {
    res.send({
      success: true,
      data: notices
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
