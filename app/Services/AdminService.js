import {AuctionConfigs} from '../Models'
import autoBind from 'auto-bind'

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
}

let instance = new AdminService()
module.exports = instance
