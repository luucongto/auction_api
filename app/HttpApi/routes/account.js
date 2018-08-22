
import passport from 'passport'
import ProductService from '../../Services/ProductService'
import UserService from '../../Services/UserService'
var express = require('express')
var router = express.Router()

router.get('/all', [passport.authenticate('jwt')], (req, res, next) => {
  let service = new ProductService(req.user.id)
  service.getWinner(req.user.id).then(products => {
    res.send({
      success: true,
      data: products
    })
  }).catch(error => {
    console.error(error)
    res.send({
      success: false,
      error: error.message
    })
  })
})
router.post('/setting', [passport.authenticate('jwt')], (req, res, next) => {
  console.log('post setting')
  let params = {
    password: req.body.password,
    userId: req.user.id
  }
  let service = new ProductService(req.user.id)
  UserService.post(params).then(result => {
    return service.getWinner(req.user.id)
  }).then(products => {
    res.send({
      success: true,
      data: products
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
