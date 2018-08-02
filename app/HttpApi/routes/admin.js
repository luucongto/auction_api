
import passport from 'passport'
import AdminService from '../../Services/AdminService'
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

module.exports = router
