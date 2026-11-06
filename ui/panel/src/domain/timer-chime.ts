// One quiet, ascending glass chime. The context is opened by a user gesture,
// reused for subsequent timers, and closed when this dashboard is unmounted.
export function createTimerChime() {
  let context: AudioContext | null = null
  return {
    async prepare() {
      try {
        context ??= new AudioContext()
        if (context.state === "suspended") await context.resume()
      } catch {
        // The visual timer still completes when audio is unavailable.
      }
    },
    play() {
      if (!context || context.state !== "running") return
      const start = context.currentTime + 0.02
      for (const [index, frequency] of [523.25, 659.25, 783.99].entries()) {
        const time = start + index * 0.14
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = "sine"
        oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(0, time)
        gain.gain.linearRampToValueAtTime(0.075, time + 0.012)
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.15)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.onended = () => {
          oscillator.disconnect()
          gain.disconnect()
        }
        oscillator.start(time)
        oscillator.stop(time + 1.2)
      }
    },
    dispose() {
      const previous = context
      context = null
      if (previous && previous.state !== "closed")
        void previous.close().catch(() => {})
    },
  }
}
