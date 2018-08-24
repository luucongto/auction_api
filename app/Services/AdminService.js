import {AuctionConfigs, Announcement} from '../Models'
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
      return AuctionConfigs.findOrCreate({where: {key: key}, defaults: {value: params[key]}})
          .spread((config, created) => {
            if (!created) {
              config.value = params[key]
              return config.save()
            }
            return config
          })
    })
    return Promise.all(funcs).then(configs => {
      AuctionBot.restart()
      return configs
    })
  }
  announce (params) {
    return Announcement.create(params)
  }
}

let instance = new AdminService()
module.exports = instance
