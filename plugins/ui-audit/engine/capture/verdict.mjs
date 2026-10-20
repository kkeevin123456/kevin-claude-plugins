// Decides whether a finished capture may become the latest run: an empty or badly shrunken run
// (broken ref, mock or login) would otherwise hide every screen and refuse all new notes.
export function runVerdict({ count, previousCount }) {
    if (count === 0) return { status: 'failed', reason: 'no states were captured (0 uploaded)' }
    if (previousCount && count < previousCount / 2) {
        return { status: 'failed', reason: `only ${count} states captured, fewer than half of the previous run's ${previousCount}` }
    }
    return { status: 'done', reason: '' }
}
