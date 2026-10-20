import { openSync, writeSync, closeSync, readFileSync, unlinkSync } from 'node:fs'

const alive = (pid) => {
    try {
        process.kill(pid, 0)
        return true
    } catch {
        return false
    }
}

export function acquireLock(path) {
    try {
        const fd = openSync(path, 'wx')
        writeSync(fd, String(process.pid))
        closeSync(fd)
    } catch (e) {
        if (e.code !== 'EEXIST') throw e
        const pid = Number(readFileSync(path, 'utf8'))
        if (pid && alive(pid)) throw new Error(`capture already running (pid ${pid})`)
        unlinkSync(path)
        return acquireLock(path)
    }
    return () => {
        try {
            unlinkSync(path)
        } catch {}
    }
}
