import {Notices} from '../Models'
import autoBind from 'auto-bind'
class NoticeService {
  constructor () {
    autoBind(this)
  }

  get () {
    return Notices.findAll().then(notices => {
      let result = []
      notices.forEach(element => {
        let notice = element.get()
        result.push(notice)
      })
      return result
    })
  }
}

let instance = new NoticeService()
module.exports = instance
