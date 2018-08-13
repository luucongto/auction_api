import {Products, ProductImages, User} from '../Models'
import autoBind from 'auto-bind'
import underscore from 'underscore'
import {Op} from 'sequelize'
class ProductService {
  constructor (userId) {
    this.userId = userId
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
        status: 'waiting'
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
          [Op.in]: ['bidding', 'waiting']
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
      status: 'finished'
    }
    if (params.userId) {
      queries.seller_id = params.userId
    }
    return Products.findAll({
      where: {
        status: 'finished',
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
      status: 'finished'
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
          if (product.seller_id !== params.user_id) return {success: false, msg: 'Unauthorized'}
          product.name = params.name
          product.ams_code = params.ams_code
          product.start_at = parseInt(params.start_at)
          product.start_price = parseInt(params.start_price)
          product.step_price = parseInt(params.step_price)
          product.round_time_1 = parseInt(params.round_time_1)
          product.round_time_2 = parseInt(params.round_time_2)
          product.round_time_3 = parseInt(params.round_time_3)
          return Promise.all([
            product.save(),
            ProductImages.findAll({
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
                  updateFuncs.push(ProductImages.create(params.images[i]))
                }
              }
              return Promise.all(updateFuncs)
            })
          ])
        }).then(result => {
          return result
        })
      } else {
        return {success: false, msg: 'Unauthorized'}
      }
    })
  }
  destroy (id, userId) {
    return User.findById(userId).then(user => {
      if (user.role === 'seller' || user.role === 'admin') {
        return Products.findById(id).then(product => {
          if (product.seller_id !== userId) return {success: false, msg: 'Unauthorized'}
          return Promise.all([
            product.destroy(),
            ProductImages.findAll({
              where: {
                product_id: product.id
              }
            }).then(images => {
              let updateFuncs = images.map((image, index) => {
                return image.destroy()
              })
              return Promise.all(updateFuncs)
            })
          ])
        }).then(result => {
          return result
        })
      } else {
        return {success: false, msg: 'Unauthorized'}
      }
    })
  }
  create (params) {
    return Products.create(params).then(product => {
      if (params.images.length === 0) return product

      let data = params.images.map(e => {
        return {
          product_id: product.id,
          image_path: e
        }
      })
      return ProductImages.bulkCreate(data).then(images => {
        product.images = images
        return product
      })
    })
  }
  import (workbook, sellerId) {
    let productWorksheet = workbook.Sheets['products']
    let productImgWorkSheet = workbook.Sheets['product_images']
    let productParams = []
    let productImgs = {}
    let self = this
    for (var i = 2; productWorksheet[`A${i}`] && productWorksheet[`A${i}`].v; i++) {
      try {
        productParams.push({
          req_id: productWorksheet[`A${i}`].v,
          name: productWorksheet[`B${i}`].v,
          category: productWorksheet[`C${i}`].v,
          ams_code: productWorksheet[`D${i}`].v,
          start_at: Math.floor(new Date(productWorksheet[`E${i}`].w).getTime() / 1000),
          start_price: parseInt(productWorksheet[`F${i}`].v),
          step_price: parseInt(productWorksheet[`G${i}`].v),
          round_time_1: parseInt(productWorksheet[`H${i}`].v),
          round_time_2: parseInt(productWorksheet[`I${i}`].v),
          round_time_3: parseInt(productWorksheet[`J${i}`].v),
          status: 'waiting',
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
        productImgs[pId].push({
          product_id: productImgWorkSheet[`A${i}`].v,
          src: productImgWorkSheet[`B${i}`].v,
          caption: productImgWorkSheet[`C${i}`].v
        })
      } catch (e) {
        console.error(i, e)
      }
    }
    let creates = productParams.map(p => {
      return Products.create(p).then(product => {
        if (productImgs[p.req_id]) {
          let imgs = productImgs[p.req_id].map(img => {
            img.product_id = product.id
            return img
          })
          return ProductImages.bulkCreate(imgs).then(() => {
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
