const pad = (n: number) => String(n).padStart(2, '0')

export function FlapClock({ now }: { now: Date }) {
  const digits = `${pad(now.getHours())}${pad(now.getMinutes())}`
  return (
    <div className="flap" role="img" aria-label={`Pukul ${digits.slice(0, 2)}.${digits.slice(2)} WIB`}>
      {[...digits].map((digit, index) => (
        <span key={`${index}-${digit}`} className={`flap-tile${index === 2 ? ' flap-gap' : ''}`}>
          {digit}
        </span>
      ))}
      <small>WIB</small>
    </div>
  )
}
