import MSSQL from 'msnodesqlv8'
import { HttpError } from 'flaska'
import { HttpErrorInternal } from './error.mjs'

export function initPool(core, config) {
  let pool = new MSSQL.Pool(config)

  core.log.info(config, 'MSSQL database setttings')

  pool.on('open', function() { 
    core.log.info('MSSQL connection open')
  })

  core.log.info('Attempting to connect to MSSQL server')
  pool.open()

  // const sp = pool.procedureMgr()

  return {
    safeCallProc: function(name, params, options) {
      if (name.indexOf('.') < 0) {
        name = 'common.' + name
      }
      return pool.promises.callProc(name, params, options)
        .catch(function(err) {
          let message = err.message.replace(/\[[^\]]+\]/g, '')
          if (err.code > 50000) {
            if (err.code === 51001) {
              throw new HttpError(403, message)
            }
            throw new HttpError(422, message)
          }
          if (err.lineNumber && err.procName) {
            message = `Error at ${err.procName}:${err.lineNumber} => ${message}`
          }
          throw new HttpErrorInternal(message, err, !err.lineNumber ? {
            name,
            params
          } : null)
        })
    },
    promises: pool.promises,
  }
}