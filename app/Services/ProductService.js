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
  getAdmin (params) {
    console.log(params)
    return Products.findAll({
      where: {
        status: 'finished',
        updated_at: {
          [Op.gte] : params.updated_at || '0'
        }
      },
      order: [
        ['updated_at', 'desc']
      ],
    }).then(products => {
      let userIds = products.map(product=> product.winner_id)
      userIds = underscore.uniq(userIds)
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
    return Products.findAll({
      where: {
        status: 'finished'
      },
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
