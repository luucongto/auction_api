import {User} from '../Models'
import autoBind from 'auto-bind'
import bcrypt from 'bcrypt'
class UserService {
  constructor () {
    autoBind(this)
  }

  post (params) {
    return User.findById(params.userId).then(user => {
      if (user) {
        user.password = bcrypt.hashSync(params.password, 10)
        return user.save()
      }
      return null
    })
  }
}

let instance = new UserService()
module.exports = instance
