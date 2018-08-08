import {Products, ProductImages} from '../Models'
import autoBind from 'auto-bind'
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
  getSelling () {
    return Products.findAll({
      where: {
        status: {
          [Op.in]: ['bidding', 'waiting']
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
  getSold (page = 0) {
    console.log(page)
    return Products.findAll({
      where: {
        status: 'finished'
      },
      order: [
        ['updatedAt', 'desc']
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
    return Products.update(params, {
      where: {id: id}
    }).then(result => {
      return result
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
}

module.exports = ProductService
