'use strict'

const net = require('net')
const toPull = require('stream-to-pull-stream')
const mafmt = require('mafmt')
const withIs = require('class-is')
const includes = require('lodash.includes')
const isFunction = require('lodash.isfunction')
const Connection = require('interface-connection').Connection
const once = require('once')
const debug = require('debug')
const log = debug('libp2p:tcp:dial')

const createListener = require('./listener')

function noop () {}

/**
 *
 */
class TCP {
  /**
   * Dial to another peer.
   *
   * @param {Multiaddr} ma - The address of the peer we want to dial to.
   * @param {Object} [options={}]
   * @param {function(Error?, Array<Multiaddr>?)} [callback]
   * @returns {Connection}
   */
  dial (ma, options, callback) {
    if (isFunction(options)) {
      callback = options
      options = {}
    }

    callback = once(callback || noop)

    const cOpts = ma.toOptions()
    log('Connecting to %s %s', cOpts.port, cOpts.host)

    const rawSocket = net.connect(cOpts)

    rawSocket.once('timeout', () => {
      log('timeout')
      rawSocket.emit('error', new Error('Timeout'))
    })

    rawSocket.once('error', callback)

    rawSocket.once('connect', () => {
      rawSocket.removeListener('error', callback)
      callback()
    })

    const socket = toPull.duplex(rawSocket)

    const conn = new Connection(socket)

    conn.getObservedAddrs = (callback) => {
      return callback(null, [ma])
    }

    return conn
  }

  /**
   * Listen for incoming `TCP` connetions.
   *
   * @param {Object} [options={}]
   * @param {function(Connection)} [handler] - Called with newly incomin connections.
   * @returns {Listener}
   */
  createListener (options, handler) {
    if (isFunction(options)) {
      handler = options
      options = {}
    }

    handler = handler || noop

    return createListener(handler)
  }

  /**
   * Filter a list of multiaddrs for those which contain
   * valid `TCP` addresses.
   *
   * @param {Multiaddr|Array<Multiaddr>} multiaddrs
   * @returns {Array<Multiaddr>}
   */
  filter (multiaddrs) {
    if (!Array.isArray(multiaddrs)) {
      multiaddrs = [multiaddrs]
    }

    return multiaddrs.filter((ma) => {
      if (includes(ma.protoNames(), 'p2p-circuit')) {
        return false
      }

      if (includes(ma.protoNames(), 'ipfs')) {
        ma = ma.decapsulate('ipfs')
      }

      return mafmt.TCP.matches(ma)
    })
  }
}

module.exports = withIs(TCP, { className: 'TCP', symbolName: '@libp2p/js-libp2p-tcp/tcp' })
