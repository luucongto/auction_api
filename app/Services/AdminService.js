import {AuctionConfigs} from '../Models'
import autoBind from 'auto-bind'
import AuctionBot from '../Bot/AuctionBot'
class AdminService {
  constructor () {
    autoBind(this)
  }

  get () {
    return AuctionConfigs.findAll().then(configs => {
      let result = {}
      configs.forEach(element => {
        let config = element.get()
        result[config.key] = config.value
      })
      return result
    })
  }

  post (params) {
    console.log(params)
    let funcs = Object.keys(params).map(key => {
      return AuctionConfigs.update({value: params[key]}, {where: {key: key}})
    })
    return Promise.all(funcs).then(updatedConfigs => {
      AuctionBot.restart()
      return this.get()
    })
  }
}

let instance = new AdminService()
module.exports = instance
