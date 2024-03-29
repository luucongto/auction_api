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
          [Op.in]: [Const.PRODUCT_STATUS.HIDE, Const.PRODUCT_STATUS.WAITING, Const.PRODUCT_STATUS.AUCTIONING]
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
        let products = {}
        ps.forEach(p => products[p.id] = p)
        return {products}
      })
    })
  }

  update (params) {
    return User.findById(params.user_id).then(user => {
      if (user.role === 'seller' || user.role === 'admin') {
        return Products.findById(params.id).then(product => {
          if (!product) {
            return new Error(`Unauthorized!!! Product is not existed!!!`)
          } else if ((product.status !== Const.PRODUCT_STATUS.WAITING && product.status !== Const.PRODUCT_STATUS.AUCTIONING && product.status !== Const.PRODUCT_STATUS.HIDE)) {
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
          if (params.status !== undefined && (params.status === Const.PRODUCT_STATUS.HIDE || params.status === Const.PRODUCT_STATUS.WAITING)) product.status = params.status
          console.log('Update', JSON.stringify(params.id), JSON.stringify(params))
          let func = [product.save()]
          if (params.images) {
            params.images = params.images.filter(image => image.src.length || image.caption.length)
            func.push(ProductImages.findAll({
              where: {
                product_id: product.id
              }
            }).then(images => {
              let updateFuncs = images.map((image, index) => {
                if (params.images.length < index + 1) {
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
            console.log('update error', params.id, params, result)
            return result
          }
          let product = result[0].get()
          return this.get(product.id)
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
        let startAt = productWorksheet[`E${i}`] ? new Date(productWorksheet[`E${i}`].w + ' GMT +07').getTime() : 1890691200000
        productParams.push({
          req_id: productWorksheet[`A${i}`].v,
          name: productWorksheet[`B${i}`].v,
          category: productWorksheet[`C${i}`].v,
          ams_code: productWorksheet[`D${i}`].v.trim().replace('\n', ' ').replace('\r\n', ' '),
          start_at: Math.floor(startAt / 1000),
          start_price: parseInt(productWorksheet[`F${i}`].v),
          step_price: parseInt(productWorksheet[`G${i}`].v),
          round_time_1: parseInt(productWorksheet[`H${i}`].v),
          round_time_2: parseInt(productWorksheet[`I${i}`].v),
          round_time_3: parseInt(productWorksheet[`J${i}`].v),
          auto_start: !!(productWorksheet[`K${i}`] && productWorksheet[`K${i}`].v === 'true'),
          status: Const.PRODUCT_STATUS.HIDE,
          user_id: sellerId,
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
    console.log('importing', productParams.length)
    let creates = productParams.map(p => {
      return Products.findOne({
        where: {
          ams_code: p.ams_code
        }
      }).then(pObj => {
        if (pObj) {
          if (pObj.seller_id === p.seller_id && (pObj.status === Const.PRODUCT_STATUS.HIDE || pObj.status === Const.PRODUCT_STATUS.WAITING || pObj.status === Const.PRODUCT_STATUS.AUCTIONING)) {
            p.images = productImgs[p.req_id]
            p.id = pObj.id
            p.status = undefined
            return self.update(p)
          } else {
            return pObj
          }
        } else {
          console.log('Insert', p.ams_code)
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
        }
      })
      .catch(error => {
        console.log('error in import', error)
      })
    })
    return Promise.all(creates).then(() => {
      console.log('Import success for Seller', sellerId)
      return self.getProductsBySeller(sellerId)
    }).catch(error => {
      console.error('error', error)
      return []
    })
  }
}

module.exports = ProductService
