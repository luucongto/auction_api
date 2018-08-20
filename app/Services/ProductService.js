import {Products, ProductImages, User} from '../Models'
import autoBind from 'auto-bind'
import {Op} from 'sequelize'
import Const from '../config/config'
class ProductService {
  constructor () {
    autoBind(this)
  }

  get (id) {
    return Products.findById(id).then(product => {
      if (!product) return
      return ProductImages.findAll({
        where: {
          product_id: id
        }
      }).then(images => {
        product = product.get()
        product.images = images
        return product
      })
    })
  }
  getAll () {
    return Products.findAll().then(products => {
      let queries = products.map(product => {
        return ProductImages.findAll({
          where: {
            product_id: product.id
          }
        }).then(images => {
          let prod = product.get()
          prod.images = images
          return prod
        })
      })
      return Promise.all(queries).then(ps => {
        return ps
      })
    })
  }
  getProductsBySeller (sellerId) {
    return Products.findAll({
      where: {
        seller_id: sellerId,
        status: {
          [Op.in]: [Const.PRODUCT_STATUS.WAITING, Const.PRODUCT_STATUS.AUCTIONING]
        }
      }
    }).then(products => {
      let queries = products.map(product => {
        return ProductImages.findAll({
          where: {
            product_id: product.id
          }
        }).then(images => {
          let prod = product.get()
          prod.images = images
          return prod
        })
      })
      return Promise.all(queries).then(ps => {
        return ps
      })
    })
  }

  botGetSelling () {
    return Products.findAll({
      where: {
        status: {
          [Op.in]: [Const.PRODUCT_STATUS.BIDDING, Const.PRODUCT_STATUS.AUCTIONING, Const.PRODUCT_STATUS.WAITING]
        }
      },
      order: [
        ['start_at', 'asc']
      ]
    }).then(products => {
      let queries = products.map(product => {
        return ProductImages.findAll({
          where: {
            product_id: product.id
          }
        }).then(images => {
          let prod = product.get()
          prod.images = images
          return prod
        })
      })
      return Promise.all(queries).then(ps => {
        return ps
      })
    })
  }
  getSoldProductForSeller (params) {
    console.log(params)
    let queries = {
      status: Const.PRODUCT_STATUS.FINISHED
    }
    if (params.userId) {
      queries.seller_id = params.userId
    }
    return Products.findAll({
      where: {
        status: Const.PRODUCT_STATUS.FINISHED,
        updated_at: {
          [Op.gte]: params.updated_at || '0'
        }
      },
      order: [
        ['updated_at', 'desc']
      ]
    }).then(products => {
      return User.findAll().then(users => {
        let userDbs = {}
        users.forEach(user => {
          userDbs[user.id] = user.get()
        })
        let result = products.map(product => {
          let p = product.get()
          let user = userDbs[product.winner_id] || {}
          p.seller_name = userDbs[product.seller_id] ? userDbs[product.seller_id].name : ''
          p.user_name = user.name || ''
          p.user_email = user.email || ''
          return p
        })
        return result
      })
    })
  }
  getSold (page = 0) {
    let queries = {
      status: Const.PRODUCT_STATUS.FINISHED
    }

    return Products.findAll({
      where: queries,
      order: [
        ['updated_at', 'desc']
      ],
      offset: page * 20,
      limit: 20
    }).then(products => {
      let queries = products.map(product => {
        return ProductImages.findAll({
          where: {
            product_id: product.id
          }
        }).then(images => {
          let prod = product.get()
          prod.images = images
          return prod
        })
      })
      return Promise.all(queries).then(ps => {
        return ps
      })
    })
  }
  getWinner (userId) {
    return Products.findAll({
      where: {
        winner_id: userId
      }
    }).then(products => {
      let result = {}
      products.forEach(product => {
        result[product.id] = product.get()
      })
      return {products: result}
    })
  }

