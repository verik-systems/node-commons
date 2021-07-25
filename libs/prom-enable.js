'use strict'

/**
 * @param {Object} app - Loopback/Express application
 * @param {Map} promRemoteMethodRouteMap a hashmap of remote method - prom tag
 * @param {Array} ignoreModels an array of models to be ignore
 *
 * With all remote methods of all models, except the ones in ignoreModels, for
 * each remote method in promRemoteMethodRouteMap, inject { prom: { route: value }
 * to ctx.req before the remote method called.
 *
 * Example: promRemoteMethodRouteMap = {'device.createDeviceCredential':
 * '/api/devices', 'service.prototype.getHistory':
 * '/api/services/#val/histories', 'service.prototype.createHeartbeat':
 * '/api/services/#val/heartbeats'
 * }
 */
function promEnable (app, promRemoteMethodRouteMap, ignoreModels) {
  const modelNames = []
  const defaultIgnoreModels = ['AccessToken', 'ACL', 'Role', 'RoleMapping']

  const finalIgnoreModels = ignoreModels || defaultIgnoreModels

  Object.keys(app.models).forEach(modelName => {
    const existing = modelNames.find(item => {
      return item.toLowerCase() === modelName.toLowerCase()
    })
    if (existing) {
      return
    }
    if (finalIgnoreModels.indexOf(modelName) >= 0) {
      return
    }

    modelNames.push(modelName)
  })

  const injectReqProm = async function (ctx) {
    const route = promRemoteMethodRouteMap[ctx.req.remotingContext.methodString]
    if (route) {
      ctx.req.prom = { route }
    }
  }

  modelNames.forEach(modelName => {
    const model = app.models[modelName]

    model.afterRemote('**', injectReqProm)
    model.afterRemoteError('**', injectReqProm)
  })
}

module.exports = promEnable
