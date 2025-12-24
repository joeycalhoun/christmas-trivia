export function SoftChristmasLights() {
  return (
    <>
      <div className="christmas-lights-soft">
        <div className="light-wire" />
        {Array.from({ length: 28 }).map((_, i) => (
          <div
            key={i}
            className={`light-bulb ${['light-red', 'light-green', 'light-gold', 'light-blue', 'light-purple'][i % 5]}`}
            style={{ left: `${2 + i * 3.4}%`, animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
      <div className="christmas-lights-soft-bottom">
        <div className="light-wire-bottom" />
        {Array.from({ length: 28 }).map((_, i) => (
          <div
            key={i}
            className={`light-bulb-bottom ${['light-purple', 'light-blue', 'light-gold', 'light-green', 'light-red'][i % 5]}`}
            style={{ left: `${2 + i * 3.4}%`, animationDelay: `${i * 0.12 + 0.5}s` }}
          />
        ))}
      </div>
    </>
  )
}