  update (id, params) {
    return User.findById(params.user_id).then(user => {
      if (user.role === 'seller' || user.role === 'admin') {
        return Products.findById(params.id).then(product => {
          if (!product || (product.status !== Const.PRODUCT_STATUS.WAITING && product.status !== Const.PRODUCT_STATUS.AUCTIONING)) {
            return new Error('Unauthorized!!! Product cannot be edited!!!')
          }
          if (user.role !== 'admin' && product.seller_id !== params.user_id) return new Error('Unauthorized')
          if (params.name !== undefined) product.name = params.name
          if (params.ams_code !== undefined) product.ams_code = params.ams_code
          if (params.start_at !== undefined) product.start_at = parseInt(params.start_at)
          if (params.start_price !== undefined) product.start_price = parseInt(params.start_price)
          if (params.step_price !== undefined) product.step_price = parseInt(params.step_price)
          if (params.round_time_1 !== undefined) product.round_time_1 = parseInt(params.round_time_1)
          if (params.round_time_2 !== undefined) product.round_time_2 = parseInt(params.round_time_2)
          if (params.round_time_3 !== undefined) product.round_time_3 = parseInt(params.round_time_3)
          if (params.auto_start !== undefined) product.auto_start = !!params.auto_start
          if (params.status && params.status === Const.PRODUCT_STATUS.REMOVED) product.status = params.status
          let func = [product.save()]
          if (params.images) {
            console.log(params.images)
            func.push(ProductImages.findAll({
              where: {
                product_id: product.id
              }
            }).then(images => {
              let updateFuncs = images.map((image, index) => {
                if (params.images.length < index) {
                  return image.destroy()
                } else {
                  image.src = params.images[index].src
                  image.caption = params.images[index].caption
                  return image.save()
                }
              })
              for (var i = images.length; i < params.images.length; i++) {
                if (params.images[i].src.length && params.images[i].caption.length) {
                  updateFuncs.push(ProductImages.create({
                    product_id: product.id,
                    src: params.images[i].src,
                    caption: params.images[i].caption
                  }))
                }
              }
              return Promise.all(updateFuncs)
            }))
          }
          return Promise.all(func)
        }).then(result => {
          if (!result || !result.length) {
            console.log('update error', id, params, result)
            return result
          }
          let product = result[0].get()
          product.images = result[1]
          return product// self.get(params.id)
        })
      } else {
        return new Error('Unauthorized')
      }
    })
  }

  import (workbook, sellerId) {
    let productWorksheet = workbook.Sheets['products']
    let productImgWorkSheet = workbook.Sheets['product_images']
    let productParams = []
    let productImgs = {}
    let self = this
    let now = Math.floor(new Date().getTime() / 1000)
    for (var i = 2; productWorksheet[`A${i}`] && productWorksheet[`A${i}`].v; i++) {
      try {
        productParams.push({
          req_id: productWorksheet[`A${i}`].v,
          name: productWorksheet[`B${i}`].v,
          category: productWorksheet[`C${i}`].v,
          ams_code: productWorksheet[`D${i}`].v,
          start_at: Math.floor(new Date(productWorksheet[`E${i}`].w + ' GMT +07').getTime() / 1000),
          start_price: parseInt(productWorksheet[`F${i}`].v),
          step_price: parseInt(productWorksheet[`G${i}`].v),
          round_time_1: parseInt(productWorksheet[`H${i}`].v),
          round_time_2: parseInt(productWorksheet[`I${i}`].v),
          round_time_3: parseInt(productWorksheet[`J${i}`].v),
          auto_start: !!(productWorksheet[`K${i}`] && productWorksheet[`K${i}`].v === 'true'),
          status: Const.PRODUCT_STATUS.WAITING,
          created_at: now,
          seller_id: sellerId
        })
      } catch (e) {
        console.error(i, e)
      }
    }
    for (i = 2; productImgWorkSheet[`A${i}`] && productImgWorkSheet[`A${i}`].v; i++) {
      try {
        let pId = productImgWorkSheet[`A${i}`].v
        if (!productImgs[pId]) {
          productImgs[pId] = []
        }
        let captions = productImgWorkSheet[`C${i}`].v.split('\n')
        captions.forEach(caption => {
          productImgs[pId].push({
            product_id: productImgWorkSheet[`A${i}`].v,
            src: productImgWorkSheet[`B${i}`].v,
            caption: caption
          })
        })
      } catch (e) {
        console.error(i, e)
      }
    }
    let creates = productParams.map(p => {
      return Products.create(p).then(productObj => {
        let product = productObj.get()
        product.images = []
        if (productImgs[p.req_id]) {
          let imgs = productImgs[p.req_id].map(img => {
            img.product_id = product.id
            return img
          })
          return ProductImages.bulkCreate(imgs).then(() => {
            product.images = imgs
            return product
          })
        } else {
          return product
        }
      })
    })
    return Promise.all(creates).then(() => {
      return self.getProductsBySeller(sellerId)
    })
  }
}

module.exports = ProductService
