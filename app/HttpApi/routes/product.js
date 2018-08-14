
import passport from 'passport'
import ProductService from '../../Services/ProductService'
import multer from 'multer'
import fs from 'fs'
import AuctionBot from '../../Bot/AuctionBot'
var XLSX = require('xlsx')
var express = require('express')
var router = express.Router()

const storage = multer.diskStorage({
  destination: './files',
  filename (req, file, cb) {
    cb(null, `${new Date()}-${file.originalname}`)
  }
})

const upload = multer({ storage })

let verifyAdmin = (req, res, next) => {
  if (req.user.role === 'admin') {
    next()
  } else {
    res.send(401)
  }
}
let verifySeller = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'seller') {
    next()
  } else {
    res.send(401)
  }
}
// router.get('/all', [passport.authenticate('jwt')], (req, res, next) => {
//   let service = new ProductService(req)
//   service.getAll().then(products => {
//     res.send({
//       success: true,
//       data: products
//     })
//   }).catch(error => {
//     console.error(error)
//     res.send({
//       success: false,
//       error: error.message
//     })
//   })
// })

router.get('/seller', [passport.authenticate('jwt'), verifySeller], (req, res, next) => {
  let service = new ProductService(req)
  service.getSoldProductForSeller(req.query).then(notices => {
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

router.post('/import', [passport.authenticate('jwt'), verifySeller, upload.single('file')], (req, res, next) => {
  const file = req.file // file passed from client
  console.log(file)
  try {
    var workbook = XLSX.readFile(file.path)
  } catch (e) {
    console.error(e)
  }

  let service = new ProductService(req)
  service.import(workbook, req.user.id).then(products => {
    products.forEach(product => {
      AuctionBot._addProductToQueue(product)
    })
    AuctionBot._broadCastToAuctionRoom([products])
    res.send({
      success: true,
      data: products
    })
    fs.unlink(file.path, function (error) {
      console.log(error)
    })
  }).catch(error => {
    console.error('import', error)
    res.send({
      success: false,
      error: error.message
    })
    fs.unlink(file.path)
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
