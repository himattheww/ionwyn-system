import type { InputHTMLAttributes } from 'react'

const typed = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string
  onChange: (value: string) => void
}

export function TimeField({ value, onChange, ...rest }: Props) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={5}
      placeholder={rest.placeholder ?? '06:00'}
      pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
      title="Format jam 24, misal 06:30"
      value={value}
      onChange={(e) => onChange(typed(e.target.value))}
    />
  )
}
