import {Notices} from '../Models'
import autoBind from 'auto-bind'
import {Op} from 'sequelize'
class NoticeService {
  constructor () {
    autoBind(this)
  }
  get () {
    let now = Math.floor(new Date().getTime() / 1000)
    return Notices.findAll({
      where: {
        start_at: {[Op.lte]: now}
      }
    }).then(notices => {
      let result = []
      notices.forEach(element => {
        let notice = element.get()
        result.push(notice)
      })
      return result
    })
  }
  getAdmin () {
    return Notices.findAll().then(notices => {
      let result = []
      notices.forEach(element => {
        let notice = element.get()
        result.push(notice)
      })
      return result
    })
  }

  post (params) {
    let self = this
    return Notices.create(params).then(notice => {
      return self.getAdmin()
    })
  }
}

let instance = new NoticeService()
module.exports = instance
