import { EventEmitter } from 'node:events'

export function createBus() {
    const ee = new EventEmitter()
    ee.setMaxListeners(0)
    return {
        publish(type, data) {
            ee.emit('event', { type, data })
        },
        subscribe(fn) {
            ee.on('event', fn)
            return () => ee.off('event', fn)
        },
    }
}
