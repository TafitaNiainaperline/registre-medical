import { useSuggestionInput } from './useSuggestionInput'
import './SuggestionInput.scss'

type Props = {
  value: string
  suggestions: string[]
  onChange?: (value: string) => void
  placeholder?: string
  id?: string
}

const SuggestionInput = ({ value, suggestions, onChange, placeholder, id }: Props) => {
  const { open, query, filtered, wrapperRef, inputRef, select, change, focus } =
    useSuggestionInput(value, suggestions, onChange)

  return (
    <div className="SuggestionInput" ref={wrapperRef}>
      <input
        ref={inputRef}
        id={id}
        value={query}
        placeholder={placeholder}
        onChange={change}
        onFocus={focus}
        autoComplete="off"
      />

      {open && filtered.length > 0 && (
        <div className="dropdown">
          {filtered.map((item) => (
            <div key={item} className="option" onMouseDown={() => select(item)}>
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SuggestionInput
