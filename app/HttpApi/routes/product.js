
import passport from 'passport'
import ProductService from '../../Services/ProductService'
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
  let service = new ProductService(req)
  service.getAll().then(products => {
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
router.get('/sold', [passport.authenticate('jwt')], (req, res, next) => {
  let service = new ProductService(req)
  service.getSold(req.query.page || 0).then(products => {
    console.log('page', req.query.page, 'products', products.length)
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
router.get('/:id', [passport.authenticate('jwt')], (req, res, next) => {
  let service = new ProductService(req)
  service.get(req.params.id).then(products => {
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

router.put('/:id', [passport.authenticate('jwt'), verifyAdmin], (req, res, next) => {
  let service = new ProductService(req)
  service.update(req.params.id, req.body).then(products => {
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

router.post('/create', [passport.authenticate('jwt'), verifyAdmin], (req, res, next) => {
  let service = new ProductService(req)
  service.create(req.body).then(products => {
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
