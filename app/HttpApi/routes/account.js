
import passport from 'passport'
import ProductService from '../../Services/ProductService'
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
    console.log(error)
    res.send({
      success: false,
      error: error.message
    })
  })
})

module.exports = router
